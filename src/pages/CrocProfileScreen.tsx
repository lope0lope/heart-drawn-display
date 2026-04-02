export default function CrocProfileScreen() {
  return (
    <div>
      <div className="flex gap-2.5 mb-4 items-center">
        <input className="bg-surface-2 border border-border text-ct-text px-3.5 py-2 font-mono-ibm text-xs rounded-sm w-[260px] outline-none focus:border-ct-accent" placeholder="Search by Green Tag number…" />
        <button className="bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] rounded-sm cursor-pointer hover:border-ct-accent hover:bg-surface-2">Search</button>
        <span className="text-[11px] text-ct-text3 ml-2 font-mono-ibm">Showing: Tag #5038</span>
      </div>

      <div className="grid grid-cols-[270px_1fr] gap-4">
        {/* Left: Profile card */}
        <div className="flex flex-col gap-3">
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="px-[18px] py-4">
              <div className="font-display text-[52px] font-semibold text-ct-accent tracking-[3px] leading-none">#5038</div>
              <div className="font-mono-ibm text-[10px] text-ct-text3 mt-1.5">GRADE 1 · BATCH 5000–5600 · GH1</div>
              <div className="mt-2.5">
                <span className="inline-flex items-center bg-[rgba(212,137,42,.12)] border border-[rgba(212,137,42,.35)] text-ct-warn font-mono-ibm text-[11px] px-[7px] py-0.5 rounded-sm mx-0.5">DS · Belly · Sev 2</span>
                <span className="inline-flex items-center bg-[rgba(212,137,42,.12)] border border-[rgba(212,137,42,.35)] text-ct-warn font-mono-ibm text-[11px] px-[7px] py-0.5 rounded-sm mx-0.5">R · Dorsal · Sev 1</span>
              </div>
              <div className="mt-2"><span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(212,137,42,.15)] text-ct-warn">Treatment Hold</span></div>
              <div className="grid grid-cols-2 gap-2 mt-3.5">
                {[
                  { label: 'Current Size', value: '39 cm' },
                  { label: 'Days in System', value: '187' },
                  { label: 'Pen · Slot', value: 'GH1 · F-14', small: true },
                  { label: 'Forecast', value: '+2 Cyc', warn: true },
                ].map((s, i) => (
                  <div key={i} className="bg-surface-2 rounded-sm p-2.5">
                    <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-1">{s.label}</div>
                    <div className={`font-display font-semibold leading-none ${s.small ? 'text-[16px] text-ct-text' : s.warn ? 'text-[22px] text-ct-warn' : 'text-[22px] text-ct-text'}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feed History */}
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Feed Consumption History</span>
              <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(74,144,184,.15)] text-ct-info">g / kg</span>
            </div>
            <div className="px-[18px] py-4">
              <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[1px] mb-2.5">TOTAL FEED PROVIDED PER INSPECTION CYCLE</div>
              {[
                { label: 'Intake', value: '1.2 kg', period: 'Sep–Oct 2025' },
                { label: 'Cycle 1', value: '2.1 kg', period: 'Nov–Dec 2025' },
                { label: 'Cycle 2', value: '2.8 kg', period: 'Jan–Mar 2026' },
              ].map((f, i) => (
                <div key={i} className="flex justify-between items-center text-xs py-[5px] border-b border-border">
                  <span className="font-mono-ibm text-ct-text3">{f.label}</span>
                  <span>{f.value}</span>
                  <span className="font-mono-ibm text-[10px] text-ct-text3">{f.period}</span>
                </div>
              ))}
              <div className="flex justify-between items-center text-xs py-[5px] text-ct-accent">
                <span className="font-mono-ibm">Cycle 3</span>
                <span>3.4 kg ↑</span>
                <span className="font-mono-ibm text-[10px]">Apr 2026</span>
              </div>
              <div className="mt-2 bg-surface-2 rounded-sm p-2.5 grid grid-cols-2 gap-2">
                <div>
                  <div className="font-mono-ibm text-[9px] text-ct-text3 uppercase tracking-[1px] mb-[3px]">Total Consumed</div>
                  <div className="font-display text-xl text-ct-text">9.5 kg</div>
                </div>
                <div>
                  <div className="font-mono-ibm text-[9px] text-ct-text3 uppercase tracking-[1px] mb-[3px]">Avg / Cycle</div>
                  <div className="font-display text-xl text-ct-text">2.4 kg</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Movement & Condition History</span>
            <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(212,137,42,.15)] text-ct-warn">187 days</span>
          </div>
          <div className="px-[18px] py-4">
            <div className="relative pl-5">
              <div className="absolute left-[6px] top-0 bottom-0 w-px bg-border" />
              {[
                { date: '05 Sep 2025 — Intake', event: 'Batch 5000–5600 arrived. Assigned GH1, Slot E-08. Grade 1.', detail: 'Size: 18 cm', dot: 'bg-ct-accent' },
                { date: '02 Dec 2025 — Cycle 1 Inspection', event: 'Size 27 cm. Readiness: Next cycle. No conditions noted.', dot: 'bg-ct-accent' },
                { date: '15 Jan 2026 — Condition Flag', event: 'DS · Belly · Sev 2 noted during routine check. Double scale on belly area.', dot: 'bg-ct-warn' },
                { date: '01 Mar 2026 — Cycle 2 Inspection', event: 'Size 34 cm. DS persists. Secondary R · Dorsal · Sev 1 noted. Moved to GH1 F-14.', detail: 'Readiness: +2 cycles.', dot: 'bg-ct-warn' },
                { date: '18 Apr 2026 — Cycle 3 Inspection', event: 'Size 39 cm. DS improving (downgraded Sev 1). R · Dorsal stable. GH1 F-14 maintained.', dot: 'bg-ct-accent' },
                { date: '~Jun 2026 — Projected Cycle 4', event: 'Est. 45–47 cm. If DS clears — advance to pre-cull slot.', dot: 'bg-surface-3 border-2 border-border', ghost: true },
                { date: '~Sep 2026 — Projected Cull', event: 'Target ≥ 54 cm. CITIES tag issued. Skin to export.', dot: 'bg-surface-3 border-2 border-border', ghost: true },
              ].map((item, i) => (
                <div key={i} className="relative pb-5 pl-4">
                  <div className={`absolute -left-[17px] top-[5px] w-2.5 h-2.5 rounded-full ${item.dot}`} />
                  <div className={`font-mono-ibm text-[10px] mb-1 ${item.ghost ? 'text-ct-text3' : 'text-ct-text3'}`}>{item.date}</div>
                  <div className={`text-xs leading-relaxed ${item.ghost ? 'text-ct-text3' : 'text-ct-text2'}`}>{item.event}</div>
                  {item.detail && <div className="font-mono-ibm text-[10px] text-ct-text3 mt-[3px]">{item.detail}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
