import { useState } from 'react';
import { useCrocs, type CrocRecord } from '@/hooks/useCrocs';

export default function CrocProfileScreen() {
  const [searchTag, setSearchTag] = useState('');
  const [selectedCroc, setSelectedCroc] = useState<CrocRecord | null>(null);
  const [pen, setPen] = useState('GH1');
  const { data: crocs } = useCrocs(pen);

  const handleSearch = () => {
    if (!crocs || !searchTag.trim()) return;
    const found = crocs.find(c => c.tag === searchTag.trim() || c.id.toString() === searchTag.trim());
    setSelectedCroc(found ?? null);
  };

  const croc = selectedCroc;

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
          </div>

          {/* Right: Details */}
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
              <div className="mt-4 bg-[rgba(201,168,76,.07)] border-l-[3px] border-l-ct-accent px-3.5 py-2.5 rounded-r text-xs text-ct-text2 leading-relaxed">
                Movement history and feed consumption tracking will be available once historical inspection data is uploaded.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
