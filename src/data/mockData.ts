export interface CrocData {
  row: string;
  col: number;
  occupied: boolean;
  tagId?: number;
  sizeCm?: number;
  conds: string[];
}

export interface ConditionDef {
  code: string;
  name: string;
  colorVar: string;
  live: boolean;
  hide: boolean;
}

export interface SizeBandDef {
  range: string;
  product: string;
  target: number;
}

export const ROWS = 'ABCDEFGHIJKLM'.split('');
export const COLS = 70;

export const CONDITIONS: ConditionDef[] = [
  { code: 'BA', name: 'Bacteria', colorVar: '--c-ba', live: true, hide: true },
  { code: 'B', name: 'Bone', colorVar: '--c-b', live: true, hide: true },
  { code: 'DS', name: 'Double Scale', colorVar: '--c-ds', live: true, hide: true },
  { code: 'HS', name: 'Healed Scar', colorVar: '--c-hs', live: true, hide: true },
  { code: 'PI', name: 'Pix', colorVar: '--c-pi', live: true, hide: true },
  { code: 'PO', name: 'Pox', colorVar: '--c-po', live: true, hide: true },
  { code: 'S', name: 'Scratches', colorVar: '--c-s', live: true, hide: true },
  { code: 'TH', name: 'Teeth Holes', colorVar: '--c-th', live: true, hide: true },
  { code: 'R', name: 'Rash', colorVar: '--c-r', live: true, hide: true },
  { code: 'W', name: 'Wrinkles', colorVar: '--c-w', live: true, hide: true },
  { code: 'BS', name: 'Brown Spot', colorVar: '--c-bs', live: true, hide: true },
  { code: 'SS', name: 'Scale Slip', colorVar: '--c-ss', live: true, hide: true },
  { code: 'KH', name: 'Knife Hole', colorVar: '--c-kh', live: true, hide: true },
  { code: 'FF', name: 'Fungus', colorVar: '--c-ff', live: true, hide: true },
  { code: 'PD', name: 'Pattern Defect', colorVar: '--c-pd', live: true, hide: true },
  { code: 'U', name: 'Umbilical', colorVar: '--c-u', live: true, hide: true },
  { code: 'C', name: 'Creasing', colorVar: '--c-c', live: true, hide: true },
  { code: 'TB', name: 'Tail Biting', colorVar: '--c-tb', live: true, hide: false },
  { code: 'OP', name: 'Orange Peal', colorVar: '--c-op', live: true, hide: false },
  { code: 'MN', name: 'Malnourished', colorVar: '--c-mn', live: true, hide: false },
];

export const SIZE_BANDS: SizeBandDef[] = [
  { range: '25–29 cm', product: 'Small belt goods', target: 300 },
  { range: '30–32 cm', product: 'Wallets / small goods', target: 400 },
  { range: '33–34 cm', product: 'Handbags (small)', target: 450 },
  { range: '35–39 cm', product: 'Handbags (standard)', target: 500 },
  { range: '40–45 cm', product: 'Luggage accessories', target: 350 },
  { range: '45+ cm', product: 'Full-size luggage', target: 200 },
];

export const GROWTH_RATES = [5.2, 4.8, 4.5, 4.1, 3.6, 2.9];
export const YTD_CULLED = [88, 142, 170, 210, 98, 42];

export const SIZE_BAND_COLORS = ['#4a6fa5', '#4a90b8', '#c9a84c', '#d4892a', '#4caf50', '#6b3fa0'];

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

export function getConditionColor(code: string): string {
  const cond = CONDITIONS.find(c => c.code === code);
  if (!cond) return 'hsl(var(--ct-text3))';
  return `hsl(var(${cond.colorVar}))`;
}

function genCrocData(pen: string): CrocData[] {
  const crocs: CrocData[] = [];
  const base = pen === 'GH1' ? 5000 : 6000;
  // Use a seeded approach for consistency
  let seed = pen === 'GH1' ? 12345 : 67890;
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  ROWS.forEach((row) => {
    for (let c = 1; c <= COLS; c++) {
      const idx = ROWS.indexOf(row) * COLS + (c - 1);
      const tagId = base + idx;
      if (rand() < 0.13) {
        crocs.push({ row, col: c, occupied: false, conds: [] });
        continue;
      }
      const sizeCm = 20 + Math.floor(rand() * 38);
      let conds: string[] = [];
      if (row === 'J' && c >= 20 && c <= 25) conds = ['MN'];
      else if (row === 'F' && c >= 30 && c <= 38) conds = ['DS'];
      else if (rand() < 0.14) {
        const nc = rand() < 0.25 ? 2 : 1;
        for (let k = 0; k < nc; k++) conds.push(CONDITIONS[Math.floor(rand() * CONDITIONS.length)].code);
      }
      crocs.push({ row, col: c, occupied: true, tagId, sizeCm, conds });
    }
  });
  return crocs;
}

export const penData: Record<string, CrocData[]> = {
  GH1: genCrocData('GH1'),
  GH2: genCrocData('GH2'),
};

