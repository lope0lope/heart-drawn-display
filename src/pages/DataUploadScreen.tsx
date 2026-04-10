import { useState, useCallback } from 'react';
import { exportLiveCrocs, exportInspectionHistory } from '@/lib/exportData';
import { useUploadLogs } from '@/hooks/useFeedData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface ParsedRow {
  tag: string;
  pen_id: string;
  line: string;
  pen_slot: number;
  belly_cm: number | null;
  grade: number | null;
  condition_codes: string[];
  inspection_date: string;
}

interface ValidationResult {
  ok: boolean;
  text: string;
}

export default function DataUploadScreen() {
  const [penFilter, setPenFilter] = useState<string>('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [importing, setImporting] = useState(false);
  const { data: uploadHistory, refetch: refetchLogs } = useUploadLogs();

  const parseFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setParsedRows([]);
    setValidations([]);

    let rawRows: Record<string, any>[] = [];

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(sheet);
    } else {
      const text = await file.text();
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      rawRows = result.data as Record<string, any>[];
    }

    // Map columns (flexible header matching)
    const colMap = (row: Record<string, any>, keys: string[]): string => {
      for (const k of keys) {
        const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
        if (val !== undefined && val !== null) return String(val).trim();
      }
      return '';
    };

    const requiredCols = ['tag', 'tag_id', 'pen_id', 'pen', 'line', 'row'];
    const firstRow = rawRows[0] ?? {};
    const headerKeys = Object.keys(firstRow).map(k => k.toLowerCase());
    const missingRequired = ['tag', 'pen', 'line'].filter(
      needed => !headerKeys.some(h => h.includes(needed))
    );

    const rows: ParsedRow[] = rawRows.map(r => ({
      tag: colMap(r, ['tag', 'tag_id', 'Tag', 'TAG']),
      pen_id: colMap(r, ['pen_id', 'pen', 'Pen', 'PEN']),
      line: colMap(r, ['line', 'row', 'Line', 'Row', 'ROW']),
      pen_slot: parseInt(colMap(r, ['pen_slot', 'slot', 'col', 'Pen_Slot', 'Col'])) || 0,
      belly_cm: parseFloat(colMap(r, ['belly_cm', 'size_cm', 'size', 'Belly_cm', 'Size'])) || null,
      grade: parseInt(colMap(r, ['grade', 'Grade'])) || null,
      condition_codes: colMap(r, ['condition_codes', 'conditions', 'conds', 'Condition_Codes'])
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(Boolean),
      inspection_date: colMap(r, ['inspection_date', 'date', 'Inspection_Date', 'Date']) || new Date().toISOString().slice(0, 10),
    })).filter(r => r.tag);

    // Validation
    const vResults: ValidationResult[] = [];
    vResults.push({ ok: true, text: `${rows.length} records parsed successfully` });
    vResults.push({
      ok: missingRequired.length === 0,
      text: missingRequired.length === 0 ? 'All required columns present' : `Missing columns: ${missingRequired.join(', ')}`,
    });

    const tags = rows.map(r => r.tag);
    const dupes = tags.filter((t, i) => tags.indexOf(t) !== i);
    vResults.push({
      ok: dupes.length === 0,
      text: dupes.length === 0 ? '0 duplicate tag IDs' : `${new Set(dupes).size} duplicate tag IDs found`,
    });

    const outOfRange = rows.filter(r => r.belly_cm !== null && (r.belly_cm < 10 || r.belly_cm > 100));
    vResults.push({
      ok: outOfRange.length === 0,
      text: outOfRange.length === 0 ? 'All sizes within valid range' : `${outOfRange.length} records with unusual size values`,
    });

    const noSlot = rows.filter(r => r.pen_slot === 0);
    if (noSlot.length > 0) {
      vResults.push({ ok: false, text: `${noSlot.length} records missing pen_slot — will auto-assign` });
    }

    setParsedRows(rows);
    setValidations(vResults);
  }, []);

  const handleImport = useCallback(async () => {
    if (!parsedRows.length) return;
    setImporting(true);
    let warnings = 0;

    try {
      // Upsert crocs
      const crocPayloads = parsedRows.map(r => ({
        tag: r.tag,
        pen_id: r.pen_id,
        line: r.line,
        pen_slot: r.pen_slot,
        belly_cm: r.belly_cm,
        grade: r.grade,
        condition_codes: r.condition_codes,
        inspection_date: r.inspection_date,
      }));

      // Insert in batches of 500
      for (let i = 0; i < crocPayloads.length; i += 500) {
        const batch = crocPayloads.slice(i, i + 500);
        const { error } = await supabase.from('crocs').upsert(batch, { onConflict: 'tag' });
        if (error) {
          warnings++;
          console.error('Upsert batch error:', error);
        }
      }

      // Also insert inspection records
      // First get croc IDs for these tags
      const tags = parsedRows.map(r => r.tag);
      const { data: crocIds } = await supabase
        .from('crocs')
        .select('id, tag')
        .in('tag', tags);

      if (crocIds?.length) {
        const tagToId = new Map(crocIds.map(c => [c.tag, c.id]));
        const inspections = parsedRows
          .filter(r => r.belly_cm !== null && tagToId.has(r.tag))
          .map(r => ({
            croc_id: tagToId.get(r.tag)!,
            inspection_date: r.inspection_date,
            belly_cm: r.belly_cm,
            condition_codes: r.condition_codes,
          }));

        for (let i = 0; i < inspections.length; i += 500) {
          const batch = inspections.slice(i, i + 500);
          const { error } = await supabase.from('inspections').insert(batch);
          if (error) {
            warnings++;
            console.error('Inspection insert error:', error);
          }
        }
      }

      // Log the upload
      await supabase.from('upload_logs').insert({
        filename: fileName,
        record_count: parsedRows.length,
        status: warnings > 0 ? 'warnings' : 'success',
        warnings,
      });

      toast.success(`Imported ${parsedRows.length} records${warnings > 0 ? ` with ${warnings} warnings` : ''}`);
      refetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [parsedRows, fileName, refetchLogs]);

  const handleExport = async (type: 'live' | 'history') => {
    setExporting(type);
    try {
      const filter = penFilter || undefined;
      const count = type === 'live'
        ? await exportLiveCrocs(filter)
        : await exportInspectionHistory(filter);
      toast.success(`Exported ${count} records`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-3.5">
        {/* Data Export */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Data Export</span>
          </div>
          <div className="px-[18px] py-4 flex flex-col gap-3">
            <div className="text-xs text-ct-text2 mb-1">Download live or historical data as CSV for auditing or re-upload.</div>
            <div>
              <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-1.5">Filter by pen</div>
              <div className="flex gap-2">
                {['', 'GH1', 'GH2'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPenFilter(p)}
                    className={`px-3 py-1.5 font-mono-ibm text-[11px] rounded-sm border cursor-pointer transition-all ${
                      penFilter === p
                        ? 'bg-ct-accent text-background border-ct-accent'
                        : 'bg-surface-2 text-ct-text2 border-border hover:border-ct-accent'
                    }`}
                  >
                    {p || 'All'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleExport('live')}
                disabled={exporting !== null}
                className="flex-1 bg-ct-accent text-background px-[18px] py-2.5 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer disabled:opacity-50 transition-all hover:bg-ct-accent2"
              >
                {exporting === 'live' ? 'Exporting…' : '↓ Live Croc Data'}
              </button>
              <button
                onClick={() => handleExport('history')}
                disabled={exporting !== null}
                className="flex-1 bg-transparent text-ct-accent border border-border px-[18px] py-2.5 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer disabled:opacity-50 transition-all hover:border-ct-accent"
              >
                {exporting === 'history' ? 'Exporting…' : '↓ Inspection History'}
              </button>
            </div>
            <div className="font-mono-ibm text-[10px] text-ct-text3 bg-surface-2 p-2.5 rounded-sm border border-border leading-[1.8]">
              <strong className="text-ct-text2">Live data</strong> — current croc records (tag, pen, size, grade, conditions)<br />
              <strong className="text-ct-text2">History</strong> — all inspection measurements over time for growth auditing<br />
              <span className="text-ct-accent">CSV format matches the upload template</span> — edit &amp; re-import
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Upload Inspection Data</span>
          </div>
          <div className="px-[18px] py-4">
            <div
              className="border-2 border-dashed border-border rounded-md p-9 text-center cursor-pointer transition-all hover:border-ct-accent hover:bg-[rgba(201,168,76,.04)]"
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-ct-accent', 'bg-[rgba(201,168,76,.04)]'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-ct-accent', 'bg-[rgba(201,168,76,.04)]'); }}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-ct-accent', 'bg-[rgba(201,168,76,.04)]'); parseFile(e.dataTransfer.files[0]); }}
            >
              <div className="text-[32px] mb-2.5 opacity-30">↑</div>
              <div className="font-display text-xl text-ct-text2 mb-1.5">Drop CSV or XLSX file here</div>
              <div className="text-[11px] text-ct-text3 font-mono-ibm">or click to browse · .csv and .xlsx supported</div>
              <input type="file" id="file-input" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />
            </div>
            <div className="mt-4">
              <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-2">Expected columns</div>
              <div className="font-mono-ibm text-[11px] text-ct-text2 leading-[2.1] bg-surface-2 p-3 rounded-sm border border-border">
                tag &nbsp;·&nbsp; pen_id &nbsp;·&nbsp; line &nbsp;·&nbsp; pen_slot<br />
                belly_cm &nbsp;·&nbsp; grade &nbsp;·&nbsp; condition_codes<br />
                inspection_date
              </div>
            </div>
          </div>
        </div>

        {/* Upload History */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Upload History</span>
          </div>
          <div className="px-[14px] py-2">
            {(!uploadHistory || uploadHistory.length === 0) ? (
              <div className="text-center py-4 text-ct-text3 font-mono-ibm text-[11px]">No uploads yet.</div>
            ) : uploadHistory.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 rounded-sm border border-border mb-1.5">
                <span className={`text-[13px] ${u.status === 'success' ? 'text-ct-good' : 'text-ct-warn'}`}>{u.status === 'success' ? '✓' : '⚠'}</span>
                <span className="font-mono-ibm text-[11px] text-ct-text flex-1 truncate">{u.filename}</span>
                <span className="font-mono-ibm text-[10px] text-ct-text3">{u.record_count} records · {new Date(u.uploaded_at).toLocaleDateString()}</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm ${u.status === 'success' ? 'bg-[rgba(76,175,80,.15)] text-ct-good' : 'bg-[rgba(212,137,42,.15)] text-ct-warn'}`}>
                  {u.status === 'success' ? 'Clean' : `${u.warnings} warning${u.warnings !== 1 ? 's' : ''}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {/* Data Preview */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Data Preview</span>
            <span className={`inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm ${parsedRows.length > 0 ? 'bg-[rgba(76,175,80,.15)] text-ct-good' : 'bg-[rgba(201,168,76,.15)] text-ct-accent'}`}>
              {parsedRows.length > 0 ? `✓ ${parsedRows.length} records loaded` : 'Awaiting file'}
            </span>
          </div>
          <div className="px-[18px] py-4">
            {parsedRows.length === 0 ? (
              <div className="text-center py-10 text-ct-text3 font-mono-ibm text-[11px]">No file loaded.</div>
            ) : (
              <>
                <div className="text-[11px] text-ct-text2 mb-2.5 font-mono-ibm">Preview — <strong className="text-ct-accent">{fileName}</strong> (first 10 rows)</div>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="border-collapse text-[11px] w-full">
                    <thead className="sticky top-0">
                      <tr className="bg-surface-3">
                        {['tag', 'pen_id', 'line', 'slot', 'belly_cm', 'grade', 'conditions', 'date'].map(h => (
                          <th key={h} className="p-[5px_8px] border border-border text-ct-text3 font-mono-ibm text-[9px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          <td className="p-[5px_8px] border border-border text-ct-text2 font-mono-ibm">{r.tag}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">{r.pen_id}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">{r.line}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">{r.pen_slot}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">{r.belly_cm ?? '—'}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">{r.grade ?? '—'}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">{r.condition_codes.join(', ') || '—'}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text3">{r.inspection_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 10 && (
                  <div className="text-[10px] text-ct-text3 font-mono-ibm mt-2">… and {parsedRows.length - 10} more rows</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Validation Report */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Validation Report</span>
          </div>
          <div className="px-[18px] py-4">
            {validations.length === 0 ? (
              <div className="text-center py-5 text-ct-text3 font-mono-ibm text-[11px]">Validation runs automatically on upload.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {validations.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className={v.ok ? 'text-ct-good' : 'text-ct-warn'}>{v.ok ? '✓' : '⚠'}</span>
                    <span className="text-xs text-ct-text2">{v.text}</span>
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="bg-ct-accent text-background px-[18px] py-2 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : 'Confirm Import'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
