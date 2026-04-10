import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllCrocs, useConditionCodes } from '@/hooks/useCrocs';
import { SIZE_BANDS, sizeBand, countSizeBands, getOccupied } from '@/lib/crocUtils';

export interface CullRecord {
  id: number;
  croc_id: number | null;
  cull_date: string;
  size_band_index: number;
  reason: string | null;
  created_at: string;
}

/** Fetch all cull records — returns empty array if table doesn't exist yet */
export function useCullRecords() {
  return useQuery({
    queryKey: ['cull_records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cull_records')
        .select('*')
        .order('cull_date', { ascending: false });
      if (error) {
        // Table may not exist yet
        console.warn('cull_records query failed (table may not exist):', error.message);
        return [] as CullRecord[];
      }
      return (data ?? []) as CullRecord[];
    },
  });
}

/** YTD culled counts per size band (6 bands) */
export function useYtdCulled() {
  const { data: records, isLoading } = useCullRecords();
  const year = new Date().getFullYear();
  
  const counts = [0, 0, 0, 0, 0, 0];
  if (records) {
    for (const r of records) {
      const d = new Date(r.cull_date);
      if (d.getFullYear() === year && r.size_band_index >= 0 && r.size_band_index < 6) {
        counts[r.size_band_index]++;
      }
    }
  }
  return { ytdCulled: counts, isLoading };
}

/** Compute average growth rates per size band from inspection history */
export function useGrowthRates() {
  return useQuery({
    queryKey: ['growth_rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select('croc_id, belly_cm, inspection_date')
        .not('belly_cm', 'is', null)
        .order('croc_id')
        .order('inspection_date', { ascending: true });
      
      // Default growth rates if no inspection data available
      const defaults = [5.2, 4.8, 4.5, 4.1, 3.6, 2.9];
      if (error || !data || data.length === 0) return defaults;

      const deltas: number[][] = [[], [], [], [], [], []];
      const rows = data;
      
      let i = 0;
      while (i < rows.length) {
        const crocId = rows[i].croc_id;
        const crocRows: { belly_cm: number; inspection_date: string }[] = [];
        while (i < rows.length && rows[i].croc_id === crocId) {
          if (rows[i].belly_cm != null) crocRows.push(rows[i] as any);
          i++;
        }
        for (let j = 1; j < crocRows.length; j++) {
          const delta = crocRows[j].belly_cm - crocRows[j - 1].belly_cm;
          const band = sizeBand(crocRows[j - 1].belly_cm);
          if (band !== null && delta > 0) {
            deltas[band].push(delta);
          }
        }
      }

      return deltas.map((arr, idx) =>
        arr.length >= 3
          ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10
          : defaults[idx]
      );
    },
  });
}

/** Compute cull readiness from live data */
export function useCullReadiness() {
  const { data: allCrocs } = useAllCrocs();
  const { data: growthRates } = useGrowthRates();
  
  if (!allCrocs || !growthRates) return null;

  const occupied = getOccupied(allCrocs);
  const rates = growthRates;

  const horizons = [
    { horizon: 'Now', label: 'Cull immediately', color: 'ct-good' },
    { horizon: 'Next Cycle', label: 'Ready in ~2 months', color: 'ct-info' },
    { horizon: '+2 Cycles', label: 'Ready in ~4 months', color: 'ct-accent' },
    { horizon: '+3 Cycles', label: 'Ready in ~6 months', color: 'ct-text2' },
  ];

  const results = horizons.map((h, hIdx) => {
    let workerCount = 0;
    let aiCount = 0;

    for (const c of occupied) {
      if (!c.belly_cm) continue;
      const currentBand = sizeBand(c.belly_cm) ?? 0;
      const projected = c.belly_cm + rates[currentBand] * hIdx;
      
      if (projected >= 35) workerCount++;
      
      if (projected >= 35) {
        const hasBlockingCondition = c.condition_codes.some(code => 
          ['MN', 'DS', 'IN'].includes(code)
        );
        if (!hasBlockingCondition) aiCount++;
        else if (hIdx >= 2) aiCount++;
      }
    }

    return { ...h, worker: workerCount, ai: aiCount };
  });

  return results;
}

/** Generate AI advisory text from live data */
export function useAiAdvisory() {
  const { data: allCrocs } = useAllCrocs();
  const { data: growthRates } = useGrowthRates();
  const { ytdCulled } = useYtdCulled();

  if (!allCrocs || !growthRates) return null;

  const occupied = getOccupied(allCrocs);
  const now = countSizeBands(occupied);
  const targets = SIZE_BANDS.map(b => b.target);

  const advisories: { icon: string; color: string; text: string }[] = [];

  SIZE_BANDS.forEach((band, i) => {
    const remaining = targets[i] - ytdCulled[i];
    const surplus = now[i] - remaining;

    if (surplus > 20) {
      advisories.push({
        icon: '✓',
        color: 'ct-good',
        text: `${band.range} — cull ${Math.min(surplus, now[i])} units now. Surplus will exceed pen capacity.`,
      });
    } else if (remaining > now[i] * 1.5 && remaining > 20) {
      advisories.push({
        icon: '⚠',
        color: 'ct-warn',
        text: `${band.range} — hold. Projected shortfall of ${remaining - now[i]} units vs annual target. Do not cull early.`,
      });
    } else {
      advisories.push({
        icon: 'ℹ',
        color: 'ct-info',
        text: `${band.range} — on track. Allow natural progression.`,
      });
    }
  });

  return advisories;
}
