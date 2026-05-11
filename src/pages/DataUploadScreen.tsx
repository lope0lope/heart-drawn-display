import { useState, useCallback } from 'react';
import { exportLiveCrocs, exportInspectionHistory } from '@/lib/exportData';
import { useUploadLogs } from '@/hooks/useFeedData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseInspectionFile, cullToConditionCode, type ParsedInspectionRow, type ParsedInspectionFile } from '@/lib/inspectionParser';
import { useQueryClient } from '@tanstack/react-query';
import CrocDatasetTable from '@/components/CrocDatasetTable';
import { sizeBand } from '@/lib/crocUtils';

export const CULLED_MARKER = 'CULLED';

interface ValidationResult {
  ok: boolean;
  text: string;
}

export default function DataUploadScreen() {
  const [penFilter, setPenFilter] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedInspectionFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const { data: uploadHistory, refetch: refetchLogs } = useUploadLogs();
  const queryClient = useQueryClient();

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setParsed(null);
    setValidations([]);

    const result = await parseInspectionFile(file);
    setParsed(result);

    // Build validations
    const v: ValidationResult[] = [];
    v.push({ ok: true, text: `Inspection date: ${result.inspectionDate}` });
    v.push({ ok: result.rows.length > 0, text: `${result.rows.length} records parsed` });

    // Check for duplicate tags with line numbers
    const tagLines = new Map<string, number[]>();
    result.rows.forEach(r => {
      if (!tagLines.has(r.tag)) tagLines.set(r.tag, []);
      tagLines.get(r.tag)!.push(r.csvRow);
    });
    const dupeEntries = [...tagLines.entries()].filter(([_, lines]) => lines.length > 1);
    if (dupeEntries.length === 0) {
      v.push({ ok: true, text: 'No duplicate tag IDs' });
    } else {
      for (const [tag, lines] of dupeEntries) {
        v.push({ ok: false, text: `Duplicate tag ${tag} on CSV rows ${lines.join(', ')}` });
      }
    }

    const withCull = result.rows.filter(r => r.cull);
    if (withCull.length > 0) {
      v.push({ ok: true, text: `${withCull.length} crocs with cull recommendations` });
    }

    const withCondition = result.rows.filter(r => r.conditions.length > 0);
    if (withCondition.length > 0) {
      const totalCodes = withCondition.reduce((s, r) => s + r.conditions.length, 0);
      v.push({ ok: true, text: `${withCondition.length} crocs with ${totalCodes} condition flags` });
    }

    for (const w of result.warnings) {
      v.push({ ok: false, text: w });
    }

    setValidations(v);
  }, []);

  const handleImport = useCallback(async () => {
    if (!parsed || !parsed.rows.length) return;
    setImporting(true);
    let warnings = 0;

    try {
      const { inspectionDate, rows } = parsed;
      const tags = rows.map(r => r.tag);

      // 1. Fetch existing crocs for these tags + their latest inspection date
      const { data: existingCrocs } = await supabase
        .from('crocs')
        .select('id, tag, inspection_date, cull_schedule')
        .in('tag', tags);
      const tagToExisting = new Map(
        (existingCrocs ?? []).map(c => [c.tag, c])
      );

      // 2. For NEW tags → insert a crocs row using this inspection's data
      //    For EXISTING tags → only UPDATE the live fields if this inspection
      //    is newer than the croc's stored inspection_date (keeps "live" view
      //    pinned to latest data, while older uploads just append history).
      const newCrocPayloads: any[] = [];
      const updatesNewer: { id: number; payload: any }[] = [];

      for (const r of rows) {
        const condCodes: string[] = [...r.conditions];
        const cullCode = cullToConditionCode(r.cull);
        if (cullCode) condCodes.push(cullCode);

        const liveFields = {
          tag: r.tag,
          pen_id: r.pen,
          belly_cm: r.belly_cm,
          grade: r.grade,
          condition_codes: condCodes,
          inspection_date: inspectionDate,
          cull_schedule: r.cull || null,
        };

        const existing = tagToExisting.get(r.tag);
        if (!existing) {
          newCrocPayloads.push(liveFields);
        } else {
          const existingDate = existing.inspection_date ?? '';
          if (inspectionDate >= existingDate) {
            updatesNewer.push({ id: existing.id, payload: liveFields });
          }
          // else: older upload — just record an inspection, leave live row alone
        }
      }

      // 3. Insert new crocs
      for (let i = 0; i < newCrocPayloads.length; i += 500) {
        const batch = newCrocPayloads.slice(i, i + 500);
        const { error } = await supabase.from('crocs').insert(batch);
        if (error) {
          warnings++;
          console.error('Insert batch error:', error);
        }
      }

      // 4. Update existing crocs whose live fields should advance
      for (const u of updatesNewer) {
        const { error } = await supabase.from('crocs').update(u.payload).eq('id', u.id);
        if (error) {
          warnings++;
          console.error('Update error:', error);
        }
      }

      // 5. Re-fetch all crocs for these tags so we can map tag → id
      const { data: allCrocs } = await supabase
        .from('crocs')
        .select('id, tag')
        .in('tag', tags);
      const tagToId = new Map((allCrocs ?? []).map(c => [c.tag, c.id]));

      // 6. Replace any existing inspection for the same croc+date,
      //    then insert the fresh ones (preserves all other historical
      //    inspections so growth charts work).
      const crocIds = [...new Set(rows.map(r => tagToId.get(r.tag)).filter(Boolean) as number[])];
      if (crocIds.length) {
        for (let i = 0; i < crocIds.length; i += 500) {
          await supabase
            .from('inspections')
            .delete()
            .in('croc_id', crocIds.slice(i, i + 500))
            .eq('inspection_date', inspectionDate);
        }
      }

      const inspections = rows
        .filter(r => tagToId.has(r.tag))
        .map(r => {
          const condCodes: string[] = [...r.conditions];
          const cullCode = cullToConditionCode(r.cull);
          if (cullCode) condCodes.push(cullCode);
          return {
            croc_id: tagToId.get(r.tag)!,
            inspection_date: inspectionDate,
            belly_cm: r.belly_cm,
            condition_codes: condCodes,
          };
        });

      for (let i = 0; i < inspections.length; i += 500) {
        const batch = inspections.slice(i, i + 500);
        const { error } = await supabase.from('inspections').insert(batch);
        if (error) {
          warnings++;
          console.error('Inspection insert error:', error);
        }
      }

      // 7. Disappearance-based cull detection.
      //    A croc is considered culled when ALL of:
      //      - Its previous pen_id was re-inspected in this upload
      //        (otherwise the pen just wasn't visited yet, not a cull).
      //      - Its tag does NOT appear ANYWHERE in this upload
      //        (so a croc moved to a different pen is correctly excluded).
      //      - It is not already marked as culled.
      //    Re-appearance: if a previously-culled tag appears in this upload,
      //    we already updated its live fields above; here we also clear any
      //    matching cull_records row so it's not double-counted.
      let autoCulled = 0;
      let autoRevived = 0;
      try {
        const uploadPenIds = [...new Set(rows.map(r => r.pen).filter(Boolean))];
        const uploadTagSet = new Set(tags);

        if (uploadPenIds.length > 0) {
          const { data: candidatesInPens } = await supabase
            .from('crocs')
            .select('id, tag, pen_id, belly_cm, cull_schedule')
            .in('pen_id', uploadPenIds);

          const disappeared = (candidatesInPens ?? []).filter(c =>
            c.cull_schedule !== CULLED_MARKER && !uploadTagSet.has(c.tag ?? '')
          );

          if (disappeared.length > 0) {
            const cullRows = disappeared.map(c => ({
              croc_id: c.id,
              cull_date: inspectionDate,
              size_band_index: c.belly_cm != null ? (sizeBand(c.belly_cm) ?? -1) : -1,
              reason: 'auto: disappeared from inspection',
            }));
            for (let i = 0; i < cullRows.length; i += 500) {
              await supabase.from('cull_records').insert(cullRows.slice(i, i + 500));
            }
            for (let i = 0; i < disappeared.length; i += 500) {
              const ids = disappeared.slice(i, i + 500).map(c => c.id);
              await supabase
                .from('crocs')
                .update({ cull_schedule: CULLED_MARKER })
                .in('id', ids);
            }
            autoCulled = disappeared.length;
          }
        }

        // Revive any previously-culled tags that re-appear in this upload.
        const reappeared = (existingCrocs ?? []).filter(
          c => uploadTagSet.has(c.tag ?? '') && (c as any).cull_schedule === CULLED_MARKER
        );
        if (reappeared.length > 0) {
          await supabase
            .from('cull_records')
            .delete()
            .in('croc_id', reappeared.map(c => c.id))
            .eq('reason', 'auto: disappeared from inspection');
          autoRevived = reappeared.length;
        }
      } catch (e) {
        console.warn('Cull detection step failed:', e);
        warnings++;
      }

      // 8. Log
      await supabase.from('upload_logs').insert({
        filename: fileName,
        record_count: rows.length,
        status: warnings > 0 ? 'warnings' : 'success',
        warnings,
      });

      queryClient.invalidateQueries();

      const newCount = newCrocPayloads.length;
      const updatedCount = updatesNewer.length;
      const historyOnly = rows.length - newCount - updatedCount;
      toast.success(
        `Imported ${rows.length} inspections for ${inspectionDate} ` +
        `(${newCount} new, ${updatedCount} updated, ${historyOnly} history-only` +
        `${autoCulled > 0 ? `, ${autoCulled} auto-culled` : ''}` +
        `${autoRevived > 0 ? `, ${autoRevived} revived` : ''})` +
        `${warnings > 0 ? ` · ${warnings} warnings` : ''}`
      );
      refetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [parsed, fileName, refetchLogs, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!parsed || !parsed.rows.length) return;
    setImporting(true);

    try {
      const tags = parsed.rows.map(r => r.tag);

      const { data: crocs } = await supabase
        .from('crocs')
        .select('id, tag')
        .in('tag', tags);

      if (crocs?.length) {
        const ids = crocs.map(c => c.id);
        for (let i = 0; i < ids.length; i += 500) {
          await supabase.from('inspections').delete().in('croc_id', ids.slice(i, i + 500));
        }
        for (let i = 0; i < ids.length; i += 500) {
          await supabase.from('crocs').delete().in('id', ids.slice(i, i + 500));
        }
      }

      queryClient.invalidateQueries();
      toast.success(`Deleted ${crocs?.length ?? 0} croc records and their inspections`);

      await supabase.from('upload_logs').insert({
        filename: `DELETE: ${fileName}`,
        record_count: crocs?.length ?? 0,
        status: 'success',
        warnings: 0,
      });
      refetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setImporting(false);
    }
  }, [parsed, fileName, queryClient, refetchLogs]);

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

  const rows = parsed?.rows ?? [];
  const cullBreakdown = rows.reduce((acc, r) => {
    if (r.cull) {
      const k = r.cull.toUpperCase();
      acc[k] = (acc[k] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex flex-col gap-3.5">
        {/* Upload Zone */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Upload Inspection Sheet</span>
          </div>
          <div className="px-[18px] py-4">
            <div
              className="border-2 border-dashed border-border rounded-md p-9 text-center cursor-pointer transition-all hover:border-ct-accent hover:bg-[rgba(201,168,76,.04)]"
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-ct-accent', 'bg-[rgba(201,168,76,.04)]'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-ct-accent', 'bg-[rgba(201,168,76,.04)]'); }}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-ct-accent', 'bg-[rgba(201,168,76,.04)]'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            >
              <div className="text-[32px] mb-2.5 opacity-30">↑</div>
              <div className="font-display text-xl text-ct-text2 mb-1.5">Drop inspection CSV / XLSX here</div>
              <div className="text-[11px] text-ct-text3 font-mono-ibm">or click to browse · .csv and .xlsx supported</div>
              <input type="file" id="file-input" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>

            {/* Expected format */}
            <div className="mt-4">
              <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-2">Expected CSV format</div>
              <div className="font-mono-ibm text-[10px] text-ct-text2 leading-[2] bg-surface-2 p-3 rounded-sm border border-border">
                <span className="text-ct-accent">Row 1:</span> Inspection date, 2026/04/15<br />
                <span className="text-ct-accent">Row 2:</span> (empty)<br />
                <span className="text-ct-accent">Row 3:</span> Pen, ID, size, Condition, Last inspected, Cull, Rating<br />
                <span className="text-ct-accent">Row 4+:</span> 150, 1112, 35, "THChest,RTail", 2026/02/15, 1, 1
              </div>
              <div className="font-mono-ibm text-[10px] text-ct-text3 mt-2 leading-[1.8]">
                <strong className="text-ct-text2">Cull values:</strong> 1 = now · NXT = next cycle · 2 = 2 cycles · 3 = 3 cycles<br />
                <strong className="text-ct-text2">Condition:</strong> Comma-separated codes (e.g. THChest,RTail for two defects)<br />
                <strong className="text-ct-text2">Re-upload:</strong> Historical inspections are preserved — uploads from older dates only append history; uploads from newer/equal dates also refresh the croc's "live" fields. Edit/delete individual records below.
              </div>
            </div>
          </div>
        </div>

        {/* Data Export */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Data Export</span>
          </div>
          <div className="px-[18px] py-4 flex flex-col gap-3">
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
                <span className="font-mono-ibm text-[10px] text-ct-text3">{u.record_count} rec · {new Date(u.uploaded_at).toLocaleDateString()}</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm ${u.status === 'success' ? 'bg-[rgba(76,175,80,.15)] text-ct-good' : 'bg-[rgba(212,137,42,.15)] text-ct-warn'}`}>
                  {u.status === 'success' ? 'Clean' : `${u.warnings} warn`}
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
            <span className={`inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm ${rows.length > 0 ? 'bg-[rgba(76,175,80,.15)] text-ct-good' : 'bg-[rgba(201,168,76,.15)] text-ct-accent'}`}>
              {rows.length > 0 ? `✓ ${rows.length} records · ${parsed?.inspectionDate}` : 'Awaiting file'}
            </span>
          </div>
          <div className="px-[18px] py-4">
            {rows.length === 0 ? (
              <div className="text-center py-10 text-ct-text3 font-mono-ibm text-[11px]">No file loaded.</div>
            ) : (
              <>
                <div className="text-[11px] text-ct-text2 mb-2.5 font-mono-ibm">
                  Preview — <strong className="text-ct-accent">{fileName}</strong> (first 15 rows)
                </div>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="border-collapse text-[11px] w-full">
                    <thead className="sticky top-0">
                      <tr className="bg-surface-3">
                        {['Row', 'Pen', 'Tag', 'Size', 'Conditions', 'Cull', 'Grade'].map(h => (
                          <th key={h} className="p-[5px_8px] border border-border text-ct-text3 font-mono-ibm text-[9px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 15).map((r, i) => (
                        <tr key={i}>
                          <td className="p-[5px_8px] border border-border text-ct-text3 font-mono-ibm text-[10px]">{r.csvRow}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">{r.pen}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2 font-mono-ibm">{r.tag}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">{r.belly_cm ?? '—'}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">
                            {r.conditions.length > 0
                              ? r.conditions.map((c, ci) => (
                                  <span key={ci} className="inline-block px-1 py-px mr-1 rounded-sm text-[10px] font-mono-ibm border border-border bg-surface-2">{c}</span>
                                ))
                              : '—'}
                          </td>
                          <td className={`p-[5px_8px] border border-border font-mono-ibm font-medium ${
                            r.cull === '1' || r.cull.toUpperCase() === 'NXT' ? 'text-ct-danger' :
                            r.cull === '2' ? 'text-ct-warn' :
                            r.cull === '3' ? 'text-ct-info' : 'text-ct-text3'
                          }`}>{r.cull || '—'}</td>
                          <td className="p-[5px_8px] border border-border text-ct-text2">{r.grade ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 15 && (
                  <div className="text-[10px] text-ct-text3 font-mono-ibm mt-2">… and {rows.length - 15} more rows</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Cull Summary */}
        {Object.keys(cullBreakdown).length > 0 && (
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="px-[18px] py-3 border-b border-border">
              <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Cull Recommendations</span>
            </div>
            <div className="px-[18px] py-4 flex gap-3 flex-wrap">
              {Object.entries(cullBreakdown).sort().map(([k, count]) => (
                <div key={k} className="bg-surface-2 border border-border rounded-sm px-4 py-2.5 text-center min-w-[80px]">
                  <div className={`font-display text-xl ${
                    k === '1' || k === 'NXT' ? 'text-ct-danger' : k === '2' ? 'text-ct-warn' : 'text-ct-info'
                  }`}>{count}</div>
                  <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[1px] uppercase mt-0.5">
                    {k === '1' ? 'Cull Now' : k === 'NXT' ? 'Next Cycle' : k === '2' ? '2 Cycles' : k === '3' ? '3 Cycles' : `Cull ${k}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation & Import */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Validation & Import</span>
          </div>
          <div className="px-[18px] py-4">
            {validations.length === 0 ? (
              <div className="text-center py-5 text-ct-text3 font-mono-ibm text-[11px]">Upload a file to see validation results.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {validations.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className={v.ok ? 'text-ct-good' : 'text-ct-warn'}>{v.ok ? '✓' : '⚠'}</span>
                    <span className="text-xs text-ct-text2">{v.text}</span>
                  </div>
                ))}

                {/* Mode toggle */}
                <div className="mt-3 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteMode}
                      onChange={e => setDeleteMode(e.target.checked)}
                      className="accent-ct-danger"
                    />
                    <span className="font-mono-ibm text-[11px] text-ct-danger">Delete mode — remove these crocs instead of importing</span>
                  </label>
                </div>

                <div className="mt-2 flex gap-2">
                  {deleteMode ? (
                    <button
                      onClick={handleDelete}
                      disabled={importing}
                      className="bg-ct-danger text-background px-[18px] py-2 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer disabled:opacity-50"
                    >
                      {importing ? 'Deleting…' : `Delete ${rows.length} Records`}
                    </button>
                  ) : (
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="bg-ct-accent text-background px-[18px] py-2 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer disabled:opacity-50"
                    >
                      {importing ? 'Importing…' : `Import ${rows.length} Records`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      <CrocDatasetTable />
    </div>
  );
}
