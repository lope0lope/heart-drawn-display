import type { CrocRecord } from '@/hooks/useCrocs';

export const SIZE_BANDS = [
  { range: '25–29 cm', product: 'Small belt goods', target: 300, min: 25, max: 29 },
  { range: '30–32 cm', product: 'Wallets / small goods', target: 400, min: 30, max: 32 },
  { range: '33–34 cm', product: 'Handbags (small)', target: 450, min: 33, max: 34 },
  { range: '35–39 cm', product: 'Handbags (standard)', target: 500, min: 35, max: 39 },
  { range: '40–45 cm', product: 'Luggage accessories', target: 350, min: 40, max: 45 },
  { range: '45+ cm', product: 'Full-size luggage', target: 200, min: 46, max: 999 },
];

export const SIZE_BAND_COLORS = ['#4a6fa5', '#4a90b8', '#c9a84c', '#d4892a', '#4caf50', '#6b3fa0'];
export const GROWTH_RATES = [5.2, 4.8, 4.5, 4.1, 3.6, 2.9];
export const YTD_CULLED = [88, 142, 170, 210, 98, 42];

export function sizeBand(cm: number): number | null {
  if (cm < 25) return null;
  if (cm <= 29) return 0;
  if (cm <= 32) return 1;
  if (cm <= 34) return 2;
  if (cm <= 39) return 3;
  if (cm <= 45) return 4;
  return 5;
}

export function sizeBandColor(i: number): string {
  return SIZE_BAND_COLORS[i] ?? '#565250';
}

export function getConditionColor(code: string, conditionCodes: Array<{ code: string; color_var: string }>): string {
  const cond = conditionCodes.find(c => c.code === code);
  if (!cond) return 'hsl(var(--ct-text3))';
  return `hsl(var(${cond.color_var}))`;
}

/** Build a grid structure for pen map from croc records */
export function buildPenGrid(crocs: CrocRecord[]) {
  const lines = [...new Set(crocs.map(c => c.line))].sort();
  const maxSlot = Math.max(...crocs.map(c => c.pen_slot), 0);
  
  // Build a lookup: line -> slot -> croc
  const grid: Map<string, Map<number, CrocRecord>> = new Map();
  for (const c of crocs) {
    if (!grid.has(c.line)) grid.set(c.line, new Map());
    grid.get(c.line)!.set(c.pen_slot, c);
  }
  
  return { lines, maxSlot, grid };
}

/** Count crocs per size band */
export function countSizeBands(crocs: CrocRecord[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const c of crocs) {
    if (c.belly_cm) {
      const b = sizeBand(c.belly_cm);
      if (b !== null) counts[b]++;
    }
  }
  return counts;
}

/** Count condition codes across all crocs */
export function countConditions(crocs: CrocRecord[]): Record<string, number> {
  const cc: Record<string, number> = {};
  for (const c of crocs) {
    for (const code of c.condition_codes) {
      cc[code] = (cc[code] || 0) + 1;
    }
  }
  return cc;
}

/** Get occupied crocs (those with a belly measurement) */
export function getOccupied(crocs: CrocRecord[]): CrocRecord[] {
  return crocs.filter(c => c.belly_cm !== null);
}
