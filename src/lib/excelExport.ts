import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface ExportRange {
  /** yyyy-mm-dd inclusive, or null for no bound. */
  from: string | null;
  to: string | null;
  /** 'GH1' | 'GH2' | '' (all) */
  pen?: string;
}

export interface DayCount {
  date: string;
  entries: number;
  crocs: number;
  pens: number;
  avgCm: number | null;
}

interface EntryRow {
  id: number;
  inspection_date: string;
  belly_cm: number | null;
  condition_codes: string[] | null;
  pen_id?: string | null;
  line?: string | null;
  pen_slot?: number | null;
  crocs?: {
    tag: string | null;
    pen_id: string;
    line: string;
    pen_slot: number;
    grade: number | null;
    cull_schedule: string | null;
  } | null;
}

const sel = (s: string): string => s;

async function fetchEntries(range: ExportRange): Promise<EntryRow[]> {
  let q = supabase
    .from('inspections')
    .select(sel('*, crocs!inner(tag, pen_id, line, pen_slot, grade, cull_schedule)'))
    .order('inspection_date', { ascending: true });

  if (range.from) q = q.gte('inspection_date', range.from);
  if (range.to) q = q.lte('inspection_date', range.to);
  if (range.pen) q = q.eq('crocs.pen_id', range.pen);

  const { data, error } = await q.returns<EntryRow[]>();
  if (error) throw error;
  return data ?? [];
}

function conditionsOf(r: EntryRow): string {
  return Array.isArray(r.condition_codes) ? r.condition_codes.join('; ') : '';
}

function houseOf(r: EntryRow): string {
  return r.pen_id ?? r.crocs?.pen_id ?? '';
}

function lineOf(r: EntryRow): string {
  return r.line ?? r.crocs?.line ?? '';
}

function slotOf(r: EntryRow): number | '' {
  return r.pen_slot ?? r.crocs?.pen_slot ?? '';
}

export function summariseByDay(rows: EntryRow[]): DayCount[] {
  const map = new Map<string, { crocs: Set<number>; pens: Set<string>; sizes: number[]; entries: number }>();
  for (const r of rows) {
    const d = r.inspection_date;
    if (!map.has(d)) map.set(d, { crocs: new Set(), pens: new Set(), sizes: [], entries: 0 });
    const g = map.get(d)!;
    g.entries++;
    g.crocs.add((r as any).croc_id);
    const house = houseOf(r);
    if (house) g.pens.add(house);
    if (r.belly_cm != null) g.sizes.push(r.belly_cm);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, g]) => ({
      date,
      entries: g.entries,
      crocs: g.crocs.size,
      pens: g.pens.size,
      avgCm: g.sizes.length ? Math.round((g.sizes.reduce((a, b) => a + b, 0) / g.sizes.length) * 10) / 10 : null,
    }));
}

/** Day-by-day entry counts for the chosen range (for on-screen preview). */
export async function previewEntryCounts(range: ExportRange): Promise<{ days: DayCount[]; total: number }> {
  const rows = await fetchEntries(range);
  return { days: summariseByDay(rows), total: rows.length };
}

/** Build and download a multi-sheet workbook for the chosen range. */
export async function exportEntriesWorkbook(range: ExportRange): Promise<number> {
  const rows = await fetchEntries(range);
  if (!rows.length) throw new Error('No entries found for that range');

  const entries = rows.map(r => ({
    Date: r.inspection_date,
    House: houseOf(r),
    Pen: `${lineOf(r)}${slotOf(r)}`,
    Line: lineOf(r),
    Slot: slotOf(r),
    Tag: r.crocs?.tag ?? '',
    'Size (cm)': r.belly_cm ?? '',
    Grade: r.crocs?.grade ?? '',
    Conditions: conditionsOf(r),
    Cull: r.crocs?.cull_schedule ?? '',
  }));

  const daily = summariseByDay(rows).map(d => ({
    Date: d.date,
    Entries: d.entries,
    'Distinct Crocs': d.crocs,
    'Distinct Houses': d.pens,
    'Avg Size (cm)': d.avgCm ?? '',
  }));

  let liveQuery = supabase
    .from('crocs')
    .select(sel('*'))
    .order('pen_id')
    .order('line')
    .order('pen_slot');
  if (range.pen) liveQuery = liveQuery.eq('pen_id', range.pen);
  const { data: liveData } = await liveQuery.returns<any[]>();

  const live = (liveData ?? []).map(c => ({
    Tag: c.tag ?? '',
    House: c.pen_id,
    Pen: `${c.line}${c.pen_slot}`,
    'Size (cm)': c.belly_cm ?? '',
    Grade: c.grade ?? '',
    Conditions: Array.isArray(c.condition_codes) ? c.condition_codes.join('; ') : '',
    Cull: c.cull_schedule ?? '',
    'Last Inspection': c.inspection_date ?? '',
    'Placement Date': c.placement_date ?? '',
    'Placement Size (cm)': c.placement_belly_cm ?? '',
    'In Pen Since': c.pen_since ?? '',
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entries), 'Entries');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(daily), 'Daily Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(live), 'Current Live');

  const scope = range.pen || 'ALL';
  const label = range.from || range.to
    ? `${range.from ?? 'start'}_to_${range.to ?? 'today'}`
    : 'all-time';
  XLSX.writeFile(wb, `croctrack_entries_${scope}_${label}.xlsx`);

  return rows.length;
}

/** Preset helpers — all return yyyy-mm-dd strings in local time. */
export function isoDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const RANGE_PRESETS: Array<{ id: string; label: string; range: () => { from: string | null; to: string | null } }> = [
  { id: 'today', label: 'Today', range: () => ({ from: isoDay(0), to: isoDay(0) }) },
  { id: 'yesterday', label: 'Yesterday', range: () => ({ from: isoDay(-1), to: isoDay(-1) }) },
  { id: '7d', label: 'Last 7 days', range: () => ({ from: isoDay(-6), to: isoDay(0) }) },
  { id: '30d', label: 'Last 30 days', range: () => ({ from: isoDay(-29), to: isoDay(0) }) },
  { id: 'all', label: 'All time', range: () => ({ from: null, to: null }) },
  { id: 'custom', label: 'Custom range', range: () => ({ from: null, to: null }) },
];
