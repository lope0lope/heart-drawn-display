import { useState } from 'react';
import { useCrocs, useConditionCodes, type CrocRecord } from '@/hooks/useCrocs';
import { SIZE_BANDS, sizeBand, sizeBandColor, buildPenGrid } from '@/lib/crocUtils';

export default function PenMapScreen() {
  const [pen, setPen] = useState('GH1');
  const [mode, setMode] = useState('health');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const { data: crocs, isLoading } = useCrocs(pen);
  const { data: conditionDefs } = useConditionCodes();

  // Initialize filters from condition defs
  if (conditionDefs && activeFilters.size === 0) {
    const all = new Set(conditionDefs.map(c => c.code));
    if (all.size > 0 && activeFilters.size === 0) setActiveFilters(all);
  }

  if (isLoading || !crocs) {
    return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading pen data…</div>;
  }

  const { lines, maxSlot, grid } = buildPenGrid(crocs);
  const occupied = crocs.filter(c => c.belly_cm !== null);
  const statsText = `${occupied.length} / ${crocs.length} occupied`;

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

  // Feeder alerts from real data
  const mnByLine: Record<string, number> = {};
  const dsByLine: Record<string, number> = {};
  crocs.forEach(c => {
    if (c.condition_codes.includes('MN')) mnByLine[c.line] = (mnByLine[c.line] || 0) + 1;
    if (c.condition_codes.includes('DS')) dsByLine[c.line] = (dsByLine[c.line] || 0) + 1;
  });

  return (
    <div>
      <div className="flex gap-2.5 items-center flex-wrap mb-3">
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
            {lines.map(r => <div key={r} className="font-mono-ibm text-[9px] text-ct-text3 flex items-center pr-[5px] min-w-[14px] h-[13px]">{r}</div>)}
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${maxSlot}, 13px)` }}>
            {lines.flatMap(line => {
              const cells = [];
              for (let s = 1; s <= maxSlot; s++) {
                const croc = grid.get(line)?.get(s);
                if (!croc || croc.belly_cm === null) {
                  cells.push(<div key={`${line}-${s}`} className="w-[13px] h-[13px] rounded-[1px] bg-surface-3 opacity-20" />);
                } else {
                  const bg = getCellColor(croc);
                  const cstr = croc.condition_codes.length ? croc.condition_codes.join(' · ') : 'Clear';
                  const tagStr = croc.tag ? `Tag: #${croc.tag}` : `ID: ${croc.id}`;
                  cells.push(
                    <div
                      key={`${line}-${s}`}
                      className="w-[13px] h-[13px] rounded-[1px] cursor-pointer transition-transform hover:scale-[1.7] hover:z-10 hover:outline hover:outline-1 hover:outline-[rgba(255,255,255,.6)]"
                      style={{ background: bg }}
                      onMouseEnter={(e) => setTooltip({ x: e.clientX + 14, y: e.clientY - 50, text: `${pen} ${line}-${s}\n${tagStr}\nSize: ${croc.belly_cm} cm\n${cstr}` })}
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
