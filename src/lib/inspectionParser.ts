import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedInspectionRow {
  pen: string;          // greenhouse / pen_id (e.g. "GH1")
  line: string;         // line letter within the pen (e.g. "A".."L")
  pen_slot: number;     // 1..54
  tag: string;
  belly_cm: number | null;
  conditions: string[];
  last_inspected: string;
  cull: string;
  grade: number | null;
  /** Inspection date for this specific row (block-level in grid format) */
  inspection_date: string;
  /** 1-based source row number for error reporting */
  csvRow: number;
}

export interface ParsedInspectionFile {
  /** File-level inspection date (max of per-row dates, or today) */
  inspectionDate: string;
  rows: ParsedInspectionRow[];
  warnings: string[];
}

/** Normalise cull field to standard codes: 1, NXT, 2, 3, 4 or empty */
export function normaliseCull(raw: string): string {
  const v = raw.trim().toUpperCase();
  if (v === 'NXT' || v === 'NEXT') return 'NXT';
  if (['1', '2', '3', '4'].includes(v)) return v;
  if (v === '') return '';
  return v;
}

/** Build the CULL-x condition code tag from cull field */
export function cullToConditionCode(cull: string): string | null {
  const n = normaliseCull(cull);
  if (!n) return null;
  return `CULL-${n}`;
}

function findPenIdInFilename(filename: string): string | null {
  const m = filename.toUpperCase().match(/GH\s*([0-9]+)/);
  if (m) return `GH${m[1]}`;
  return null;
}

/** Try to extract a pen_id like "GH1" / "GH2" from the file name. Defaults to "GH1". */
function inferPenIdFromFilename(filename: string): string {
  const inferred = findPenIdInFilename(filename);
  if (inferred) return inferred;
  return 'GH1';
}

function toIsoDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  const m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

async function readSheets(file: File): Promise<{ name: string; rows: any[][] }[]> {
  if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    return wb.SheetNames.map(name => ({
      name,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[name], {
        header: 1,
        raw: true,
        defval: '',
        blankrows: true,
        range: 0,
      }) as any[][],
    }));
  }
  const text = await file.text();
  const result = Papa.parse(text, { header: false, skipEmptyLines: false });
  return [{ name: file.name, rows: result.data as any[][] }];
}

/**
 * Detects whether the sheet uses the new "grid" layout:
 *   - One or more "block headers" — a row containing single-letter cells (A, B, C…)
 *   - Followed by a date row
 *   - Followed by a header row containing "Pen" and one of "Tag" / "Cm" / "Size"
 *   - Followed by ~54 data rows where col A of each sub-block is e.g. "A1".."A54"
 */
function looksLikeGrid(rows: any[][]): boolean {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] ?? [];
    let letterCount = 0;
    for (const cell of row) {
      const s = String(cell ?? '').trim();
      if (/^[A-Z]\d*$/i.test(s)) letterCount++;
    }
    if (letterCount >= 2) return true;
  }
  return false;
}

/** Block-header cell may be just a letter ("A") or letter+digits ("M1"). */
const BLOCK_LETTER_RE = /^([A-Z])\d*$/i;

// Approximate anchor rows for each of the 4 row-groups; we search a small window around each.
const FIXED_GRID_ANCHORS = [1, 59, 117, 175];
const FIXED_GRID_START_COL_SETS = [
  [1, 6, 11, 16], // standard B/G/L/Q
  [0, 5, 10, 15], // trimmed left margin
];
const FIXED_GRID_LINES = 'ABCDEFGHIJKLMN'.split('');

function parseNumber(v: any): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function parseInteger(v: any): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

const PEN_SLOT_RE = /^([A-Z])\s*(\d+)$/i;

