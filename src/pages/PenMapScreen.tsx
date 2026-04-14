import { useState, useMemo, useEffect } from 'react';
import { useCrocs, useConditionCodes, type CrocRecord } from '@/hooks/useCrocs';
import { SIZE_BANDS, sizeBand, sizeBandColor, buildPenGrid } from '@/lib/crocUtils';

export default function PenMapScreen() {
  const [pen, setPen] = useState('GH1');
  const [mode, setMode] = useState('health');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  
  // New filter states
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [sizeMin, setSizeMin] = useState<string>('');
  const [sizeMax, setSizeMax] = useState<string>('');
  const [searchTag, setSearchTag] = useState('');
  const [showOnlyConditions, setShowOnlyConditions] = useState(false);
  const [showEmpty, setShowEmpty] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  const { data: crocs, isLoading } = useCrocs(pen);
  const { data: conditionDefs } = useConditionCodes();

  // Initialize filters from condition defs
  useEffect(() => {
    if (conditionDefs && conditionDefs.length > 0) {
      setActiveFilters(prev => {
        if (prev.size > 0) return prev;
        return new Set(conditionDefs.map(c => c.code));
      });
    }
  }, [conditionDefs]);

  // Derive available lines
  const availableLines = useMemo(() => {
    if (!crocs) return [];
    return [...new Set(crocs.map(c => c.line))].sort();
  }, [crocs]);

  // Apply filters
  const filteredCrocs = useMemo(() => {
    if (!crocs) return [];
    return crocs.filter(c => {
      if (lineFilter !== 'all' && c.line !== lineFilter) return false;
      if (sizeMin && c.belly_cm !== null && c.belly_cm < Number(sizeMin)) return false;
      if (sizeMax && c.belly_cm !== null && c.belly_cm > Number(sizeMax)) return false;
      if (searchTag && c.tag && !c.tag.toLowerCase().includes(searchTag.toLowerCase())) return false;
      if (searchTag && !c.tag) return false;
      if (showOnlyConditions && c.condition_codes.length === 0) return false;
      if (gradeFilter !== 'all' && !c.condition_codes.includes(gradeFilter)) return false;
      return true;
    });
  }, [crocs, lineFilter, sizeMin, sizeMax, searchTag, showOnlyConditions, gradeFilter]);

  // Highlighted tags for search
  const highlightedIds = useMemo(() => {
    if (!searchTag) return new Set<number>();
    return new Set(filteredCrocs.map(c => c.id));
  }, [searchTag, filteredCrocs]);

  if (isLoading || !crocs) {
    return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading pen data…</div>;
  }

  const { lines, maxSlot, grid } = buildPenGrid(crocs);
  const displayLines = lineFilter === 'all' ? lines : lines.filter(l => l === lineFilter);
  const occupied = filteredCrocs.filter(c => c.belly_cm !== null);
  const totalOccupied = crocs.filter(c => c.belly_cm !== null).length;
  const statsText = `Showing ${occupied.length} / ${totalOccupied} occupied (${crocs.length} total slots)`;

  function getCellColor(croc: CrocRecord): string {
    if (mode === 'health') {
      return croc.condition_codes.length === 0 ? '#2e5e32' : '#d4892a';
    } else if (mode === 'condition') {
      if (croc.condition_codes.length === 0) return '#2e5e32';
      const vis = croc.condition_codes.filter(c => activeFilters.has(c));
      if (vis.length === 0) return 'hsl(var(--surface3))';
      const cd = conditionDefs?.find(c => c.code === vis[0]);
      return cd ? `hsl(var(${cd.color_var}))` : '#2e5e32';
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
  };

  const hasActiveFilters = lineFilter !== 'all' || sizeMin || sizeMax || searchTag || showOnlyConditions || !showEmpty || gradeFilter !== 'all';

  // Feeder alerts from real data
  const mnByLine: Record<string, number> = {};
  const dsByLine: Record<string, number> = {};
  crocs.forEach(c => {
    if (c.condition_codes.includes('MN')) mnByLine[c.line] = (mnByLine[c.line] || 0) + 1;
    if (c.condition_codes.includes('DS')) dsByLine[c.line] = (dsByLine[c.line] || 0) + 1;
  });

  // Unique condition codes present in this pen
  const penConditions = useMemo(() => {
    if (!crocs) return [];
    const codes = new Set<string>();
    crocs.forEach(c => c.condition_codes.forEach(code => codes.add(code)));
    return [...codes].sort();
  }, [crocs]);

  return (
    <div>
      {/* Primary controls */}
      <div className="flex gap-2.5 items-center flex-wrap mb-2">
        <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={pen} onChange={e => setPen(e.target.value)}>
          <option value="GH1">GH1</option>
          <option value="GH2">GH2</option>
        </select>
        <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={mode} onChange={e => setMode(e.target.value)}>
          <option value="health">Heatmap: Health Status</option>
          <option value="condition">Heatmap: Condition Type</option>
          <option value="size">Heatmap: Size Category</option>
        </select>
        <span className="font-mono-ibm text-[10px] text-ct-text3">{statsText}</span>
        <button className="ml-auto bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] cursor-pointer rounded-sm transition-all hover:border-ct-accent hover:bg-surface-2 whitespace-nowrap">⎙ Print / Export</button>
      </div>

      {/* Enhanced filters panel */}
      <div className="bg-surface border border-border rounded mb-2.5 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase">Filters</span>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="font-mono-ibm text-[10px] text-ct-accent hover:underline cursor-pointer">
              Clear all filters
            </button>
          )}
        </div>
        <div className="flex gap-2.5 items-end flex-wrap">
          {/* Line filter */}
          <div>
            <label className="font-mono-ibm text-[9px] text-ct-text3 block mb-1">Line</label>
            <select className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={lineFilter} onChange={e => setLineFilter(e.target.value)}>
              <option value="all">All Lines</option>
              {availableLines.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Size range */}
          <div>
            <label className="font-mono-ibm text-[9px] text-ct-text3 block mb-1">Size (cm)</label>
            <div className="flex gap-1 items-center">
              <input
                type="number" placeholder="Min" value={sizeMin} onChange={e => setSizeMin(e.target.value)}
                className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[60px]"
              />
              <span className="text-ct-text3 text-[10px]">–</span>
              <input
                type="number" placeholder="Max" value={sizeMax} onChange={e => setSizeMax(e.target.value)}
                className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[60px]"
              />
            </div>
          </div>

          {/* Tag search */}
          <div>
            <label className="font-mono-ibm text-[9px] text-ct-text3 block mb-1">Tag Search</label>
            <input
              type="text" placeholder="Search tag…" value={searchTag} onChange={e => setSearchTag(e.target.value)}
              className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[120px]"
            />
          </div>

          {/* Condition filter */}
          <div>
            <label className="font-mono-ibm text-[9px] text-ct-text3 block mb-1">Condition</label>
            <select className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
              <option value="all">All Conditions</option>
              {penConditions.map(code => {
                const def = conditionDefs?.find(c => c.code === code);
                return <option key={code} value={code}>{code}{def ? ` — ${def.name}` : ''}</option>;
              })}
            </select>
          </div>

          {/* Toggle: only conditions */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none pb-[1px]">
            <input type="checkbox" checked={showOnlyConditions} onChange={e => setShowOnlyConditions(e.target.checked)} className="accent-[hsl(var(--ct-accent))]" />
            <span className="font-mono-ibm text-[10px] text-ct-text2">Flagged only</span>
          </label>

          {/* Toggle: show empty */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none pb-[1px]">
            <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} className="accent-[hsl(var(--ct-accent))]" />
            <span className="font-mono-ibm text-[10px] text-ct-text2">Show empty</span>
          </label>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {mode === 'condition' && conditionDefs?.map(c => (
          <div
            key={c.code}
            className={`flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border cursor-pointer transition-all select-none ${activeFilters.has(c.code) ? 'border-[rgba(255,255,255,.2)] text-ct-text2' : 'border-[rgba(255,255,255,.06)] text-ct-text3'}`}
            onClick={() => toggleFilter(c.code)}
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `hsl(var(${c.color_var}))` }} />
            {c.code} — {c.name}
          </div>
        ))}
        {mode === 'health' && (
          <>
            <div className="flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border border-[rgba(255,255,255,.2)] text-ct-text2"><div className="w-2 h-2 rounded-full" style={{ background: '#2e5e32' }} />Healthy</div>
            <div className="flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border border-[rgba(255,255,255,.2)] text-ct-text2"><div className="w-2 h-2 rounded-full bg-ct-warn" />Condition flag</div>
            <div className="flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border border-[rgba(255,255,255,.2)] text-ct-text2"><div className="w-2 h-2 rounded-full bg-ct-danger" />Critical / injury</div>
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
        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5">
            {displayLines.map(r => <div key={r} className="font-mono-ibm text-[9px] text-ct-text3 flex items-center pr-[5px] min-w-[14px] h-[13px]">{r}</div>)}
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${maxSlot}, 13px)` }}>
            {displayLines.flatMap(line => {
              const cells = [];
              for (let s = 1; s <= maxSlot; s++) {
                const croc = grid.get(line)?.get(s);
                const isFiltered = croc && filteredCrocs.includes(croc);
                const isHighlighted = croc && highlightedIds.has(croc.id);

                if (!croc || croc.belly_cm === null) {
                  cells.push(
                    <div key={`${line}-${s}`} className={`w-[13px] h-[13px] rounded-[1px] bg-surface-3 ${showEmpty ? 'opacity-20' : 'opacity-5'}`} />
                  );
                } else if (!isFiltered && hasActiveFilters) {
                  // Dimmed for filtered-out crocs
                  cells.push(
                    <div key={`${line}-${s}`} className="w-[13px] h-[13px] rounded-[1px] bg-surface-3 opacity-10" />
                  );
                } else {
                  const bg = getCellColor(croc);
                  const cstr = croc.condition_codes.length ? croc.condition_codes.join(' · ') : 'Clear';
                  const tagStr = croc.tag ? `Tag: #${croc.tag}` : `ID: ${croc.id}`;
                  cells.push(
                    <div
                      key={`${line}-${s}`}
                      className={`w-[13px] h-[13px] rounded-[1px] cursor-pointer transition-transform hover:scale-[1.7] hover:z-10 hover:outline hover:outline-1 hover:outline-[rgba(255,255,255,.6)] ${isHighlighted ? 'ring-1 ring-ct-accent scale-[1.4] z-10' : ''}`}
                      style={{ background: bg }}
                      onMouseEnter={(e) => setTooltip({ x: e.clientX + 14, y: e.clientY - 50, text: `${pen} ${line}-${s}\n${tagStr}\nSize: ${croc.belly_cm} cm\nGrade: ${croc.grade ?? '—'}\n${cstr}` })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                }
              }
              return cells;
            })}
          </div>
        </div>
        {tooltip && (
          <div
            className="fixed bg-surface-3 border border-border rounded px-3 py-2 font-mono-ibm text-[11px] text-ct-text pointer-events-none z-[999] max-w-[200px] leading-relaxed shadow-[0_4px_20px_rgba(0,0,0,.6)] whitespace-pre-line"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      {/* Feeder Alerts */}
      <div className="mt-3.5 bg-surface border border-border rounded overflow-hidden">
        <div className="px-[18px] py-3 border-b border-border">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Feeder Line Alerts</span>
        </div>
        <div className="px-[18px] py-4">
          {Object.entries(mnByLine).map(([line, count]) => (
            <div key={line} className="bg-[rgba(192,57,43,.08)] border border-[rgba(192,57,43,.25)] rounded p-2.5 mb-2">
              <div className="font-mono-ibm text-[10px] text-ct-danger mb-1">⚠ LINE {line} — MN CLUSTER</div>
              <div className="text-xs text-ct-text2">{count} malnourished crocs in Line {line}. Inspect feeder line immediately.</div>
            </div>
          ))}
          {Object.entries(dsByLine).map(([line, count]) => (
            <div key={line} className="bg-[rgba(212,137,42,.08)] border border-[rgba(212,137,42,.25)] rounded p-2.5 mb-2">
              <div className="font-mono-ibm text-[10px] text-ct-warn mb-1">WATCH — LINE {line} · DS CLUSTER</div>
              <div className="text-xs text-ct-text2">{count} DS-flagged crocs in Line {line}. Monitor water quality.</div>
            </div>
          ))}
          {Object.keys(mnByLine).length === 0 && Object.keys(dsByLine).length === 0 && (
            <div className="text-xs text-ct-text3 text-center py-5">No active feeder alerts</div>
          )}
        </div>
      </div>
    </div>
  );
}
