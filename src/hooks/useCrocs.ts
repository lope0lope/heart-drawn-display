import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/fetchAllPages';

export interface CrocRecord {
  id: number;
  pen_id: string;
  tag: string | null;
  line: string;
  belly_cm: number | null;
  pen_slot: number;
  condition_codes: string[];
  inspection_date: string;
  cull_schedule: string | null;
  /** First-ever record on the farm (added by the placement-history migration). */
  placement_date?: string | null;
  placement_belly_cm?: number | null;
  /** Date the croc entered its current pen / line / slot. */
  pen_since?: string | null;
}

export interface ConditionCodeRecord {
  code: string;
  name: string;
  color_var: string;
  is_live: boolean;
  is_hide: boolean;
}

function fetchCrocs(penId?: string, includeCulled = false) {
  return fetchAllPages((from, to) => {
    let query = supabase.from('crocs').select('*');
    if (!includeCulled) query = query.or('cull_schedule.is.null,cull_schedule.neq.CULLED');
    if (penId) query = query.eq('pen_id', penId);
    return query
      .order('pen_id')
      .order('line')
      .order('pen_slot')
      .order('id')
      .range(from, to);
  });
}

export function useCrocs(penId?: string) {
  return useQuery({
    queryKey: ['crocs', penId],
    queryFn: async () => (await fetchCrocs(penId)) as CrocRecord[],
  });
}

export function useAllCrocs(includeCulled = false) {
  return useQuery({
    queryKey: includeCulled ? ['crocs', 'all', 'including-culled'] : ['crocs', 'all'],
    queryFn: async () => (await fetchCrocs(undefined, includeCulled)) as CrocRecord[],
  });
}

export function useConditionCodes() {
  return useQuery({
    queryKey: ['condition_codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('condition_codes')
        .select('*')
        .order('code');
      if (error) throw error;
      return (data ?? []) as ConditionCodeRecord[];
    },
  });
}

export interface InspectionRecord {
  id: number;
  croc_id: number;
  inspection_date: string;
  belly_cm: number | null;
  condition_codes: string[];
  /** Pen context recorded from the placement-history migration onwards. */
  pen_id?: string | null;
  line?: string | null;
  pen_slot?: number | null;
}

export function useInspectionHistory(crocId?: number) {
  return useQuery({
    queryKey: ['inspections', crocId],
    queryFn: async () => {
      if (!crocId) return [];
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('croc_id', crocId)
        .order('inspection_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InspectionRecord[];
    },
    enabled: !!crocId,
  });
}

export function usePenMeta(penId: string) {
  return useQuery({
    queryKey: ['pen_meta', penId],
    queryFn: async () => {
      const rows = await fetchAllPages((from, to) => supabase
        .from('crocs')
        .select('line, pen_slot, belly_cm')
        .eq('pen_id', penId)
        .order('line')
        .order('pen_slot')
        .order('id')
        .range(from, to));
      const lines = [...new Set(rows.map(r => r.line))].sort();
      const maxSlot = Math.max(...rows.map(r => r.pen_slot), 0);
      return { lines, maxSlot };
    },
  });
}
