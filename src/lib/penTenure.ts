import type { CrocRecord } from '@/hooks/useCrocs';

/** Day count between an ISO date string and today (never negative). */
export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = Math.floor((Date.now() - t) / 86_400_000);
  return d < 0 ? 0 : d;
}

export interface Tenure {
  /** Date the croc entered its current pen/line/slot (or first record). */
  since: string | null;
  days: number | null;
  /** True when we only know the first record, not an observed move. */
  estimated: boolean;
}

/**
 * How long this croc has been in its current pen. Prefers the observed
 * placement (`pen_since`); falls back to the first record on the farm.
 */
export function penTenure(croc: CrocRecord): Tenure {
  if (croc.pen_since) {
    return { since: croc.pen_since, days: daysSince(croc.pen_since), estimated: false };
  }
  const fallback = croc.placement_date ?? null;
  return { since: fallback, days: daysSince(fallback), estimated: true };
}

export const TENURE_BUCKETS = [
  { label: '0–30 d', min: 0, max: 30 },
  { label: '31–60 d', min: 31, max: 60 },
  { label: '61–90 d', min: 61, max: 90 },
  { label: '91–180 d', min: 91, max: 180 },
  { label: '180+ d', min: 181, max: Infinity },
];

/** Cold (new) → hot (long-standing) scale, one colour per tenure bucket. */
export const TENURE_COLORS = ['#2d7dd2', '#1abc9c', '#fdd835', '#fb8c00', '#c62828'];

export function tenureBucket(days: number): number {
  for (let i = 0; i < TENURE_BUCKETS.length; i++) {
    if (days >= TENURE_BUCKETS[i].min && days <= TENURE_BUCKETS[i].max) return i;
  }
  return TENURE_BUCKETS.length - 1;
}

export function tenureColor(days: number | null): string {
  if (days === null) return '#565250';
  return TENURE_COLORS[tenureBucket(days)];
}

export interface TenureStats {
  count: number;
  avg: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  buckets: number[];
  unknown: number;
  estimated: number;
}

export function tenureStats(crocs: CrocRecord[]): TenureStats {
  const days: number[] = [];
  let unknown = 0;
  let estimated = 0;
  const buckets = new Array(TENURE_BUCKETS.length).fill(0);

  for (const c of crocs) {
    const t = penTenure(c);
    if (t.days === null) { unknown++; continue; }
    if (t.estimated) estimated++;
    days.push(t.days);
    buckets[tenureBucket(t.days)]++;
  }

  if (days.length === 0) {
    return { count: 0, avg: null, median: null, min: null, max: null, buckets, unknown, estimated };
  }

  days.sort((a, b) => a - b);
  const mid = Math.floor(days.length / 2);
  const median = days.length % 2 ? days[mid] : Math.round((days[mid - 1] + days[mid]) / 2);

  return {
    count: days.length,
    avg: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    median,
    min: days[0],
    max: days[days.length - 1],
    buckets,
    unknown,
    estimated,
  };
}

export interface PenStay {
  pen_id: string;
  line: string;
  pen_slot: number;
  from: string;
  to: string | null;
  belly_cm: number | null;
  days: number | null;
}

/**
 * Collapse a croc's chronological inspection rows into distinct pen stays.
 * Rows without pen data are ignored so pre-migration history stays quiet.
 */
export function buildPenStays(
  rows: Array<{ inspection_date: string; belly_cm: number | null; pen_id?: string | null; line?: string | null; pen_slot?: number | null }>
): PenStay[] {
  const stays: PenStay[] = [];
  const sorted = [...rows]
    .filter(r => r.pen_id && r.line != null && r.pen_slot != null)
    .sort((a, b) => a.inspection_date.localeCompare(b.inspection_date));

  for (const r of sorted) {
    const last = stays[stays.length - 1];
    if (last && last.pen_id === r.pen_id && last.line === r.line && last.pen_slot === r.pen_slot) continue;
    if (last) {
      last.to = r.inspection_date;
      last.days = Math.max(0, Math.floor((Date.parse(r.inspection_date) - Date.parse(last.from)) / 86_400_000));
    }
    stays.push({
      pen_id: r.pen_id!,
      line: r.line!,
      pen_slot: r.pen_slot!,
      from: r.inspection_date,
      to: null,
      belly_cm: r.belly_cm,
      days: null,
    });
  }

  const current = stays[stays.length - 1];
  if (current) current.days = daysSince(current.from);
  return stays;
}
