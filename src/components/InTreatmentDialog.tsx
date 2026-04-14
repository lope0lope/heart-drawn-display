import { useRef, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { CrocRecord, ConditionCodeRecord } from '@/hooks/useCrocs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crocs: CrocRecord[];
  conditionDefs: ConditionCodeRecord[];
}

export default function InTreatmentDialog({ open, onOpenChange, crocs, conditionDefs }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [groupBy, setGroupBy] = useState<'pen' | 'line'>('pen');
  const [condFilter, setCondFilter] = useState<string>('all');

  const treated = useMemo(() => {
    let list = crocs.filter(c => c.condition_codes.length > 0);
    if (condFilter !== 'all') {
      list = list.filter(c => c.condition_codes.includes(condFilter));
    }
    return list.sort((a, b) => a.pen_id.localeCompare(b.pen_id) || a.line.localeCompare(b.line) || a.pen_slot - b.pen_slot);
  }, [crocs, condFilter]);

  // Unique condition codes present
  const activeConds = useMemo(() => {
    const codes = new Set<string>();
    crocs.filter(c => c.condition_codes.length > 0).forEach(c => c.condition_codes.forEach(code => codes.add(code)));
    return [...codes].sort();
  }, [crocs]);

  // Group logic
  const grouped = useMemo(() => {
    const map: Record<string, CrocRecord[]> = {};
    for (const c of treated) {
      const key = groupBy === 'pen' ? c.pen_id : `${c.pen_id} — Line ${c.line}`;
      (map[key] ??= []).push(c);
    }
    return map;
  }, [treated, groupBy]);

  const getCondName = (code: string) => conditionDefs.find(c => c.code === code)?.name ?? code;
  const getCondColor = (code: string) => {
    const cd = conditionDefs.find(c => c.code === code);
    return cd ? `hsl(var(${cd.color_var}))` : 'hsl(var(--ct-text3))';
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>In-Treatment Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-size: 11px; color: #1a1a1a; padding: 20px; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        .subtitle { font-size: 10px; color: #666; margin-bottom: 16px; }
        h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 10px; }
        th { background: #f0f0f0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 9px; }
        .code-badge { display: inline-block; padding: 1px 5px; border: 1px solid #999; border-radius: 2px; margin-right: 4px; font-size: 10px; }
        .summary { font-size: 10px; color: #666; margin-top: 8px; }
        .checkbox { display: inline-block; width: 12px; height: 12px; border: 1px solid #999; margin-right: 6px; vertical-align: middle; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <h1>In-Treatment — Farm Walk Checklist</h1>
      <div class="subtitle">Generated: ${new Date().toLocaleDateString()} · ${treated.length} crocs · Grouped by ${groupBy}${condFilter !== 'all' ? ` · Filter: ${condFilter}` : ''}</div>
      ${Object.entries(grouped).map(([key, groupCrocs]) => `
        <h2>${key} — ${groupCrocs.length} crocs</h2>
        <table>
          <thead><tr><th>✓</th><th>Line</th><th>Slot</th><th>Tag</th><th>Belly</th><th>Conditions</th><th>Last Inspected</th></tr></thead>
          <tbody>
            ${groupCrocs.map(c => `<tr>
              <td><span class="checkbox"></span></td>
              <td>${c.line}</td>
              <td>${c.pen_slot}</td>
              <td>${c.tag ?? '—'}</td>
              <td>${c.belly_cm ?? '—'} cm</td>
              <td>${c.condition_codes.map(code => `<span class="code-badge">${code}</span> ${getCondName(code)}`).join(', ')}</td>
              <td>${c.inspection_date ?? '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      `).join('')}
      <div class="summary">Farm walk inspection checklist · Tick off each croc as inspected.</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-mono-ibm text-sm text-ct-text tracking-[1px]">
            In-Treatment — Farm Walk Checklist
          </DialogTitle>
          <DialogDescription className="font-mono-ibm text-[10px] text-ct-text3">
            {treated.length} crocs with active condition flags · Print for physical inspection walk
          </DialogDescription>
        </DialogHeader>

        {/* Controls */}
        <div className="flex gap-2 mb-2 items-center flex-wrap">
          <button
            onClick={handlePrint}
            className="bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] cursor-pointer rounded-sm transition-all hover:border-ct-accent hover:bg-surface-2"
          >
            ⎙ Print Checklist
          </button>

          {/* Group by toggle */}
          <div className="flex items-center gap-1 ml-2">
            <span className="font-mono-ibm text-[9px] text-ct-text3">Group:</span>
            <button
              onClick={() => setGroupBy('pen')}
              className={`font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border transition-all ${groupBy === 'pen' ? 'border-ct-accent text-ct-accent bg-surface-2' : 'border-border text-ct-text3 hover:border-ct-accent'}`}
            >
              By Pen
            </button>
            <button
              onClick={() => setGroupBy('line')}
              className={`font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border transition-all ${groupBy === 'line' ? 'border-ct-accent text-ct-accent bg-surface-2' : 'border-border text-ct-text3 hover:border-ct-accent'}`}
            >
              By Line
            </button>
          </div>

          {/* Condition filter */}
          <select
            className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[10px] rounded-sm cursor-pointer outline-none focus:border-ct-accent ml-2"
            value={condFilter}
            onChange={e => setCondFilter(e.target.value)}
          >
            <option value="all">All Conditions</option>
            {activeConds.map(code => {
              const def = conditionDefs.find(c => c.code === code);
              return <option key={code} value={code}>{code}{def ? ` — ${def.name}` : ''}</option>;
            })}
          </select>

          <span className="font-mono-ibm text-[10px] text-ct-text3 ml-auto">
            {Object.keys(grouped).length} groups · {treated.length} crocs
          </span>
        </div>

        <div ref={printRef} className="flex-1 overflow-y-auto pr-1">
          {Object.entries(grouped).map(([key, groupCrocs]) => (
            <div key={key} className="mb-4">
              <div className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase mb-2 pb-1 border-b border-border">
                {key} — {groupCrocs.length} crocs in treatment
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {['Line', 'Slot', 'Tag', 'Belly', 'Conditions', 'Date'].map(h => (
                        <th key={h} className="bg-surface-3 border border-border p-[5px_8px] font-mono-ibm text-[9px] text-ct-text3 tracking-[1px] uppercase text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupCrocs.map(c => (
                      <tr key={c.id} className="hover:bg-surface-2">
                        <td className="border border-border p-[5px_8px] font-mono-ibm text-[11px]">{c.line}</td>
                        <td className="border border-border p-[5px_8px] font-mono-ibm text-[11px]">{c.pen_slot}</td>
                        <td className="border border-border p-[5px_8px] font-mono-ibm text-[11px] text-ct-accent">{c.tag ?? '—'}</td>
                        <td className="border border-border p-[5px_8px] font-mono-ibm text-[11px]">{c.belly_cm ?? '—'} cm</td>
                        <td className="border border-border p-[5px_8px]">
                          <div className="flex flex-wrap gap-1">
                            {c.condition_codes.map(code => (
                              <span
                                key={code}
                                className="font-mono-ibm text-[10px] px-[5px] py-px rounded-sm"
                                style={{ border: `1px solid ${getCondColor(code)}`, color: getCondColor(code) }}
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="border border-border p-[5px_8px] font-mono-ibm text-[10px] text-ct-text3">{c.inspection_date ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
