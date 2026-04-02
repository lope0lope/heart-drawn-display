import { ROWS } from '@/data/mockData';

export default function AnalyticsScreen() {
  // Seeded random for heatmap
  let seed = 42;
  function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

  const heatR = 13, heatC = 25;
  const heatmapCells: { r: number; c: number; v: number }[] = [];
  for (let ri = 0; ri < heatR; ri++)
    for (let ci = 0; ci < heatC; ci++) {
      const v = ri === 5 ? 0.4 + rand() * 0.5 : ri === 9 ? 0.6 + rand() * 0.4 : rand() * 0.25;
      heatmapCells.push({ r: ri, c: ci, v });
    }

  const feederData = [
    { row: 'J', mn: 3, note: 'Feeder line J — 3 MN flags. Possible blocked nozzle or low flow rate.', col: 'text-ct-danger' },
    { row: 'F', mn: 0, note: 'Row F — no MN but elevated DS cluster. Water quality suspect.', col: 'text-ct-warn' },
    { row: 'B', mn: 0, note: 'Row B — normal feed distribution.', col: 'text-ct-good' },
  ];

  const heal = [
    { code: 'DS', name: 'Double Scale', n: 112, c: 2.1, colorVar: '--c-ds' },
    { code: 'FW', name: 'Fighting Wound', n: 76, c: 1.4, colorVar: '--c-r' },
    { code: 'BM', name: 'Bacteria Mark', n: 55, c: 1.8, colorVar: '--c-ba' },
    { code: 'RA', name: 'Rash', n: 38, c: 0.9, colorVar: '--c-r' },
  ];

  const batches = [
    ['5000–5600', 34, 41, 48],
    ['5601–6200', 27, 35, 42],
    ['6201–6800', 22, 29, 36],
    ['6801–7400', 18, 24, 31],
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {/* Query Builder */}
      <div className="col-span-2 bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Dynamic Query Builder</span>
        </div>
        <div className="px-[18px] py-4">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="font-mono-ibm text-[10px] text-ct-text3">WHERE</span>
            {[['Condition Code', 'Pen', 'Size Band', 'Days in System', 'Batch'], ['contains', 'equals', 'greater than', 'less than'], ['DS', 'FW', 'BM', 'RA', 'MN']].map((opts, i) => (
              <select key={i} className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none">
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
            <button className="bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] rounded-sm cursor-pointer">+ AND</button>
            <select className="ml-auto bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none">
              <option>Show as: Heatmap</option><option>Show as: Table</option><option>Show as: Bar Chart</option>
            </select>
            <button className="bg-ct-accent text-background px-[18px] py-2 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer">Run →</button>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Condition Density Heatmap — GH1</span>
        </div>
        <div className="px-[18px] py-4">
          <div className="font-mono-ibm text-[9px] text-ct-text3 mb-2">Cell = pen slot · colour intensity = condition density</div>
          <div className="flex gap-1.5 items-center mb-2">
            <span className="text-[9px] text-ct-text3 font-mono-ibm">NONE</span>
            <div className="flex-1 h-[5px] rounded-sm" style={{ background: 'linear-gradient(to right, hsl(var(--surface3)), hsl(var(--ct-warn)), hsl(var(--ct-danger)))' }} />
            <span className="text-[9px] text-ct-text3 font-mono-ibm">HIGH</span>
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${heatC}, 1fr)` }}>
            {heatmapCells.map((cell, idx) => (
              <div
                key={idx}
                className="h-[11px] rounded-[1px] cursor-pointer"
                style={{ background: `rgba(${cell.r === 9 ? '255,107,53' : '212,137,42'}, ${cell.v.toFixed(2)})` }}
                title={`Row ${ROWS[cell.r]}, Col ${cell.c + 1}: ${Math.round(cell.v * 100)}%`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Feeder Analysis */}
      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Malnourishment — Row & Feeder Analysis</span>
        </div>
        <div className="px-[18px] py-4">
          {feederData.map((f, i) => (
            <div key={i} className="mb-2.5 last:mb-0">
              <div className={`font-mono-ibm text-[10px] mb-1 ${f.col}`}>Row {f.row} {f.mn > 0 ? `— ${f.mn} MN flags` : ''}</div>
              <div className="text-xs text-ct-text2">{f.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Healing Trajectories */}
      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Treatment Hold — Healing Trajectories</span>
        </div>
        <div className="px-[18px] py-4">
          {heal.map((h, i) => (
            <div key={i} className="mb-2.5">
              <div className="flex justify-between text-[11px] mb-[3px]">
                <span className="font-mono-ibm" style={{ color: `hsl(var(${h.colorVar}))` }}>{h.code} — {h.name}</span>
                <span className="text-ct-text3 font-mono-ibm">{h.n} crocs · avg {h.c} cycles</span>
              </div>
              <div className="h-[7px] bg-surface-3 rounded-sm overflow-hidden">
                <div className="h-full rounded-sm" style={{ width: `${Math.min(h.c / 3 * 100, 100)}%`, background: `hsl(var(${h.colorVar}))` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Batch Comparison */}
      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Batch Comparison — Avg Size by Cycle</span>
        </div>
        <div className="px-[18px] py-4">
          <div className="flex gap-2 font-mono-ibm text-[9px] text-ct-text3 pb-1.5 border-b border-border">
            <span className="flex-1">Batch</span>
            <span className="w-[52px] text-center">Cycle 1</span>
            <span className="w-[52px] text-center">Cycle 2</span>
            <span className="w-[52px] text-center">Cycle 3</span>
          </div>
          {batches.map((b, i) => (
            <div key={i} className="flex gap-2 items-center text-xs py-1">
              <span className="flex-1 font-mono-ibm text-[10px] text-ct-accent">{b[0]}</span>
              {(b.slice(1) as number[]).map((v, j) => (
                <span key={j} className="w-[52px] text-center text-ct-text2">{v} cm</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
