import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedInspectionRow {
  pen: string;
  tag: string;
  belly_cm: number | null;
  conditions: string[];
  last_inspected: string;
  cull: string;
  grade: number | null;
  /** 1-based CSV row number for error reporting */
  csvRow: number;
}

export interface ParsedInspectionFile {
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
  return v; // keep unknown values as-is
}

/** Build the CULL-x condition code tag from cull field */
export function cullToConditionCode(cull: string): string | null {
  const n = normaliseCull(cull);
  if (!n) return null;
  return `CULL-${n}`;
}

/**
 * Parse the farm inspection CSV/XLSX format:
 *   Row 1: "Inspection date, 2026/04/15"
 *   Row 2: empty
 *   Row 3: Headers — Pen, ID, size, Condition, Last inspected, Cull, Rating
 *   Row 4+: Data
 */
export async function parseInspectionFile(file: File): Promise<ParsedInspectionFile> {
  const warnings: string[] = [];
  let allRows: string[][] = [];

  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
  } else {
    const text = await file.text();
    const result = Papa.parse(text, { header: false, skipEmptyLines: false });
    allRows = result.data as string[][];
  }

  // Row 1: extract inspection date
  let inspectionDate = new Date().toISOString().slice(0, 10);
  if (allRows.length > 0) {
    const row0 = allRows[0];
    // Look for date in second cell or anywhere in first row
    for (const cell of row0) {
      const s = String(cell ?? '').trim();
      // Match YYYY/MM/DD or YYYY-MM-DD
      const m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (m) {
        inspectionDate = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        break;
      }
    }
  }

  // Find header row (contains "Pen" and "ID")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const cells = allRows[i].map(c => String(c ?? '').trim().toLowerCase());
    if (cells.includes('pen') && cells.includes('id')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    warnings.push('Could not find header row with "Pen" and "ID" columns');
    return { inspectionDate, rows: [], warnings };
  }

  const headers = allRows[headerIdx].map(c => String(c ?? '').trim().toLowerCase());
  const col = (name: string, alts: string[] = []): number => {
    const keys = [name, ...alts];
    for (const k of keys) {
      const idx = headers.indexOf(k.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const penCol = col('pen');
  const idCol = col('id', ['tag', 'tag_id']);
  const sizeCol = col('size', ['belly_cm', 'size_cm']);
  const condCol = col('condition', ['conditions', 'condition_codes', 'defect']);
  const lastCol = col('last inspected', ['last_inspected', 'prev_date']);
  const cullCol = col('cull', ['cull_schedule']);
  const ratingCol = col('rating', ['grade', 'gr']);

  if (idCol === -1) warnings.push('Missing "ID" column — cannot match records');
  if (penCol === -1) warnings.push('Missing "Pen" column');

  const dataRows = allRows.slice(headerIdx + 1);
  const rows: ParsedInspectionRow[] = [];

  for (let di = 0; di < dataRows.length; di++) {
    const r = dataRows[di];
    const cells = r.map(c => String(c ?? '').trim());
    const tag = idCol >= 0 ? cells[idCol] : '';
    if (!tag) continue; // skip empty rows

    // Parse conditions: split by comma, semicolon, or space-separated codes
    const rawCond = condCol >= 0 ? cells[condCol] : '';
    const conditions = rawCond
      ? rawCond.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
      : [];

    rows.push({
      pen: penCol >= 0 ? cells[penCol] : '',
      tag,
      belly_cm: sizeCol >= 0 ? (parseFloat(cells[sizeCol]) || null) : null,
      conditions,
      last_inspected: lastCol >= 0 ? cells[lastCol] : '',
      cull: cullCol >= 0 ? cells[cullCol] : '',
      grade: ratingCol >= 0 ? (parseInt(cells[ratingCol]) || null) : null,
      csvRow: headerIdx + 2 + di, // 1-based CSV row number
    });
  }

  if (rows.length === 0) warnings.push('No data rows found after headers');

  return { inspectionDate, rows, warnings };
}