function normaliseHeader(v: any): string {
  return String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPlausibleBelly(v: any): boolean {
  const n = parseNumber(v);
  return n !== null && n >= 10 && n <= 80;
}

function parseSequentialBlocks(rows: any[][], penId: string, mode: 'GH1' | 'GH2'): { rows: ParsedInspectionRow[]; warnings: string[]; maxDate: string | null } {
  const out: ParsedInspectionRow[] = [];
  const warnings: string[] = [];
  let maxDate: string | null = null;
  const maxRows = mode === 'GH2' ? 56 : 80;

  const inferGH1Cols = (startRow: number, penCol: number) => {
    const header = rows[startRow - 1] ?? [];
    const cols = Array.from({ length: 6 }, (_, i) => penCol + 1 + i);
    let tagCol = -1, sizeCol = -1, gradeCol = -1;

    for (const col of [penCol, ...cols]) {
      const h = normaliseHeader(header[col]);
      if (['tag', 'id', 'tagid'].includes(h)) tagCol = col;
      if (['cm', 'size', 'bellycm', 'measurement', 'measure'].includes(h)) sizeCol = col;
      if (['gr', 'grade', 'grading', 'rating'].includes(h)) gradeCol = col;
    }

    if (sizeCol < 0) {
      sizeCol = cols
        .map(col => ({ col, score: rows.slice(startRow, startRow + 12).filter(r => isPlausibleBelly(r?.[col])).length }))
        .sort((a, b) => b.score - a.score)[0]?.col ?? penCol + 2;
    }
    if (gradeCol < 0) {
      gradeCol = cols
        .filter(col => col !== sizeCol)
        .map(col => ({ col, score: rows.slice(startRow, startRow + 12).filter(r => { const n = parseInteger(r?.[col]); return n !== null && n >= 0 && n <= 5; }).length }))
        .sort((a, b) => b.score - a.score)[0]?.col ?? -1;
    }
    if (tagCol < 0) {
      tagCol = cols.find(col => col !== sizeCol && col !== gradeCol && rows.slice(startRow, startRow + 12).some(r => String(r?.[col] ?? '').trim() !== '')) ?? penCol + 1;
    }

    return { tagCol, sizeCol, gradeCol, codeCol: -1 };
  };

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const first = String(row[c] ?? '').trim().match(PEN_SLOT_RE);
      if (!first || String(row[c + 1] ?? '').trim() === '') continue;
      if (String(rows[r - 1]?.[c] ?? '').trim().match(PEN_SLOT_RE)) continue;

      const cols = mode === 'GH2'
        ? { tagCol: c + 1, sizeCol: c + 7, gradeCol: c + 4, codeCol: c + 8 }
        : inferGH1Cols(r, c);
      const parsedBlock: ParsedInspectionRow[] = [];
      const inspection_date = findDateNearBlock(rows, r - 1, c) ?? new Date().toISOString().slice(0, 10);

      for (let i = 0; i < maxRows; i++) {
        const rowIndex = r + i;
        const drow = rows[rowIndex] ?? [];
        const m = String(drow[c] ?? '').trim().match(PEN_SLOT_RE);
        if (!m) break;
        const tag = String(drow[cols.tagCol] ?? '').trim();
        if (!tag) continue;
        const codeRaw = cols.codeCol >= 0 ? drow[cols.codeCol] : '';
        parsedBlock.push({
          pen: penId,
          line: m[1].toUpperCase(),
          pen_slot: parseInt(m[2], 10),
          tag,
          belly_cm: parseNumber(drow[cols.sizeCol]),
          conditions: codeRaw == null || codeRaw === '' ? [] : String(codeRaw).split(/[,;]+/).map(s => s.trim()).filter(Boolean),
          last_inspected: '',
          cull: '',
          grade: cols.gradeCol >= 0 ? parseInteger(drow[cols.gradeCol]) : null,
          inspection_date,
          csvRow: rowIndex + 1,
        });
      }

      if (parsedBlock.length >= 2 || (parsedBlock.length === 1 && mode === 'GH1')) {
        out.push(...parsedBlock);
        if (!maxDate || inspection_date > maxDate) maxDate = inspection_date;
      }
    }
  }

  if (out.length === 0) warnings.push(`${mode} sequential block scan found no Pen/Tag data rows`);
  return { rows: out, warnings, maxDate };
}

