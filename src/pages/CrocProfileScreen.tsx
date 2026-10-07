import { useState, useEffect, useMemo } from 'react';
import { useAllCrocs, useInspectionHistory, type CrocRecord } from '@/hooks/useCrocs';
import { useFeedRecords } from '@/hooks/useFeedData';
import { useGrowthRates } from '@/hooks/useCullData';
import { useCrocPhotos } from '@/hooks/useCrocPhotos';
import { sizeBand } from '@/lib/crocUtils';
import { penTenure, buildPenStays, tenureColor } from '@/lib/penTenure';


const CULL_THRESHOLD = 54;

interface CrocProfileProps {
  initialSearch?: string;
}

export default function CrocProfileScreen({ initialSearch }: CrocProfileProps) {
  const [searchTag, setSearchTag] = useState(initialSearch ?? '');
  const [selectedCroc, setSelectedCroc] = useState<CrocRecord | null>(null);
  const { data: allCrocs } = useAllCrocs();
  const { data: inspections, isLoading: loadingHistory } = useInspectionHistory(selectedCroc?.id);
  const { data: feedRecords } = useFeedRecords(selectedCroc?.pen_id);
  const { data: growthRates } = useGrowthRates();
  const { data: crocPhotos = [], error: photoError } = useCrocPhotos(selectedCroc?.id, selectedCroc?.tag);


  useEffect(() => {
    if (initialSearch && initialSearch !== searchTag) {
      setSearchTag(initialSearch);
    }
  }, [initialSearch]);

  useEffect(() => {
    if (!searchTag.trim() || !allCrocs) return;
    const found = allCrocs.find(c => c.tag === searchTag.trim() || c.id.toString() === searchTag.trim());
    if (found) {
      setSelectedCroc(found);
    }
  }, [allCrocs, searchTag]);

  const handleSearch = () => {
    if (!searchTag.trim()) return;
    const found = (allCrocs ?? []).find(c => c.tag === searchTag.trim() || c.id.toString() === searchTag.trim());
    setSelectedCroc(found ?? null);
  };

  const croc = selectedCroc;
  const tenureInfo = useMemo(
    () => (croc ? penTenure(croc) : { since: null, days: null, estimated: true }),
    [croc]
  );
  const penStays = useMemo(() => buildPenStays(inspections ?? []), [inspections]);
  const history = inspections ?? [];
  const growthDelta = history.length >= 2
    ? (history[history.length - 1].belly_cm ?? 0) - (history[0].belly_cm ?? 0)
    : null;
  const growthRate = history.length >= 2 && history[0].belly_cm
    ? ((growthDelta ?? 0) / history[0].belly_cm * 100)
    : null;
  const maxBelly = Math.max(...history.map(h => h.belly_cm ?? 0), 1);

  // Feed records for this croc's line
  const crocFeedHistory = useMemo(() => {
    if (!feedRecords || !croc) return [];
    return feedRecords
      .filter(f => f.line === croc.line)
      .sort((a, b) => a.cycle.localeCompare(b.cycle));
  }, [feedRecords, croc]);

  // Size progress toward cull threshold
  const sizeProgress = croc?.belly_cm ? Math.min((croc.belly_cm / CULL_THRESHOLD) * 100, 100) : 0;

  // Projected cull date
  const projectedCullDate = useMemo(() => {
    if (!croc?.belly_cm || !growthRates) return null;
    const currentBand = sizeBand(croc.belly_cm) ?? 0;
    const monthlyGrowth = growthRates[currentBand]; // cm per cycle (~2 months)
    if (monthlyGrowth <= 0) return null;
    const remaining = CULL_THRESHOLD - croc.belly_cm;
    if (remaining <= 0) return 'Ready now';
    const cyclesRemaining = Math.ceil(remaining / monthlyGrowth);
    const months = cyclesRemaining * 2;
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return `~${date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })} (${months} months)`;
  }, [croc, growthRates]);

  return (
    <div>
      <div className="flex gap-2.5 mb-4 items-center">
        <input
          className="bg-surface-2 border border-border text-ct-text px-3.5 py-2 font-mono-ibm text-xs rounded-sm w-[260px] outline-none focus:border-ct-accent"
          placeholder="Search by Tag # or ID…"
          value={searchTag}
          onChange={e => setSearchTag(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} className="bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] rounded-sm cursor-pointer hover:border-ct-accent hover:bg-surface-2">Search</button>
        {croc && <span className="text-[11px] text-ct-text3 ml-2 font-mono-ibm">Showing: {croc.tag ? `Tag #${croc.tag}` : `ID ${croc.id}`} · {croc.pen_id} {croc.line}-{croc.pen_slot}</span>}
      </div>

      {!croc ? (
        <div className="bg-surface border border-border rounded p-8 text-center">
          <div className="text-ct-text3 text-xs font-mono-ibm mb-2">Enter a tag number or croc ID to view profile</div>
          <div className="text-ct-text3 text-[10px] font-mono-ibm">
            {allCrocs ? `${allCrocs.filter(c => c.belly_cm).length} crocs loaded across all pens` : 'Loading…'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-4">
          {/* Left: Profile card */}
          <div className="flex flex-col gap-3">
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-4">
                <div className="font-display text-[52px] font-semibold text-ct-accent tracking-[3px] leading-none">
                  {croc.tag ? `#${croc.tag}` : `#${croc.id}`}
                </div>
                <div className="font-mono-ibm text-[10px] text-ct-text3 mt-1.5">
                  {croc.pen_id} · Line {croc.line}
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

            {/* Size Progress to Cull */}
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-3 border-b border-border">
                <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Cull Progress</span>
              </div>
              <div className="px-[18px] py-3">
                <div className="flex justify-between text-[10px] font-mono-ibm mb-1.5">
                  <span className="text-ct-text2">{croc.belly_cm ?? 0} cm</span>
                  <span className="text-ct-text3">{CULL_THRESHOLD} cm target</span>
                </div>
                <div className="h-2.5 bg-surface-3 rounded-sm overflow-hidden mb-2">
                  <div
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${sizeProgress}%`,
                      background: sizeProgress >= 100 ? 'hsl(var(--ct-good))' : sizeProgress >= 65 ? 'hsl(var(--ct-accent))' : 'hsl(var(--ct-info))',
                    }}
                  />
                </div>
                <div className="font-mono-ibm text-[10px] text-ct-text3">
                  {sizeProgress >= 100 ? (
                    <span className="text-ct-good">✓ Ready for cull</span>
                  ) : (
                    <span>{(CULL_THRESHOLD - (croc.belly_cm ?? 0)).toFixed(1)} cm remaining</span>
                  )}
                </div>
                {projectedCullDate && sizeProgress < 100 && (
                  <div className="font-mono-ibm text-[10px] text-ct-accent mt-1">
                    Est. cull: {projectedCullDate}
                  </div>
                )}
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

            {/* CITIES Tag */}
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-3 border-b border-border">
                <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">CITIES Tag</span>
              </div>
              <div className="px-[18px] py-3">
                <div className="font-mono-ibm text-[11px] text-ct-text3">
                  {sizeProgress >= 100 ? 'Pending assignment at cull' : 'Assigned at cull — not yet eligible'}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Details + History + Feed */}
          <div className="flex flex-col gap-3">
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-3 border-b border-border">
                <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Croc Details</span>
              </div>
              <div className="px-[18px] py-4">
                <div className="text-xs text-ct-text2 leading-[1.8]">
                  <strong>Location:</strong> {croc.pen_id}, Line {croc.line}, Slot {croc.pen_slot}<br />
                  <strong>Belly measurement:</strong> {croc.belly_cm ?? 'Not measured'} cm<br />
                  <strong>Conditions:</strong> {croc.condition_codes.length > 0 ? croc.condition_codes.join(', ') : 'None'}<br />
                  <strong>Last inspection:</strong> {croc.inspection_date}<br />
                  <strong>Tag:</strong> {croc.tag || 'Not tagged'}
                </div>
              </div>
            </div>

            {/* Placement & Pen History */}
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
                <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Placement & Pen History</span>
                {tenureInfo.days !== null && (
                  <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm" style={{ background: 'rgba(0,0,0,.10)', color: tenureColor(tenureInfo.days) }}>
                    {tenureInfo.days} days in current pen{tenureInfo.estimated ? ' (est.)' : ''}
                  </span>
                )}
              </div>
              <div className="px-[18px] py-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Placement date', value: croc.placement_date ?? '—' },
                    { label: 'Placement size', value: croc.placement_belly_cm != null ? `${croc.placement_belly_cm} cm` : '—' },
                    { label: 'In pen since', value: tenureInfo.since ?? '—' },
                    { label: 'Growth since placement', value: croc.placement_belly_cm != null && croc.belly_cm != null ? `+${(croc.belly_cm - croc.placement_belly_cm).toFixed(1)} cm` : '—' },
                  ].map(s => (
                    <div key={s.label} className="bg-surface-2 border border-border rounded-sm p-2.5">
                      <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[1.5px] uppercase mb-1">{s.label}</div>
                      <div className="font-mono-ibm text-[13px] text-ct-text">{s.value}</div>
                    </div>
                  ))}
                </div>

                {penStays.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px] font-mono-ibm min-w-[420px]">
                      <thead>
                        <tr>
                          {['Pen', 'Slot', 'From', 'To', 'Days', 'Size at move'].map(h => (
                            <th key={h} className="p-[6px_10px] text-ct-text3 text-left border-b border-border font-normal tracking-[1px] uppercase text-[9px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {penStays.map((s, i) => (
                          <tr key={`${s.pen_id}-${s.line}-${s.pen_slot}-${s.from}`} className={i === penStays.length - 1 ? 'text-ct-text' : 'text-ct-text2'}>
                            <td className="p-[6px_10px] border-b border-border/50 text-ct-accent">{s.pen_id}</td>
                            <td className="p-[6px_10px] border-b border-border/50">{s.line}-{s.pen_slot}</td>
                            <td className="p-[6px_10px] border-b border-border/50">{s.from}</td>
                            <td className="p-[6px_10px] border-b border-border/50">{s.to ?? 'current'}</td>
                            <td className="p-[6px_10px] border-b border-border/50" style={{ color: tenureColor(s.days) }}>{s.days ?? '—'}</td>
                            <td className="p-[6px_10px] border-b border-border/50">{s.belly_cm != null ? `${s.belly_cm} cm` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="font-mono-ibm text-[10px] text-ct-text3 leading-[1.8]">
                    No pen movement history recorded yet. Pen positions are logged from the next inspection upload onwards.
                  </div>
                )}
              </div>
            </div>


            {/* Photo History — oldest capture first */}
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
                <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Photo History</span>
                <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(201,168,76,.18)] text-ct-accent2">
                  {crocPhotos.length} photo{crocPhotos.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="px-[18px] py-4">
                {photoError ? (
                  <div className="text-center py-4 text-ct-text3 font-mono-ibm text-[11px]">
                    Photo storage is not set up yet.
                  </div>
                ) : crocPhotos.length === 0 ? (
                  <div className="text-center py-4 text-ct-text3 font-mono-ibm text-[11px]">
                    No photo evidence captured for this croc yet.
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {crocPhotos.map(p => (
                      <figure key={p.id} className="flex-shrink-0 w-[150px]">
                        <a href={p.photo_url} target="_blank" rel="noreferrer">
                          <img
                            src={p.photo_url}
                            alt={`Croc ${croc.tag ?? croc.id} inspected ${p.inspection_date}`}
                            loading="lazy"
                            className="w-[150px] h-[150px] object-cover rounded-sm border border-border hover:border-ct-accent transition-colors"
                          />
                        </a>
                        <figcaption className="mt-1.5">
                          <div className="font-mono-ibm text-[10px] text-ct-accent">{p.inspection_date}</div>
                          <div className="font-mono-ibm text-[9px] text-ct-text3">
                            {p.belly_cm ? `${p.belly_cm} cm` : 'No measurement'}
                            {p.marks?.length ? ` · ${p.marks.length} mark${p.marks.length > 1 ? 's' : ''}` : ''}
                          </div>
                          {p.marks?.length ? (
                            <div className="font-mono-ibm text-[9px] text-ct-warn leading-snug mt-0.5">
                              {p.marks.map(m => `${m.code} ${m.zoneLabel}`).join(' · ')}
                            </div>
                          ) : null}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
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
                          <div className="w-full rounded-t-sm bg-ct-accent transition-all group-hover:bg-ct-good" style={{ height: `${Math.max(pct, 4)}%` }} />
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

            {/* Feed Consumption History */}
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
                <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Feed Consumption — Line {croc.line}</span>
                <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(201,168,76,.18)] text-ct-accent2">
                  {crocFeedHistory.length} cycles
                </span>
              </div>
              <div className="px-[18px] py-4">
                {crocFeedHistory.length === 0 ? (
                  <div className="text-center py-4 text-ct-text3 font-mono-ibm text-[11px]">No feed data for this line.</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {crocFeedHistory.map(f => (
                      <div key={f.id} className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-sm border border-border">
                        <span className="font-mono-ibm text-[10px] text-ct-accent w-[60px]">{f.cycle}</span>
                        <div className="flex-1 h-[5px] bg-surface-3 rounded-sm overflow-hidden">
                          <div className="h-full rounded-sm bg-ct-accent" style={{ width: `${Math.min(f.feed_kg / 50 * 100, 100)}%` }} />
                        </div>
                        <span className="font-mono-ibm text-[11px] text-ct-text w-[55px] text-right">{f.feed_kg} kg</span>
                        {f.croc_count && <span className="font-mono-ibm text-[9px] text-ct-text3">({f.croc_count} crocs)</span>}
                      </div>
                    ))}
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
                    {/* Projected future entry */}
                    {projectedCullDate && sizeProgress < 100 && (
                      <div className="flex items-center gap-3 px-3 py-2 bg-[rgba(201,168,76,.06)] rounded-sm border border-[rgba(201,168,76,.2)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-ct-accent flex-shrink-0 opacity-40" />
                        <span className="font-mono-ibm text-[10px] text-ct-text3 w-[80px]">Projected</span>
                        <span className="font-mono-ibm text-[11px] text-ct-accent flex-1 italic">
                          {CULL_THRESHOLD} cm — est. {projectedCullDate}
                        </span>
                      </div>
                    )}
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
