import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { captureRequest } from '@/lib/cloudConnection';
import { useOfflineConditionCodes, useOnlineStatus } from '@/hooks/useOffline';
import {
  SHEET_COLUMNS, blankRow, isBlank, newId, normaliseHouse, parseComment, parseCull, parsePen,
  rowsFromGrid, validateRow, type SheetColumnKey, type SheetRow,
} from '@/lib/sheetEntry';

interface SheetDraft { id: string; name: string; house: string; date: string; rows: SheetRow[]; updatedAt: number }
const STORE = 'croctrack.data-sheets.v1';
const today = () => new Date().toISOString().slice(0, 10);
const loadAll = (): SheetDraft[] => { try { return JSON.parse(localStorage.getItem(STORE) ?? '[]'); } catch { return []; } };
const newSheet = (name = `Sheet ${new Date().toLocaleString()}`): SheetDraft =>
  ({ id: newId(), name, house: 'GH1', date: today(), rows: Array.from({ length: 20 }, () => blankRow()), updatedAt: Date.now() });

function toIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) ?? null;
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (d) return `${d[3].length === 2 ? '20' + d[3] : d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
  return null;
}

export default function DataSheetScreen() {
  const codes = useOfflineConditionCodes().map(c => c.code);
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [sheets, setSheets] = useState<SheetDraft[]>(() => { const s = loadAll(); return s.length ? s : [newSheet()]; });
  const [activeId, setActiveId] = useState(() => sheets[0].id);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [committing, setCommitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sheet = sheets.find(s => s.id === activeId) ?? sheets[0];

  // Incremental autosave: every change is written to this device shortly after typing.
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify(sheets)); setSavedAt(Date.now()); }
      catch { toast.error('Device storage is full — download or commit a sheet to free space.'); }
    }, 300);
    return () => clearTimeout(t);
  }, [sheets]);
  useEffect(() => {
    const flush = () => localStorage.setItem(STORE, JSON.stringify(sheets));
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [sheets]);

  const update = useCallback((fn: (s: SheetDraft) => SheetDraft) =>
    setSheets(all => all.map(s => (s.id === activeId ? { ...fn(s), updatedAt: Date.now() } : s))), [activeId]);

  const setCell = (rowIdx: number, key: SheetColumnKey, value: string) => update(s => {
    const rows = [...s.rows];
    const r = rows[rowIdx];
    rows[rowIdx] = { ...r, [key]: value, error: undefined, ...(r.committed ? { committed: false, clientId: newId() } : {}) };
    if (rowIdx >= rows.length - 2) rows.push(blankRow());
    return { ...s, rows };
  });

  /** Tidies a cell when leaving it so the client sees the decoded value. */
  const tidyCell = (rowIdx: number, key: SheetColumnKey) => {
    const r = sheet.rows[rowIdx]; const raw = r[key]; let v = raw;
    if (key === 'house') v = normaliseHouse(raw) ?? raw;
    if (key === 'pen') { const p = parsePen(raw); if (p) v = `${p.line}${p.pen}`; }
    if (key === 'cull') { const c = parseCull(raw); if (c) v = c === 'NXT' ? 'Nxt' : c === 'CULLED' ? 'Cull' : c; }
    if (key === 'comment' && raw.trim()) {
      const c = parseComment(raw, codes);
      v = [...c.codes, ...c.unknown, ...(c.cull ? ['Cull'] : [])].join(', ');
    }
    if (key === 'tag') v = raw.trim();
    if (v !== raw) update(s => { const rows = [...s.rows]; rows[rowIdx] = { ...rows[rowIdx], [key]: v }; return { ...s, rows }; });
  };

  const focusCell = (row: number, col: number) =>
    (document.querySelector(`[data-cell="${row}-${col}"]`) as HTMLInputElement | null)?.focus();

  const onKey = (e: React.KeyboardEvent, row: number, col: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(row + 1, col); }
    if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(row - 1, col); }
  };

  /** Pasting a block copied from Excel fills cells to the right and below. */
  const onPaste = (e: React.ClipboardEvent, row: number, col: number) => {
    const text = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
    update(s => {
      const rows = [...s.rows];
      lines.forEach((cells, i) => {
        while (rows.length <= row + i + 1) rows.push(blankRow());
        const r = { ...rows[row + i], committed: false, clientId: newId(), error: undefined };
        cells.forEach((v, j) => { const k = SHEET_COLUMNS[col + j]?.key; if (k) r[k] = v.trim(); });
        rows[row + i] = r;
      });
      return { ...s, rows };
    });
    toast.success(`Pasted ${lines.length} row(s)`);
  };

  const status = useMemo(() => sheet.rows.map(r => {
    if (isBlank(r)) return null;
    if (r.committed) return { ok: true, text: 'Uploaded' };
    if (r.error) return { ok: false, text: r.error };
    const v = validateRow(r, sheet.house, codes);
    return v.ok === true ? { ok: true, text: 'Ready' } : { ok: false, text: (v as { error: string }).error };
  }), [sheet.rows, sheet.house, codes]);
  const filled = status.filter(Boolean).length;
  const ready = sheet.rows.filter((r, i) => status[i]?.text === 'Ready').length;
  const invalid = status.filter(s => s && !s.ok).length;
  const uploaded = sheet.rows.filter(r => r.committed && !isBlank(r)).length;

  const openFile = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      let lastErr: unknown;
      for (const name of wb.SheetNames) {
        try {
          const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][];
          const { rows, date } = rowsFromGrid(grid);
          const firstHouse = rows.map(r => normaliseHouse(r.house)).find(Boolean) ?? 'GH1';
          const draft: SheetDraft = { ...newSheet(file.name.replace(/\.(xlsx|xls|csv)$/i, '')), house: firstHouse, date: toIso(date) ?? today(), rows: [...rows, blankRow(), blankRow()] };
          setSheets(all => [draft, ...all]); setActiveId(draft.id);
          toast.success(`Opened ${rows.length} rows from ${file.name}`);
          return;
        } catch (err) { lastErr = err; }
      }
      throw lastErr;
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not open that file'); }
  };

  const download = () => {
    const data = sheet.rows.filter(r => !isBlank(r)).map(r => ({
      House: normaliseHouse(r.house || sheet.house) ?? r.house, Pen: r.pen, Tag: r.tag, 'Size (cm)': r.size, Cull: r.cull, Comment: r.comment, Date: sheet.date,
    }));
    const ws = XLSX.utils.json_to_sheet(data, { header: ['House', 'Pen', 'Tag', 'Size (cm)', 'Cull', 'Comment', 'Date'] });
    ws['!cols'] = [8, 8, 12, 10, 8, 28, 12].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data Entry');
    XLSX.writeFile(wb, `${sheet.name.replace(/[^\w -]/g, '_')}.xlsx`);
  };

  const commit = async () => {
    if (!online) { toast.error('No connection — the sheet is saved on this device. Commit when back online.'); return; }
    const batch: { idx: number; entry: Record<string, unknown> }[] = [];
    sheet.rows.forEach((r, idx) => {
      if (isBlank(r) || r.committed) return;
      const v = validateRow(r, sheet.house, codes);
      if (!v.ok) return;
      const { codes: cs, ...rest } = v.value;
      batch.push({ idx, entry: { ...rest, date: sheet.date, marks: cs.map(code => ({ code, zone_key: 'general', zone_label: 'General' })) } });
    });
    if (!batch.length) { toast.error(invalid ? 'Fix the rows marked in red first.' : 'Nothing new to upload.'); return; }
    setCommitting(true);
    const results = new Map<number, { ok: boolean; reason?: string }>();
    try {
      for (let i = 0; i < batch.length; i += 100) {
        const part = batch.slice(i, i + 100);
        const res = await captureRequest('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: part.map(p => p.entry) }) });
        part.forEach((p, j) => {
          const r = res.results?.[j];
          results.set(p.idx, r?.status === 'saved' || r?.status === 'duplicate' ? { ok: true } : { ok: false, reason: r?.reason ?? 'Rejected' });
        });
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed — the sheet stays saved here.'); }
    update(s => ({ ...s, rows: s.rows.map((r, idx) => { const res = results.get(idx); return !res ? r : res.ok ? { ...r, committed: true, error: undefined } : { ...r, error: res.reason }; }) }));
    const okCount = [...results.values()].filter(r => r.ok).length;
    if (okCount) { toast.success(`Uploaded ${okCount} row(s) — dashboard and pen map updated`); qc.invalidateQueries(); }
    if (results.size - okCount > 0) toast.error(`${results.size - okCount} row(s) were rejected — see the Status column`);
    setCommitting(false);
  };

  const deleteSheet = () => {
    if (!confirm(`Delete "${sheet.name}" from this device? Uploaded rows stay in the dataset.`)) return;
    setSheets(all => { const rest = all.filter(s => s.id !== sheet.id); const next = rest.length ? rest : [newSheet()]; setActiveId(next[0].id); return next; });
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-xs font-mono-ibm text-ct-text2">Sheet
          <select className="h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground min-w-[200px]" value={sheet.id} onChange={e => setActiveId(e.target.value)}>
            {sheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-mono-ibm text-ct-text2">Name
          <Input className="h-10 w-[200px]" value={sheet.name} onChange={e => update(s => ({ ...s, name: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-mono-ibm text-ct-text2">Default house
          <select className="h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground" value={sheet.house} onChange={e => update(s => ({ ...s, house: e.target.value }))}>
            <option>GH1</option><option>GH2</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-mono-ibm text-ct-text2">Inspection date
          <Input type="date" className="h-10" value={sheet.date} onChange={e => update(s => ({ ...s, date: e.target.value, rows: s.rows.map(r => r.committed ? { ...r, committed: false, clientId: newId() } : r) }))} />
        </label>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button variant="outline" onClick={() => { const d = newSheet(); setSheets(a => [d, ...a]); setActiveId(d.id); }}>New sheet</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>Open Excel file</Button>
          <Button variant="outline" onClick={download}>Download Excel</Button>
          <Button variant="outline" onClick={deleteSheet}>Delete sheet</Button>
          <Button onClick={commit} disabled={committing || !online}>{committing ? 'Uploading…' : `Commit ${ready} row(s)`}</Button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ''; }} />
      </div>

      <div className="flex flex-wrap gap-4 text-xs font-mono-ibm text-ct-text2">
        <span>{filled} filled</span><span className="text-ct-accent">{ready} ready</span><span>{uploaded} uploaded</span>
        {invalid > 0 && <span className="text-destructive">{invalid} need fixing</span>}
        <span>{online ? 'Online' : 'Offline — saved on this device'}</span>
        <span className="ml-auto">{savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : 'Draft saves automatically'}</span>
      </div>

      <div className="overflow-auto border border-border rounded-lg bg-background max-h-[65vh]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr>
              <th className="border border-border px-2 py-2 w-10 font-mono-ibm text-[11px] text-ct-text3">#</th>
              {SHEET_COLUMNS.map(c => (
                <th key={c.key} className="border border-border px-2 py-1.5 text-left min-w-[110px]">
                  <div className="font-semibold text-foreground">{c.label}</div>
                  <div className="font-mono-ibm text-[10px] font-normal text-ct-text3">{c.hint}</div>
                </th>
              ))}
              <th className="border border-border px-2 py-2 text-left min-w-[180px]">Status</th>
              <th className="border border-border w-8" />
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r, ri) => (
              <tr key={r.id} className={r.committed ? 'bg-surface' : ''}>
                <td className="border border-border text-center font-mono-ibm text-[11px] text-ct-text3">{ri + 1}</td>
                {SHEET_COLUMNS.map((c, ci) => (
                  <td key={c.key} className="border border-border p-0">
                    <input
                      data-cell={`${ri}-${ci}`}
                      className="w-full h-9 px-2 bg-transparent outline-none focus:bg-surface-2 focus:ring-2 focus:ring-inset focus:ring-ring"
                      value={r[c.key]}
                      placeholder={ri === 0 && !r[c.key] && c.key === 'house' ? sheet.house : ''}
                      list={c.key === 'comment' ? 'sheet-codes' : c.key === 'cull' ? 'sheet-cull' : undefined}
                      onChange={e => setCell(ri, c.key, e.target.value)}
                      onBlur={() => tidyCell(ri, c.key)}
                      onKeyDown={e => onKey(e, ri, ci)}
                      onPaste={e => onPaste(e, ri, ci)}
                    />
                  </td>
                ))}
                <td className={`border border-border px-2 text-xs ${status[ri] ? (status[ri]!.ok ? 'text-ct-accent' : 'text-destructive') : ''}`}>{status[ri]?.text ?? ''}</td>
                <td className="border border-border text-center">
                  <button className="text-ct-text3 hover:text-destructive px-1" aria-label={`Delete row ${ri + 1}`}
                    onClick={() => update(s => ({ ...s, rows: s.rows.length > 1 ? s.rows.filter((_, i) => i !== ri) : [blankRow()] }))}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <datalist id="sheet-codes">{codes.map(c => <option key={c} value={c} />)}<option value="Cull" /></datalist>
      <datalist id="sheet-cull"><option value="Nxt" /><option value="1" /><option value="2" /><option value="3" /></datalist>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => update(s => ({ ...s, rows: [...s.rows, ...Array.from({ length: 10 }, () => blankRow())] }))}>Add 10 rows</Button>
        <p className="text-xs text-ct-text3 self-center">Leave House blank to use the default. Separate several conditions with commas. Paste straight from Excel. Known codes: {codes.join(', ') || 'loading…'}</p>
      </div>
    </div>
  );
}
