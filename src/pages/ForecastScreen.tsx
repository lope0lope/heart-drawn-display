import { useAllCrocs } from '@/hooks/useCrocs';
import { SIZE_BANDS, sizeBand, sizeBandColor, countSizeBands, getOccupied } from '@/lib/crocUtils';
import { useGrowthRates, useYtdCulled, useAiAdvisory, useCullProjections, projectBelly } from '@/hooks/useCullData';
import { useMemo } from 'react';

const CULL_THRESHOLD = 54;

export default function ForecastScreen() {
  const { data: allCrocs, isLoading } = useAllCrocs();
  const { data: growthRates } = useGrowthRates();
  const { ytdCulled } = useYtdCulled();
  const aiAdvisory = useAiAdvisory();
  const cullProjections = useCullProjections();

  // Compute per-band movement: how many crocs move between bands each cycle
  const bandFlow = useMemo(() => {
    if (!allCrocs || !growthRates) return null;
    const occupied = getOccupied(allCrocs);
    // For each cycle, track how many move from band i → band j
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

  const occupied = getOccupied(allCrocs);
  const targets = SIZE_BANDS.map(b => b.target);

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="bg-[hsla(var(--ct-accent),0.07)] border-l-[3px] border-l-[hsl(var(--ct-accent))] px-3.5 py-2.5 rounded-r text-xs text-muted-foreground leading-relaxed">
        Growth rates are computed from inspection history and vary by size band — smaller crocs grow faster. 
        Cull threshold: <strong className="text-[hsl(var(--ct-accent))]">{CULL_THRESHOLD} cm</strong> belly width. 
        Each cycle ≈ 2 months.
      </div>

      {/* Cull Readiness Summary — the key output */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">Cull Readiness — ≥{CULL_THRESHOLD} cm</span>
          <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono bg-[hsla(var(--ct-cull),0.15)] text-[hsl(var(--ct-cull))]">
            Live projection
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          {cullProjections.projections.map((p, idx) => {
            const pct = p.total > 0 ? Math.round((p.cullReady / p.total) * 100) : 0;
            return (
              <div key={idx} className="px-5 py-5">
                <div className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase mb-2">{p.label}</div>
                <div className="flex items-baseline gap-2">
                  <span className={`font-serif text-[40px] font-semibold leading-none ${
                    p.cullReady > 0 ? 'text-[hsl(var(--ct-good))]' : 'text-muted-foreground'
                  }`}>{p.cullReady}</span>
                  <span className="text-xs text-muted-foreground">of {p.total} ({pct}%)</span>
                </div>
                <div className="h-[4px] bg-secondary rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: p.cullReady > 0 ? 'hsl(var(--ct-good))' : 'hsl(var(--ct-text3))',
                    }}
                  />
                </div>
                {/* Breakdown by current band */}
                <div className="mt-3 space-y-1">
                  {p.cullReadyByBand.map((count, bi) =>
                    count > 0 ? (
                      <div key={bi} className="flex items-center justify-between text-[10px] font-mono">
                        <span style={{ color: sizeBandColor(bi) }}>{SIZE_BANDS[bi].range}</span>
                        <span className="text-foreground">{count} ready</span>
                      </div>
                    ) : null
                  )}
                  {p.cullReady === 0 && (
                    <div className="text-[10px] text-muted-foreground font-mono">None at threshold yet</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Size Distribution Projection */}
        <div className="bg-card border border-border rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">Size Distribution by Cycle</span>
            <div className="flex gap-3 text-[9px] font-mono text-muted-foreground">
              {cullProjections.projections.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{
                    background: i === 0 ? 'hsl(var(--ct-accent))' : i === 1 ? 'hsl(var(--ct-info))' : 'hsl(var(--ct-cull))'
                  }} />
                  {p.label}
                </span>
              ))}
            </div>
          </div>
          {SIZE_BANDS.map((band, bi) => {
            const maxVal = Math.max(
              ...cullProjections.projections.flatMap(p => p.distribution),
              ...targets,
              1
            );
            return (
              <div key={bi} className="grid grid-cols-[140px_1fr_100px] border-b border-border last:border-b-0">
                <div className="px-4 py-3 flex flex-col justify-center border-r border-border">
                  <div className="font-serif text-lg font-semibold" style={{ color: sizeBandColor(bi) }}>{band.range}</div>
                  <div className="text-[9px] text-muted-foreground font-mono">{band.product}</div>
                </div>
                <div className="px-4 py-2.5 flex flex-col gap-1 justify-center">
                  {cullProjections.projections.map((p, pi) => {
                    const colors = ['var(--ct-accent)', 'var(--ct-info)', 'var(--ct-cull)'];
                    return (
                      <div key={pi} className="flex items-center gap-2">
                        <span className="font-mono text-[8px] w-14 text-right" style={{ color: `hsl(${colors[pi]})` }}>
                          {pi === 0 ? 'NOW' : pi === 1 ? '+1 CYC' : '+2 CYC'}
                        </span>
                        <div className="flex-1 h-[7px] bg-secondary rounded-sm overflow-hidden">
                          <div
                            className="h-full rounded-sm transition-all duration-500"
                            style={{
                              width: `${(p.distribution[bi] / maxVal) * 100}%`,
                              background: `hsl(${colors[pi]})`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] w-7 text-right" style={{ color: `hsl(${colors[pi]})` }}>
                          {p.distribution[bi]}
                        </span>
                      </div>
                    );
                  })}
                  {/* Target line */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[8px] text-muted-foreground w-14 text-right">TARGET</span>
                    <div className="flex-1 h-[7px] relative">
                      <div
                        className="absolute h-3 w-0.5 bg-muted-foreground rounded-sm -top-0.5"
                        style={{ left: `${(targets[bi] / maxVal) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground w-7 text-right">{targets[bi]}</span>
                  </div>
                </div>
                <div className="px-3 py-2 border-l border-border flex flex-col justify-center">
                  {/* Net change indicator */}
                  {(() => {
                    const nowCount = cullProjections.projections[0].distribution[bi];
                    const nextCount = cullProjections.projections[1].distribution[bi];
                    const diff = nextCount - nowCount;
                    if (diff > 0) return (
                      <div className="text-[10px] font-mono text-[hsl(var(--ct-good))]">▲ +{diff} next</div>
                    );
                    if (diff < 0) return (
                      <div className="text-[10px] font-mono text-[hsl(var(--ct-warn))]">▼ {diff} next</div>
                    );
                    return <div className="text-[10px] font-mono text-muted-foreground">— steady</div>;
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Growth Rates per Band */}
          <div className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">Growth Rates (per cycle)</span>
              <span className="text-[9px] font-mono text-muted-foreground">From inspections</span>
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
                        style={{
                          width: `${(rate / maxRate) * 100}%`,
                          background: sizeBandColor(i),
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-foreground w-20 text-right">
                      {rate} cm / 2mo
                    </span>
                  </div>
                );
              })}
              <div className="mt-2 text-[9px] text-muted-foreground font-mono leading-relaxed">
                Note: Growth decelerates as crocs get larger. Rates are averaged from measured inspection deltas.
              </div>
            </div>
          </div>

          {/* AI Advisory */}
          <div className="bg-card border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">AI Advisory</span>
              <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono bg-[hsla(var(--ct-accent),0.15)] text-[hsl(var(--ct-accent))]">Live</span>
            </div>
            <div className="px-4 py-4 text-xs leading-[1.8]">
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

          {/* Band Movement Flow */}
          {bandFlow && bandFlow.length > 0 && (
            <div className="bg-card border border-border rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">Band Transitions (Next Cycle)</span>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                {bandFlow[0].length > 0 ? bandFlow[0].sort((a, b) => b.count - a.count).slice(0, 6).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                    <span style={{ color: sizeBandColor(f.from) }}>{SIZE_BANDS[f.from]?.range}</span>
                    <span className="text-muted-foreground">→</span>
                    <span style={{ color: sizeBandColor(f.to) }}>{SIZE_BANDS[f.to]?.range}</span>
                    <span className="ml-auto text-foreground font-semibold">{f.count}</span>
                  </div>
                )) : (
                  <div className="text-[10px] text-muted-foreground font-mono">No band transitions projected</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* YTD Cull vs Target */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground tracking-[2px] uppercase">Year-to-Date Cull vs Annual Target</span>
          <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono bg-[hsla(var(--ct-info),0.15)] text-[hsl(var(--ct-info))]">From cull records</span>
        </div>
        <div className="px-4 py-4">
          <div className="grid grid-cols-6 gap-3">
            {SIZE_BANDS.map((b, i) => {
              const p = targets[i] > 0 ? Math.round(ytdCulled[i] / targets[i] * 100) : 0;
              const col = p >= 80 ? 'hsl(var(--ct-good))' : p >= 50 ? 'hsl(var(--ct-warn))' : 'hsl(var(--ct-danger))';
              return (
                <div key={i} className="bg-secondary rounded p-3.5 border border-border">
                  <div className="font-mono text-[9px] mb-1.5" style={{ color: sizeBandColor(i) }}>{b.range}</div>
                  <div className="font-serif text-[32px] font-semibold leading-none" style={{ color: col }}>{ytdCulled[i]}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">of {targets[i]} target</div>
                  <div className="h-[3px] bg-background rounded-sm mt-2 overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${Math.min(p, 100)}%`, background: col }} />
                  </div>
                  <div className="text-[10px] mt-1.5" style={{ color: col }}>
                    {targets[i] - ytdCulled[i] > 0 ? `${targets[i] - ytdCulled[i]} remaining` : '✓ Target met'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
