/** Pure helpers for the spreadsheet-style Data Entry sheet. */
export interface SheetRow {
  id: string;            // stable row id
  clientId: string;      // idempotency key sent on commit; renewed when the row is edited
  house: string;
  pen: string;
  tag: string;
  size: string;
  cull: string;
  comment: string;
  committed?: boolean;
  error?: string;
}

export const SHEET_COLUMNS = [
  { key: 'house', label: 'House', hint: 'GH1 / GH2' },
  { key: 'pen', label: 'Pen', hint: 'e.g. A12' },
  { key: 'tag', label: 'Tag', hint: 'Tag ID' },
  { key: 'size', label: 'Size (cm)', hint: 'e.g. 37' },
  { key: 'cull', label: 'Cull', hint: 'Nxt, 1, 2, R' },
  { key: 'comment', label: 'Comment (conditions)', hint: 'e.g. BS, TH or Cull' },
] as const;
export type SheetColumnKey = typeof SHEET_COLUMNS[number]['key'];

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
export const blankRow = (house = ''): SheetRow => ({ id: newId(), clientId: newId(), house, pen: '', tag: '', size: '', cull: '', comment: '' });

export function normaliseHouse(raw: string): string | null {
  const v = String(raw ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (v === 'GH1' || v === '1') return 'GH1';
  if (v === 'GH2' || v === '2') return 'GH2';
  return null;
}

/** "a12", " B 4 ", "c06" -> { line: 'A', pen: 12 } */
export function parsePen(raw: string): { line: string; pen: number } | null {
  const m = String(raw ?? '').trim().match(/^([a-nA-N])\s*-?\s*0*(\d{1,3})$/);
  if (!m) return null;
  const pen = parseInt(m[2], 10);
  if (!pen || pen > 200) return null;
  return { line: m[1].toUpperCase(), pen };
}

/** Nxt/next/nx -> NXT; 1/2 kept; R/rejected -> R; cull/culled -> CULLED; '' -> ''. null = invalid. */
export function parseCull(raw: string): string | null {
  const v = String(raw ?? '').trim().toUpperCase().replace(/\.$/, '');
  if (v === '') return '';
  if (['NX', 'NXT', 'NEXT'].includes(v)) return 'NXT';
  if (['1', '2'].includes(v)) return v;
  if (v === 'R' || v === 'REJ' || v === 'REJECT' || v === 'REJECTED') return 'R';
  if (v === 'CULL' || v === 'CULLED') return 'CULLED';
  return null;
}

/** Splits a comment like "bs, th / Cull" into known codes (matched case-insensitively). */
export function parseComment(raw: string, knownCodes: string[]): { codes: string[]; cull: boolean; unknown: string[] } {
  const byLower = new Map(knownCodes.map(c => [c.toLowerCase(), c]));
  const codes: string[] = []; const unknown: string[] = []; let cull = false;
  for (const part of String(raw ?? '').split(/[,;/\s+&]+/).map(s => s.trim()).filter(Boolean)) {
    const low = part.toLowerCase();
    if (low === 'cull' || low === 'culled') { cull = true; continue; }
    const code = byLower.get(low);
    if (code) { if (!codes.includes(code)) codes.push(code); } else unknown.push(part);
  }
  return { codes, cull, unknown };
}

/** "NT" = croc with no tag: give it a per-pen id so different untagged crocs never merge. */
export function noTagId(raw: string, house: string, line: string, pen: number): string {
  const t = String(raw ?? '').trim();
  return t.toUpperCase() === 'NT' ? `NT-${house}-${line}${pen}` : t;
}

export function isBlank(r: SheetRow) { return !r.pen.trim() && !r.tag.trim() && !r.size.trim() && !r.cull.trim() && !r.comment.trim(); }

export interface ValidRow { client_id: string; house: string; line: string; pen: number; tag: string; size_cm: number | null; cull: string; codes: string[] }

/** Validates one row; returns the cleaned entry or a readable error. */
export function validateRow(r: SheetRow, defaultHouse: string, knownCodes: string[]): { ok: true; value: ValidRow } | { ok: false; error: string } {
  const house = normaliseHouse(r.house || defaultHouse);
  if (!house) return { ok: false, error: 'House must be GH1 or GH2' };
  const pen = parsePen(r.pen);
  if (!pen) return { ok: false, error: 'Pen must look like A12 (line A–N + number)' };
  const tag = noTagId(r.tag, house, pen.line, pen.pen);
  if (!tag) return { ok: false, error: 'Tag is required (use NT if the croc has no tag)' };
  let size_cm: number | null = null;
  if (r.size.trim()) {
    const n = parseFloat(r.size.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n) || n < 5 || n > 300) return { ok: false, error: 'Size must be a number in cm' };
    size_cm = n;
  }
  let cull = parseCull(r.cull);
  if (cull === null) return { ok: false, error: 'Cull must be Nxt, 1, 2, R or Cull' };
  const c = parseComment(r.comment, knownCodes);
  if (c.unknown.length) return { ok: false, error: `Unknown condition: ${c.unknown.join(', ')}` };
  if (c.cull) cull = 'CULLED';
  return { ok: true, value: { client_id: r.clientId, house, line: pen.line, pen: pen.pen, tag, size_cm, cull, codes: c.codes } };
}

const ALIASES: Record<SheetColumnKey | 'date', string[]> = {
  house: ['house', 'gh', 'greenhouse', 'penid'],
  pen: ['pen', 'penslot', 'slot', 'location'],
  tag: ['tag', 'tagid', 'id'],
  size: ['size', 'sizecm', 'cm', 'belly', 'bellycm'],
  cull: ['cull', 'cullschedule'],
  comment: ['comment', 'comments', 'condition', 'conditions', 'commentconditions', 'codes', 'notes'],
  date: ['date', 'inspectiondate'],
};
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/** Reads a 2D array (from an Excel sheet) into rows; finds the header row by names. */
export function rowsFromGrid(grid: unknown[][]): { rows: SheetRow[]; date: unknown } {
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const keys = (grid[i] ?? []).map(norm);
    const col: Partial<Record<string, number>> = {};
    for (const [field, names] of Object.entries(ALIASES)) {
      const idx = keys.findIndex(k => names.includes(k));
      if (idx >= 0) col[field] = idx;
    }
    if (col.pen === undefined || col.tag === undefined) continue;
    const rows: SheetRow[] = []; let date: unknown = null;
    for (const line of grid.slice(i + 1)) {
      const get = (f: string) => (col[f] === undefined ? '' : String(line?.[col[f]!] ?? '').trim());
      const r = { ...blankRow(), house: get('house'), pen: get('pen'), tag: get('tag'), size: get('size'), cull: get('cull'), comment: get('comment') };
      if (isBlank(r)) continue;
      if (!date && col.date !== undefined && line?.[col.date] != null && line[col.date] !== '') date = line[col.date];
      rows.push(r);
    }
    return { rows, date };
  }
  throw new Error('No header row found. Columns needed: Pen and Tag (plus House, Size, Cull, Comment).');
}
