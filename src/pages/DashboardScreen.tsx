import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAllCrocs, useConditionCodes } from '@/hooks/useCrocs';
import { SIZE_BANDS, sizeBandColor, countSizeBands, countConditions, getOccupied, sizeBand } from '@/lib/crocUtils';
import { useCullProjections, useAiAdvisory } from '@/hooks/useCullData';
import { useUploadLogs } from '@/hooks/useFeedData';
import InTreatmentDialog from '@/components/InTreatmentDialog';

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

function KPI({ label, value, sub, delta, variant, onClick }: { label: string; value: string; sub?: string; delta?: string; variant?: 'warn' | 'danger' | 'info' | 'cull' | 'good'; onClick?: () => void }) {
  const topColor = variant === 'warn' ? 'bg-ct-warn' : variant === 'danger' ? 'bg-ct-danger' : variant === 'info' ? 'bg-ct-info' : variant === 'cull' ? 'bg-ct-cull' : variant === 'good' ? 'bg-ct-good' : 'bg-ct-accent';
  return (
    <div className={`bg-surface border border-border rounded p-4 relative overflow-hidden ${onClick ? 'cursor-pointer hover:ring-1 hover:ring-ct-accent transition-all' : ''}`} onClick={onClick}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${topColor}`} />
      <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-2">{label}</div>
      <div className="font-display text-[38px] font-semibold text-ct-text leading-none">{value}</div>
      {sub && <div className="text-[11px] text-ct-text3 mt-1">{sub}</div>}
      {delta && <div className={`font-mono-ibm text-[10px] mt-1 ${variant ? 'text-ct-' + variant : 'text-ct-accent'}`}>{delta}</div>}
    </div>
  );
}

export default function DashboardScreen() {
  const { data: allCrocs, isLoading } = useAllCrocs();
  const { data: conditionDefs } = useConditionCodes();
  const { data: uploadLogs } = useUploadLogs();
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const cullProjections = useCullProjections();
  const aiAdvisory = useAiAdvisory();

  // Compute cluster alerts from real data
  const clusterAlerts = useMemo(() => {
    if (!allCrocs) return [];
    const occupied = getOccupied(allCrocs);
    const lineCondCounts: Record<string, Record<string, number>> = {};
    occupied.forEach(c => c.condition_codes.forEach(code => {
      const key = `${c.pen_id}-${c.line}`;
      lineCondCounts[key] ??= {};
      lineCondCounts[key][code] = (lineCondCounts[key][code] || 0) + 1;
    }));
    const alerts: { severity: 'danger' | 'warn'; text: string }[] = [];
    Object.entries(lineCondCounts).forEach(([penLine, codes]) => {
      Object.entries(codes).forEach(([code, count]) => {
        if (count >= 5) {
          alerts.push({ severity: 'danger', text: `${count} ${code} flags on ${penLine} — investigate immediately` });
        } else if (count >= 3) {
          alerts.push({ severity: 'warn', text: `${count} ${code} flags on ${penLine} — monitor closely` });
        }
      });
    });
    return alerts.sort((a, b) => (a.severity === 'danger' ? 0 : 1) - (b.severity === 'danger' ? 0 : 1));
  }, [allCrocs]);

  if (isLoading || !allCrocs) {
    return <div className="text-ct-text3 text-xs font-mono-ibm py-10 text-center">Loading live data…</div>;
  }

  const occupied = getOccupied(allCrocs);
  const gh1Count = occupied.filter(c => c.pen_id === 'GH1').length;
  const gh2Count = occupied.filter(c => c.pen_id === 'GH2').length;
  
  const bc = countSizeBands(occupied);
  const maxB = Math.max(...bc, 1);

  const cc = countConditions(occupied);
  const totalCondFlags = Object.values(cc).reduce((a, b) => a + b, 0);
  const uniqueCondTypes = Object.keys(cc).length;
  const maxC = Math.max(...Object.values(cc), 1);

  const inTreatment = occupied.filter(c => c.condition_codes.length > 0).length;
  const cullReady = occupied.filter(c => c.belly_cm !== null && c.belly_cm >= 35).length;

  // Next inspection: find latest inspection_date and compute days since
  const dates = occupied.filter(c => c.inspection_date).map(c => new Date(c.inspection_date).getTime());
  const latestInspection = dates.length > 0 ? new Date(Math.max(...dates)) : null;
  const daysSinceInspection = latestInspection ? Math.floor((Date.now() - latestInspection.getTime()) / 86400000) : null;
  const inspectionCycleLength = 14; // 2-week cycles
  const daysUntilNext = daysSinceInspection !== null ? Math.max(0, inspectionCycleLength - daysSinceInspection) : null;

  return (
    <div>
      {/* Cluster alerts — collapsible */}
      <div className="mb-4 bg-surface border border-border rounded overflow-hidden">
        <button
          onClick={() => setAlertsOpen(o => !o)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-surface-2 transition-colors"
        >
          <div className="flex items-center gap-2">
            {alertsOpen ? <ChevronDown className="w-3.5 h-3.5 text-ct-text3" /> : <ChevronRight className="w-3.5 h-3.5 text-ct-text3" />}
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Farm Alerts</span>
            {clusterAlerts.length > 0 ? (
              <>
                {clusterAlerts.some(a => a.severity === 'danger') && <Pill variant="red">{clusterAlerts.filter(a => a.severity === 'danger').length} critical</Pill>}
                {clusterAlerts.some(a => a.severity === 'warn') && <Pill variant="orange">{clusterAlerts.filter(a => a.severity === 'warn').length} watch</Pill>}
              </>
            ) : (
              <Pill variant="green">All clear</Pill>
            )}
          </div>
          <span className="font-mono-ibm text-[10px] text-ct-text3">{occupied.length} crocs · {totalCondFlags} flags</span>
        </button>
        {alertsOpen && (
          <div className="px-3.5 pb-3 pt-1 border-t border-border">
            {clusterAlerts.length > 0 ? (
              clusterAlerts.map((a, i) => (
                <NoteBox key={i} variant={a.severity}>
                  <strong>{a.severity === 'danger' ? '⚠ ALERT:' : '⊙ WATCH:'}</strong> {a.text}
                </NoteBox>
              ))
            ) : (
              <NoteBox>
                <strong>No condition clusters detected.</strong> {occupied.length} crocs tracked across GH1 & GH2. {totalCondFlags > 0 ? `${totalCondFlags} individual condition flags active.` : 'All clear.'}
              </NoteBox>
            )}
          </div>
        )}
      </div>

      {/* 5-column KPIs */}
      <div className="grid grid-cols-5 gap-3.5 mb-5">
        <KPI label="Active — Skin Track" value={occupied.length.toLocaleString()} delta={`GH1: ${gh1Count} · GH2: ${gh2Count}`} />
        <KPI label="In Treatment" value={inTreatment.toString()} sub="Injury / Disease hold" delta={inTreatment > 0 ? `Click to view list` : 'None flagged'} variant="warn" onClick={() => setTreatmentOpen(true)} />
        <KPI label="Condition Flags" value={totalCondFlags.toString()} sub={`${uniqueCondTypes} types active`} variant="danger" />
        <KPI label="Cull Ready" value={cullReady.toString()} sub="Belly ≥ 35 cm" delta={`${((cullReady / occupied.length) * 100).toFixed(0)}% of stock`} variant="good" />
        <KPI label="Next Inspection" value={daysUntilNext !== null ? `${daysUntilNext}d` : '—'} sub={daysUntilNext !== null ? (daysUntilNext <= 2 ? 'Imminent' : 'Scheduled') : 'No data'} delta={latestInspection ? `Last: ${latestInspection.toLocaleDateString()}` : ''} variant={daysUntilNext !== null && daysUntilNext <= 2 ? 'warn' : 'info'} />
      </div>

      {/* Cull Stock by Horizon */}
      <div className="bg-surface border border-border rounded overflow-hidden mb-3.5">
        <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Stock Available to Cull — All Size Bands</span>
          <Pill>Computed from live data</Pill>
        </div>
        <div className="grid grid-cols-4 divide-x divide-border">
          {(cullProjections?.projections ?? []).map((p, i) => {
            const totalStock = p.distribution.reduce((a, b) => a + b, 0);
            return (
              <div key={i} className="px-[18px] py-4">
                <div className="font-mono-ibm text-[10px] text-ct-text3 tracking-wider uppercase mb-1">{p.label}</div>
                <div className="flex items-baseline gap-2">
                  <span className={`font-display text-[36px] font-semibold leading-none ${totalStock > 0 ? 'text-ct-good' : 'text-ct-text3'}`}>{totalStock}</span>
                  <span className="text-xs text-ct-text3">across {p.distribution.filter(d => d > 0).length} bands</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-[18px] py-2.5 font-mono-ibm text-[9px] text-ct-text3 border-t border-border">
          All size bands are cullable. Projections use non-linear growth rates from inspection history.
        </div>
      </div>

      {/* Size & Conditions */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-3.5 mb-3.5">
        <Panel title="Size Category Snapshot — Today" pill={<Pill>Live from Supabase</Pill>}>
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
        <Panel title="Active Conditions" pill={<Pill variant="orange">{totalCondFlags} crocs</Pill>}>
          {totalCondFlags === 0 ? (
            <div className="text-xs text-ct-text3 text-center py-5">No condition flags in current dataset</div>
          ) : (
            conditionDefs?.filter(c => cc[c.code]).sort((a, b) => (cc[b.code] || 0) - (cc[a.code] || 0)).map(c => (
              <div key={c.code} className="flex items-center gap-2.5 py-1">
                <span className="font-mono-ibm text-[10px] w-7" style={{ color: `hsl(var(${c.color_var}))` }}>{c.code}</span>
                <span className="text-xs text-ct-text2 flex-1">{c.name}</span>
                <div className="w-[110px] h-1.5 bg-surface-3 rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm" style={{ width: `${(cc[c.code] || 0) / maxC * 100}%`, background: `hsl(var(${c.color_var}))` }} />
                </div>
                <span className="font-mono-ibm text-[10px] text-ct-text3 w-[26px] text-right">{cc[c.code] || 0}</span>
              </div>
            ))
          )}
        </Panel>
      </div>

      {/* AI Advisory & Activity */}
      <div className="grid grid-cols-[2fr_1fr] gap-3.5">
        <Panel title="AI Advisory — This Month" pill={<Pill>AI · Live</Pill>}>
          <div className="text-xs text-ct-text2 leading-[1.8]">
            {aiAdvisory ? (
              <>
                <strong className="text-ct-accent">Recommended actions this cycle:</strong><br /><br />
                {aiAdvisory.map((a, i) => (
                  <span key={i}>
                    <span className={`text-${a.color}`}>{a.icon} {a.text}</span><br />{i < aiAdvisory.length - 1 && <br />}
                  </span>
                ))}
              </>
            ) : (
              <span className="text-ct-text3">Computing advisory from live data…</span>
            )}
          </div>
        </Panel>
        <Panel title="Recent Activity">
          {/* Real activity from upload logs + computed data */}
          {[
            ...(uploadLogs ?? []).slice(0, 3).map(log => ({
              col: log.status === 'success' ? 'bg-ct-good' : 'bg-ct-warn',
              text: `${log.filename} — ${log.record_count} records ${log.status === 'success' ? 'imported' : log.status}${log.warnings > 0 ? ` (${log.warnings} warnings)` : ''}`,
              time: new Date(log.uploaded_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
            })),
            { col: 'bg-ct-info', text: `${occupied.length} crocs with measurements across GH1 & GH2.`, time: 'Current' },
            { col: 'bg-ct-accent', text: `${cullReady} crocs at cull-ready size (≥35 cm).`, time: 'Current' },
            ...(inTreatment > 0 ? [{ col: 'bg-ct-warn', text: `${inTreatment} crocs in treatment hold.`, time: 'Current' }] : []),
          ].slice(0, 6).map((a, i) => (
            <div key={i} className="flex gap-3 py-2.5 border-b border-border last:border-b-0 items-start">
              <div className={`w-[7px] h-[7px] rounded-full mt-1.5 flex-shrink-0 ${a.col}`} />
              <div className="text-xs text-ct-text2 leading-relaxed flex-1">{a.text}</div>
              <div className="font-mono-ibm text-[10px] text-ct-text3 whitespace-nowrap pt-0.5">{a.time}</div>
            </div>
          ))}
        </Panel>
      </div>

      {conditionDefs && (
        <InTreatmentDialog
          open={treatmentOpen}
          onOpenChange={setTreatmentOpen}
          crocs={allCrocs}
          conditionDefs={conditionDefs}
        />
      )}
    </div>
  );
}
