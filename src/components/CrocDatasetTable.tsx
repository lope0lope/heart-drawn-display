import { useState, useMemo, useEffect } from 'react';
import { useAllCrocs, type CrocRecord } from '@/hooks/useCrocs';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Trash2, Save, X, Search, ChevronDown, ChevronRight } from 'lucide-react';

interface InspectionRow {
  id: number;
  croc_id: number;
  inspection_date: string;
  belly_cm: number | null;
  condition_codes: string[];
}

/**
 * Live, editable dataset visualiser for all croc records.
 * - Inline edit / delete on each croc.
 * - Date-range filter narrows which crocs are shown (any croc with at least
 *   one inspection in range).
 * - Expand a row to view + delete individual historical inspections.
 */
export default function CrocDatasetTable() {
  const { data: crocs, isLoading } = useAllCrocs();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [penFilter, setPenFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<CrocRecord>>({});
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [history, setHistory] = useState<InspectionRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [inRangeIds, setInRangeIds] = useState<Set<number> | null>(null);

  // Resolve date-range to a set of croc IDs that have inspections in range.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!dateFrom && !dateTo) { setInRangeIds(null); return; }
      let q = supabase.from('inspections').select('croc_id');
      if (dateFrom) q = q.gte('inspection_date', dateFrom);
      if (dateTo) q = q.lte('inspection_date', dateTo);
      const { data } = await q;
      if (!active) return;
      setInRangeIds(new Set((data ?? []).map((r: any) => r.croc_id)));
    })();
    return () => { active = false; };
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!crocs) return [];
    const q = search.trim().toLowerCase();
    return crocs.filter(c => {
      if (penFilter !== 'all' && c.pen_id !== penFilter) return false;
      if (inRangeIds && !inRangeIds.has(c.id)) return false;
      if (!q) return true;
      return (c.tag ?? '').toLowerCase().includes(q)
        || `${c.line}-${c.pen_slot}`.toLowerCase().includes(q)
        || c.condition_codes.join(',').toLowerCase().includes(q);
    });
  }, [crocs, search, penFilter, inRangeIds]);

  const toggleExpand = async (crocId: number) => {
    if (expandedId === crocId) { setExpandedId(null); setHistory([]); return; }
    setExpandedId(crocId);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('croc_id', crocId)
        .order('inspection_date', { ascending: false });
      if (error) throw error;
      setHistory((data ?? []) as InspectionRow[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteInspection = async (insId: number) => {
    if (!confirm('Delete this inspection record?')) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('inspections').delete().eq('id', insId);
      if (error) throw error;
      setHistory(h => h.filter(x => x.id !== insId));
      toast.success('Inspection deleted');
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (c: CrocRecord) => {
    setEditingId(c.id);
    setDraft({
      tag: c.tag,
      pen_id: c.pen_id,
      line: c.line,
      pen_slot: c.pen_slot,
      belly_cm: c.belly_cm,
      grade: c.grade,
      condition_codes: c.condition_codes,
      cull_schedule: c.cull_schedule,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    setBusy(true);
    try {
      const update: any = {
        tag: draft.tag ?? null,
        pen_id: draft.pen_id,
        line: draft.line,
        pen_slot: Number(draft.pen_slot) || 0,
        belly_cm: draft.belly_cm === null || draft.belly_cm === undefined || draft.belly_cm === ('' as any) ? null : Number(draft.belly_cm),
        grade: draft.grade === null || draft.grade === undefined || draft.grade === ('' as any) ? null : Number(draft.grade),
        condition_codes: draft.condition_codes ?? [],
        cull_schedule: draft.cull_schedule || null,
      };
      const { error } = await supabase.from('crocs').update(update).eq('id', editingId);
      if (error) throw error;
      toast.success('Record updated');
      cancelEdit();
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteRow = async (id: number, tag: string | null) => {
    if (!confirm(`Delete croc ${tag ? `#${tag}` : `id ${id}`} and all its inspections?`)) return;
    setBusy(true);
    try {
      await supabase.from('inspections').delete().eq('croc_id', id);
      const { error } = await supabase.from('crocs').delete().eq('id', id);
      if (error) throw error;
      toast.success('Record deleted');
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const pens = useMemo(() => crocs ? [...new Set(crocs.map(c => c.pen_id))].sort() : [], [crocs]);

  return (
    <div className="bg-surface border border-border rounded overflow-hidden">
      <div className="px-[18px] py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Live Dataset</span>
          <span className="inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm bg-[rgba(76,175,80,.15)] text-ct-good">
            {filtered.length} / {crocs?.length ?? 0} records
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={penFilter}
            onChange={e => setPenFilter(e.target.value)}
            className="bg-surface-2 border border-border text-ct-text px-2 py-[5px] font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent"
          >
            <option value="all">All Pens</option>
            {pens.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-sm px-2 py-[3px]">
            <span className="font-mono-ibm text-[9px] text-ct-text3 uppercase tracking-wider">Inspected</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-ct-text font-mono-ibm text-[11px] outline-none"
              title="From date"
            />
            <span className="text-ct-text3 text-[10px]">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-ct-text font-mono-ibm text-[11px] outline-none"
              title="To date"
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-ct-text3 hover:text-ct-text" title="Clear dates">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-sm px-2 py-[5px]">
            <Search className="w-3 h-3 text-ct-text3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tag, slot, condition…"
              className="bg-transparent text-ct-text font-mono-ibm text-[11px] outline-none w-[140px]"
            />
          </div>
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto">
        {isLoading ? (
          <div className="text-center py-8 text-ct-text3 font-mono-ibm text-[11px]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-ct-text3 font-mono-ibm text-[11px]">No records match.</div>
        ) : (
          <table className="border-collapse text-[11px] w-full">
            <thead className="sticky top-0 bg-surface-3 z-10">
              <tr>
                {['', 'Pen', 'Line', 'Slot', 'Tag', 'Size cm', 'Grade', 'Conditions', 'Cull', 'Actions'].map((h, i) => (
                  <th key={i} className="p-[6px_8px] border-b border-border text-ct-text3 font-mono-ibm text-[9px] tracking-wider uppercase text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map(c => {
                const isEditing = editingId === c.id;
                const isExpanded = expandedId === c.id;
                return (
                  <>
                  <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                    <td className="p-[5px_4px]">
                      <button onClick={() => toggleExpand(c.id)} className="text-ct-text3 hover:text-ct-accent" title="Show inspection history">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="p-[5px_8px] text-ct-text2">
                      {isEditing
                        ? <input value={draft.pen_id ?? ''} onChange={e => setDraft({ ...draft, pen_id: e.target.value })} className="bg-surface-3 border border-border text-ct-text px-1 py-px font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[60px]" />
                        : c.pen_id}
                    </td>
                    <td className="p-[5px_8px] text-ct-text2 font-mono-ibm">
                      {isEditing
                        ? <input value={draft.line ?? ''} onChange={e => setDraft({ ...draft, line: e.target.value })} className="bg-surface-3 border border-border text-ct-text px-1 py-px font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[40px]" />
                        : c.line}
                    </td>
                    <td className="p-[5px_8px] text-ct-text2 font-mono-ibm">
                      {isEditing
                        ? <input type="number" value={draft.pen_slot ?? ''} onChange={e => setDraft({ ...draft, pen_slot: Number(e.target.value) })} className="bg-surface-3 border border-border text-ct-text px-1 py-px font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[55px]" />
                        : c.pen_slot}
                    </td>
                    <td className="p-[5px_8px] text-ct-text font-mono-ibm">
                      {isEditing
                        ? <input value={draft.tag ?? ''} onChange={e => setDraft({ ...draft, tag: e.target.value })} className="bg-surface-3 border border-border text-ct-text px-1 py-px font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[80px]" />
                        : (c.tag ?? '—')}
                    </td>
                    <td className="p-[5px_8px] text-ct-text2 font-mono-ibm">
                      {isEditing
                        ? <input type="number" step="0.1" value={draft.belly_cm ?? ''} onChange={e => setDraft({ ...draft, belly_cm: e.target.value === '' ? null : Number(e.target.value) })} className="bg-surface-3 border border-border text-ct-text px-1 py-px font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[60px]" />
                        : (c.belly_cm ?? '—')}
                    </td>
                    <td className="p-[5px_8px] text-ct-text2 font-mono-ibm">
                      {isEditing
                        ? <input type="number" value={draft.grade ?? ''} onChange={e => setDraft({ ...draft, grade: e.target.value === '' ? null : Number(e.target.value) })} className="bg-surface-3 border border-border text-ct-text px-1 py-px font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[50px]" />
                        : (c.grade ?? '—')}
                    </td>
                    <td className="p-[5px_8px] text-ct-text2 max-w-[200px]">
                      {isEditing ? (
                        <input
                          value={(draft.condition_codes ?? []).join(',')}
                          onChange={e => setDraft({ ...draft, condition_codes: e.target.value.split(/[,;]+/).map(s => s.trim()).filter(Boolean) })}
                          placeholder="THChest,RTail"
                          className="bg-surface-3 border border-border text-ct-text px-1 py-px font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-full"
                        />
                      ) : (
                        c.condition_codes.length > 0
                          ? c.condition_codes.map((code, i) => (
                              <span key={i} className="inline-block px-1 py-px mr-1 rounded-sm text-[10px] font-mono-ibm border border-border bg-surface-2">{code}</span>
                            ))
                          : <span className="text-ct-text3">—</span>
                      )}
                    </td>
                    <td className="p-[5px_8px] text-ct-text2 font-mono-ibm">
                      {isEditing
                        ? <input value={draft.cull_schedule ?? ''} onChange={e => setDraft({ ...draft, cull_schedule: e.target.value })} className="bg-surface-3 border border-border text-ct-text px-1 py-px font-mono-ibm text-[11px] rounded-sm outline-none focus:border-ct-accent w-[55px]" />
                        : (c.cull_schedule || '—')}
                    </td>
                    <td className="p-[5px_8px]">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} disabled={busy} className="text-ct-good hover:text-ct-good/80 disabled:opacity-50" title="Save"><Save className="w-3.5 h-3.5" /></button>
                            <button onClick={cancelEdit} disabled={busy} className="text-ct-text3 hover:text-ct-text disabled:opacity-50" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(c)} disabled={busy} className="text-ct-accent hover:text-ct-accent/80 disabled:opacity-50" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteRow(c.id, c.tag)} disabled={busy} className="text-ct-danger hover:text-ct-danger/80 disabled:opacity-50" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${c.id}-history`} className="bg-surface-2/40">
                      <td colSpan={10} className="p-[6px_18px]">
                        <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-1.5">Inspection History · {history.length} record{history.length === 1 ? '' : 's'}</div>
                        {historyLoading ? (
                          <div className="text-ct-text3 font-mono-ibm text-[10px] py-2">Loading…</div>
                        ) : history.length === 0 ? (
                          <div className="text-ct-text3 font-mono-ibm text-[10px] py-2">No inspection history.</div>
                        ) : (
                          <table className="w-full text-[10px] border-collapse">
                            <thead>
                              <tr className="text-ct-text3 font-mono-ibm">
                                <th className="text-left p-[3px_6px] border-b border-border">Date</th>
                                <th className="text-left p-[3px_6px] border-b border-border">Belly cm</th>
                                <th className="text-left p-[3px_6px] border-b border-border">Conditions</th>
                                <th className="text-right p-[3px_6px] border-b border-border w-[40px]"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.map(h => (
                                <tr key={h.id} className="border-b border-border last:border-b-0">
                                  <td className="p-[3px_6px] text-ct-text2 font-mono-ibm">{h.inspection_date}</td>
                                  <td className="p-[3px_6px] text-ct-text2 font-mono-ibm">{h.belly_cm ?? '—'}</td>
                                  <td className="p-[3px_6px] text-ct-text2">
                                    {h.condition_codes.length
                                      ? h.condition_codes.map((code, i) => (
                                          <span key={i} className="inline-block px-1 py-px mr-1 rounded-sm text-[9px] font-mono-ibm border border-border bg-surface-3">{code}</span>
                                        ))
                                      : <span className="text-ct-text3">—</span>}
                                  </td>
                                  <td className="p-[3px_6px] text-right">
                                    <button onClick={() => deleteInspection(h.id)} disabled={busy} className="text-ct-danger hover:text-ct-danger/80 disabled:opacity-50" title="Delete this inspection">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {filtered.length > 500 && (
        <div className="px-[18px] py-2 border-t border-border font-mono-ibm text-[10px] text-ct-text3">
          Showing first 500 of {filtered.length} records — narrow the filter to see more.
        </div>
      )}
    </div>
  );
}
