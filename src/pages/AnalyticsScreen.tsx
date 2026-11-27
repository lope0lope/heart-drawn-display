import { useState, useMemo } from 'react';
import { useAllCrocs, useConditionCodes, useInspectionHistory, type CrocRecord } from '@/hooks/useCrocs';
import { useCullRecords } from '@/hooks/useCullData';
import { getOccupied, countConditions, sizeBand, sizeBandColor, SIZE_BANDS } from '@/lib/crocUtils';
import { buildCulledReportRows, summarizeLine } from '@/lib/lineReports';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type ViewMode = 'heatmap' | 'table' | 'bar';

function Panel({ title, pill, children, className }: { title: string; pill?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded overflow-hidden ${className ?? ''}`}>
      <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">{title}</span>
        {pill}
      </div>
      <div className="px-[18px] py-4">{children}</div>
    </div>
  );
}

export default function AnalyticsScreen() {
  const { data: allCrocs, isLoading } = useAllCrocs(true);
  const { data: conditionDefs } = useConditionCodes();
  const { data: cullRecords, isLoading: isLoadingCullRecords, error: cullRecordsError } = useCullRecords();

  const [filterField, setFilterField] = useState('Condition Code');
  const [filterOp, setFilterOp] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [queryApplied, setQueryApplied] = useState(false);
  const [lineReportLine, setLineReportLine] = useState('M');
  const [includeCulledInLineReport, setIncludeCulledInLineReport] = useState(false);
  const [culledReportMonth, setCulledReportMonth] = useState('all');

  const activeCrocs = useMemo(
    () => (allCrocs ?? []).filter(c => c.cull_schedule !== 'CULLED'),
    [allCrocs],
  );
  const occupied = useMemo(() => getOccupied(activeCrocs), [activeCrocs]);

  const filteredCrocs = useMemo(() => {
    if (!queryApplied || !filterValue) return occupied;
    return occupied.filter(c => {
      switch (filterField) {
        case 'Condition Code':
          return filterOp === 'contains' ? c.condition_codes.includes(filterValue) : !c.condition_codes.includes(filterValue);
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
        default: return true;
      }
    });
  }, [occupied, filterField, filterOp, filterValue, queryApplied]);

  const cc = useMemo(() => countConditions(filteredCrocs), [filteredCrocs]);

  const valueOptions = useMemo(() => {
    switch (filterField) {
      case 'Condition Code': return conditionDefs?.map(c => c.code) ?? [];
      case 'Pen': return ['GH1', 'GH2'];
      case 'Size Band': return ['0', '1', '2', '3', '4', '5'];
      case 'Line': return [...new Set(activeCrocs.map(c => c.line))].sort();
      default: return [];
    }
  }, [filterField, conditionDefs, activeCrocs]);

  const lineReportCrocs = useMemo(
    () => includeCulledInLineReport ? allCrocs ?? [] : activeCrocs,
    [includeCulledInLineReport, allCrocs, activeCrocs],
  );
  const lineOptions = useMemo(
    () => [...new Set(lineReportCrocs.map(c => c.line))].sort(),
    [lineReportCrocs],
  );
  const selectedLine = lineOptions.includes(lineReportLine) ? lineReportLine : lineOptions[0] ?? '';
  const lineRows = useMemo(
    () => lineReportCrocs.filter(c => c.line === selectedLine),
    [lineReportCrocs, selectedLine],
  );
  const lineSummary = useMemo(() => summarizeLine(lineRows), [lineRows]);

  const culledRows = useMemo(
    () => buildCulledReportRows(allCrocs ?? [], cullRecords ?? []),
    [allCrocs, cullRecords],
  );
  const culledMonths = useMemo(
    () => [...new Set(culledRows.map(row => row.date.slice(0, 7)))].sort().reverse(),
    [culledRows],
  );
  const visibleCulledRows = culledReportMonth === 'all'
    ? culledRows
    : culledRows.filter(row => row.date.startsWith(`${culledReportMonth}-`));

  // Batch comparison: avg belly by tag range
  const batchComparison = useMemo(() => {
    const ranges = [
      { label: '5000–5600', min: 5000, max: 5600 },
      { label: '5601–6200', min: 5601, max: 6200 },
      { label: '6201–6800', min: 6201, max: 6800 },
      { label: '6801+', min: 6801, max: 999999 },
    ];
    return ranges.map(r => {
      const batch = occupied.filter(c => {
        const t = parseInt(c.tag ?? '');
        return !isNaN(t) && t >= r.min && t <= r.max;
      });
      const withBelly = batch.filter(c => c.belly_cm !== null);
      const avg = withBelly.length > 0 ? Math.round(withBelly.reduce((s, c) => s + c.belly_cm!, 0) / withBelly.length * 10) / 10 : 0;
      const flagged = batch.filter(c => c.condition_codes.length > 0).length;
      return { ...r, count: batch.length, avg, flagged };
    }).filter(r => r.count > 0);
  }, [occupied]);

  if (isLoading || !allCrocs) {
    return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading…</div>;
  }

  // Heatmap data — both pens
  const pens = ['GH1', 'GH2'];

  const mnByLine: Record<string, number> = {};
  const dsByLine: Record<string, number> = {};
  filteredCrocs.forEach(c => {
    if (c.condition_codes.includes('MN')) mnByLine[c.line] = (mnByLine[c.line] || 0) + 1;
    if (c.condition_codes.includes('DS')) dsByLine[c.line] = (dsByLine[c.line] || 0) + 1;
  });

  const handleRun = () => setQueryApplied(true);
  const handleClear = () => { setQueryApplied(false); setFilterValue(''); };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {/* Query Builder */}
      <div className="md:col-span-2 bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Dynamic Query Builder</span>
        </div>
        <div className="px-[18px] py-4">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="font-mono-ibm text-[10px] text-ct-text3">WHERE</span>
            <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none" value={filterField} onChange={e => { setFilterField(e.target.value); setFilterValue(''); setQueryApplied(false); }}>
              {['Condition Code', 'Pen', 'Size Band', 'Line'].map(o => <option key={o}>{o}</option>)}
            </select>
            <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none" value={filterOp} onChange={e => setFilterOp(e.target.value)}>
              {['contains', 'equals', 'greater than', 'less than'].map(o => <option key={o}>{o}</option>)}
            </select>
            <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none" value={filterValue} onChange={e => setFilterValue(e.target.value)}>
              <option value="">Select…</option>
              {valueOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {queryApplied && (
              <button className="bg-transparent text-ct-danger border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] rounded-sm cursor-pointer" onClick={handleClear}>✕ Clear</button>
            )}
            <select className="ml-auto bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none" value={viewMode} onChange={e => setViewMode(e.target.value as ViewMode)}>
              <option value="heatmap">Show as: Heatmap</option>
              <option value="table">Show as: Table</option>
              <option value="bar">Show as: Bar Chart</option>
            </select>
            <button className="bg-ct-accent text-background px-[18px] py-2 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer" onClick={handleRun}>Run →</button>
          </div>
          {queryApplied && (
            <div className="mt-2 font-mono-ibm text-[10px] text-ct-accent">
              Showing {filteredCrocs.length} of {occupied.length} crocs · Filter: {filterField} {filterOp} "{filterValue}"
            </div>
          )}
        </div>
      </div>

      {/* Heatmap — Both pens */}
      {viewMode === 'heatmap' && pens.map(penId => {
        const penCrocs = filteredCrocs.filter(c => c.pen_id === penId);
        const penLines = [...new Set(penCrocs.map(c => c.line))].sort();
        const penMaxSlot = Math.max(...penCrocs.map(c => c.pen_slot), 1);
        const heatCols = Math.min(penMaxSlot, 54);
        const slotConds: Map<string, number> = new Map();
        penCrocs.forEach(c => slotConds.set(`${c.line}-${c.pen_slot}`, c.condition_codes.length));

        return (
          <Panel key={penId} title={`Condition Density — ${penId} ${queryApplied ? `(${penCrocs.length} crocs)` : ''}`}>
            <div className="font-mono-ibm text-[9px] text-ct-text3 mb-2">Cell = pen slot · colour intensity = condition density</div>
            <div className="flex gap-1.5 items-center mb-2">
              <span className="text-[9px] text-ct-text3 font-mono-ibm">NONE</span>
              <div className="flex-1 h-[5px] rounded-sm" style={{ background: 'linear-gradient(to right, hsl(var(--surface3)), hsl(var(--ct-warn)), hsl(var(--ct-danger)))' }} />
              <span className="text-[9px] text-ct-text3 font-mono-ibm">HIGH</span>
            </div>
            {penLines.length === 0 ? (
              <div className="text-xs text-ct-text3 text-center py-5">No data matches query</div>
            ) : (
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${heatCols}, 1fr)` }}>
                {penLines.flatMap(line =>
                  Array.from({ length: heatCols }, (_, ci) => {
                    const v = slotConds.get(`${line}-${ci + 1}`) ?? 0;
                    const intensity = Math.min(v / 3, 1);
                    return (
                      <div key={`${line}-${ci}`} className="h-[11px] rounded-[1px] cursor-pointer" style={{ background: `rgba(212,137,42, ${intensity > 0 ? 0.3 + intensity * 0.7 : 0.05})` }} title={`Line ${line}, Slot ${ci + 1}: ${v} conditions`} />
                    );
                  })
                )}
              </div>
            )}
          </Panel>
        );
      })}

      {/* Table */}
      {viewMode === 'table' && (
        <Panel title={`Filtered Results — Table (${filteredCrocs.length} crocs)`}>
          <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
            <div className="min-w-[480px]">
            <div className="grid grid-cols-[60px_60px_50px_80px_1fr] gap-1 font-mono-ibm text-[9px] text-ct-text3 pb-2 border-b border-border tracking-[1px] uppercase">
              <span>Pen</span><span>Line</span><span>Slot</span><span>Belly</span><span>Conditions</span>
            </div>
            {filteredCrocs.slice(0, 100).map(c => (
              <div key={c.id} className="grid grid-cols-[60px_60px_50px_80px_1fr] gap-1 items-center py-1 border-b border-[rgba(0,0,0,.07)] text-[11px]">
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
        </Panel>
      )}

      {/* Bar Chart */}
      {viewMode === 'bar' && (
        <Panel title={`Condition Distribution — Bar (${filteredCrocs.length} crocs)`}>
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
        </Panel>
      )}

      {/* Batch Comparison */}
      <Panel title="Batch Comparison — Avg Size by Tag Range">
        {batchComparison.length === 0 ? (
          <div className="text-xs text-ct-text3 text-center py-3">No tagged crocs found</div>
        ) : (
          <>
            {batchComparison.map(b => {
              const maxAvg = Math.max(...batchComparison.map(x => x.avg), 1);
              return (
                <div key={b.label} className="mb-3">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-mono-ibm text-ct-accent">{b.label}</span>
                    <span className="font-mono-ibm text-ct-text3">{b.count} crocs · avg {b.avg} cm · {b.flagged} flagged</span>
                  </div>
                  <div className="h-[7px] bg-surface-3 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm bg-ct-accent" style={{ width: `${(b.avg / maxAvg) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </Panel>

      {/* Feeder Analysis */}
      <Panel title="Malnourishment — Line & Feeder Analysis">
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
      </Panel>

      {/* Condition Summary */}
      <Panel title={`Condition Summary — ${queryApplied ? 'Filtered' : 'All Pens'}`}>
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
      </Panel>

      {/* Line Comparison */}
      <Panel title="Avg Belly Size by Line">
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
      </Panel>

      <Panel title="Line Query — Size Bands & Cull Schedule" className="md:col-span-2">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="flex items-center gap-2 font-mono-ibm text-[10px] text-ct-text3">
            Line
            <select
              value={selectedLine}
              onChange={e => setLineReportLine(e.target.value)}
              className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm outline-none"
            >
              {lineOptions.map(line => <option key={line} value={line}>{line}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 font-mono-ibm text-[10px] text-ct-text3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCulledInLineReport}
              onChange={e => setIncludeCulledInLineReport(e.target.checked)}
            />
            Include previously culled
          </label>
          <span className="ml-auto font-mono-ibm text-[10px] text-ct-text3">
            {lineRows.length} records · {selectedLine ? `Line ${selectedLine}` : 'No lines available'}
          </span>
        </div>
        {selectedLine ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[
                { label: 'Cull', value: lineSummary.cull },
                { label: 'NX', value: lineSummary.nx },
                { label: '1', value: lineSummary.one },
                { label: '2', value: lineSummary.two },
              ].map(item => (
                <div key={item.label} className="bg-surface-2 border border-border rounded p-3 text-center">
                  <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[1px] uppercase">{item.label}</div>
                  <div className="font-display text-2xl font-semibold text-ct-text">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono-ibm border-collapse">
                <thead>
                  <tr className="text-ct-text3">
                    <th className="text-left px-3 py-2 border-b border-border">Size band</th>
                    <th className="text-right px-3 py-2 border-b border-border">Croc count</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZE_BANDS.map((band, index) => (
                    <tr key={band.range}>
                      <td className="px-3 py-2 border-b border-border">{band.range}</td>
                      <td className="px-3 py-2 border-b border-border text-right font-semibold">{lineSummary.sizes[index]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-xs text-ct-text3 text-center py-4">No line data available.</div>
        )}
      </Panel>

      <Panel title="Culled Crocs — Monthly Report" className="md:col-span-2">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="flex items-center gap-2 font-mono-ibm text-[10px] text-ct-text3">
            Month
            <select
              value={culledReportMonth}
              onChange={e => setCulledReportMonth(e.target.value)}
              className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm outline-none"
            >
              <option value="all">All months</option>
              {culledMonths.map(month => <option key={month} value={month}>{month}</option>)}
            </select>
          </label>
          <span className="ml-auto font-mono-ibm text-[10px] text-ct-text3">
            {visibleCulledRows.length} culled crocs
          </span>
        </div>
        <p className="text-[10px] text-ct-text3 mb-3">
          Uses the recorded cull date when available; otherwise uses the croc&apos;s latest inspection date.
        </p>
        {cullRecordsError && (
          <p role="alert" className="text-xs text-ct-danger mb-3">
            Cull dates could not be loaded. Showing inspection dates where available.
          </p>
        )}
        {isLoadingCullRecords ? (
          <div className="text-xs text-ct-text3 text-center py-4">Loading cull dates…</div>
        ) : visibleCulledRows.length === 0 ? (
          <div className="text-xs text-ct-text3 text-center py-4">No culled crocs for this month.</div>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full min-w-[560px] text-[11px] font-mono-ibm border-collapse">
              <thead>
                <tr className="text-ct-text3 sticky top-0 bg-surface">
                  <th className="text-left px-3 py-2 border-b border-border">Cull date</th>
                  <th className="text-left px-3 py-2 border-b border-border">Pen</th>
                  <th className="text-left px-3 py-2 border-b border-border">Line</th>
                  <th className="text-left px-3 py-2 border-b border-border">Slot</th>
                  <th className="text-left px-3 py-2 border-b border-border">Tag</th>
                  <th className="text-right px-3 py-2 border-b border-border">Size</th>
                </tr>
              </thead>
              <tbody>
                {visibleCulledRows.map(row => (
                  <tr key={row.croc.id}>
                    <td className="px-3 py-2 border-b border-border">
                      {row.date}{row.usesInspectionDate ? ' *' : ''}
                    </td>
                    <td className="px-3 py-2 border-b border-border">{row.croc.pen_id}</td>
                    <td className="px-3 py-2 border-b border-border">{row.croc.line}</td>
                    <td className="px-3 py-2 border-b border-border">{row.croc.pen_slot}</td>
                    <td className="px-3 py-2 border-b border-border">{row.croc.tag ?? '—'}</td>
                    <td className="px-3 py-2 border-b border-border text-right">
                      {row.croc.belly_cm === null ? '—' : `${row.croc.belly_cm} cm`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleCulledRows.some(row => row.usesInspectionDate) && (
              <p className="text-[10px] text-ct-text3 mt-2">* No cull event date was recorded; inspection date shown.</p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
