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

/** Try to extract a pen_id like "GH1" / "GH2" from the file name. Defaults to "GH1". */
function inferPenIdFromFilename(filename: string): string {
  const m = filename.toUpperCase().match(/GH\s*([0-9]+)/);
  if (m) return `GH${m[1]}`;
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

async function readSheet(file: File): Promise<any[][]> {
  if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][];
  }
  const text = await file.text();
  const result = Papa.parse(text, { header: false, skipEmptyLines: false });
  return result.data as any[][];
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

const FIXED_GRID_LAYOUTS = [
  { headerRows: [1, 59, 117, 175], startCols: [1, 6, 11, 16] }, // Pen/Cm/Gr/Tag at B2/G2/L2/Q2, etc.
  { headerRows: [3, 61, 119, 177], startCols: [1, 6, 11, 16] }, // line name + date above the column headers
  { headerRows: [2, 60, 118, 176], startCols: [1, 6, 11, 16] }, // date immediately above row-3 style templates
  { headerRows: [0, 58, 116, 174], startCols: [1, 6, 11, 16] }, // trimmed top margin
  { headerRows: [1, 59, 117, 175], startCols: [0, 5, 10, 15] }, // trimmed left margin
  { headerRows: [3, 61, 119, 177], startCols: [0, 5, 10, 15] },
  { headerRows: [2, 60, 118, 176], startCols: [0, 5, 10, 15] },
  { headerRows: [0, 58, 116, 174], startCols: [0, 5, 10, 15] },
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
 * Parses the client XLSX template with fixed 4-column blocks:
 * B:E, G:J, L:O, Q:T, with each block containing Pen/Cm/Gr/Tag headers
 * and then 54 data rows.
 */
function parseFixedGridLayout(rows: any[][], penId: string, headerRows: number[], startCols: number[]): { rows: ParsedInspectionRow[]; warnings: string[]; maxDate: string | null } {
  const out: ParsedInspectionRow[] = [];
  const warnings: string[] = [];
  let maxDate: string | null = null;

  for (let rowGroup = 0; rowGroup < headerRows.length; rowGroup++) {
    const headerRow = headerRows[rowGroup];

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
  const attempts = FIXED_GRID_LAYOUTS.map(layout => parseFixedGridLayout(rows, penId, layout.lineRows, layout.startCols));
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
 * Auto-detects the file layout:
 *   - "grid"  → multi-block GH1 style (Pen letters across columns × 54 slots down)
 *   - "flat"  → original CSV with one row per croc (Pen, ID, size, …)
 */
export async function parseInspectionFile(file: File): Promise<ParsedInspectionFile> {
  const allRows = await readSheet(file);
  const penId = inferPenIdFromFilename(file.name);

  if (looksLikeGrid(allRows)) {
    const { rows, warnings, maxDate } = parseGrid(allRows, penId);
    const inspectionDate = maxDate ?? new Date().toISOString().slice(0, 10);
    if (rows.length === 0) warnings.push('Grid layout detected but no data rows parsed');
    return { inspectionDate, rows, warnings };
  }

  return parseFlat(allRows, penId);
}
