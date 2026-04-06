import { useAllCrocs, useConditionCodes } from '@/hooks/useCrocs';
import { getOccupied, countConditions } from '@/lib/crocUtils';

export default function AnalyticsScreen() {
  const { data: allCrocs, isLoading } = useAllCrocs();
  const { data: conditionDefs } = useConditionCodes();

  if (isLoading || !allCrocs) {
    return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading…</div>;
  }

  const occupied = getOccupied(allCrocs);
  const cc = countConditions(occupied);

  // Build real condition density heatmap from data
  const gh1 = allCrocs.filter(c => c.pen_id === 'GH1');
  const lines = [...new Set(gh1.map(c => c.line))].sort();
  const maxSlot = Math.max(...gh1.map(c => c.pen_slot), 1);
  const heatCols = Math.min(maxSlot, 54);

  // Build a lookup for condition density
  const lineSlotConds: Map<string, number> = new Map();
  gh1.forEach(c => {
    const key = `${c.line}-${c.pen_slot}`;
    lineSlotConds.set(key, c.condition_codes.length);
  });

  // MN analysis by line across all pens
  const mnByLine: Record<string, number> = {};
  const dsByLine: Record<string, number> = {};
  allCrocs.forEach(c => {
    if (c.condition_codes.includes('MN')) mnByLine[c.line] = (mnByLine[c.line] || 0) + 1;
    if (c.condition_codes.includes('DS')) dsByLine[c.line] = (dsByLine[c.line] || 0) + 1;
  });

  // Batch comparison - group by size ranges  
  const batchLines = ['A', 'B', 'C', 'D'];
  const avgByLine = batchLines.map(line => {
    const lineCrocs = occupied.filter(c => c.line === line && c.belly_cm);
    const avg = lineCrocs.length > 0 ? Math.round(lineCrocs.reduce((s, c) => s + c.belly_cm!, 0) / lineCrocs.length) : 0;
    return { line, count: lineCrocs.length, avg };
  });

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
            {[
              ['Condition Code', 'Pen', 'Size Band', 'Line', 'Grade'],
              ['contains', 'equals', 'greater than', 'less than'],
              conditionDefs?.map(c => c.code) ?? ['DS', 'BA', 'MN'],
            ].map((opts, i) => (
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
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${heatCols}, 1fr)` }}>
            {lines.flatMap(line =>
              Array.from({ length: heatCols }, (_, ci) => {
                const v = lineSlotConds.get(`${line}-${ci + 1}`) ?? 0;
                const intensity = Math.min(v / 3, 1);
                return (
                  <div
                    key={`${line}-${ci}`}
                    className="h-[11px] rounded-[1px] cursor-pointer"
                    style={{ background: `rgba(212,137,42, ${intensity > 0 ? 0.3 + intensity * 0.7 : 0.05})` }}
                    title={`Line ${line}, Slot ${ci + 1}: ${v} conditions`}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Feeder Analysis */}
      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Malnourishment — Line & Feeder Analysis</span>
        </div>
        <div className="px-[18px] py-4">
          {Object.keys(mnByLine).length === 0 && Object.keys(dsByLine).length === 0 ? (
            <div className="text-xs text-ct-text3 text-center py-3">No MN or DS flags in current dataset</div>
          ) : (
            <>
              {Object.entries(mnByLine).sort((a, b) => b[1] - a[1]).map(([line, count]) => (
                <div key={line} className="mb-2.5">
                  <div className="font-mono-ibm text-[10px] text-ct-danger mb-1">Line {line} — {count} MN flags</div>
                  <div className="text-xs text-ct-text2">Feeder line {line} — {count} malnourished crocs. Inspect feeder.</div>
                </div>
              ))}
              {Object.entries(dsByLine).sort((a, b) => b[1] - a[1]).map(([line, count]) => (
                <div key={line} className="mb-2.5">
                  <div className="font-mono-ibm text-[10px] text-ct-warn mb-1">Line {line} — {count} DS flags</div>
                  <div className="text-xs text-ct-text2">Water quality check recommended.</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Condition Summary */}
      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Condition Summary — All Pens</span>
        </div>
        <div className="px-[18px] py-4">
          {Object.keys(cc).length === 0 ? (
            <div className="text-xs text-ct-text3 text-center py-3">No conditions flagged in current dataset</div>
          ) : (
            Object.entries(cc).sort((a, b) => b[1] - a[1]).map(([code, count]) => {
              const def = conditionDefs?.find(c => c.code === code);
              const maxCount = Math.max(...Object.values(cc), 1);
              return (
                <div key={code} className="mb-2.5">
                  <div className="flex justify-between text-[11px] mb-[3px]">
                    <span className="font-mono-ibm" style={{ color: def ? `hsl(var(${def.color_var}))` : undefined }}>{code} — {def?.name ?? code}</span>
                    <span className="text-ct-text3 font-mono-ibm">{count} crocs</span>
                  </div>
                  <div className="h-[7px] bg-surface-3 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${count / maxCount * 100}%`, background: def ? `hsl(var(${def.color_var}))` : 'hsl(var(--ct-warn))' }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Line Comparison */}
      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Avg Belly Size by Line</span>
        </div>
        <div className="px-[18px] py-4">
          <div className="flex gap-2 font-mono-ibm text-[9px] text-ct-text3 pb-1.5 border-b border-border">
            <span className="flex-1">Line</span>
            <span className="w-[52px] text-center">Count</span>
            <span className="w-[52px] text-center">Avg cm</span>
          </div>
          {[...new Set(occupied.map(c => c.line))].sort().map(line => {
            const lineCrocs = occupied.filter(c => c.line === line && c.belly_cm);
            const avg = lineCrocs.length > 0 ? (lineCrocs.reduce((s, c) => s + c.belly_cm!, 0) / lineCrocs.length).toFixed(1) : '—';
            return (
              <div key={line} className="flex gap-2 items-center text-xs py-1">
                <span className="flex-1 font-mono-ibm text-[10px] text-ct-accent">{line}</span>
                <span className="w-[52px] text-center text-ct-text2">{lineCrocs.length}</span>
                <span className="w-[52px] text-center text-ct-text2">{avg}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
