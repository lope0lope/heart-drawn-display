import { useState, useMemo } from 'react';
import { useAllCrocs } from '@/hooks/useCrocs';
import { SIZE_BUCKETS, sizeBucketColor, countSizeBuckets, getOccupied, cullMarkerHorizon } from '@/lib/crocUtils';
import CullHorizonDialog from '@/components/CullHorizonDialog';
import type { CrocRecord } from '@/hooks/useCrocs';

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(201,168,76,.15)] text-ct-accent">{children}</span>;
}

function KPI({ label, value, sub, variant, onClick }: { label: string; value: string; sub?: string; variant?: 'warn' | 'danger' | 'info' | 'cull' | 'good'; onClick?: () => void }) {
  const topColor = variant === 'warn' ? 'bg-ct-warn' : variant === 'danger' ? 'bg-ct-danger' : variant === 'info' ? 'bg-ct-info' : variant === 'cull' ? 'bg-ct-cull' : variant === 'good' ? 'bg-ct-good' : 'bg-ct-accent';
  return (
    <div className={`bg-surface border border-border rounded p-4 relative overflow-hidden ${onClick ? 'cursor-pointer hover:ring-1 hover:ring-ct-accent transition-all active:scale-[.98]' : ''}`} onClick={onClick}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${topColor}`} />
      <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-2">{label}</div>
      <div className="font-display text-[38px] font-semibold text-ct-text leading-none">{value}</div>
      {sub && <div className="text-[11px] text-ct-text3 mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardScreen() {
  const { data: allCrocs, isLoading } = useAllCrocs();
  const [drill, setDrill] = useState<{ title: string; crocs: CrocRecord[] } | null>(null);

  const grouped = useMemo(() => {
    const occupied = allCrocs ? getOccupied(allCrocs) : [];
    const groups: Record<0 | 1 | 2 | 3, CrocRecord[]> = { 0: [], 1: [], 2: [], 3: [] };
    for (const c of occupied) {
      const h = cullMarkerHorizon(c);
      if (h !== null) groups[h].push(c);
    }
    return { occupied, groups };
  }, [allCrocs]);

  if (isLoading || !allCrocs) {
    return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading live data…</div>;
  }

  const { occupied, groups } = grouped;
  const gh1Count = occupied.filter(c => c.pen_id === 'GH1').length;
  const gh2Count = occupied.filter(c => c.pen_id === 'GH2').length;
  const bc = countSizeBuckets(occupied);
  const maxB = Math.max(...bc, 1);

  const openDrill = (title: string, crocs: CrocRecord[]) => setDrill({ title, crocs });

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5 mb-5">
        <KPI
          label="Total Crocodiles"
          value={occupied.length.toLocaleString()}
          sub={`GH1: ${gh1Count} · GH2: ${gh2Count}`}
          onClick={() => openDrill('All Crocodiles', occupied)}
        />
        <KPI
          label="Ready Next Cycle (NX)"
          value={groups[0].length.toString()}
          sub="Marked NX"
          variant="cull"
          onClick={() => openDrill('Ready Next Cycle (NX)', groups[0])}
        />
        <KPI
          label="Ready in 1 More Cycle"
          value={groups[1].length.toString()}
          sub="Marked 1"
          variant="warn"
          onClick={() => openDrill('Ready in 1 More Cycle', groups[1])}
        />
        <KPI
          label="Ready in 2 More Cycles"
          value={groups[2].length.toString()}
          sub="Marked 2"
          variant="info"
          onClick={() => openDrill('Ready in 2 More Cycles', groups[2])}
        />
        <KPI
          label="Ready in 3 More Cycles"
          value={groups[3].length.toString()}
          sub="Marked 3"
          variant="good"
          onClick={() => openDrill('Ready in 3 More Cycles', groups[3])}
        />
      </div>

      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Size Category Snapshot — Today</span>
          <Pill>Live</Pill>
        </div>
        <div className="px-[18px] py-4">
          {SIZE_BANDS.map((b, i) => (
            <div key={i} className="flex items-center gap-2.5 mb-2">
              <span className="font-mono-ibm text-[10px] text-ct-text3 w-[58px]">{b.range}</span>
              <div className="flex-1 h-[9px] bg-surface-3 rounded-sm overflow-hidden">
                <div className="h-full rounded-sm" style={{ width: `${(bc[i] / maxB) * 100}%`, background: sizeBandColor(i) }} />
              </div>
              <span className="font-mono-ibm text-[11px] w-[34px] text-right" style={{ color: sizeBandColor(i) }}>{bc[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <CullHorizonDialog
        open={drill !== null}
        onOpenChange={(o) => !o && setDrill(null)}
        title={drill?.title ?? ''}
        crocs={drill?.crocs ?? []}
      />
    </div>
  );
}
