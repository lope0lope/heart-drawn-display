import { useAllCrocs } from '@/hooks/useCrocs';
import { SIZE_BANDS, sizeBand, sizeBandColor, GROWTH_RATES, YTD_CULLED, countSizeBands, getOccupied } from '@/lib/crocUtils';

function advBadge(now: number, next: number, target: number, ytd: number) {
  const rem = target - ytd;
  if (now > target * 0.28) return <><div className="inline-flex items-center gap-[5px] text-[10px] font-mono-ibm px-2 py-[3px] rounded-sm bg-[rgba(107,63,160,.15)] text-[#b39ddb]">● Cull ready</div><div className="text-[10px] text-ct-text3 mt-1">{now} available</div></>;
  if (next > now * 1.15) return <div className="inline-flex items-center gap-[5px] text-[10px] font-mono-ibm px-2 py-[3px] rounded-sm bg-[rgba(74,144,184,.15)] text-ct-info">● Hold — growth incoming</div>;
  if (rem > next * 1.5) return <><div className="inline-flex items-center gap-[5px] text-[10px] font-mono-ibm px-2 py-[3px] rounded-sm bg-[rgba(192,57,43,.15)] text-ct-danger">● Shortfall risk</div><div className="text-[10px] text-ct-text3 mt-1">{rem} still needed</div></>;
  return <div className="inline-flex items-center gap-[5px] text-[10px] font-mono-ibm px-2 py-[3px] rounded-sm bg-[rgba(76,175,80,.15)] text-ct-good">● On track</div>;
}

