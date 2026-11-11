import { useMemo } from 'react';
import type { CrocRecord } from '@/hooks/useCrocs';
import { cullMarkerHorizon } from '@/lib/crocUtils';

const hasCondition = (c: CrocRecord) => (c.condition_codes ?? []).some(code => !/^CULL/i.test(code));

/** Two-circle diagram: crocs with conditions vs crocs marked for cull, overlap = both. */
export default function CrocStateVenn({ crocs, onOpen }: { crocs: CrocRecord[]; onOpen: (title: string, crocs: CrocRecord[]) => void }) {
  const g = useMemo(() => {
    const out = { cond: [] as CrocRecord[], both: [] as CrocRecord[], cull: [] as CrocRecord[], clear: [] as CrocRecord[] };
    for (const c of crocs) {
      const k = hasCondition(c), m = cullMarkerHorizon(c) !== null;
      (k && m ? out.both : k ? out.cond : m ? out.cull : out.clear).push(c);
    }
    return out;
  }, [crocs]);

  const Region = ({ x, y, n, label, title, list }: { x: number; y: number; n: number; label: string; title: string; list: CrocRecord[] }) => (
    <g className="cursor-pointer" onClick={() => onOpen(title, list)}>
      <text x={x} y={y} textAnchor="middle" className="font-display" fontSize="34" fontWeight="600" fill="hsl(var(--foreground))">{n}</text>
      <text x={x} y={y + 20} textAnchor="middle" fontSize="11" fill="hsl(var(--ct-text2))">{label}</text>
    </g>
  );

  return (
    <div className="bg-surface border border-border rounded overflow-hidden mb-5">
      <div className="px-[18px] py-3 border-b border-border">
        <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Croc States — tap a section to see the crocs</span>
      </div>
      <div className="px-[18px] py-4 flex flex-col md:flex-row items-center gap-4">
        <svg viewBox="0 0 520 300" className="w-full max-w-[560px]" role="img" aria-label="Diagram of crocs with conditions and crocs marked for cull">
          <rect x="4" y="4" width="512" height="292" rx="10" fill="hsl(var(--ct-good) / .08)" stroke="hsl(var(--ct-good))" className="cursor-pointer" onClick={() => onOpen('Clear — no conditions, not marked', g.clear)} />
          <circle cx="200" cy="150" r="112" fill="hsl(var(--ct-danger) / .22)" stroke="hsl(var(--ct-danger))" strokeWidth="2" className="cursor-pointer" onClick={() => onOpen('Conditions only', g.cond)} />
          <circle cx="320" cy="150" r="112" fill="hsl(var(--ct-cull) / .22)" stroke="hsl(var(--ct-cull))" strokeWidth="2" className="cursor-pointer" onClick={() => onOpen('Marked for cull only', g.cull)} />
          <Region x={145} y={150} n={g.cond.length} label="Conditions only" title="Conditions only" list={g.cond} />
          <Region x={260} y={150} n={g.both.length} label="Both" title="Conditions and marked for cull" list={g.both} />
          <Region x={375} y={150} n={g.cull.length} label="Marked for cull" title="Marked for cull only" list={g.cull} />
          <Region x={470} y={278} n={g.clear.length} label="" title="Clear — no conditions, not marked" list={g.clear} />
          <text x="440" y="292" textAnchor="middle" fontSize="0">.</text>
        </svg>
        <ul className="text-xs space-y-2 font-mono-ibm text-ct-text2">
          <li><span className="inline-block w-3 h-3 rounded-full mr-2 align-middle bg-ct-danger" />Has a condition: {g.cond.length + g.both.length}</li>
          <li><span className="inline-block w-3 h-3 rounded-full mr-2 align-middle bg-ct-cull" />Marked for cull (NX/1/2/3): {g.cull.length + g.both.length}</li>
          <li><span className="inline-block w-3 h-3 rounded-full mr-2 align-middle bg-ct-good" />Clear (outside the circles): {g.clear.length}</li>
          <li>Total: {crocs.length}</li>
        </ul>
      </div>
    </div>
  );
}
