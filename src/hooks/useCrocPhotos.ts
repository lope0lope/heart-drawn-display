import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ConditionMark } from '@/lib/crocZones';

export interface CrocPhotoRecord {
  id: number;
  croc_id: number | null;
  tag: string | null;
  inspection_date: string;
  photo_url: string;
  storage_path: string | null;
  marks: ConditionMark[] | null;
  belly_cm: number | null;
  created_at: string;
}

export const PHOTO_BUCKET = 'croc-photos';

/** Visual history for a croc, oldest capture first. */
export function useCrocPhotos(crocId?: number, tag?: string | null) {
  return useQuery({
    queryKey: ['croc_photos', crocId, tag],
    queryFn: async () => {
      if (!crocId && !tag) return [] as CrocPhotoRecord[];
      const filters: string[] = [];
      if (crocId) filters.push(`croc_id.eq.${crocId}`);
      if (tag) filters.push(`tag.eq.${tag}`);
      const { data, error } = await supabase
        .from('croc_photos')
        .select('*')
        .or(filters.join(','))
        .order('inspection_date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return await Promise.all((data ?? []).map(async row => {
        if (!row.storage_path) return row as unknown as CrocPhotoRecord;
        const { data: signed, error: signError } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(row.storage_path, 3600);
        if (signError) throw signError;
        return { ...row, photo_url: signed.signedUrl } as unknown as CrocPhotoRecord;
      }));
    },
    enabled: !!(crocId || tag),
    retry: false,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });
}
