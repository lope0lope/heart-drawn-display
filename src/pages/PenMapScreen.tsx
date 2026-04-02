import { useState, useMemo } from 'react';
import { penData, ROWS, COLS, CONDITIONS, SIZE_BANDS, sizeBand, sizeBandColor, type CrocData } from '@/data/mockData';

export default function PenMapScreen() {
  const [pen, setPen] = useState('GH1');
  const [mode, setMode] = useState('health');
  const [batch, setBatch] = useState('all');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(CONDITIONS.map(c => c.code)));
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const data = penData[pen];
  const batchActive = batch !== 'all';
  const [blo, bhi] = batchActive ? batch.split('-').map(Number) : [0, 99999];

  const occ = data.filter(c => c.occupied).length;
  const batchCount = batchActive ? data.filter(c => c.occupied && c.tagId! >= blo && c.tagId! <= bhi).length : occ;
  const statsText = batchActive ? `Batch ${batch.replace('-', '–')}: ${batchCount} · ${occ} total` : `${occ} / ${data.length} occupied`;

  function getCellColor(croc: CrocData): string {
    if (mode === 'health') {
      return croc.conds.length === 0 ? '#2e5e32' : croc.conds.some(c => c === 'FW' || c === 'IJ' || c === 'SK') ? 'hsl(var(--ct-danger))' : 'hsl(var(--ct-warn))';
    } else if (mode === 'condition') {
      if (croc.conds.length === 0) return '#2e5e32';
      const vis = croc.conds.filter(c => activeFilters.has(c));
      if (vis.length === 0) return 'hsl(var(--surface3))';
      const cd = CONDITIONS.find(c => c.code === vis[0]);
      return cd ? `hsl(var(${cd.colorVar}))` : '#2e5e32';
    } else {
      const b = sizeBand(croc.sizeCm!);
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

  // Feeder alerts
  const jMN = data.filter(c => c.occupied && c.row === 'J' && c.conds.includes('MN')).length;
  const fDS = data.filter(c => c.occupied && c.row === 'F' && c.conds.includes('DS')).length;

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
        <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-sm px-2.5 py-1">
          <span className="font-mono-ibm text-[9px] text-ct-text3 tracking-[1px] uppercase whitespace-nowrap">Batch</span>
          <select className="bg-transparent border-none text-ct-text font-mono-ibm text-[11px] cursor-pointer outline-none px-1 py-0.5" value={batch} onChange={e => setBatch(e.target.value)}>
            <option value="all">All Batches</option>
            <option value="5000-5600">5000–5600</option>
            <option value="5601-6200">5601–6200</option>
            <option value="6201-6800">6201–6800</option>
            <option value="6801-7400">6801–7400</option>
          </select>
        </div>
        <span className="font-mono-ibm text-[10px] text-ct-text3">{statsText}</span>
        <button className="ml-auto bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] cursor-pointer rounded-sm transition-all hover:border-ct-accent hover:bg-surface-2 whitespace-nowrap">⎙ Print / Export</button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {mode === 'condition' && CONDITIONS.map(c => (
          <div
            key={c.code}
            className={`flex items-center gap-[5px] font-mono-ibm text-[10px] px-2 py-[3px] rounded-sm border cursor-pointer transition-all select-none ${activeFilters.has(c.code) ? 'border-[rgba(255,255,255,.2)] text-ct-text2' : 'border-[rgba(255,255,255,.06)] text-ct-text3'}`}
            onClick={() => toggleFilter(c.code)}
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `hsl(var(${c.colorVar}))` }} />
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
            {ROWS.map(r => <div key={r} className="font-mono-ibm text-[9px] text-ct-text3 flex items-center pr-[5px] min-w-[14px] h-[13px]">{r}</div>)}
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${COLS}, 13px)` }}>
            {data.map((croc, idx) => {
              if (!croc.occupied) return <div key={idx} className="w-[13px] h-[13px] rounded-[1px] bg-surface-3 opacity-20" />;
              const inBatch = !batchActive || (croc.tagId! >= blo && croc.tagId! <= bhi);
              if (!inBatch) return <div key={idx} className="w-[13px] h-[13px] rounded-[1px] bg-surface-3 opacity-[.07]" />;
              const bg = getCellColor(croc);
              const cstr = croc.conds.length ? croc.conds.join(' · ') : 'Clear';
              return (
                <div
                  key={idx}
                  className="w-[13px] h-[13px] rounded-[1px] cursor-pointer transition-transform hover:scale-[1.7] hover:z-10 hover:outline hover:outline-1 hover:outline-[rgba(255,255,255,.6)]"
                  style={{ background: bg }}
                  onMouseEnter={(e) => setTooltip({ x: e.clientX + 14, y: e.clientY - 50, text: `${pen} ${croc.row}-${croc.col}\nTag: #${croc.tagId}\nSize: ${croc.sizeCm} cm\n${cstr}` })}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
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
          {jMN > 0 && (
            <div className="bg-[rgba(192,57,43,.08)] border border-[rgba(192,57,43,.25)] rounded p-2.5 mb-2">
              <div className="font-mono-ibm text-[10px] text-ct-danger mb-1">⚠ ROW J — MN CLUSTER</div>
              <div className="text-xs text-ct-text2">{jMN} malnourished crocs in Row J. Inspect feeder line immediately.</div>
              <div className="mt-2"><button className="bg-ct-accent text-background border-none px-2.5 py-[5px] font-mono-ibm text-[10px] rounded-sm cursor-pointer">Log Feeder Check</button></div>
            </div>
          )}
          {fDS > 0 && (
            <div className="bg-[rgba(212,137,42,.08)] border border-[rgba(212,137,42,.25)] rounded p-2.5">
              <div className="font-mono-ibm text-[10px] text-ct-warn mb-1">WATCH — ROW F · DS CLUSTER</div>
              <div className="text-xs text-ct-text2">{fDS} DS-flagged crocs in Row F, cols 30–38. Monitor water quality.</div>
            </div>
          )}
          {jMN === 0 && fDS === 0 && <div className="text-xs text-ct-text3 text-center py-5">No active feeder alerts</div>}
        </div>
      </div>
    </div>
  );
}
