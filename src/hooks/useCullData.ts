import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllCrocs } from '@/hooks/useCrocs';
import { SIZE_BANDS, sizeBand, countSizeBands, getOccupied } from '@/lib/crocUtils';

export interface CullRecord {
  id: number;
  croc_id: number | null;
  cull_date: string;
  size_band_index: number;
  reason: string | null;
  created_at: string;
}

/** Fetch all cull records */
export function useCullRecords() {
  return useQuery({
    queryKey: ['cull_records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cull_records')
        .select('*')
        .order('cull_date', { ascending: false });
      if (error) {
        console.warn('cull_records query failed:', error.message);
        return [] as CullRecord[];
      }
      return (data ?? []) as CullRecord[];
    },
  });
}

/** YTD culled counts per size band */
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

/**
 * Compute NON-LINEAR growth rates per size band from inspection history.
 * Groups consecutive inspections by croc, measures cm gained per ~2-month cycle,
 * and buckets by the starting size band. This captures that smaller crocs grow
 * faster than larger ones.
 */
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

      // Defaults based on typical saltwater croc growth curves (cm per 2-month cycle)
      // Smaller crocs grow much faster; larger crocs slow significantly
      const defaults = [3.8, 3.2, 2.6, 2.0, 1.4, 0.8];
      if (error || !data || data.length === 0) return defaults;

      const deltas: number[][] = [[], [], [], [], [], []];
      let i = 0;
      while (i < data.length) {
        const crocId = data[i].croc_id;
        const crocRows: { belly_cm: number; inspection_date: string }[] = [];
        while (i < data.length && data[i].croc_id === crocId) {
          if (data[i].belly_cm != null) crocRows.push(data[i] as any);
          i++;
        }
        for (let j = 1; j < crocRows.length; j++) {
          const delta = crocRows[j].belly_cm - crocRows[j - 1].belly_cm;
          const band = sizeBand(crocRows[j - 1].belly_cm);
          if (band !== null && delta > 0) {
            // Normalize to ~2-month intervals
            const days = (new Date(crocRows[j].inspection_date).getTime() -
              new Date(crocRows[j - 1].inspection_date).getTime()) / 86400000;
            if (days > 10 && days < 200) {
              const normalized = (delta / days) * 60; // cm per 60 days
              deltas[band].push(normalized);
            }
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

const CULL_THRESHOLD = 54;

/**
 * Project each croc forward through cycles using non-linear growth rates.
 * As a croc grows into a new size band, its growth rate changes to match
 * that band's rate — capturing the natural slowdown.
 */
export function projectBelly(currentCm: number, rates: number[], cycles: number): number {
  let cm = currentCm;
  for (let c = 0; c < cycles; c++) {
    const band = sizeBand(cm);
    const rate = band !== null ? rates[band] : rates[rates.length - 1];
    cm += rate;
  }
  return cm;
}

/** Compute cull-ready counts for now, +1 cycle, +2 cycles */
export function useCullProjections() {
  const { data: allCrocs } = useAllCrocs();
  const { data: growthRates } = useGrowthRates();

  if (!allCrocs || !growthRates) return null;

  const occupied = getOccupied(allCrocs);

  // For each cycle horizon, count crocs that will be ≥54cm
  const horizons = [
    { label: 'Now', cycles: 0 },
    { label: 'Next Cycle (~2 mo)', cycles: 1 },
    { label: '+2 Cycles (~4 mo)', cycles: 2 },
  ];

  const projections = horizons.map(h => {
    const byBand = [0, 0, 0, 0, 0, 0];
    let cullReady = 0;
    const cullReadyByBand = [0, 0, 0, 0, 0, 0];

    for (const c of occupied) {
      if (!c.belly_cm) continue;
      const projected = projectBelly(c.belly_cm, growthRates, h.cycles);
      const band = sizeBand(projected);
      if (band !== null) byBand[band]++;

      if (projected >= CULL_THRESHOLD) {
        cullReady++;
        const currentBand = sizeBand(c.belly_cm);
        if (currentBand !== null) cullReadyByBand[currentBand]++;
      }
    }

    return {
      ...h,
      distribution: byBand,
      cullReady,
      cullReadyByBand,
      total: occupied.length,
    };
  });

  return { projections, rates: growthRates, occupied, totalStock: occupied.length };
}

/** AI advisory based on cull projections */
export function useAiAdvisory() {
  const { data: allCrocs } = useAllCrocs();
  const { data: growthRates } = useGrowthRates();
  const { ytdCulled } = useYtdCulled();

  if (!allCrocs || !growthRates) return null;

  const occupied = getOccupied(allCrocs);
  const now = countSizeBands(occupied);
  const targets = SIZE_BANDS.map(b => b.target);

  const advisories: { icon: string; color: string; text: string }[] = [];

  // Count how many are already at cull threshold
  const cullNow = occupied.filter(c => c.belly_cm && c.belly_cm >= CULL_THRESHOLD).length;
  if (cullNow > 0) {
    advisories.push({
      icon: '✓',
      color: 'ct-good',
      text: `${cullNow} crocs at ≥${CULL_THRESHOLD}cm — ready for immediate cull.`,
    });
  }

  // Check upcoming supply per band
  SIZE_BANDS.forEach((band, i) => {
    const remaining = targets[i] - ytdCulled[i];
    const surplus = now[i] - remaining;

    if (surplus > 20) {
      advisories.push({
        icon: '⚠',
        color: 'ct-warn',
        text: `${band.range} — surplus of ${surplus}. Consider accelerating cull schedule.`,
      });
    } else if (remaining > now[i] * 1.5 && remaining > 20) {
      advisories.push({
        icon: '⚠',
        color: 'ct-danger',
        text: `${band.range} — shortfall risk. ${remaining - now[i]} units below target. Hold stock.`,
      });
    }
  });

  if (advisories.length === 0) {
    advisories.push({
      icon: 'ℹ',
      color: 'ct-info',
      text: 'All size bands on track. Continue standard growth cycles.',
    });
  }

  return advisories;
}