function findDateNearBlock(rows: any[][], headerRow: number, startCol: number): string | null {
  for (let r = Math.max(0, headerRow - 3); r < headerRow; r++) {
    for (let c = startCol; c < startCol + 4; c++) {
      const iso = toIsoDate(rows[r]?.[c]);
      if (iso) return iso;
    }
  }
  return null;
}

function findLineNearBlock(rows: any[][], headerRow: number, startCol: number, fallback: string): string {
  for (let r = Math.max(0, headerRow - 3); r < headerRow; r++) {
    for (let c = startCol; c < startCol + 4; c++) {
      const m = String(rows[r]?.[c] ?? '').trim().match(BLOCK_LETTER_RE);
      if (m) return m[1].toUpperCase();
    }
  }
  return fallback;
}

/**
 * Within a search window of rows around `anchor`, find a row whose cells at
 * the given startCols match the Pen/Cm/Gr/Tag header pattern. Returns the
 * row index, or -1.
 */
function findHeaderRow(rows: any[][], anchor: number, startCols: number[]): number {
  for (let delta = 0; delta <= 6; delta++) {
    for (const sign of [0, 1, -1]) {
      if (delta === 0 && sign !== 0) continue;
      const r = anchor + sign * delta;
      if (r < 0 || r >= rows.length) continue;
      const row = rows[r] ?? [];
      // Need at least one block at this row to have pen+tag+cm headers
      let blocksMatched = 0;
      for (const start of startCols) {
        const cells = [0, 1, 2, 3].map(o => String(row[start + o] ?? '').trim().toLowerCase());
        const hasPen = cells.includes('pen');
        const hasTag = cells.some(h => h === 'tag' || h === 'id' || h === 'tag_id');
        const hasSize = cells.some(h => h === 'cm' || h === 'size' || h === 'belly_cm');
        if (hasPen && hasTag && hasSize) blocksMatched++;
      }
      if (blocksMatched >= 1) return r;
    }
  }
  return -1;
}

function parseFixedGridLayout(rows: any[][], penId: string, startCols: number[]): { rows: ParsedInspectionRow[]; warnings: string[]; maxDate: string | null } {
  const out: ParsedInspectionRow[] = [];
  const warnings: string[] = [];
  let maxDate: string | null = null;

  for (let rowGroup = 0; rowGroup < FIXED_GRID_ANCHORS.length; rowGroup++) {
    const anchor = FIXED_GRID_ANCHORS[rowGroup];
    const headerRow = findHeaderRow(rows, anchor, startCols);
    if (headerRow < 0) continue;

    for (let colGroup = 0; colGroup < startCols.length; colGroup++) {
      const start = startCols[colGroup];
      const blockIndex = rowGroup * 4 + colGroup;
      const fallbackLine = FIXED_GRID_LINES[blockIndex];
      if (!fallbackLine) break;

      const header = rows[headerRow] ?? [];
      const cells = [0, 1, 2, 3].map(offset => String(header[start + offset] ?? '').trim().toLowerCase());
      const hasAnyHeader = cells.some(Boolean);
      if (!hasAnyHeader) continue;

      const penOffset = cells.indexOf('pen');
      const sizeOffset = cells.findIndex(h => h === 'cm' || h === 'size' || h === 'belly_cm');
      const gradeOffset = cells.findIndex(h => h === 'gr' || h === 'grade' || h === 'rating');
      const tagOffset = cells.findIndex(h => h === 'tag' || h === 'id' || h === 'tag_id');

      if (penOffset < 0 || sizeOffset < 0 || tagOffset < 0) continue;

      const line = fallbackLine;
      const inspection_date = findDateNearBlock(rows, headerRow, start) ?? new Date().toISOString().slice(0, 10);
      if (!maxDate || inspection_date > maxDate) maxDate = inspection_date;

      for (let i = 0; i < 54; i++) {
        const rowIndex = headerRow + 1 + i;
        const drow = rows[rowIndex] ?? [];
        const tagRaw = drow[start + tagOffset];
        const tag = tagRaw == null ? '' : String(tagRaw).trim();
        if (!tag) continue;

        const penCell = String(drow[start + penOffset] ?? '').trim();
        const slotMatch = penCell.match(/^([A-Z])\s*(\d+)$/i);
        const slot = slotMatch ? parseInt(slotMatch[2], 10) : i + 1;

        out.push({
          pen: penId,
          line,
          pen_slot: slot,
          tag,
          belly_cm: parseNumber(drow[start + sizeOffset]),
          conditions: [],
          last_inspected: '',
          cull: '',
          grade: gradeOffset >= 0 ? parseInteger(drow[start + gradeOffset]) : null,
          inspection_date,
          csvRow: rowIndex + 1,
        });
      }
    }
  }

  if (out.length > 0 && out.length < 700) {
    warnings.push(`Fixed grid parsed ${out.length} records; expected close to 750. Check for blank Tag cells in the source file.`);
  }

  return { rows: out, warnings, maxDate };
}

