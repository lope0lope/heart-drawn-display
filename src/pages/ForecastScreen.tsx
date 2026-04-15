import { SIZE_BANDS, sizeBand, sizeBandColor, getOccupied } from '@/lib/crocUtils';
import { useGrowthRates, useYtdCulled, useAiAdvisory, useCullProjections, projectBelly } from '@/hooks/useCullData';
import { useAllCrocs } from '@/hooks/useCrocs';
import { useMemo } from 'react';

export default function ForecastScreen() {
  const { data: allCrocs, isLoading } = useAllCrocs();
  const { data: growthRates } = useGrowthRates();
  const { ytdCulled } = useYtdCulled();
  const aiAdvisory = useAiAdvisory();
  const cullProjections = useCullProjections();

  // Band movement flow
  const bandFlow = useMemo(() => {
    if (!allCrocs || !growthRates) return null;
    const occupied = getOccupied(allCrocs);
    const flows: { from: number; to: number; count: number }[][] = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      const movements: Record<string, number> = {};
      for (const c of occupied) {
        if (!c.belly_cm) continue;
        const before = projectBelly(c.belly_cm, growthRates, cycle);
        const after = projectBelly(c.belly_cm, growthRates, cycle + 1);
        const bBefore = sizeBand(before);
        const bAfter = sizeBand(after);
        if (bBefore !== null && bAfter !== null && bBefore !== bAfter) {
          const key = `${bBefore}-${bAfter}`;
          movements[key] = (movements[key] || 0) + 1;
        }
      }
      flows.push(
        Object.entries(movements).map(([key, count]) => {
          const [from, to] = key.split('-').map(Number);
          return { from, to, count };
        })
      );
    }
    return flows;
  }, [allCrocs, growthRates]);

  if (isLoading || !allCrocs || !growthRates || !cullProjections) {
    return <div className="text-muted-foreground text-xs font-mono py-10 text-center">Loading forecast data…</div>;
  }

  const targets = SIZE_BANDS.map(b => b.target);

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="bg-[hsla(var(--ct-accent),0.07)] border-l-[3px] border-l-[hsl(var(--ct-accent))] px-3.5 py-2.5 rounded-r text-xs text-muted-foreground leading-relaxed">
        Crocs can be culled at <strong className="text-[hsl(var(--ct-accent))]">any size band</strong> — each band has its own annual target.
        Growth rates vary by size (smaller crocs grow faster). Each cycle ≈ 2 months.
      </div>

      {/* ── Main Projection Table: Stock per Band at Each Horizon ── */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">
            Projected Stock &amp; Cull Availability by Size Band
          </span>
          <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono bg-[hsla(var(--ct-accent),0.15)] text-[hsl(var(--ct-accent))]">
            Live projection
          </span>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[160px_repeat(4,1fr)_100px] border-b border-border bg-secondary/50">
          <div className="px-4 py-2 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Size Band</div>
          {cullProjections.projections.map((p, i) => (
            <div key={i} className="px-3 py-2 text-[9px] font-mono text-muted-foreground uppercase tracking-wider text-center">
              {p.label}
            </div>
          ))}
          <div className="px-3 py-2 text-[9px] font-mono text-muted-foreground uppercase tracking-wider text-center">
            Annual Target
          </div>
        </div>

        {/* Band rows */}
        {SIZE_BANDS.map((band, bi) => {
          const remaining = Math.max(0, targets[bi] - ytdCulled[bi]);
          return (
            <div key={bi} className="grid grid-cols-[160px_repeat(4,1fr)_100px] border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
              {/* Band info */}
              <div className="px-4 py-3 flex flex-col justify-center border-r border-border">
                <div className="font-serif text-base font-semibold" style={{ color: sizeBandColor(bi) }}>
                  {band.range}
                </div>
                <div className="text-[9px] text-muted-foreground font-mono">{band.product}</div>
              </div>

              {/* Projection columns */}
              {cullProjections.projections.map((p, pi) => {
                const count = p.distribution[bi];
                const prevCount = pi > 0 ? cullProjections.projections[pi - 1].distribution[bi] : count;
                const diff = count - prevCount;
                const maxVal = Math.max(...cullProjections.projections.flatMap(pr => pr.distribution), 1);
                const barPct = (count / maxVal) * 100;

                // Can we fill remaining target from this horizon's stock?
                const canCull = remaining > 0 && count >= remaining;
                const partialCull = remaining > 0 && count > 0 && count < remaining;

                return (
                  <div key={pi} className="px-3 py-3 flex flex-col justify-center border-r border-border">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`font-serif text-2xl font-semibold leading-none ${
                        canCull ? 'text-[hsl(var(--ct-good))]' :
                        partialCull ? 'text-[hsl(var(--ct-warn))]' :
                        'text-foreground'
                      }`}>
                        {count}
                      </span>
                      {pi > 0 && diff !== 0 && (
                        <span className={`text-[10px] font-mono ${
                          diff > 0 ? 'text-[hsl(var(--ct-good))]' : 'text-[hsl(var(--ct-warn))]'
                        }`}>
                          {diff > 0 ? `▲+${diff}` : `▼${diff}`}
                        </span>
                      )}
                    </div>
                    <div className="h-[4px] bg-secondary rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${barPct}%`,
                          background: sizeBandColor(bi),
                        }}
                      />
                    </div>
                    {/* Cull status indicator */}
                    <div className="mt-1">
                      {canCull ? (
                        <span className="text-[9px] font-mono text-[hsl(var(--ct-good))]">
                          ✓ {remaining} cullable
                        </span>
                      ) : partialCull ? (
                        <span className="text-[9px] font-mono text-[hsl(var(--ct-warn))]">
                          ◐ {count} of {remaining} needed
                        </span>
                      ) : remaining > 0 ? (
                        <span className="text-[9px] font-mono text-muted-foreground">
                          — none in band
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-[hsl(var(--ct-good))]">
                          ✓ target met
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Target column */}
              <div className="px-3 py-3 flex flex-col justify-center items-center">
                <div className="font-mono text-sm text-foreground">{targets[bi]}</div>
                <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
                  {ytdCulled[bi]} culled
                </div>
                <div className={`text-[9px] font-mono mt-0.5 ${
                  remaining === 0 ? 'text-[hsl(var(--ct-good))]' : 'text-[hsl(var(--ct-warn))]'
                }`}>
                  {remaining === 0 ? '✓ Done' : `${remaining} left`}
                </div>
              </div>
            </div>
          );
        })}

        {/* Totals row */}
        <div className="grid grid-cols-[160px_repeat(4,1fr)_100px] bg-secondary/50 border-t border-border">
          <div className="px-4 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider flex items-center">
            Total Stock
          </div>
          {cullProjections.projections.map((p, i) => (
            <div key={i} className="px-3 py-3 text-center border-r border-border">
              <span className="font-serif text-xl font-semibold text-foreground">{p.total}</span>
            </div>
          ))}
          <div className="px-3 py-3 text-center">
            <span className="font-mono text-sm text-foreground">
              {targets.reduce((a, b) => a + b, 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Left: Growth Rates + Band Transitions */}
        <div className="flex flex-col gap-4">
          {/* Growth Rates */}
          <div className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">Growth Rates (per cycle ≈ 2 mo)</span>
              <span className="text-[9px] font-mono text-muted-foreground">From inspection data</span>
            </div>
            <div className="px-4 py-3">
              {SIZE_BANDS.map((b, i) => {
                const rate = growthRates[i];
                const maxRate = Math.max(...growthRates);
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border last:border-b-0">
                    <span className="font-mono text-[10px] w-16" style={{ color: sizeBandColor(i) }}>{b.range}</span>
                    <div className="flex-1 h-[6px] bg-secondary rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm"
                        style={{ width: `${(rate / maxRate) * 100}%`, background: sizeBandColor(i) }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-foreground w-20 text-right">{rate} cm / 2mo</span>
                  </div>
                );
              })}
              <div className="mt-2 text-[9px] text-muted-foreground font-mono leading-relaxed">
                Smaller crocs grow faster. Rates averaged from measured inspection deltas.
              </div>
            </div>
          </div>

          {/* Band Transitions */}
          {bandFlow && bandFlow.length > 0 && (
            <div className="bg-card border border-border rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">
                  Band Transitions per Cycle
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border">
                {bandFlow.slice(0, 3).map((cycle, ci) => (
                  <div key={ci} className="px-4 py-3">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
                      Cycle {ci + 1}
                    </div>
                    <div className="space-y-1">
                      {cycle.length > 0 ? cycle.sort((a, b) => b.count - a.count).slice(0, 5).map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono">
                          <span style={{ color: sizeBandColor(f.from) }}>{SIZE_BANDS[f.from]?.range}</span>
                          <span className="text-muted-foreground">→</span>
                          <span style={{ color: sizeBandColor(f.to) }}>{SIZE_BANDS[f.to]?.range}</span>
                          <span className="ml-auto text-foreground font-semibold">{f.count}</span>
                        </div>
                      )) : (
                        <div className="text-[10px] text-muted-foreground font-mono">No transitions</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: YTD Cull Progress + AI Advisory */}
        <div className="flex flex-col gap-4">
          {/* YTD Cull Progress */}
          <div className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">
                YTD Cull vs Target
              </span>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {SIZE_BANDS.map((b, i) => {
                const pct = targets[i] > 0 ? Math.round(ytdCulled[i] / targets[i] * 100) : 0;
                const col = pct >= 80 ? 'hsl(var(--ct-good))' : pct >= 50 ? 'hsl(var(--ct-warn))' : 'hsl(var(--ct-danger))';
                const remaining = Math.max(0, targets[i] - ytdCulled[i]);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px]" style={{ color: sizeBandColor(i) }}>{b.range}</span>
                      <span className="font-mono text-[10px]" style={{ color: col }}>
                        {ytdCulled[i]}/{targets[i]} ({pct}%)
                      </span>
                    </div>
                    <div className="h-[5px] bg-secondary rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: col }} />
                    </div>
                    <div className="text-[8px] font-mono text-muted-foreground mt-0.5">
                      {remaining === 0 ? '✓ Target met' : `${remaining} remaining`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Advisory */}
          <div className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">AI Advisory</span>
              <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono bg-[hsla(var(--ct-accent),0.15)] text-[hsl(var(--ct-accent))]">Live</span>
            </div>
            <div className="px-4 py-3 text-xs leading-[1.8]">
              {aiAdvisory ? (
                <div className="space-y-2">
                  {aiAdvisory.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <span className={`text-[hsl(var(--${a.color}))] flex-shrink-0`}>{a.icon}</span>
                      <span className="text-muted-foreground">{a.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">Computing…</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
