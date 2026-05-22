import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCrocs, useConditionCodes, type CrocRecord } from '@/hooks/useCrocs';
import { SIZE_BANDS, sizeBand, sizeBandColor, buildPenGrid } from '@/lib/crocUtils';
import { matchesConditionFilter, parseConditionCode, extractTypes, extractLocations } from '@/lib/conditionUtils';

const BATCH_RANGES = [
  { label: 'All Tags', min: 0, max: 999999 },
  { label: '5000–5600', min: 5000, max: 5600 },
  { label: '5601–6200', min: 5601, max: 6200 },
  { label: '6201–6800', min: 6201, max: 6800 },
  { label: '6801–7400', min: 6801, max: 7400 },
  { label: '7401–8000', min: 7401, max: 8000 },
];

interface PenMapScreenProps {
  onOpenCroc?: (tag: string) => void;
}

export default function PenMapScreen({ onOpenCroc }: PenMapScreenProps = {}) {
  const [pen, setPen] = useState('GH1');
  const [mode, setMode] = useState('health');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [sizeMin, setSizeMin] = useState<string>('');
  const [sizeMax, setSizeMax] = useState<string>('');
  const [searchTag, setSearchTag] = useState('');
  const [showOnlyConditions, setShowOnlyConditions] = useState(false);
  const [showEmpty, setShowEmpty] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState(0); // index into BATCH_RANGES

  const { data: crocs, isLoading } = useCrocs(pen === 'ALL' ? undefined : pen);
  const { data: conditionDefs } = useConditionCodes();

  useEffect(() => {
    if (conditionDefs && conditionDefs.length > 0) {
      setActiveFilters(prev => {
        if (prev.size > 0) return prev;
        return new Set(conditionDefs.map(c => c.code));
      });
    }
  }, [conditionDefs]);

  const availableLines = useMemo(() => {
    if (!crocs) return [];
    return [...new Set(crocs.map(c => c.line))].sort();
  }, [crocs]);

  const filteredCrocs = useMemo(() => {
    if (!crocs) return [];
    const batch = BATCH_RANGES[batchFilter];
    return crocs.filter(c => {
      if (lineFilter !== 'all' && c.line !== lineFilter) return false;
      if (sizeMin && c.belly_cm !== null && c.belly_cm < Number(sizeMin)) return false;
      if (sizeMax && c.belly_cm !== null && c.belly_cm > Number(sizeMax)) return false;
      if (searchTag && c.tag && !c.tag.toLowerCase().includes(searchTag.toLowerCase())) return false;
      if (searchTag && !c.tag) return false;
      if (showOnlyConditions && c.condition_codes.length === 0) return false;
      if (gradeFilter !== 'all' && !matchesConditionFilter(c.condition_codes, gradeFilter)) return false;
      if (batchFilter > 0 && c.tag) {
        const tagNum = parseInt(c.tag);
        if (isNaN(tagNum) || tagNum < batch.min || tagNum > batch.max) return false;
      }
      if (batchFilter > 0 && !c.tag) return false;
      return true;
    });
  }, [crocs, lineFilter, sizeMin, sizeMax, searchTag, showOnlyConditions, gradeFilter, batchFilter]);

  const highlightedIds = useMemo(() => {
    if (!searchTag) return new Set<number>();
    return new Set(filteredCrocs.map(c => c.id));
  }, [searchTag, filteredCrocs]);

  // Build filterable groups: full codes + parsed types + parsed locations.
  const conditionFilterGroups = useMemo(() => {
    if (!crocs) return { full: [] as string[], types: [] as string[], locations: [] as string[] };
    const all: string[] = [];
    crocs.forEach(c => c.condition_codes.forEach(code => all.push(code)));
    const fullSet = new Set(all);
    return {
      full: [...fullSet].sort(),
      types: extractTypes(all),
      locations: extractLocations(all),
    };
  }, [crocs]);

  // Row summary: condition count per line
  const lineSummary = useMemo(() => {
    if (!crocs) return [];
    const map: Record<string, { total: number; flagged: number; avgCm: number }> = {};
    for (const c of crocs) {
      if (!map[c.line]) map[c.line] = { total: 0, flagged: 0, avgCm: 0 };
      if (c.belly_cm !== null) {
        map[c.line].total++;
        map[c.line].avgCm += c.belly_cm;
      }
      if (c.condition_codes.length > 0) map[c.line].flagged++;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([line, d]) => ({
      line,
      total: d.total,
      flagged: d.flagged,
      avgCm: d.total > 0 ? Math.round(d.avgCm / d.total * 10) / 10 : 0,
    }));
  }, [crocs]);

  if (isLoading || !crocs) {
    return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading pen data…</div>;
  }

  // Build grid from full pen for layout dims & duplicate counts
  const fullGrid = buildPenGrid(crocs);
  const { lines, maxSlot, duplicates, slotPositions, columnCount } = fullGrid;
  // Rebuild grid from filteredCrocs so condition/size/etc. filters actually
  // surface the matching record at each slot instead of the latest one.
  const { grid } = buildPenGrid(filteredCrocs.length ? filteredCrocs : crocs);
  const displayLines = lineFilter === 'all' ? lines : lines.filter(l => l === lineFilter);
  const occupied = filteredCrocs.filter(c => c.belly_cm !== null);
  const totalOccupied = crocs.filter(c => c.belly_cm !== null).length;
  const dupeSlotCount = duplicates.size;
  const statsText = `Showing ${occupied.length} / ${totalOccupied} occupied (${crocs.length} total records)${dupeSlotCount > 0 ? ` · ⚠ ${dupeSlotCount} slots with duplicates` : ''}`;

  function getCellColor(croc: CrocRecord): string {
    if (mode === 'health') {
      return croc.condition_codes.length === 0 ? '#2e5e32' : '#d4892a';
    } else if (mode === 'condition') {
      if (croc.condition_codes.length === 0) return '#2e5e32';
      // Match by parsed TYPE (e.g. "THChest" -> "TH") against activeFilters
      // which holds base type codes from condition_codes table.
      const vis = croc.condition_codes.filter(code => {
        const t = parseConditionCode(code).type;
        return activeFilters.has(code) || activeFilters.has(t);
      });
      if (vis.length === 0) return 'hsl(var(--surface3))';
      const firstType = parseConditionCode(vis[0]).type;
      const cd = conditionDefs?.find(c => c.code === firstType) ?? conditionDefs?.find(c => c.code === vis[0]);
      return cd ? `hsl(var(${cd.color_var}))` : '#d4892a';
    } else {
      if (!croc.belly_cm) return '#565250';
      const b = sizeBand(croc.belly_cm);
      return b !== null ? sizeBandColor(b) : '#565250';
    }
  }

  const toggleFilter = (code: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const clearAllFilters = () => {
    setLineFilter('all');
    setSizeMin('');
    setSizeMax('');
    setSearchTag('');
    setShowOnlyConditions(false);
    setShowEmpty(true);
    setGradeFilter('all');
    setBatchFilter(0);
  };

  const hasActiveFilters = lineFilter !== 'all' || sizeMin || sizeMax || searchTag || showOnlyConditions || !showEmpty || gradeFilter !== 'all' || batchFilter > 0;

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const maxFlagged = Math.max(...lineSummary.map(l => l.flagged), 1);
    win.document.write(`
      <html><head><title>Pen Map — ${pen}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'IBM Plex Mono', monospace; font-size: 10px; padding: 16px; color: #1a1a1a; }
        h1 { font-size: 14px; margin-bottom: 4px; }
        .meta { font-size: 9px; color: #666; margin-bottom: 12px; }
        table { border-collapse: collapse; margin-bottom: 12px; }
        th, td { border: 1px solid #ccc; padding: 3px 6px; font-size: 9px; }
        th { background: #eee; }
        .legend { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
        .legend-item { display: flex; align-items: center; gap: 4px; font-size: 9px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .summary-table { width: 100%; margin-top: 16px; }
        @media print { body { padding: 8px; } }
      </style></head><body>
      <h1>Pen Map — ${pen}</h1>
      <div class="meta">${statsText} · Mode: ${mode} · Generated: ${new Date().toLocaleDateString()}</div>
      <table class="summary-table">
        <thead><tr><th>Line</th><th>Occupied</th><th>Flagged</th><th>Avg cm</th><th>Flag %</th></tr></thead>
        <tbody>
          ${lineSummary.map(l => `<tr>
            <td>${l.line}</td><td>${l.total}</td><td>${l.flagged}</td><td>${l.avgCm}</td>
            <td>${l.total > 0 ? Math.round(l.flagged / l.total * 100) : 0}%</td>
          </tr>`).join('')}
        </tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  // Feeder alerts
  const mnByLine: Record<string, number> = {};
  const dsByLine: Record<string, number> = {};
  crocs.forEach(c => {
    if (c.condition_codes.includes('MN')) mnByLine[c.line] = (mnByLine[c.line] || 0) + 1;
    if (c.condition_codes.includes('DS')) dsByLine[c.line] = (dsByLine[c.line] || 0) + 1;
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-3.5">
      <div>
        {/* Primary controls */}
        <div className="flex gap-2.5 items-center flex-wrap mb-2">
          <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={pen} onChange={e => setPen(e.target.value)}>
            <option value="GH1">GH1</option>
            <option value="GH2">GH2</option>
            <option value="ALL">Both (GH1+GH2)</option>
          </select>
          <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={mode} onChange={e => setMode(e.target.value)}>
            <option value="health">Heatmap: Health Status</option>
            <option value="condition">Heatmap: Condition Type</option>
            <option value="size">Heatmap: Size Category</option>
          </select>
          <span className="font-mono-ibm text-[10px] text-ct-text3">{statsText}</span>
          <button onClick={handlePrint} className="ml-auto bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] cursor-pointer rounded-sm transition-all hover:border-ct-accent hover:bg-surface-2 whitespace-nowrap">⎙ Print / Export</button>
        </div>

        {/* Filters */}
        <div className="bg-surface border border-border rounded mb-2.5 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase">Filters</span>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="font-mono-ibm text-[10px] text-ct-accent hover:underline cursor-pointer">Clear all</button>
            )}
          </div>
          <div className="flex gap-2.5 items-end flex-wrap">
            <div>
              <label className="font-mono-ibm text-[9px] text-ct-text3 block mb-1">Line</label>
              <select className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={lineFilter} onChange={e => setLineFilter(e.target.value)}>
                <option value="all">All Lines</option>
                {availableLines.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono-ibm text-[9px] text-ct-text3 block mb-1">Batch</label>
              <select className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={batchFilter} onChange={e => setBatchFilter(Number(e.target.value))}>
                {BATCH_RANGES.map((b, i) => <option key={i} value={i}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono-ibm text-[9px] text-ct-text3 block mb-1">Size (cm)</label>
              <div className="flex gap-1 items-center">
                <input type="number" placeholder="Min" value={sizeMin} onChange={e => setSizeMin(e.target.value)} className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[60px]" />
                <span className="text-ct-text3 text-[10px]">–</span>
                <input type="number" placeholder="Max" value={sizeMax} onChange={e => setSizeMax(e.target.value)} className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[60px]" />
              </div>
            </div>
            <div>
              <label className="font-mono-ibm text-[9px] text-ct-text3 block mb-1">Tag</label>
              <input type="text" placeholder="Search…" value={searchTag} onChange={e => setSearchTag(e.target.value)} className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[100px]" />
            </div>
            <div>
              <label className="font-mono-ibm text-[9px] text-ct-text3 block mb-1">Condition</label>
              <select className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                <option value="all">All</option>
                {conditionFilterGroups.types.length > 0 && (
                  <optgroup label="By Type (e.g. TH, R)">
                    {conditionFilterGroups.types.map(t => (
                      <option key={`t-${t}`} value={t}>{t} — any location</option>
                    ))}
                  </optgroup>
                )}
                {conditionFilterGroups.locations.length > 0 && (
                  <optgroup label="By Location">
                    {conditionFilterGroups.locations.map(l => (
                      <option key={`l-${l}`} value={l}>{l} — any type</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Exact Code">
                  {conditionFilterGroups.full.map(code => {
                    const def = conditionDefs?.find(c => c.code === code);
                    const parsed = parseConditionCode(code);
                    const label = def ? `${code} — ${def.name}` : (parsed.location ? `${code} (${parsed.type} on ${parsed.location})` : code);
                    return <option key={code} value={code}>{label}</option>;
                  })}
                </optgroup>
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none pb-[1px]">
              <input type="checkbox" checked={showOnlyConditions} onChange={e => setShowOnlyConditions(e.target.checked)} className="accent-[hsl(var(--ct-accent))]" />
              <span className="font-mono-ibm text-[10px] text-ct-text2">Flagged only</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none pb-[1px]">
              <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} className="accent-[hsl(var(--ct-accent))]" />
              <span className="font-mono-ibm text-[10px] text-ct-text2">Show empty</span>
            </label>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {mode === 'condition' && conditionDefs?.map(c => (
            <div key={c.code} className={`flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border cursor-pointer transition-all select-none ${activeFilters.has(c.code) ? 'border-[rgba(255,255,255,.2)] text-ct-text2' : 'border-[rgba(255,255,255,.06)] text-ct-text3'}`} onClick={() => toggleFilter(c.code)}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `hsl(var(${c.color_var}))` }} />
              {c.code} — {c.name}
            </div>
          ))}
          {mode === 'health' && (
            <>
              <div className="flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border border-[rgba(255,255,255,.2)] text-ct-text2"><div className="w-2 h-2 rounded-full" style={{ background: '#2e5e32' }} />Healthy</div>
              <div className="flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border border-[rgba(255,255,255,.2)] text-ct-text2"><div className="w-2 h-2 rounded-full bg-ct-warn" />Condition flag</div>
              <div className="flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border border-[rgba(255,255,255,.2)] text-ct-text2"><div className="w-2 h-2 rounded-full bg-surface-3 opacity-40" />Empty</div>
            </>
          )}
          {mode === 'size' && SIZE_BANDS.map((b, i) => (
            <div key={i} className="flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border border-[rgba(255,255,255,.2)] text-ct-text2">
              <div className="w-2 h-2 rounded-full" style={{ background: sizeBandColor(i) }} />{b.range}
            </div>
          ))}
        </div>

        {/* Pen Grid */}
        <div className="bg-surface border border-border rounded p-4 overflow-auto relative" onMouseLeave={() => setTooltip(null)}>
          <div className="flex gap-[2px]">
            <div className="flex flex-col gap-[2px]">
              {displayLines.map(r => <div key={r} className="font-mono-ibm text-[11px] text-ct-text3 flex items-center justify-end pr-1.5 min-w-[18px] h-[22px]">{r}</div>)}
            </div>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${maxSlot}, 22px)` }}>
              {displayLines.flatMap(line => {
                const cells = [];
                for (let s = 1; s <= maxSlot; s++) {
                  const croc = grid.get(line)?.get(s);
                  const isHighlighted = croc && highlightedIds.has(croc.id);

                  if (!croc || croc.belly_cm === null) {
                    cells.push(<div key={`${line}-${s}`} className={`w-[22px] h-[22px] rounded-[2px] bg-surface-3 ${showEmpty ? 'opacity-20' : 'opacity-5'}`} />);
                  } else {
                    const bg = getCellColor(croc);
                    const cstr = croc.condition_codes.length ? croc.condition_codes.join(' · ') : 'Clear';
                    const tagStr = croc.tag ? `Tag: #${croc.tag}` : `ID: ${croc.id}`;
                    const dupeKey = `${line}-${s}`;
                    const dupeCount = duplicates.get(dupeKey);
                    const dupeNote = dupeCount ? `\n⚠ ${dupeCount} crocs share this slot` : '';
                    cells.push(
                      <div
                        key={`${line}-${s}`}
                        className={`w-[22px] h-[22px] rounded-[2px] cursor-pointer transition-transform hover:scale-[1.4] hover:z-10 hover:outline hover:outline-1 hover:outline-[rgba(255,255,255,.6)] ${isHighlighted ? 'ring-1 ring-ct-accent scale-[1.2] z-10' : ''} ${dupeCount ? 'ring-1 ring-[rgba(212,137,42,.5)]' : ''}`}
                        style={{ background: bg }}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX + 14, y: e.clientY - 50, text: `${pen} ${line}-${s}\n${tagStr}\nSize: ${croc.belly_cm} cm\nGrade: ${croc.grade ?? '—'}\n${cstr}${dupeNote}\n\nClick to open profile` })}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => {
                          if (onOpenCroc && croc.tag) onOpenCroc(croc.tag);
                        }}
                      />
                    );
                  }
                }
                return cells;
              })}
            </div>
          </div>
          {tooltip && (
            <div className="fixed bg-surface-3 border border-border rounded px-3 py-2 font-mono-ibm text-[11px] text-ct-text pointer-events-none z-[999] max-w-[200px] leading-relaxed shadow-[0_4px_20px_rgba(0,0,0,.6)] whitespace-pre-line" style={{ left: tooltip.x, top: tooltip.y }}>
              {tooltip.text}
            </div>
          )}
        </div>

        {/* Feeder Alerts */}
        {(Object.keys(mnByLine).length > 0 || Object.keys(dsByLine).length > 0) && (
          <div className="mt-3.5 bg-surface border border-border rounded overflow-hidden">
            <div className="px-[18px] py-3 border-b border-border">
              <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Feeder Line Alerts</span>
            </div>
            <div className="px-[18px] py-4">
              {Object.entries(mnByLine).map(([line, count]) => (
                <div key={line} className="bg-[rgba(192,57,43,.08)] border border-[rgba(192,57,43,.25)] rounded p-2.5 mb-2">
                  <div className="font-mono-ibm text-[10px] text-ct-danger mb-1">⚠ LINE {line} — MN CLUSTER</div>
                  <div className="text-xs text-ct-text2">{count} malnourished crocs. Inspect feeder line immediately.</div>
                </div>
              ))}
              {Object.entries(dsByLine).map(([line, count]) => (
                <div key={line} className="bg-[rgba(212,137,42,.08)] border border-[rgba(212,137,42,.25)] rounded p-2.5 mb-2">
                  <div className="font-mono-ibm text-[10px] text-ct-warn mb-1">WATCH — LINE {line} · DS CLUSTER</div>
                  <div className="text-xs text-ct-text2">{count} DS-flagged crocs. Monitor water quality.</div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Conditions Breakdown */}
        <ConditionBreakdown crocs={crocs} pen={pen} conditionDefs={conditionDefs} />
      </div>

      {/* Row Summary Sidebar */}
      <div className="bg-surface border border-border rounded overflow-hidden self-start">
        <div className="px-3 py-2.5 border-b border-border">
          <span className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase">Row Summary</span>
        </div>
        <div className="px-3 py-2">
          {lineSummary.map(l => {
            const maxFlagged = Math.max(...lineSummary.map(x => x.flagged), 1);
            return (
              <div key={l.line} className="flex items-center gap-2 py-1 border-b border-[rgba(255,255,255,.04)] last:border-b-0">
                <span className="font-mono-ibm text-[10px] text-ct-accent w-4">{l.line}</span>
                <div className="flex-1 h-[5px] bg-surface-3 rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm bg-ct-warn" style={{ width: `${(l.flagged / maxFlagged) * 100}%` }} />
                </div>
                <span className="font-mono-ibm text-[9px] text-ct-text3 w-4 text-right">{l.flagged}</span>
                <span className="font-mono-ibm text-[9px] text-ct-text3 w-10 text-right">{l.avgCm}cm</span>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t border-border">
          <div className="font-mono-ibm text-[8px] text-ct-text3 leading-relaxed">
            Bar = condition flags per line<br />
            Right = avg belly size (cm)
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConditionBreakdownProps {
  crocs: CrocRecord[] | undefined;
  pen: string;
  conditionDefs: Array<{ code: string; name: string; color_var: string }> | undefined;
}

function ConditionBreakdown({ crocs, pen, conditionDefs }: ConditionBreakdownProps) {
  const breakdown = useMemo(() => {
    if (!crocs) return { groups: [] as Array<{ type: string; total: number; locations: Array<{ location: string; count: number }> }>, totalFlagged: 0 };
    const totalFlagged = crocs.filter(c => c.condition_codes.length > 0).length;
    // Group by type prefix
    const byType: Record<string, Record<string, number>> = {};
    for (const c of crocs) {
      for (const code of c.condition_codes) {
        const p = parseConditionCode(code);
        const loc = p.location || '—';
        byType[p.type] ??= {};
        byType[p.type][loc] = (byType[p.type][loc] || 0) + 1;
      }
    }
    const groups = Object.entries(byType).map(([type, locs]) => {
      const total = Object.values(locs).reduce((a, b) => a + b, 0);
      const locations = Object.entries(locs)
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count);
      return { type, total, locations };
    }).sort((a, b) => b.total - a.total);
    return { groups, totalFlagged };
  }, [crocs]);

  const penLabel = pen === 'ALL' ? 'GH1 + GH2' : pen;

  return (
    <div className="mt-3.5 bg-surface border border-border rounded overflow-hidden">
      <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Conditions in {penLabel}</span>
        <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(212,137,42,.15)] text-ct-warn">
          {breakdown.totalFlagged} flagged croc{breakdown.totalFlagged === 1 ? '' : 's'}
        </span>
      </div>
      <div className="px-[18px] py-4">
        {breakdown.groups.length === 0 ? (
          <div className="text-xs text-ct-text3 text-center py-3">No conditions recorded in this view.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {breakdown.groups.map(g => {
              const def = conditionDefs?.find(c => c.code === g.type);
              const color = def ? `hsl(var(${def.color_var}))` : 'hsl(var(--ct-accent))';
              const name = def?.name ?? g.type;
              return (
                <div key={g.type} className="border-b border-[rgba(255,255,255,.04)] pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="font-mono-ibm text-[11px]" style={{ color }}>{g.type}</span>
                    <span className="text-xs text-ct-text2 flex-1 truncate">{name}</span>
                    <span className="font-mono-ibm text-[12px] text-ct-text">{g.total}</span>
                  </div>
                  <div className="pl-4 flex flex-wrap gap-x-3 gap-y-0.5">
                    {g.locations.map(l => (
                      <span key={l.location} className="font-mono-ibm text-[10px] text-ct-text3">
                        {l.location}: <span className="text-ct-text2">{l.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