export const CULL_READINESS = [
  { horizon: 'Now', label: 'Cull immediately', worker: 218, ai: 194, color: 'ct-good' },
  { horizon: 'Next Cycle', label: 'Ready in ~2 months', worker: 341, ai: 378, color: 'ct-info' },
  { horizon: '+2 Cycles', label: 'Ready in ~4 months', worker: 487, ai: 502, color: 'ct-accent' },
  { horizon: '+3 Cycles', label: 'Ready in ~6 months', worker: 624, ai: 589, color: 'ct-text2' },
];

export const FEED_DATA: Record<string, { lines: Array<{ line: string; crocs: number; cycle1_kg: number; cycle2_kg: number; cycle3_kg: number }>; monthly: Array<{ month: string; kg: number }> }> = {
  GH1: {
    lines: [
      { line: 'A', crocs: 70, cycle1_kg: 148, cycle2_kg: 182, cycle3_kg: 210 },
      { line: 'B', crocs: 68, cycle1_kg: 144, cycle2_kg: 176, cycle3_kg: 205 },
      { line: 'C', crocs: 71, cycle1_kg: 150, cycle2_kg: 185, cycle3_kg: 214 },
      { line: 'D', crocs: 65, cycle1_kg: 137, cycle2_kg: 169, cycle3_kg: 196 },
      { line: 'E', crocs: 72, cycle1_kg: 152, cycle2_kg: 187, cycle3_kg: 217 },
      { line: 'F', crocs: 69, cycle1_kg: 146, cycle2_kg: 181, cycle3_kg: 208 },
      { line: 'G', crocs: 70, cycle1_kg: 148, cycle2_kg: 183, cycle3_kg: 211 },
      { line: 'H', crocs: 67, cycle1_kg: 141, cycle2_kg: 174, cycle3_kg: 202 },
      { line: 'I', crocs: 71, cycle1_kg: 150, cycle2_kg: 186, cycle3_kg: 215 },
      { line: 'J', crocs: 64, cycle1_kg: 135, cycle2_kg: 164, cycle3_kg: 188 },
      { line: 'K', crocs: 70, cycle1_kg: 148, cycle2_kg: 182, cycle3_kg: 210 },
      { line: 'L', crocs: 68, cycle1_kg: 144, cycle2_kg: 177, cycle3_kg: 206 },
      { line: 'M', crocs: 69, cycle1_kg: 146, cycle2_kg: 180, cycle3_kg: 208 },
    ],
    monthly: [
      { month: 'Oct 2025', kg: 960 }, { month: 'Nov 2025', kg: 1020 }, { month: 'Dec 2025', kg: 1080 },
      { month: 'Jan 2026', kg: 1140 }, { month: 'Feb 2026', kg: 1180 }, { month: 'Mar 2026', kg: 1210 },
      { month: 'Apr 2026', kg: 1260 },
    ],
  },
  GH2: {
    lines: [
      { line: 'A', crocs: 69, cycle1_kg: 146, cycle2_kg: 178, cycle3_kg: 207 },
      { line: 'B', crocs: 70, cycle1_kg: 148, cycle2_kg: 182, cycle3_kg: 210 },
      { line: 'C', crocs: 68, cycle1_kg: 143, cycle2_kg: 176, cycle3_kg: 204 },
      { line: 'D', crocs: 71, cycle1_kg: 150, cycle2_kg: 184, cycle3_kg: 213 },
      { line: 'E', crocs: 66, cycle1_kg: 139, cycle2_kg: 171, cycle3_kg: 199 },
      { line: 'F', crocs: 70, cycle1_kg: 148, cycle2_kg: 181, cycle3_kg: 210 },
      { line: 'G', crocs: 68, cycle1_kg: 144, cycle2_kg: 177, cycle3_kg: 205 },
      { line: 'H', crocs: 72, cycle1_kg: 152, cycle2_kg: 188, cycle3_kg: 218 },
      { line: 'I', crocs: 67, cycle1_kg: 141, cycle2_kg: 173, cycle3_kg: 201 },
      { line: 'J', crocs: 63, cycle1_kg: 133, cycle2_kg: 162, cycle3_kg: 185 },
      { line: 'K', crocs: 70, cycle1_kg: 148, cycle2_kg: 182, cycle3_kg: 210 },
      { line: 'L', crocs: 69, cycle1_kg: 146, cycle2_kg: 180, cycle3_kg: 208 },
      { line: 'M', crocs: 68, cycle1_kg: 144, cycle2_kg: 177, cycle3_kg: 206 },
    ],
    monthly: [
      { month: 'Oct 2025', kg: 930 }, { month: 'Nov 2025', kg: 985 }, { month: 'Dec 2025', kg: 1050 },
      { month: 'Jan 2026', kg: 1105 }, { month: 'Feb 2026', kg: 1150 }, { month: 'Mar 2026', kg: 1185 },
      { month: 'Apr 2026', kg: 1220 },
    ],
  },
};

export type ScreenName = 'dashboard' | 'penmap' | 'forecast' | 'feed' | 'upload' | 'croc' | 'analytics' | 'codes';

export const SCREEN_TITLES: Record<ScreenName, string> = {
  dashboard: 'Dashboard',
  penmap: 'Pen Map',
  forecast: 'Forecasting',
  feed: 'Feed Reports',
  upload: 'Data Upload',
  croc: 'Croc Profiles',
  analytics: 'Analytics',
  codes: 'Condition Codes',
};
