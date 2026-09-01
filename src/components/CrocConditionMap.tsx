import { useState } from 'react';
import { X } from 'lucide-react';
import crocDiagram from '@/assets/croc-diagram.png';
import {
  CROC_H, CROC_W, CROC_ZONES, ZONE_BY_KEY,
  markerPosition, type ConditionMark,
} from '@/lib/crocZones';
import type { ConditionCodeRecord } from '@/hooks/useCrocs';

interface Props {
  marks: ConditionMark[];
  onChange: (marks: ConditionMark[]) => void;
  conditionCodes: ConditionCodeRecord[];
  readOnly?: boolean;
}

/**
 * Location-based condition capture: tap a body zone on the diagram, pick one or
 * more condition codes. Multiple marks per zone are supported.
 */
export default function CrocConditionMap({ marks, onChange, conditionCodes, readOnly }: Props) {
  const [activeZone, setActiveZone] = useState<string | null>(null);
  /** Exact tap point in diagram coordinates, captured on press. */
  const [tapPoint, setTapPoint] = useState<{ mx: number; my: number } | null>(null);

  const openZone = (zoneKey: string, e: React.MouseEvent<SVGElement>) => {
    const svg = e.currentTarget.ownerSVGElement ?? (e.currentTarget as unknown as SVGSVGElement);
    const r = svg.getBoundingClientRect();
    if (r.width && r.height) {
      setTapPoint({
        mx: ((e.clientX - r.left) / r.width) * CROC_W,
        my: ((e.clientY - r.top) / r.height) * CROC_H,
      });
    } else {
      setTapPoint(null);
    }
    setActiveZone(zoneKey);
  };

  const addMark = (zoneKey: string, c: ConditionCodeRecord) => {
    const zone = ZONE_BY_KEY[zoneKey];
    if (!zone) return;
    // Pin at the exact press location; nudge repeats so stacked codes stay readable.
    const base = tapPoint ?? markerPosition(zone);
    const stacked = marks.filter(
      m => Math.abs(m.mx - base.mx) < 14 && Math.abs(m.my - base.my) < 14,
    ).length;
    const pos = stacked
      ? { mx: base.mx + Math.cos(stacked) * 20 * stacked, my: base.my + Math.sin(stacked) * 20 * stacked }
      : base;
    onChange([
      ...marks,
      {
        id: crypto.randomUUID(),
        zoneKey,
        zoneLabel: zone.label,
        code: c.code,
        name: c.name,
        mx: Math.max(12, Math.min(CROC_W - 12, pos.mx)),
        my: Math.max(12, Math.min(CROC_H - 12, pos.my)),
      },
    ]);
    setActiveZone(null);
    setTapPoint(null);
  };

  const removeMark = (id: string) => onChange(marks.filter(m => m.id !== id));

  return (
    <div>
      {!readOnly && (
        <div className="font-mono-ibm text-[10px] text-ct-text3 text-center mb-2 uppercase tracking-[1.5px]">
          Tap the region where the condition is found
        </div>
      )}

      <div className="relative mx-auto max-w-[340px] select-none" style={{ touchAction: 'manipulation' }}>
        <img
          src={crocDiagram}
          alt="Crocodile body diagram for marking condition locations"
          className="w-full h-auto block pointer-events-none"
          draggable={false}
        />
        <svg
          viewBox={`0 0 ${CROC_W} ${CROC_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
        >
          {CROC_ZONES.map(z => {
            const common = {
              className: `${readOnly ? '' : 'cursor-pointer'} fill-ct-accent opacity-0 hover:opacity-30 active:opacity-40 transition-opacity`,
              onClick: readOnly ? undefined : (e: React.MouseEvent<SVGElement>) => openZone(z.key, e),
            };
            return z.points
              ? <polygon key={z.key} points={z.points} {...common} />
              : <ellipse key={z.key} {...z.ellipse!} {...common} />;
          })}
        </svg>

        {/* Markers */}
        <div className="absolute inset-0 pointer-events-none">
          {marks.map(m => (
            <div
              key={m.id}
              title={`${m.name} — ${m.zoneLabel}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-ct-accent text-background font-mono-ibm text-[9px] font-bold flex items-center justify-center shadow-[0_0_0_2px_rgba(0,0,0,.6),0_2px_6px_rgba(0,0,0,.5)] animate-in zoom-in duration-150"
              style={{ left: `${(m.mx / CROC_W) * 100}%`, top: `${(m.my / CROC_H) * 100}%` }}
            >
              {m.code}
            </div>
          ))}
        </div>
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-1.5 mt-4">
        {marks.length === 0 ? (
          <div className="font-mono-ibm text-[11px] text-ct-text3 text-center py-3.5 border border-dashed border-border rounded-sm uppercase tracking-[1.5px]">
            No conditions recorded yet
          </div>
        ) : (
          marks.map(m => (
            <div key={m.id} className="flex items-center gap-2.5 bg-surface-2 border border-border rounded-sm px-3 py-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-ct-accent flex-shrink-0" />
              <span className="flex-1 text-ct-text2">
                <b className="text-ct-accent font-semibold">{m.name}</b> — {m.zoneLabel}
              </span>
              {!readOnly && (
                <button
                  onClick={() => removeMark(m.id)}
                  className="text-ct-text3 hover:text-ct-danger p-1 active:scale-95"
                  aria-label={`Remove ${m.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Condition picker */}
      {activeZone && (
        <div
          className="fixed inset-0 z-50 bg-black/65 flex items-end sm:items-center justify-center"
          onClick={e => { if (e.target === e.currentTarget) { setActiveZone(null); setTapPoint(null); }; }}
        >
          <div className="bg-surface border border-border w-full max-w-[440px] max-h-[80vh] overflow-y-auto p-5 rounded-t-xl sm:rounded-xl animate-in slide-in-from-bottom-4 duration-200">
            <h3 className="font-display text-lg text-ct-text">Select Condition</h3>
            <div className="font-mono-ibm text-[11px] text-ct-accent uppercase tracking-[1.5px] mb-4">
              {ZONE_BY_KEY[activeZone]?.label}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {conditionCodes.map(c => (
                <button
                  key={c.code}
                  onClick={() => addMark(activeZone, c)}
                  className="bg-surface-2 border border-border rounded-sm px-1.5 py-3 text-[11px] text-ct-text hover:bg-ct-accent hover:text-background hover:border-ct-accent active:scale-95 transition-all"
                >
                  <span className="block font-mono-ibm font-bold text-[13px] mb-1">{c.code}</span>
                  {c.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setActiveZone(null); setTapPoint(null); }}
              className="w-full mt-4 border border-border text-ct-text3 rounded-sm py-3 font-mono-ibm text-[11px] uppercase tracking-[1.5px] hover:text-ct-text active:scale-[.98]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
