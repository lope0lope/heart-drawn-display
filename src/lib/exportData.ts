import { supabase } from '@/integrations/supabase/client';

function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map(v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(',');
}

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportLiveCrocs(penFilter?: string) {
  let query = supabase.from('crocs').select('*').order('pen_id').order('line').order('pen_slot');
  if (penFilter) query = query.eq('pen_id', penFilter);
  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) throw new Error('No records found');

  const headers = ['id', 'tag', 'pen_id', 'line', 'pen_slot', 'belly_cm', 'condition_codes', 'inspection_date'];
  const rows = data.map(r => [
    r.id,
    r.tag,
    r.pen_id,
    r.line,
    r.pen_slot,
    r.belly_cm,
    Array.isArray(r.condition_codes) ? r.condition_codes.join('; ') : r.condition_codes,
    r.inspection_date,
  ]);

  const csv = [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
  const suffix = penFilter ? `_${penFilter}` : '_ALL';
  const date = new Date().toISOString().slice(0, 10);
  downloadCsv(`crocs_live${suffix}_${date}.csv`, csv);
  return data.length;
}

export async function exportInspectionHistory(penFilter?: string) {
  // Join inspections with crocs to get pen/tag info
  let query = supabase
    .from('inspections')
    .select('id, croc_id, inspection_date, belly_cm, condition_codes, crocs!inner(tag, pen_id, line, pen_slot)')
    .order('inspection_date', { ascending: true });

  if (penFilter) {
    query = query.eq('crocs.pen_id', penFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) throw new Error('No inspection records found');

  const headers = ['inspection_id', 'croc_id', 'tag', 'pen_id', 'line', 'pen_slot', 'inspection_date', 'belly_cm', 'condition_codes'];
  const rows = data.map((r: any) => [
    r.id,
    r.croc_id,
    r.crocs?.tag,
    r.crocs?.pen_id,
    r.crocs?.line,
    r.crocs?.pen_slot,
    r.inspection_date,
    r.belly_cm,
    Array.isArray(r.condition_codes) ? r.condition_codes.join('; ') : r.condition_codes,
  ]);

  const csv = [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
  const suffix = penFilter ? `_${penFilter}` : '_ALL';
  const date = new Date().toISOString().slice(0, 10);
  downloadCsv(`inspections_history${suffix}_${date}.csv`, csv);
  return data.length;
}
