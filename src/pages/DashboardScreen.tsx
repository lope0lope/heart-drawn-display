import { penData, SIZE_BANDS, CONDITIONS, sizeBand, sizeBandColor, CULL_READINESS } from '@/data/mockData';

function NoteBox({ children, variant }: { children: React.ReactNode; variant?: 'warn' | 'danger' }) {
  const borderColor = variant === 'warn' ? 'border-l-ct-warn' : variant === 'danger' ? 'border-l-ct-danger' : 'border-l-ct-accent';
  const bg = variant === 'warn' ? 'bg-[rgba(212,137,42,.07)]' : variant === 'danger' ? 'bg-[rgba(192,57,43,.07)]' : 'bg-[rgba(201,168,76,.07)]';
  return <div className={`${bg} border-l-[3px] ${borderColor} px-3.5 py-2.5 rounded-r text-xs text-ct-text2 leading-relaxed mb-4`}>{children}</div>;
}

function Pill({ children, variant = 'gold' }: { children: React.ReactNode; variant?: 'gold' | 'green' | 'orange' | 'red' | 'blue' }) {
  const cls: Record<string, string> = {
    gold: 'bg-[rgba(201,168,76,.15)] text-ct-accent',
    green: 'bg-[rgba(76,175,80,.15)] text-ct-good',
    orange: 'bg-[rgba(212,137,42,.15)] text-ct-warn',
    red: 'bg-[rgba(192,57,43,.15)] text-ct-danger',
    blue: 'bg-[rgba(74,144,184,.15)] text-ct-info',
  };
  return <span className={`inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm ${cls[variant]}`}>{children}</span>;
}

function Panel({ title, pill, children }: { title: string; pill?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded overflow-hidden">
      <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">{title}</span>
        {pill}
      </div>
      <div className="px-[18px] py-4">{children}</div>
    </div>
  );
}

function KPI({ label, value, sub, delta, variant }: { label: string; value: string; sub?: string; delta?: string; variant?: 'warn' | 'danger' | 'info' | 'cull' }) {
  const topColor = variant === 'warn' ? 'bg-ct-warn' : variant === 'danger' ? 'bg-ct-danger' : variant === 'info' ? 'bg-ct-info' : variant === 'cull' ? 'bg-ct-cull' : 'bg-ct-accent';
  const isNeg = delta?.includes('↑') && variant;
  return (
    <div className="bg-surface border border-border rounded p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${topColor}`} />
      <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-2">{label}</div>
      <div className="font-display text-[38px] font-semibold text-ct-text leading-none">{value}</div>
      {sub && <div className="text-[11px] text-ct-text3 mt-1">{sub}</div>}
      {delta && <div className={`font-mono-ibm text-[10px] mt-1 ${isNeg ? 'text-ct-danger' : 'text-ct-accent'}`}>{delta}</div>}
    </div>
  );
}

