import { useState } from 'react';
import { FEED_DATA } from '@/data/mockData';

export default function FeedReportsScreen() {
  const [penSel, setPenSel] = useState('GH1');
  const [cycleSel, setCycleSel] = useState('Cycle 3 (Feb–Apr 2026)');
  const cycleKey = cycleSel.startsWith('Cycle 3') ? 'cycle3_kg' : cycleSel.startsWith('Cycle 2') ? 'cycle2_kg' : 'cycle1_kg' as const;

  const pens = penSel === 'ALL' ? ['GH1', 'GH2'] : [penSel];
  const allLines = pens.flatMap(p => FEED_DATA[p].lines.map(l => ({ ...l, pen: p })));
  const totalFeed = allLines.reduce((s, l) => s + l[cycleKey], 0);
  const totalCrocs = allLines.reduce((s, l) => s + l.crocs, 0);
  const avgPerCroc = totalCrocs > 0 ? (totalFeed / totalCrocs * 1000) : 0;
  const maxLine = Math.max(...allLines.map(l => l[cycleKey]), 1);
  const highestLine = allLines.reduce((a, b) => b[cycleKey] > a[cycleKey] ? b : a);

  const months = penSel === 'ALL'
    ? FEED_DATA.GH1.monthly.map((m, i) => ({ month: m.month, kg: m.kg + FEED_DATA.GH2.monthly[i].kg }))
    : FEED_DATA[penSel].monthly;
  const maxM = Math.max(...months.map(m => m.kg), 1);

  const cullData = [
    { batch: '5000–5600', culled: 94, avgCycles: 4.2, avgFeedPerCycle_kg: 2.8 },
    { batch: '5601–6200', culled: 68, avgCycles: 3.8, avgFeedPerCycle_kg: 2.6 },
    { batch: '6201–6800', culled: 42, avgCycles: 3.5, avgFeedPerCycle_kg: 2.5 },
  ].map(d => ({ ...d, totalEst_kg: +(d.avgCycles * d.avgFeedPerCycle_kg).toFixed(1) }));

  return (
    <div>
      <div className="bg-[rgba(201,168,76,.07)] border-l-[3px] border-l-ct-accent px-3.5 py-2.5 rounded-r text-xs text-ct-text2 leading-relaxed mb-4">
        Feed data is captured every <strong>2 months</strong> per inspection cycle. All measurements in <strong>grams (g)</strong> or <strong>kilograms (kg)</strong>. Average feed per crocodile is calculated as <strong>Total Feed ÷ Number of Crocodiles in Pen Line</strong>.
      </div>

      <div className="flex gap-2.5 items-center mb-3.5">
        <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none" value={penSel} onChange={e => setPenSel(e.target.value)}>
          <option value="GH1">GH1</option><option value="GH2">GH2</option><option value="ALL">All Pens</option>
        </select>
        <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none" value={cycleSel} onChange={e => setCycleSel(e.target.value)}>
          <option>Cycle 3 (Feb–Apr 2026)</option><option>Cycle 2 (Dec 2025–Feb 2026)</option><option>Cycle 1 (Oct–Dec 2025)</option>
        </select>
        <button className="ml-auto bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] rounded-sm cursor-pointer hover:border-ct-accent hover:bg-surface-2">⎙ Print Report</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3.5 mb-4">
        {[
          { label: 'Total Feed (Cycle)', value: `${totalFeed.toLocaleString()} kg`, sub: 'All lines combined' },
          { label: 'Avg per Crocodile', value: `${avgPerCroc.toFixed(0)} g`, sub: 'Per 2-month cycle', cls: 'info' },
          { label: 'Total Crocodiles', value: totalCrocs.toLocaleString(), sub: 'Across selected pens' },
          { label: 'Highest Feed Line', value: `${highestLine.pen} — Row ${highestLine.line}`, sub: `${Math.max(...allLines.map(l => l[cycleKey]))} kg`, cls: 'warn' },
        ].map((k, i) => (
          <div key={i} className="bg-surface border border-border rounded p-4 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${k.cls === 'warn' ? 'bg-ct-warn' : k.cls === 'info' ? 'bg-ct-info' : 'bg-ct-accent'}`} />
            <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-2">{k.label}</div>
            <div className="font-display text-[28px] font-semibold text-ct-text leading-none">{k.value}</div>
            <div className="text-[11px] text-ct-text3 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-3.5 mb-3.5">
        {/* Feed Per Line */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Feed Per Pen Line — Current Cycle</span>
            <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(201,168,76,.15)] text-ct-accent">kg · avg per croc</span>
          </div>
          <div className="px-[18px] py-4">
            <div className="grid grid-cols-[60px_80px_1fr_80px_80px] gap-1 font-mono-ibm text-[9px] text-ct-text3 pb-2 border-b border-border tracking-[1px] uppercase">
              <span>Line</span><span>Crocs</span><span>Feed</span><span>Avg/Croc</span><span>vs Prev</span>
            </div>
            {allLines.map((l, i) => {
              const avg = (l[cycleKey] / l.crocs * 1000).toFixed(0);
              const prevKey = cycleKey === 'cycle3_kg' ? 'cycle2_kg' : cycleKey === 'cycle2_kg' ? 'cycle1_kg' : null;
              const delta = prevKey ? ((l[cycleKey] - l[prevKey as keyof typeof l] as number) / (l[prevKey as keyof typeof l] as number) * 100) : null;
              const col = delta === null ? 'text-ct-text3' : delta > 0 ? 'text-ct-good' : delta < -5 ? 'text-ct-danger' : 'text-ct-warn';
              const isLow = l.line === 'J';
              return (
                <div key={i} className="grid grid-cols-[60px_80px_1fr_80px_80px] gap-1 items-center py-1.5 border-b border-[rgba(255,255,255,.04)]">
                  <span className="font-mono-ibm text-[11px] text-ct-accent">{l.pen} — {l.line}</span>
                  <span className="text-[11px] text-ct-text2">{l.crocs}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-[7px] bg-surface-3 rounded-sm overflow-hidden">
                      <div className={`h-full rounded-sm ${isLow ? 'bg-ct-danger' : 'bg-ct-accent'}`} style={{ width: `${l[cycleKey] / maxLine * 100}%` }} />
                    </div>
                    <span className="font-mono-ibm text-[10px] text-ct-text2 min-w-[52px]">{l[cycleKey]} kg</span>
                  </div>
                  <span className="font-mono-ibm text-[10px] text-ct-text2">{avg} g</span>
                  <span className={`font-mono-ibm text-[10px] ${col}`}>{delta === null ? '—' : delta > 0 ? `↑ ${delta.toFixed(1)}%` : `↓ ${Math.abs(delta).toFixed(1)}%`}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Totals */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Monthly Feed Totals</span>
          </div>
          <div className="px-[18px] py-4">
            {months.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 mb-1.5">
                <span className="font-mono-ibm text-[9px] text-ct-text3 w-[62px]">{m.month}</span>
                <div className="flex-1 h-[9px] bg-surface-3 rounded-sm overflow-hidden">
                  <div className="h-full bg-ct-info rounded-sm" style={{ width: `${m.kg / maxM * 100}%` }} />
                </div>
                <span className="font-mono-ibm text-[10px] text-ct-info min-w-[60px]">{m.kg.toLocaleString()} kg</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cull Impact */}
      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Cull Impact Estimation — Feed Intake at Time of Cull</span>
          <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(212,137,42,.15)] text-ct-warn">Based on historical consumption</span>
        </div>
        <div className="px-[18px] py-4">
          <div className="grid grid-cols-5 gap-1 font-mono-ibm text-[9px] text-ct-text3 pb-2 border-b border-border tracking-[1px] uppercase">
            <span>Batch</span><span className="text-center">Culled</span><span className="text-center">Avg Cycles</span><span className="text-center">Avg Feed/Cycle</span><span className="text-center">Est. Lifetime Feed</span>
          </div>
          {cullData.map((d, i) => (
            <div key={i} className="grid grid-cols-5 gap-1 items-center py-2 border-b border-[rgba(255,255,255,.04)] text-xs">
              <span className="font-mono-ibm text-ct-accent">{d.batch}</span>
              <span className="text-center font-mono-ibm text-ct-text2">{d.culled}</span>
              <span className="text-center font-mono-ibm text-ct-text2">{d.avgCycles}</span>
              <span className="text-center font-mono-ibm text-ct-text2">{(d.avgFeedPerCycle_kg * 1000).toFixed(0)} g</span>
              <span className="text-center font-display text-xl text-ct-cull">{d.totalEst_kg} kg</span>
            </div>
          ))}
          <div className="mt-2.5 font-mono-ibm text-[9px] text-ct-text3 leading-[1.8]">
            ※ Lifetime feed estimate = Avg Cycles × Avg Feed per Cycle · Based on historical consumption patterns.
          </div>
        </div>
      </div>
    </div>
  );
}
