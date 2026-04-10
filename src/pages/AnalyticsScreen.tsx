import { useState, useMemo } from 'react';
import { useAllCrocs, useConditionCodes, type CrocRecord } from '@/hooks/useCrocs';
import { getOccupied, countConditions, sizeBand } from '@/lib/crocUtils';

type ViewMode = 'heatmap' | 'table' | 'bar';

export default function AnalyticsScreen() {
  const { data: allCrocs, isLoading } = useAllCrocs();
  const { data: conditionDefs } = useConditionCodes();

  // Query builder state
  const [filterField, setFilterField] = useState('Condition Code');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [queryApplied, setQueryApplied] = useState(false);

  if (isLoading || !allCrocs) {
    return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading…</div>;
  }

  const occupied = getOccupied(allCrocs);

  // Filter logic
  const filteredCrocs = useMemo(() => {
    if (!queryApplied || !filterValue) return occupied;
    return occupied.filter(c => {
      switch (filterField) {
        case 'Condition Code':
          return filterOp === 'contains'
            ? c.condition_codes.includes(filterValue)
            : !c.condition_codes.includes(filterValue);
        case 'Pen':
          return filterOp === 'equals' ? c.pen_id === filterValue : c.pen_id !== filterValue;
        case 'Size Band': {
          const band = sizeBand(c.belly_cm ?? 0);
          const target = parseInt(filterValue);
          if (filterOp === 'equals') return band === target;
          if (filterOp === 'greater than') return (band ?? -1) > target;
          if (filterOp === 'less than') return (band ?? 99) < target;
          return true;
        }
        case 'Line':
          return filterOp === 'equals' ? c.line === filterValue : c.line !== filterValue;
        case 'Grade': {
          const g = c.grade ?? 0;
          const target = parseInt(filterValue);
          if (filterOp === 'equals') return g === target;
          if (filterOp === 'greater than') return g > target;
          if (filterOp === 'less than') return g < target;
          return true;
        }
        default:
          return true;
      }
    });
  }, [occupied, filterField, filterOp, filterValue, queryApplied]);

  const cc = countConditions(filteredCrocs);

  // Heatmap data — use GH1 from filtered set
  const gh1 = filteredCrocs.filter(c => c.pen_id === 'GH1');
  const lines = [...new Set(gh1.map(c => c.line))].sort();
  const maxSlot = Math.max(...gh1.map(c => c.pen_slot), 1);
  const heatCols = Math.min(maxSlot, 54);

  const lineSlotConds: Map<string, number> = new Map();
  gh1.forEach(c => {
    const key = `${c.line}-${c.pen_slot}`;
    lineSlotConds.set(key, c.condition_codes.length);
  });

  // MN/DS analysis
  const mnByLine: Record<string, number> = {};
  const dsByLine: Record<string, number> = {};
  filteredCrocs.forEach(c => {
    if (c.condition_codes.includes('MN')) mnByLine[c.line] = (mnByLine[c.line] || 0) + 1;
    if (c.condition_codes.includes('DS')) dsByLine[c.line] = (dsByLine[c.line] || 0) + 1;
  });

  // Filter value options
  const valueOptions = useMemo(() => {
    switch (filterField) {
      case 'Condition Code': return conditionDefs?.map(c => c.code) ?? [];
      case 'Pen': return ['GH1', 'GH2'];
      case 'Size Band': return ['0', '1', '2', '3', '4', '5'];
      case 'Line': return [...new Set(allCrocs.map(c => c.line))].sort();
      case 'Grade': return ['1', '2', '3', '4', '5'];
      default: return [];
    }
  }, [filterField, conditionDefs, allCrocs]);

  const handleRun = () => {
    setQueryApplied(true);
  };

  const handleClear = () => {
    setQueryApplied(false);
    setFilterValue('');
  };

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
            <select
              className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none"
              value={filterField}
              onChange={e => { setFilterField(e.target.value); setFilterValue(''); setQueryApplied(false); }}
            >
              {['Condition Code', 'Pen', 'Size Band', 'Line', 'Grade'].map(o => <option key={o}>{o}</option>)}
            </select>
            <select
              className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none"
              value={filterOp}
              onChange={e => setFilterOp(e.target.value)}
            >
              {['contains', 'equals', 'greater than', 'less than'].map(o => <option key={o}>{o}</option>)}
            </select>
            <select
              className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none"
              value={filterValue}
              onChange={e => setFilterValue(e.target.value)}
            >
              <option value="">Select…</option>
              {valueOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {queryApplied && (
              <button className="bg-transparent text-ct-danger border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] rounded-sm cursor-pointer" onClick={handleClear}>✕ Clear</button>
            )}
            <select
              className="ml-auto bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none"
              value={viewMode}
              onChange={e => setViewMode(e.target.value as ViewMode)}
            >
              <option value="heatmap">Show as: Heatmap</option>
              <option value="table">Show as: Table</option>
              <option value="bar">Show as: Bar Chart</option>
            </select>
            <button
              className="bg-ct-accent text-background px-[18px] py-2 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer"
              onClick={handleRun}
            >
              Run →
            </button>
          </div>
          {queryApplied && (
            <div className="mt-2 font-mono-ibm text-[10px] text-ct-accent">
              Showing {filteredCrocs.length} of {occupied.length} crocs · Filter: {filterField} {filterOp} "{filterValue}"
            </div>
          )}
        </div>
      </div>

      {/* Results — Heatmap */}
      {viewMode === 'heatmap' && (
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Condition Density Heatmap — GH1 {queryApplied && `(${gh1.length} crocs)`}</span>
          </div>
          <div className="px-[18px] py-4">
            <div className="font-mono-ibm text-[9px] text-ct-text3 mb-2">Cell = pen slot · colour intensity = condition density</div>
            <div className="flex gap-1.5 items-center mb-2">
              <span className="text-[9px] text-ct-text3 font-mono-ibm">NONE</span>
              <div className="flex-1 h-[5px] rounded-sm" style={{ background: 'linear-gradient(to right, hsl(var(--surface3)), hsl(var(--ct-warn)), hsl(var(--ct-danger)))' }} />
              <span className="text-[9px] text-ct-text3 font-mono-ibm">HIGH</span>
            </div>
            {lines.length === 0 ? (
              <div className="text-xs text-ct-text3 text-center py-5">No GH1 data matches query</div>
            ) : (
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
            )}
          </div>
        </div>
      )}

      {/* Results — Table */}
      {viewMode === 'table' && (
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Filtered Results — Table ({filteredCrocs.length} crocs)</span>
          </div>
          <div className="px-[18px] py-4 max-h-[400px] overflow-y-auto">
            <div className="grid grid-cols-[60px_60px_50px_80px_1fr] gap-1 font-mono-ibm text-[9px] text-ct-text3 pb-2 border-b border-border tracking-[1px] uppercase">
              <span>Pen</span><span>Line</span><span>Slot</span><span>Belly</span><span>Conditions</span>
            </div>
            {filteredCrocs.slice(0, 100).map(c => (
              <div key={c.id} className="grid grid-cols-[60px_60px_50px_80px_1fr] gap-1 items-center py-1 border-b border-[rgba(255,255,255,.04)] text-[11px]">
                <span className="font-mono-ibm text-ct-accent">{c.pen_id}</span>
                <span className="text-ct-text2">{c.line}</span>
                <span className="text-ct-text2">{c.pen_slot}</span>
                <span className="text-ct-text2">{c.belly_cm ? `${c.belly_cm} cm` : '—'}</span>
                <span className="font-mono-ibm text-ct-warn">{c.condition_codes.join(', ') || '—'}</span>
              </div>
            ))}
            {filteredCrocs.length > 100 && (
              <div className="text-xs text-ct-text3 text-center py-2">Showing first 100 of {filteredCrocs.length}</div>
            )}
          </div>
        </div>
      )}

      {/* Results — Bar Chart */}
      {viewMode === 'bar' && (
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Condition Distribution — Bar ({filteredCrocs.length} crocs)</span>
          </div>
          <div className="px-[18px] py-4">
            {Object.keys(cc).length === 0 ? (
              <div className="text-xs text-ct-text3 text-center py-5">No conditions in filtered set</div>
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
      )}

      {/* Feeder Analysis */}
      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Malnourishment — Line & Feeder Analysis</span>
        </div>
        <div className="px-[18px] py-4">
          {Object.keys(mnByLine).length === 0 && Object.keys(dsByLine).length === 0 ? (
            <div className="text-xs text-ct-text3 text-center py-3">No MN or DS flags in {queryApplied ? 'filtered' : 'current'} dataset</div>
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
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Condition Summary — {queryApplied ? 'Filtered' : 'All Pens'}</span>
        </div>
        <div className="px-[18px] py-4">
          {Object.keys(cc).length === 0 ? (
            <div className="text-xs text-ct-text3 text-center py-3">No conditions flagged</div>
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
          {[...new Set(filteredCrocs.map(c => c.line))].sort().map(line => {
            const lineCrocs = filteredCrocs.filter(c => c.line === line && c.belly_cm);
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