export default function DashboardScreen() {
  const all = [...penData.GH1, ...penData.GH2].filter(c => c.occupied);
  const bc = [0, 0, 0, 0, 0, 0];
  all.forEach(c => { const b = sizeBand(c.sizeCm!); if (b !== null) bc[b]++; });
  const maxB = Math.max(...bc);

  const cc: Record<string, number> = {};
  all.forEach(c => c.conds.forEach(cd => cc[cd] = (cc[cd] || 0) + 1));
  const maxC = Math.max(...Object.values(cc), 1);

  return (
    <div>
      <NoteBox>
        <strong>Inspection cycle opens in 14 days.</strong> GH1 Row F has an elevated DS cluster. 3 MN flags on GH2 Row J — feeder check recommended. AI advisory has been updated from last upload.
      </NoteBox>

      <div className="grid grid-cols-3 gap-3.5 mb-5">
        <KPI label="Active — Skin Track" value="4,618" delta="GH1: 2,310 · GH2: 2,308" />
        <KPI label="In Treatment" value="304" sub="Injury / Disease hold" delta="↑ 28 new this cycle" variant="warn" />
        <KPI label="Condition Flags" value="187" sub="8 condition types active" variant="danger" />
      </div>

      {/* Cull Readiness */}
      <div className="bg-surface border border-border rounded overflow-hidden mb-3.5">
        <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Cull Readiness — Worker Assessment vs AI Suggestion</span>
          <Pill>From last inspection upload</Pill>
        </div>
        <div>
          <div className="grid grid-cols-4 border-b border-border">
            {['Horizon', 'Worker Count', 'AI Suggested', 'Variance'].map((h, i) => (
              <div key={h} className={`px-[18px] py-2 font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase ${i < 3 ? 'border-r border-border' : ''}`}>
                {h}
                {i === 1 && <div className="text-[8px] tracking-[1px] mt-0.5">Manual inspection opinion</div>}
                {i === 2 && <div className="text-[8px] tracking-[1px] mt-0.5">Size + growth + condition model</div>}
              </div>
            ))}
          </div>
          {CULL_READINESS.map((r, i) => {
            const diff = r.ai - r.worker;
            const varLabel = diff === 0 ? 'Aligned' : diff > 0 ? `AI +${diff} higher` : `Worker +${Math.abs(diff)} higher`;
            const varCol = Math.abs(diff) < 20 ? 'text-ct-good' : Math.abs(diff) < 60 ? 'text-ct-warn' : 'text-ct-danger';
            return (
              <div key={i} className={`grid grid-cols-4 ${i < CULL_READINESS.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="px-[18px] py-3.5 border-r border-border">
                  <div className={`font-display text-[22px] font-semibold leading-none text-${r.color}`}>{r.horizon}</div>
                  <div className="font-mono-ibm text-[9px] text-ct-text3 mt-1">{r.label}</div>
                </div>
                <div className="px-[18px] py-3.5 border-r border-border flex items-center gap-3.5">
                  <div className={`font-display text-[38px] font-semibold leading-none text-${r.color}`}>{r.worker}</div>
                  <div className="text-[10px] text-ct-text3 font-mono-ibm leading-[1.7]">crocs<br />assessed</div>
                </div>
                <div className="px-[18px] py-3.5 border-r border-border flex items-center gap-3.5">
                  <div className={`font-display text-[38px] font-semibold leading-none text-${r.color}`}>{r.ai}</div>
                  <div className="text-[10px] text-ct-text3 font-mono-ibm leading-[1.7]">crocs<br />suggested</div>
                </div>
                <div className="px-[18px] py-3.5 flex items-center">
                  <div>
                    <div className={`font-mono-ibm text-sm font-medium ${varCol}`}>{Math.abs(diff)}</div>
                    <div className={`font-mono-ibm text-[10px] ${varCol}`}>{varLabel}</div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="px-[18px] py-2.5 font-mono-ibm text-[9px] text-ct-text3 border-t border-border leading-[1.8]">
            Worker readiness is captured per croc at inspection via the <span className="text-ct-accent">readiness</span> CSV column (values: <span className="text-ct-accent">now · next · +2 · +3</span>).
            AI suggestion is derived from size band, growth rate, and condition clearance projections.
          </div>
        </div>
      </div>

      {/* Size & Conditions */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-3.5 mb-3.5">
        <Panel title="Size Category Snapshot — Today" pill={<Pill>Live from last upload</Pill>}>
          {SIZE_BANDS.map((b, i) => (
            <div key={i} className="flex items-center gap-2.5 mb-2">
              <span className="font-mono-ibm text-[10px] text-ct-text3 w-[58px]">{b.range}</span>
              <div className="flex-1 h-[9px] bg-surface-3 rounded-sm overflow-hidden">
                <div className="h-full rounded-sm" style={{ width: `${bc[i] / maxB * 100}%`, background: sizeBandColor(i) }} />
              </div>
              <span className="font-mono-ibm text-[11px] w-[34px]" style={{ color: sizeBandColor(i) }}>{bc[i]}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Active Conditions" pill={<Pill variant="orange">187 crocs</Pill>}>
          {CONDITIONS.filter(c => cc[c.code]).sort((a, b) => (cc[b.code] || 0) - (cc[a.code] || 0)).map(c => (
            <div key={c.code} className="flex items-center gap-2.5 py-1">
              <span className="font-mono-ibm text-[10px] w-7" style={{ color: `hsl(var(${c.colorVar}))` }}>{c.code}</span>
              <span className="text-xs text-ct-text2 flex-1">{c.name}</span>
              <div className="w-[110px] h-1.5 bg-surface-3 rounded-sm overflow-hidden">
                <div className="h-full rounded-sm" style={{ width: `${(cc[c.code] || 0) / maxC * 100}%`, background: `hsl(var(${c.colorVar}))` }} />
              </div>
              <span className="font-mono-ibm text-[10px] text-ct-text3 w-[26px] text-right">{cc[c.code] || 0}</span>
            </div>
          ))}
        </Panel>
      </div>

      {/* AI Advisory & Activity */}
      <div className="grid grid-cols-[2fr_1fr] gap-3.5">
        <Panel title="AI Advisory — This Month" pill={<Pill>AI</Pill>}>
          <div className="text-xs text-ct-text2 leading-[1.8]">
            Based on current growth rates, you are <span className="text-ct-accent font-mono-ibm text-[11px]">on track</span> in 4 of 6 size categories.<br /><br />
            <strong className="text-ct-warn">⚠ 33–34 cm shortfall.</strong> Projected 68 units below annual target. Hold this band — do not cull early.<br /><br />
            <strong className="text-ct-accent">45+ cm surplus.</strong> Recommend scheduling a cull batch this cycle to avoid overcrowding.
          </div>
        </Panel>
        <Panel title="Recent Activity">
          {[
            { col: 'bg-ct-accent', text: 'Tag #5919 moved GH1 E-12 → F-14. Size 36 cm.', time: '2h ago' },
            { col: 'bg-ct-warn', text: 'Tag #5038 flagged DS · Belly · Severity 2.', time: '3h ago' },
            { col: 'bg-ct-danger', text: 'GH2 Row J: 3 crocs flagged MN — feeder check triggered.', time: '5h ago' },
            { col: 'bg-ct-cull', text: 'Batch cull ×94 completed. CITIES tags issued.', time: '1d ago' },
            { col: 'bg-ct-info', text: 'CSV uploaded — 910 records, 0 errors.', time: '1d ago' },
          ].map((a, i) => (
            <div key={i} className="flex gap-3 py-2.5 border-b border-border last:border-b-0 items-start">
              <div className={`w-[7px] h-[7px] rounded-full mt-1.5 flex-shrink-0 ${a.col}`} />
              <div className="text-xs text-ct-text2 leading-relaxed flex-1">{a.text}</div>
              <div className="font-mono-ibm text-[10px] text-ct-text3 whitespace-nowrap pt-0.5">{a.time}</div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
