import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { useAllCrocs } from '@/hooks/useCrocs';
import { SIZE_BANDS, sizeBand, countSizeBands, getOccupied, cullEligibleCycle } from '@/lib/crocUtils';

export interface CullRecord {
  id: number;
  croc_id: number | null;
  cull_date: string;
  size_band_index: number | null;
  reason: string | null;
  created_at: string;
}

/** Fetch all cull records */
export function useCullRecords() {
  return useQuery({
    queryKey: ['cull_records'],
    queryFn: async () => (await fetchAllPages((from, to) => supabase
        .from('cull_records')
        .select('*')
        .order('cull_date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to))) as CullRecord[],
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
      if (d.getFullYear() === year && r.size_band_index !== null && r.size_band_index >= 0 && r.size_band_index < 6) {
        counts[r.size_band_index]++;
      }
    }
  }
  return { ytdCulled: counts, isLoading };
}

/**
 * Compute NON-LINEAR growth rates per size band from inspection history.
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

      const defaults = [3.8, 3.2, 2.6, 2.0, 1.4, 0.8];
      if (error || !data || data.length === 0) return defaults;

      const deltas: number[][] = [[], [], [], [], [], []];
      let i = 0;
      while (i < data.length) {
        const crocId = data[i].croc_id;
        const crocRows: { belly_cm: number; inspection_date: string }[] = [];
        while (i < data.length && data[i].croc_id === crocId) {
          const row = data[i];
          if (row.belly_cm != null) {
            crocRows.push({ belly_cm: row.belly_cm, inspection_date: row.inspection_date });
          }
          i++;
        }
        for (let j = 1; j < crocRows.length; j++) {
          const delta = crocRows[j].belly_cm - crocRows[j - 1].belly_cm;
          const band = sizeBand(crocRows[j - 1].belly_cm);
          if (band !== null && delta > 0) {
            const days = (new Date(crocRows[j].inspection_date).getTime() -
              new Date(crocRows[j - 1].inspection_date).getTime()) / 86400000;
            if (days > 10 && days < 200) {
              const normalized = (delta / days) * 60;
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

/**
 * Project belly forward through cycles using non-linear growth rates.
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

export interface BandProjection {
  label: string;
  cycles: number;
  /** Projected stock count per size band */
  distribution: number[];
  /** Total occupied */
  total: number;
}

/**
 * Full cull projections — shows stock distribution across ALL size bands
 * at 4 horizons (now, +1, +2, +3 cycles). Every band is cullable.
 */
export function useCullProjections() {
  const { data: allCrocs } = useAllCrocs();
  const { data: growthRates } = useGrowthRates();

  if (!allCrocs || !growthRates) return null;

  const occupied = getOccupied(allCrocs);

  const horizons = [
    { label: 'Now', cycles: 0 },
    { label: '+1 Cycle (~2 mo)', cycles: 1 },
    { label: '+2 Cycles (~4 mo)', cycles: 2 },
    { label: '+3 Cycles (~6 mo)', cycles: 3 },
  ];

  // Crocs on treatment hold (no schedule + active conditions) are excluded entirely.
  const onHold = occupied.filter(c => cullEligibleCycle(c) === null).length;

  const projections: BandProjection[] = horizons.map(h => {
    const byBand = [0, 0, 0, 0, 0, 0];

    for (const c of occupied) {
      if (!c.belly_cm) continue;
      const eligible = cullEligibleCycle(c);
      // Skip held crocs entirely; skip those not yet cleared by this horizon.
      if (eligible === null) continue;
      if (eligible > h.cycles) continue;
      const projected = projectBelly(c.belly_cm, growthRates, h.cycles);
      const band = sizeBand(projected);
      if (band !== null) byBand[band]++;
    }

    return {
      ...h,
      distribution: byBand,
      total: byBand.reduce((a, b) => a + b, 0),
    };
  });

  return { projections, rates: growthRates, occupied, totalStock: occupied.length, onHold };
}

/** AI advisory based on cull projections */
export function useAiAdvisory() {
  const { data: allCrocs } = useAllCrocs();
  const { data: growthRates } = useGrowthRates();
  const { ytdCulled } = useYtdCulled();

  if (!allCrocs || !growthRates) return null;

  const occupied = getOccupied(allCrocs);
  // Only crocs cleared for culling THIS cycle count toward "in stock" decisions.
  const eligibleNow = occupied.filter(c => cullEligibleCycle(c) === 0);
  const heldCount = occupied.filter(c => cullEligibleCycle(c) === null).length;
  const now = countSizeBands(eligibleNow);
  const targets = SIZE_BANDS.map(b => b.target);

  const advisories: { icon: string; color: string; text: string }[] = [];

  // Check each band against its target
  SIZE_BANDS.forEach((band, i) => {
    const remaining = targets[i] - ytdCulled[i];
    if (now[i] >= remaining && remaining > 0) {
      advisories.push({
        icon: '✓',
        color: 'ct-good',
        text: `${band.range} — ${now[i]} in stock, ${remaining} still needed. Ready to cull.`,
      });
    } else if (remaining > now[i] * 1.5 && remaining > 20) {
      advisories.push({
        icon: '⚠',
        color: 'ct-danger',
        text: `${band.range} — shortfall risk. Only ${now[i]} in stock vs ${remaining} needed.`,
      });
    }
  });

  // Check surplus bands
  SIZE_BANDS.forEach((band, i) => {
    const remaining = targets[i] - ytdCulled[i];
    const surplus = now[i] - remaining;
    if (surplus > 20 && remaining > 0) {
      advisories.push({
        icon: '⚠',
        color: 'ct-warn',
        text: `${band.range} — surplus of ${surplus}. Consider accelerating cull schedule.`,
      });
    }
  });

  if (heldCount > 0) {
    advisories.unshift({
      icon: '⊙',
      color: 'ct-warn',
      text: `${heldCount} croc${heldCount === 1 ? '' : 's'} on treatment hold — excluded from cull totals until staff sets a clearance schedule (NXT / 2 / 3 / 4).`,
    });
  }

  if (advisories.length === 0) {
    advisories.push({
      icon: 'ℹ',
      color: 'ct-info',
      text: 'All size bands on track. Continue standard growth cycles.',
    });
  }

  return advisories;
}
