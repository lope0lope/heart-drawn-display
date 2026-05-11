import { useConditionCodes } from '@/hooks/useCrocs';

export default function ConditionCodesScreen() {
  const { data: conditionDefs, isLoading } = useConditionCodes();

  const locs = [
    { code: 'Collar', desc: 'Collar / neck area' },
    { code: 'Chest', desc: 'Upper chest / throat belly' },
    { code: 'Belly', desc: 'Central belly panel' },
    { code: 'Tail', desc: 'Tail section' },
    { code: 'LF', desc: 'Left Flank' },
    { code: 'RF', desc: 'Right Flank' },
    { code: 'RT', desc: 'Right Top' },
    { code: 'RB', desc: 'Right Bottom' },
    { code: 'FT', desc: 'Front Top' },
    { code: 'LB', desc: 'Left Bottom' },
  ];

  const sevs = [
    { label: 'NXT', col: 'text-ct-cull', bg: 'bg-[rgba(107,63,160,.15)]', meaning: 'Cull at next inspection. Defect is progressing — do not delay.' },
    { label: '1', col: 'text-ct-danger', bg: 'bg-[rgba(192,57,43,.12)]', meaning: 'Potential cull in 2 inspections. Monitor closely every visit.' },
    { label: '2', col: 'text-ct-warn', bg: 'bg-[rgba(212,137,42,.12)]', meaning: 'Potential cull in 3 inspections. Flag for tracking.' },
    { label: '3', col: 'text-ct-info', bg: 'bg-[rgba(74,144,184,.12)]', meaning: 'Potential cull in 4 inspections. Note and monitor.' },
    { label: '4', col: 'text-ct-danger', bg: 'bg-[rgba(192,57,43,.2)]', meaning: 'Remove from pen immediately. Replace with new croc. Defect is disqualifying.' },
  ];

  if (isLoading) return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading…</div>;

  const liveDefs = conditionDefs?.filter(c => c.is_live) ?? [];
  const hideDefs = conditionDefs?.filter(c => c.is_hide) ?? [];

  return (
    <div className="max-w-[1100px]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
        <div className="bg-[rgba(201,168,76,.07)] border-l-[3px] border-l-ct-accent px-3.5 py-2.5 rounded-r text-xs text-ct-text2 leading-relaxed">
          <strong>Live Defects</strong> — recorded on the living croc at each inspection. Tracked on the pen map and croc profile. Informs culling decisions and treatment holds.
        </div>
        <div className="bg-[rgba(212,137,42,.07)] border-l-[3px] border-l-ct-warn px-3.5 py-2.5 rounded-r text-xs text-ct-text2 leading-relaxed">
          <strong>Defects in Hide</strong> — recorded after the croc is culled. The skin can still acquire damage during processing (knife marks, handling). These are logged against the CITIES tag and follow the skin to export.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Body Locations — Column Headers</span>
          </div>
          <div className="px-[18px] py-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {locs.map(l => (
                <div key={l.code} className="bg-surface-2 border border-border rounded-sm p-2">
                  <div className="font-mono-ibm text-[13px] text-ct-accent font-medium">{l.code}</div>
                  <div className="text-[10px] text-ct-text3 mt-0.5">{l.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Severity Rating — Updated Scale</span>
          </div>
          <div className="px-[18px] py-4">
            {sevs.map((s, i) => (
              <div key={i} className={`flex items-start gap-3 p-2.5 rounded ${s.bg} mb-1.5`}>
                <div className={`font-display text-[26px] font-bold leading-none w-9 text-center flex-shrink-0 ${s.col}`}>{s.label}</div>
                <div className="text-xs text-ct-text2 leading-relaxed">{s.meaning}</div>
              </div>
            ))}
            <div className="font-mono-ibm text-[9px] text-ct-text3 mt-2.5 tracking-[1px]">
              NXT = next inspection · 1–3 = inspections until cull · 4 = immediate removal
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Live Defects</span>
            <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(76,175,80,.15)] text-ct-good">On living croc</span>
          </div>
          <div className="p-0">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="bg-surface-3 border border-border p-[7px_10px] font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase text-left">Code</th>
                  <th className="bg-surface-3 border border-border p-[7px_10px] font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase text-left">Defect</th>
                  <th className="bg-surface-3 border border-border p-[7px_10px] font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase text-center">In Hide?</th>
                </tr>
              </thead>
              <tbody>
                {liveDefs.map((d) => {
                  const col = `hsl(var(${d.color_var}))`;
                  return (
                    <tr key={d.code} className="hover:bg-surface-2">
                      <td className="border border-border p-[7px_12px]">
                        <span className="font-mono-ibm text-[11px] px-[5px] py-px rounded-sm" style={{ border: `1px solid ${col}`, color: col }}>{d.code}</span>
                      </td>
                      <td className="border border-border p-[7px_12px] font-medium">{d.name}</td>
                      <td className="border border-border p-[7px_12px] text-center text-[13px]">
                        {d.is_hide ? <span className="text-ct-good">✓</span> : <span className="text-ct-text3">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Defects in Hide</span>
            <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(212,137,42,.15)] text-ct-warn">Post-cull / processing</span>
          </div>
          <div className="p-0">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="bg-surface-3 border border-border p-[7px_10px] font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase text-left">Code</th>
                  <th className="bg-surface-3 border border-border p-[7px_10px] font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase text-left">Defect</th>
                </tr>
              </thead>
              <tbody>
                {hideDefs.map((d) => {
                  const col = `hsl(var(${d.color_var}))`;
                  return (
                    <tr key={d.code} className="hover:bg-surface-2">
                      <td className="border border-border p-[7px_12px]">
                        <span className="font-mono-ibm text-[11px] px-[5px] py-px rounded-sm" style={{ border: `1px solid ${col}`, color: col }}>{d.code}</span>
                      </td>
                      <td className="border border-border p-[7px_12px] font-medium">{d.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3.5 border-t border-border font-mono-ibm text-[10px] text-ct-text3 leading-[1.8]">
              ※ Skin defects share the same code list as live defects.<br />
              Post-cull damage (e.g. knife marks) is logged using the same codes against the CITIES tag number.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