export default function ForecastScreen() {
  const { data: allCrocs, isLoading } = useAllCrocs();

  if (isLoading || !allCrocs) {
    return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading…</div>;
  }

  const occupied = getOccupied(allCrocs);
  const now = countSizeBands(occupied);
  const next = [0, 0, 0, 0, 0, 0];
  occupied.forEach(c => {
    if (!c.belly_cm) return;
    const b = sizeBand(c.belly_cm);
    if (b === null) return;
    const nb = sizeBand(c.belly_cm + GROWTH_RATES[b]);
    if (nb !== null) next[nb]++;
  });
  const targets = SIZE_BANDS.map(b => b.target);
  const maxC = Math.max(...now, ...next, ...targets, 1);

  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const plan = [[0, 0, 90, 0, 0, 80, 0, 0, 0], [0, 60, 0, 0, 70, 0, 0, 60, 0], [30, 0, 40, 30, 0, 40, 30, 0, 40], [94, 0, 80, 94, 0, 80, 94, 0, 80], [20, 30, 0, 20, 30, 0, 20, 30, 0], [now[5], 0, 0, 15, 0, 0, 15, 0, 0]];

  return (
    <div>
      <div className="bg-[rgba(201,168,76,.07)] border-l-[3px] border-l-ct-accent px-3.5 py-2.5 rounded-r text-xs text-ct-text2 leading-relaxed mb-4">
        Projections use average growth rates calculated from uploaded CSV history. <strong>Next Cycle</strong> = 2 months forward, no mortality assumed. Annual targets are per size category. The AI Advisory recalculates on each new upload.
      </div>

      <div className="grid grid-cols-[1fr_330px] gap-4">
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Size Category Forecast</span>
            <span className="font-mono-ibm text-[9px] text-ct-text3">
              <span className="text-ct-accent">■</span> Now &nbsp;
              <span className="text-ct-info">■</span> +2 months &nbsp;
              <span>| target</span>
            </span>
          </div>
          {SIZE_BANDS.map((b, i) => (
            <div key={i} className="grid grid-cols-[160px_1fr_190px] border-b border-border last:border-b-0">
              <div className="px-4 py-3.5 flex flex-col justify-center border-r border-border">
                <div className="font-display text-[22px] font-semibold text-ct-accent">{b.range}</div>
                <div className="text-[10px] text-ct-text3 font-mono-ibm mt-0.5">{b.product}</div>
              </div>
              <div className="px-4 py-3 flex flex-col gap-1.5 justify-center">
                {[
                  { label: 'NOW', value: now[i], color: 'var(--ct-accent)' },
                  { label: '+2 MO', value: next[i], color: 'var(--ct-info)' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="font-mono-ibm text-[9px] w-11 text-right" style={{ color: row.color }}>{row.label}</span>
                    <div className="flex-1 h-[9px] bg-surface-3 rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm transition-all duration-400" style={{ width: `${row.value / maxC * 100}%`, background: row.color }} />
                    </div>
                    <span className="font-mono-ibm text-[10px] w-8" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="font-mono-ibm text-[9px] text-ct-text3 w-11 text-right">TARGET</span>
                  <div className="flex-1 h-[9px] relative overflow-visible">
                    <div className="absolute h-[13px] w-0.5 bg-ct-text3 rounded-sm -top-0.5" style={{ left: `${targets[i] / maxC * 100}%` }} />
                  </div>
                  <span className="font-mono-ibm text-[10px] text-ct-text3 w-8">{targets[i]}</span>
                </div>
              </div>
              <div className="px-4 py-3 border-l border-border flex flex-col justify-center gap-1">
                {advBadge(now[i], next[i], targets[i], YTD_CULLED[i])}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">AI Culling Advisory</span>
              <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(201,168,76,.15)] text-ct-accent">AI</span>
            </div>
            <div className="px-[18px] py-4 text-xs text-ct-text2 leading-[1.8]">
              <strong className="text-ct-accent">Recommended action this cycle:</strong><br /><br />
              <span className="text-ct-good">✓ 35–39 cm</span> — cull <span className="text-ct-accent font-mono-ibm text-[11px]">94 units</span> now. Surplus will exceed pen capacity at +2 months.<br /><br />
              <span className="text-ct-good">✓ 45+ cm</span> — cull all <span className="text-ct-accent font-mono-ibm text-[11px]">{now[5]} available</span> above threshold immediately.<br /><br />
              <span className="text-ct-warn">⚠ 33–34 cm</span> — hold. Projected shortfall of <span className="text-ct-accent font-mono-ibm text-[11px]">68 units</span> vs annual target. Do not cull early.<br /><br />
              <span className="text-ct-info">ℹ 25–29 cm</span> — on track. Allow natural progression.
            </div>
          </div>

          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="px-[18px] py-3 border-b border-border">
              <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Month-by-Month Cull Plan</span>
            </div>
            <div className="px-[18px] py-4 overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 font-mono-ibm text-[9px] text-ct-text3 border-b border-border">Band</th>
                    {months.map(m => <th key={m} className="p-1.5 font-mono-ibm text-[9px] text-ct-text3 border-b border-border text-center">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {SIZE_BANDS.map((b, i) => (
                    <tr key={i}>
                      <td className="p-[5px_6px] font-mono-ibm text-[10px]" style={{ color: sizeBandColor(i) }}>{b.range}</td>
                      {plan[i].map((v, j) => <td key={j} className={`p-[5px] text-center font-mono-ibm text-[10px] ${v > 0 ? 'text-ct-text' : 'text-ct-text3'}`}>{v > 0 ? v : '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Avg Growth Rates</span>
              <span className="font-mono-ibm text-[9px] text-ct-text3">From CSV</span>
            </div>
            <div className="px-[18px] py-4">
              {SIZE_BANDS.map((b, i) => (
                <div key={i} className="flex justify-between py-[5px] border-b border-border text-xs">
                  <span className="font-mono-ibm" style={{ color: sizeBandColor(i) }}>{b.range}</span>
                  <span className="font-mono-ibm text-ct-text2">{GROWTH_RATES[i]} cm / 2 months</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3.5 bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Year-to-Date Cull vs Annual Target</span>
          <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(74,144,184,.15)] text-ct-info">Updated from last upload</span>
        </div>
        <div className="px-[18px] py-4">
          <div className="grid grid-cols-6 gap-3">
            {SIZE_BANDS.map((b, i) => {
              const p = Math.round(YTD_CULLED[i] / b.target * 100);
              const col = p >= 80 ? 'var(--ct-good)' : p >= 50 ? 'var(--ct-warn)' : 'var(--ct-danger)';
              return (
                <div key={i} className="bg-surface-2 rounded p-3.5 border border-border">
                  <div className="font-mono-ibm text-[9px] mb-1.5" style={{ color: sizeBandColor(i) }}>{b.range}</div>
                  <div className="font-display text-[34px] font-semibold leading-none" style={{ color: col }}>{YTD_CULLED[i]}</div>
                  <div className="text-[10px] text-ct-text3 mt-0.5">of {b.target} target</div>
                  <div className="h-[3px] bg-surface-3 rounded-sm mt-2 overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${p}%`, background: col }} />
                  </div>
                  <div className="text-[10px] mt-1.5" style={{ color: col }}>
                    {b.target - YTD_CULLED[i] > 0 ? `${b.target - YTD_CULLED[i]} remaining` : '✓ Target met'}
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
