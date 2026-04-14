import { useRef } from 'react';
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

  const treated = crocs
    .filter(c => c.condition_codes.length > 0)
    .sort((a, b) => a.pen_id.localeCompare(b.pen_id) || a.line.localeCompare(b.line) || a.pen_slot - b.pen_slot);

  // Group by pen
  const byPen: Record<string, CrocRecord[]> = {};
  for (const c of treated) {
    (byPen[c.pen_id] ??= []).push(c);
  }

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
        @media print { body { padding: 10px; } }
      </style></head><body>
      <h1>In-Treatment Crocodile Report</h1>
      <div class="subtitle">Generated: ${new Date().toLocaleDateString()} · Total: ${treated.length} crocs with active conditions</div>
      ${Object.entries(byPen).map(([pen, penCrocs]) => `
        <h2>${pen} — ${penCrocs.length} crocs in treatment</h2>
        <table>
          <thead><tr><th>Line</th><th>Slot</th><th>Tag</th><th>Belly (cm)</th><th>Conditions</th><th>Inspection</th></tr></thead>
          <tbody>
            ${penCrocs.map(c => `<tr>
              <td>${c.line}</td>
              <td>${c.pen_slot}</td>
              <td>${c.tag ?? '—'}</td>
              <td>${c.belly_cm ?? '—'}</td>
              <td>${c.condition_codes.map(code => `<span class="code-badge">${code}</span> ${getCondName(code)}`).join(', ')}</td>
              <td>${c.inspection_date ?? '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      `).join('')}
      <div class="summary">Report covers all active condition flags across all pens.</div>
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
            In-Treatment Crocodile Log
          </DialogTitle>
          <DialogDescription className="font-mono-ibm text-[10px] text-ct-text3">
            {treated.length} crocs with active condition flags · Click print to generate a physical inspection list
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          <button
            onClick={handlePrint}
            className="bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] cursor-pointer rounded-sm transition-all hover:border-ct-accent hover:bg-surface-2"
          >
            ⎙ Print Report
          </button>
          <span className="font-mono-ibm text-[10px] text-ct-text3 flex items-center">
            {Object.keys(byPen).length} pens · {treated.length} crocs
          </span>
        </div>

        <div ref={printRef} className="flex-1 overflow-y-auto pr-1">
          {Object.entries(byPen).map(([pen, penCrocs]) => (
            <div key={pen} className="mb-4">
              <div className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase mb-2 pb-1 border-b border-border">
                {pen} — {penCrocs.length} crocs in treatment
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
                    {penCrocs.map(c => (
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