function parseFixedGrid(rows: any[][], penId: string): { rows: ParsedInspectionRow[]; warnings: string[]; maxDate: string | null } {
  const attempts = [
    ...FIXED_GRID_START_COL_SETS.map(startCols => parseFixedGridLayout(rows, penId, startCols)),
    parseSequentialBlocks(rows, penId, 'GH1'),
  ];
  return attempts.sort((a, b) => b.rows.length - a.rows.length)[0];
}

function parseGrid(rows: any[][], penId: string): { rows: ParsedInspectionRow[]; warnings: string[]; maxDate: string | null } {
  const fixed = parseFixedGrid(rows, penId);
  if (fixed.rows.length > 0) return fixed;

  const out: ParsedInspectionRow[] = [];
  const warnings: string[] = [];
  let maxDate: string | null = null;

  // Find every "block header" row — a row with multiple single-letter cells.
  // Then within each block, locate sub-blocks by their column index.
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    // Identify columns whose value is a single uppercase letter
    const letterCols: { col: number; letter: string }[] = [];
    for (let c = 0; c < row.length; c++) {
      const s = String(row[c] ?? '').trim();
      const m = s.match(BLOCK_LETTER_RE);
      if (m) letterCols.push({ col: c, letter: m[1].toUpperCase() });
    }
    if (letterCols.length < 2) continue;

    // Expect: r = letters, r+1 = dates, r+2 = headers, r+3.. = data
    const dateRow = rows[r + 1] ?? [];
    const headerRow = rows[r + 2] ?? [];

    // Verify header row contains "Pen"
    const hasPen = headerRow.some(c => String(c ?? '').trim().toLowerCase() === 'pen');
    if (!hasPen) continue;

    // For each sub-block, work out which column holds which field
    type Sub = {
      letter: string;
      penCol: number;
      tagCol: number;
      sizeCol: number;
      gradeCol: number;
      date: string | null;
    };
    const subs: Sub[] = [];

    for (let i = 0; i < letterCols.length; i++) {
      const start = letterCols[i].col;
      const end = i + 1 < letterCols.length ? letterCols[i + 1].col : row.length;

      let penCol = -1, tagCol = -1, sizeCol = -1, gradeCol = -1;
      for (let c = start; c < end; c++) {
        const h = String(headerRow[c] ?? '').trim().toLowerCase();
        if (h === 'pen') penCol = c;
        else if (h === 'tag' || h === 'id') tagCol = c;
        else if (h === 'cm' || h === 'size' || h === 'belly_cm') sizeCol = c;
        else if (h === 'gr' || h === 'grade' || h === 'rating') gradeCol = c;
      }
      if (penCol < 0 || tagCol < 0 || sizeCol < 0) continue;

      subs.push({
        letter: letterCols[i].letter,
        penCol, tagCol, sizeCol, gradeCol,
        date: toIsoDate(dateRow[start]),
      });
    }

    if (subs.length === 0) continue;

    // Walk data rows until we see a blank pen cell across ALL sub-blocks
    for (let dr = r + 3; dr < rows.length; dr++) {
      const drow = rows[dr] ?? [];
      const allBlank = subs.every(s => {
        const v = String(drow[s.penCol] ?? '').trim();
        return v === '';
      });
      if (allBlank) break;

      for (const s of subs) {
        const penCell = String(drow[s.penCol] ?? '').trim();
        if (!penCell) continue;
        // Expect e.g. "A1".."A54" — slot is the trailing digits
        const m = penCell.match(/^([A-Z])\s*(\d+)$/i);
        if (!m) continue;
        const slot = parseInt(m[2], 10);
        if (!slot) continue;

        const tagRaw = drow[s.tagCol];
        const tag = tagRaw == null ? '' : String(tagRaw).trim();
        if (!tag) continue;

        const sizeRaw = drow[s.sizeCol];
        const belly_cm = sizeRaw == null || sizeRaw === '' ? null : (typeof sizeRaw === 'number' ? sizeRaw : parseFloat(String(sizeRaw))) || null;

        const gradeRaw = s.gradeCol >= 0 ? drow[s.gradeCol] : null;
        const grade = gradeRaw == null || gradeRaw === '' ? null : (typeof gradeRaw === 'number' ? gradeRaw : parseInt(String(gradeRaw), 10)) || null;

        const inspection_date = s.date ?? new Date().toISOString().slice(0, 10);
        if (!maxDate || inspection_date > maxDate) maxDate = inspection_date;

        out.push({
          pen: penId,
          line: s.letter,
          pen_slot: slot,
          tag,
          belly_cm,
          conditions: [],
          last_inspected: '',
          cull: '',
          grade,
          inspection_date,
          csvRow: dr + 1,
        });
      }
    }

    // Skip past this block — jump roughly past 54 data rows
    r = r + 3 + 54;
  }

  return { rows: out, warnings, maxDate };
}

