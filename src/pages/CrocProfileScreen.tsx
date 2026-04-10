import { useState, useEffect } from 'react';
import { useCrocs, useInspectionHistory, type CrocRecord } from '@/hooks/useCrocs';

interface CrocProfileProps {
  initialSearch?: string;
}

export default function CrocProfileScreen({ initialSearch }: CrocProfileProps) {
  const [searchTag, setSearchTag] = useState(initialSearch ?? '');
  const [selectedCroc, setSelectedCroc] = useState<CrocRecord | null>(null);
  const [pen, setPen] = useState('GH1');
  const { data: crocs } = useCrocs(pen);
  const { data: crocs2 } = useCrocs('GH2');
  const { data: inspections, isLoading: loadingHistory } = useInspectionHistory(selectedCroc?.id);

  // Auto-search when initialSearch changes (from global search)
  useEffect(() => {
    if (initialSearch && initialSearch !== searchTag) {
      setSearchTag(initialSearch);
    }
  }, [initialSearch]);

  // Auto-search when crocs load and there's a search tag
  useEffect(() => {
    if (!searchTag.trim() || !crocs) return;
    const allCrocs = [...(crocs ?? []), ...(crocs2 ?? [])];
    const found = allCrocs.find(c => c.tag === searchTag.trim() || c.id.toString() === searchTag.trim());
    if (found) {
      setPen(found.pen_id);
      setSelectedCroc(found);
    }
  }, [crocs, crocs2, searchTag]);

  const handleSearch = () => {
    if (!searchTag.trim()) return;
    const allCrocs = [...(crocs ?? []), ...(crocs2 ?? [])];
    const found = allCrocs.find(c => c.tag === searchTag.trim() || c.id.toString() === searchTag.trim());
    setSelectedCroc(found ?? null);
  };

  const croc = selectedCroc;

  // Growth calculations
  const history = inspections ?? [];
  const growthDelta = history.length >= 2
    ? (history[history.length - 1].belly_cm ?? 0) - (history[0].belly_cm ?? 0)
    : null;
  const growthRate = history.length >= 2 && history[0].belly_cm
    ? ((growthDelta ?? 0) / history[0].belly_cm * 100)
    : null;
  const maxBelly = Math.max(...history.map(h => h.belly_cm ?? 0), 1);

  return (
    <div>
      <div className="flex gap-2.5 mb-4 items-center">
        <select className="bg-surface-2 border border-border text-ct-text px-2.5 py-[7px] font-mono-ibm text-[11px] rounded-sm cursor-pointer outline-none focus:border-ct-accent" value={pen} onChange={e => { setPen(e.target.value); setSelectedCroc(null); }}>
          <option value="GH1">GH1</option>
          <option value="GH2">GH2</option>
        </select>
        <input
          className="bg-surface-2 border border-border text-ct-text px-3.5 py-2 font-mono-ibm text-xs rounded-sm w-[260px] outline-none focus:border-ct-accent"
          placeholder="Search by Tag # or ID…"
          value={searchTag}
          onChange={e => setSearchTag(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} className="bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] rounded-sm cursor-pointer hover:border-ct-accent hover:bg-surface-2">Search</button>
        {croc && <span className="text-[11px] text-ct-text3 ml-2 font-mono-ibm">Showing: {croc.tag ? `Tag #${croc.tag}` : `ID ${croc.id}`}</span>}
      </div>

      {!croc ? (
        <div className="bg-surface border border-border rounded p-8 text-center">
          <div className="text-ct-text3 text-xs font-mono-ibm mb-2">Enter a tag number or croc ID to view profile</div>
          <div className="text-ct-text3 text-[10px] font-mono-ibm">
            {crocs ? `${crocs.filter(c => c.belly_cm).length} crocs loaded in ${pen}` : 'Loading…'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[270px_1fr] gap-4">
          {/* Left: Profile card */}
          <div className="flex flex-col gap-3">
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-4">
                <div className="font-display text-[52px] font-semibold text-ct-accent tracking-[3px] leading-none">
                  {croc.tag ? `#${croc.tag}` : `#${croc.id}`}
                </div>
                <div className="font-mono-ibm text-[10px] text-ct-text3 mt-1.5">
                  {croc.grade ? `GRADE ${croc.grade}` : 'NO GRADE'} · {croc.pen_id} · Line {croc.line}
                </div>
                {croc.condition_codes.length > 0 && (
                  <div className="mt-2.5">
                    {croc.condition_codes.map((code, i) => (
                      <span key={i} className="inline-flex items-center bg-[rgba(212,137,42,.12)] border border-[rgba(212,137,42,.35)] text-ct-warn font-mono-ibm text-[11px] px-[7px] py-0.5 rounded-sm mx-0.5">
                        {code}
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-3.5">
                  {[
                    { label: 'Belly Size', value: croc.belly_cm ? `${croc.belly_cm} cm` : '—' },
                    { label: 'Pen Slot', value: `${croc.line}-${croc.pen_slot}` },
                    { label: 'Pen', value: croc.pen_id },
                    { label: 'Inspection', value: croc.inspection_date || '—' },
                  ].map((s, i) => (
                    <div key={i} className="bg-surface-2 rounded-sm p-2.5">
                      <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-1">{s.label}</div>
                      <div className="font-display text-[16px] font-semibold leading-none text-ct-text">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Growth Summary */}
            {history.length > 0 && (
              <div className="bg-surface border border-border rounded overflow-hidden">
                <div className="px-[18px] py-3 border-b border-border">
                  <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Growth Summary</span>
                </div>
                <div className="px-[18px] py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-2 rounded-sm p-2.5">
                      <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-1">Inspections</div>
                      <div className="font-display text-[20px] font-semibold text-ct-text leading-none">{history.length}</div>
                    </div>
                    <div className="bg-surface-2 rounded-sm p-2.5">
                      <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-1">Growth</div>
                      <div className={`font-display text-[20px] font-semibold leading-none ${growthDelta !== null && growthDelta > 0 ? 'text-ct-good' : 'text-ct-text'}`}>
                        {growthDelta !== null ? `${growthDelta > 0 ? '+' : ''}${growthDelta.toFixed(1)} cm` : '—'}
                      </div>
                    </div>
                    <div className="bg-surface-2 rounded-sm p-2.5">
                      <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-1">First</div>
                      <div className="font-display text-[14px] font-semibold text-ct-text leading-none">{history[0]?.belly_cm ?? '—'} cm</div>
                    </div>
                    <div className="bg-surface-2 rounded-sm p-2.5">
                      <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-1">Latest</div>
                      <div className="font-display text-[14px] font-semibold text-ct-accent leading-none">{history[history.length - 1]?.belly_cm ?? '—'} cm</div>
                    </div>
                  </div>
                  {growthRate !== null && (
                    <div className="mt-2 text-[10px] text-ct-text3 font-mono-ibm">
                      Growth rate: <span className="text-ct-good">{growthRate.toFixed(1)}%</span> over {history.length} inspection(s)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Details + History */}
          <div className="flex flex-col gap-3">
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-3 border-b border-border">
                <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Croc Details</span>
              </div>
              <div className="px-[18px] py-4">
                <div className="text-xs text-ct-text2 leading-[1.8]">
                  <strong>Location:</strong> {croc.pen_id}, Line {croc.line}, Slot {croc.pen_slot}<br />
                  <strong>Belly measurement:</strong> {croc.belly_cm ?? 'Not measured'} cm<br />
                  <strong>Grade:</strong> {croc.grade ?? 'Not graded'}<br />
                  <strong>Conditions:</strong> {croc.condition_codes.length > 0 ? croc.condition_codes.join(', ') : 'None'}<br />
                  <strong>Last inspection:</strong> {croc.inspection_date}<br />
                  <strong>Tag:</strong> {croc.tag || 'Not tagged'}
                </div>
              </div>
            </div>

            {/* Growth Chart */}
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
                <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Belly Growth Over Time</span>
                <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(76,175,80,.15)] text-ct-good">
                  {history.length} measurement{history.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="px-[18px] py-4">
                {loadingHistory ? (
                  <div className="text-center py-6 text-ct-text3 font-mono-ibm text-[11px]">Loading history…</div>
                ) : history.length === 0 ? (
                  <div className="text-center py-6 text-ct-text3 font-mono-ibm text-[11px]">No inspection history recorded yet.</div>
                ) : (
                  <div className="flex items-end gap-1 h-[120px]">
                    {history.map((h, i) => {
                      const pct = (h.belly_cm ?? 0) / maxBelly * 100;
                      return (
                        <div key={h.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-surface-3 px-1.5 py-0.5 rounded text-[9px] text-ct-text font-mono-ibm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {h.belly_cm} cm · {h.inspection_date}
                          </div>
                          <div
                            className="w-full rounded-t-sm bg-ct-accent transition-all group-hover:bg-ct-good"
                            style={{ height: `${Math.max(pct, 4)}%` }}
                          />
                          <span className="text-[8px] text-ct-text3 font-mono-ibm">
                            {history.length <= 12 ? h.inspection_date.slice(5) : (i === 0 || i === history.length - 1 ? h.inspection_date.slice(5) : '')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Inspection Timeline */}
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-3 border-b border-border">
                <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Inspection History</span>
              </div>
              <div className="px-[18px] py-3 max-h-[260px] overflow-y-auto">
                {loadingHistory ? (
                  <div className="text-center py-4 text-ct-text3 font-mono-ibm text-[11px]">Loading…</div>
                ) : history.length === 0 ? (
                  <div className="text-center py-4 text-ct-text3 font-mono-ibm text-[11px]">No inspections recorded.</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {[...history].reverse().map((h) => (
                      <div key={h.id} className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-sm border border-border">
                        <div className="w-1.5 h-1.5 rounded-full bg-ct-accent flex-shrink-0" />
                        <span className="font-mono-ibm text-[10px] text-ct-text3 w-[80px]">{h.inspection_date}</span>
                        <span className="font-mono-ibm text-[11px] text-ct-text flex-1">
                          {h.belly_cm ? `${h.belly_cm} cm` : 'No measurement'}
                        </span>
                        {h.condition_codes.length > 0 && (
                          <div className="flex gap-0.5">
                            {h.condition_codes.map((c, j) => (
                              <span key={j} className="bg-[rgba(212,137,42,.12)] text-ct-warn font-mono-ibm text-[9px] px-1.5 py-0.5 rounded-sm">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
