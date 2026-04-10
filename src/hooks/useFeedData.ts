import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FeedRecord {
  id: number;
  pen_id: string;
  line: string;
  cycle: string;
  feed_kg: number;
  croc_count: number | null;
  recorded_date: string;
}

export interface UploadLog {
  id: number;
  filename: string;
  record_count: number;
  status: string;
  warnings: number;
  uploaded_at: string;
}

export function useFeedRecords(penId?: string, cycle?: string) {
  return useQuery({
    queryKey: ['feed_records', penId, cycle],
    queryFn: async () => {
      let query = supabase.from('feed_records').select('*').order('pen_id').order('line');
      if (penId && penId !== 'ALL') query = query.eq('pen_id', penId);
      if (cycle) query = query.eq('cycle', cycle);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as FeedRecord[];
    },
  });
}

export function useFeedCycles() {
  return useQuery({
    queryKey: ['feed_cycles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_records')
        .select('cycle, recorded_date')
        .order('recorded_date', { ascending: false });
      if (error) throw error;
      const unique = [...new Set((data ?? []).map(d => d.cycle))];
      return unique;
    },
  });
}

export function useUploadLogs() {
  return useQuery({
    queryKey: ['upload_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('upload_logs')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as UploadLog[];
    },
  });
}