function parseFlat(rows: any[][], penIdFallback: string): ParsedInspectionFile {
  const warnings: string[] = [];

  // Row 1: extract inspection date
  let inspectionDate = new Date().toISOString().slice(0, 10);
  if (rows.length > 0) {
    for (const cell of rows[0]) {
      const iso = toIsoDate(cell);
      if (iso) { inspectionDate = iso; break; }
    }
  }

  // Find header row (contains "Pen" and "ID")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] ?? []).map(c => String(c ?? '').trim().toLowerCase());
    if (cells.includes('pen') && cells.includes('id')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) {
    warnings.push('Could not find header row with "Pen" and "ID" columns');
    return { inspectionDate, rows: [], warnings };
  }

  const headers = (rows[headerIdx] ?? []).map(c => String(c ?? '').trim().toLowerCase());
  const col = (name: string, alts: string[] = []): number => {
    for (const k of [name, ...alts]) {
      const idx = headers.indexOf(k.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const penCol = col('pen');
  const idCol = col('id', ['tag', 'tag_id']);
  const sizeCol = col('size', ['belly_cm', 'size_cm', 'cm']);
  const condCol = col('condition', ['conditions', 'condition_codes', 'defect']);
  const lastCol = col('last inspected', ['last_inspected', 'prev_date']);
  const cullCol = col('cull', ['cull_schedule']);
  const ratingCol = col('rating', ['grade', 'gr']);
  if (idCol === -1) warnings.push('Missing "ID" column — cannot match records');
  if (penCol === -1) warnings.push('Missing "Pen" column');

  const out: ParsedInspectionRow[] = [];
  const dataRows = rows.slice(headerIdx + 1);
  for (let di = 0; di < dataRows.length; di++) {
    const cells = (dataRows[di] ?? []).map(c => String(c ?? '').trim());
    const tag = idCol >= 0 ? cells[idCol] : '';
    if (!tag) continue;
    const rawCond = condCol >= 0 ? cells[condCol] : '';
    const conditions = rawCond ? rawCond.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];
    const penRaw = penCol >= 0 ? cells[penCol] : '';
    // Try to split pen into line+slot if it looks like "A12"
    const m = penRaw.match(/^([A-Z])\s*(\d+)$/i);
    const line = m ? m[1].toUpperCase() : '';
    const pen_slot = m ? parseInt(m[2], 10) : 0;
    out.push({
      pen: m ? penIdFallback : (penRaw || penIdFallback),
      line,
      pen_slot,
      tag,
      belly_cm: sizeCol >= 0 ? (parseFloat(cells[sizeCol]) || null) : null,
      conditions,
      last_inspected: lastCol >= 0 ? cells[lastCol] : '',
      cull: cullCol >= 0 ? cells[cullCol] : '',
      grade: ratingCol >= 0 ? (parseInt(cells[ratingCol]) || null) : null,
      inspection_date: inspectionDate,
      csvRow: headerIdx + 2 + di,
    });
  }
  if (out.length === 0) warnings.push('No data rows found after headers');
  return { inspectionDate, rows: out, warnings };
}

/**
 * GH2 layout:
 *   Repeating rectangular blocks, 9 columns wide × 57 rows tall (1 header + 56 data rows).
 *   Header row: Pen | Tag | <date measurement cols...> | Gr | Grow | <date measurement cols...> | Code
 *   We only use: Pen (col+0), Tag (col+1), Gr (col+4), latest belly (col+7, second-to-last), Code (col+8).
 *   Pen cell contains line letter + slot (e.g. "B1".."B56"). Blocks are auto-detected
 *   by scanning every cell for the header pattern, so the file can grow or shrink.
 */
function parseGH2Grid(rows: any[][], penId: string): { rows: ParsedInspectionRow[]; warnings: string[]; maxDate: string | null } {
  const out: ParsedInspectionRow[] = [];
  const warnings: string[] = [];
  const inspection_date = new Date().toISOString().slice(0, 10);
  const knownOrigins = [
    'A4', 'N4', 'A64', 'N64', 'A125', 'N125', 'A188', 'N188', 'A249', 'N249',
    'A312', 'N312', 'A369', 'A441', 'N441', 'A503', 'N503', 'A563', 'N563',
    'A624', 'N624', 'A685', 'N685', 'A747', 'N747', 'A809', 'N809', 'A877', 'N877',
  ].map(ref => {
    const m = ref.match(/^([A-Z]+)(\d+)$/)!;
    const col = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    return `${Number(m[2]) - 1}:${col}`;
  });
  const knownOriginSet = new Set(knownOrigins);
  const isLikelyOrigin = (r: number, c: number): boolean => {
    const firstPen = String(rows[r + 1]?.[c] ?? '').trim();
    const firstTag = String(rows[r + 1]?.[c + 1] ?? '').trim();
    const secondPen = String(rows[r + 2]?.[c] ?? '').trim();
    return /^[A-Z]\s*\d+$/i.test(firstPen) && firstTag !== '' && /^[A-Z]\s*\d+$/i.test(secondPen);
  };

  const isHeader = (row: any[], c: number): boolean => {
    if (!row) return false;
    const get = (off: number) => String(row[c + off] ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const matches = (value: string, prefixes: string[]) => prefixes.some(prefix => value === prefix || value.startsWith(prefix));
    return (
      matches(get(0), ['pen']) &&
      matches(get(1), ['tag', 'tags', 'id', 'tagid']) &&
      matches(get(4), ['gr', 'grade', 'grading', 'rating']) &&
      matches(get(5), ['grow', 'growth']) &&
      matches(get(8), ['code', 'codes', 'injurycode', 'condition', 'conditions'])
    );
  };

  let blocks = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const len = row.length ?? 0;
    for (let c = 0; c < len; c++) {
      const isKnownOrigin = knownOriginSet.has(`${r}:${c}`) && isLikelyOrigin(r, c);
      if (!isHeader(row, c) && !isKnownOrigin) continue;
      blocks++;

      const penCol = c;
      const tagCol = c + 1;
      const gradeCol = c + 4;
      const bellyCol = c + 7;
      const codeCol = c + 8;

      for (let i = 1; i <= 56; i++) {
        const dr = rows[r + i];
        if (!dr) break;
        const penCell = String(dr[penCol] ?? '').trim();
        if (!penCell) continue;
        const m = penCell.match(/^([A-Z])\s*(\d+)$/i);
        if (!m) continue;
        const line = m[1].toUpperCase();
        const slot = parseInt(m[2], 10);
        if (!slot) continue;

        const tagRaw = dr[tagCol];
        const tag = tagRaw == null ? '' : String(tagRaw).trim();
        if (!tag) continue;

        const codeRaw = dr[codeCol];
        const conditions = codeRaw == null || codeRaw === ''
          ? []
          : String(codeRaw).split(/[,;]+/).map(s => s.trim()).filter(Boolean);

        out.push({
          pen: penId,
          line,
          pen_slot: slot,
          tag,
          belly_cm: parseNumber(dr[bellyCol]),
          conditions,
          last_inspected: '',
          cull: '',
          grade: parseInteger(dr[gradeCol]),
          inspection_date,
          csvRow: r + i + 1,
        });
      }
    }
  }

  if (blocks === 0) warnings.push('GH2 layout: no Pen/Tag/Gr/Grow/Code header blocks found');
  else if (out.length < blocks * 40) warnings.push(`GH2 layout: parsed ${out.length} rows from ${blocks} blocks (expected ~${blocks * 56})`);
  return { rows: out, warnings, maxDate: inspection_date };
}

/**
 * Auto-detects the file layout:
 *   - "GH2"   → repeating 9-col blocks with Pen/Tag/Gr/Grow/Code headers
 *   - "grid"  → multi-block GH1 style (Pen letters across columns × 54 slots down)
 *   - "flat"  → original CSV with one row per croc (Pen, ID, size, …)
 */
export async function parseInspectionFile(file: File): Promise<ParsedInspectionFile> {
  const sheets = await readSheets(file);
  const filenamePenId = findPenIdInFilename(file.name);
  const penId = inferPenIdFromFilename(file.name);
  const warnings: string[] = [];

  const parseGridSheets = () => {
    const attempts = sheets.map(sheet => ({ sheet: sheet.name, ...parseGrid(sheet.rows, penId) }));
    return attempts.sort((a, b) => b.rows.length - a.rows.length)[0];
  };

  const parseGH2Sheets = () => {
    const attempts = sheets.map(sheet => ({ sheet: sheet.name, ...parseGH2Grid(sheet.rows, filenamePenId ?? 'GH2') }));
    return attempts.sort((a, b) => b.rows.length - a.rows.length)[0];
  };

  const preferGH2 = filenamePenId === 'GH2';
  const first = preferGH2 ? parseGH2Sheets() : parseGridSheets();
  if (first.rows.length > 0) {
    return {
      inspectionDate: first.maxDate ?? new Date().toISOString().slice(0, 10),
      rows: first.rows,
      warnings: first.warnings,
    };
  }

  const gh2 = preferGH2 ? first : parseGH2Sheets();
  if (gh2.rows.length > 0) {
    return {
      inspectionDate: gh2.maxDate ?? new Date().toISOString().slice(0, 10),
      rows: gh2.rows,
      warnings: gh2.warnings,
    };
  }

  const grid = preferGH2 ? parseGridSheets() : first;
  if (grid.rows.length > 0) {
    return {
      inspectionDate: grid.maxDate ?? new Date().toISOString().slice(0, 10),
      rows: grid.rows,
      warnings: grid.warnings,
    };
  }

  if (sheets.some(sheet => looksLikeGrid(sheet.rows))) {
    const inspectionDate = grid.maxDate ?? new Date().toISOString().slice(0, 10);
    grid.warnings.push('Grid layout detected but no data rows parsed');
    return { inspectionDate, rows: grid.rows, warnings: grid.warnings };
  }

  for (const sheet of sheets) warnings.push(...parseFlat(sheet.rows, penId).warnings);
  const flatAttempts = sheets.map(sheet => parseFlat(sheet.rows, penId)).sort((a, b) => b.rows.length - a.rows.length);
  const flat = flatAttempts[0];
  return flat.rows.length > 0 ? flat : { ...flat, warnings: [...new Set(warnings)] };
}
