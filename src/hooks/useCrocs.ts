import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrocRecord {
  id: number;
  pen_id: string;
  tag: string | null;
  line: string;
  belly_cm: number | null;
  grade: number | null;
  pen_slot: number;
  condition_codes: string[];
  inspection_date: string;
}

export interface ConditionCodeRecord {
  code: string;
  name: string;
  color_var: string;
  is_live: boolean;
  is_hide: boolean;
}

export function useCrocs(penId?: string) {
  return useQuery({
    queryKey: ['crocs', penId],
    queryFn: async () => {
      let query = supabase.from('crocs').select('*');
      if (penId) query = query.eq('pen_id', penId);
      const { data, error } = await query.order('line').order('pen_slot');
      if (error) throw error;
      return (data ?? []) as CrocRecord[];
    },
  });
}

export function useAllCrocs() {
  return useQuery({
    queryKey: ['crocs', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crocs')
        .select('*')
        .order('pen_id')
        .order('line')
        .order('pen_slot');
      if (error) throw error;
      return (data ?? []) as CrocRecord[];
    },
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

export function usePenMeta(penId: string) {
  return useQuery({
    queryKey: ['pen_meta', penId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crocs')
        .select('line, pen_slot, belly_cm')
        .eq('pen_id', penId);
      if (error) throw error;
      const rows = data ?? [];
      const lines = [...new Set(rows.map(r => r.line))].sort();
      const maxSlot = Math.max(...rows.map(r => r.pen_slot), 0);
      return { lines, maxSlot };
    },
  });
}
