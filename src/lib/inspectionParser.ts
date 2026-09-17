import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedInspectionRow {
  pen: string;          // House / pen_id (e.g. "GH1", "GH2")
  line: string;         // line letter within the pen (e.g. "A".."N")
  pen_slot: number;     // 1..N
  tag: string;
  belly_cm: number | null;
  conditions: string[];
  last_inspected: string;
  cull: string;
  inspection_date: string;
  /** 1-based source row number for error reporting */
  csvRow: number;
}

export interface ParsedInspectionFile {
  inspectionDate: string;
  rows: ParsedInspectionRow[];
  warnings: string[];
}

/** Normalise cull field to standard codes: NXT, 1, 2, 3 or empty */
export function normaliseCull(raw: string): string {
  const v = (raw ?? '').toString().trim().toUpperCase();
  if (v === 'CULL' || v === 'CULLED') return 'CULLED';
  if (v === 'NXT' || v === 'NEXT' || v === 'NX') return 'NXT';
  if (['1', '2', '3'].includes(v)) return v;
  if (v === '') return '';
  return '';
}

/** Build the CULL-x condition code tag from cull field */
export function cullToConditionCode(cull: string): string | null {
  const n = normaliseCull(cull);
  if (!n) return null;
  return `CULL-${n}`;
}

function normKey(v: any): string {
  return String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseNumber(v: any): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseInteger(v: any): number | null {
  const n = parseNumber(v);
  if (n === null) return null;
  return Math.trunc(n);
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function excelSerialToISO(n: number): string | null {
  if (!Number.isFinite(n) || n < 1 || n > 80000) return null;
  // Excel epoch (1899-12-30 to account for 1900 leap-year bug)
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toIsoDate(v: any): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number') return excelSerialToISO(v);
  const s = String(v).trim();
  const monthYear = s.match(/^([A-Za-z]{3,})[-\s](\d{2,4})$/);
  if (monthYear) {
    const mo = MONTHS[monthYear[1].slice(0, 3).toLowerCase()];
    const yr = monthYear[2].length === 2 ? `20${monthYear[2]}` : monthYear[2];
    if (mo) return `${yr}-${mo}-01`;
  }
  // Excel serial as string
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const iso = excelSerialToISO(parseFloat(s));
    if (iso) return iso;
  }
  // ISO / slash dates
  const m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  // DD/MM/YYYY or MM/DD/YYYY — assume DD/MM/YYYY (project locale)
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m2) {
    const yr = m2[3].length === 2 ? `20${m2[3]}` : m2[3];
    return `${yr}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  }
  // Try Date.parse fallback (e.g. "Mar-26", "26 Mar 2026")
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return null;
}

async function readSheets(file: File): Promise<{ name: string; rows: any[][] }[]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    return wb.SheetNames.map(name => ({
      name,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[name], {
        header: 1,
        raw: true,
        defval: '',
        blankrows: false,
      }) as any[][],
    }));
  }
  const text = await file.text();
  const result = Papa.parse(text, { header: false, skipEmptyLines: true });
  return [{ name: file.name, rows: result.data as any[][] }];
}

const HEADER_ALIASES: Record<string, string[]> = {
  house: ['house', 'pen_id', 'penid', 'greenhouse', 'gh'],
  pen: ['pen', 'penslot', 'slot', 'location'],
  tag: ['tag', 'id', 'tagid', 'tag_id'],
  size: ['size', 'cm', 'bellycm', 'belly', 'measurement', 'measure'],
  date: ['date', 'inspectiondate', 'inspected', 'lastinspected'],
  condition: ['condition', 'conditions', 'code', 'codes', 'defect', 'conditioncode'],
  cull: ['cull', 'cullschedule', 'cullcycle'],
};

/** Strict unified layout: House | Pen | Tag | Size | Date | Condition | Cull.
 *  Header row must match all 7 columns by alias to avoid latching onto legacy
 *  template sheets that happen to contain a "Pen"/"Tag" pair. */
function findHeaderRow(rows: any[][]): { idx: number; cols: Record<string, number> } | null {
  const positionalOrder = ['house', 'pen', 'tag', 'size', 'date', 'condition', 'cull'];
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const row = rows[i] ?? [];
    const keys = row.map(normKey);
    const matches = positionalOrder.every((field, pos) =>
      pos < keys.length && HEADER_ALIASES[field].includes(keys[pos])
    );
    if (matches) {
      return {
        idx: i,
        cols: Object.fromEntries(positionalOrder.map((field, pos) => [field, pos])),
      };
    }
  }
  return null;
}

function splitPenCell(raw: string): { line: string; slot: number } | null {
  const m = String(raw ?? '').trim().match(/^([A-Za-z])\s*(\d{1,3})$/);
  if (!m) return null;
  const slot = parseInt(m[2], 10);
  if (!slot) return null;
  return { line: m[1].toUpperCase(), slot };
}

/** Parse the unified flat layout: House | Pen | Tag | Size | Date | Condition | Cull */
export async function parseInspectionFile(file: File): Promise<ParsedInspectionFile> {
  const sheets = await readSheets(file);
  const warnings: string[] = [];
  const todayIso = new Date().toISOString().slice(0, 10);

  const all: ParsedInspectionRow[] = [];
  let maxDate: string | null = null;
  let parsedSheet = false;

  const seenRowKeys = new Set<string>();
  let duplicateRows = 0;
  let invalidHouse = 0;
  let invalidPen = 0;
  let parsedSheetName: string | null = null;

  for (const sheet of sheets) {
    const found = findHeaderRow(sheet.rows);
    if (!found) continue;
    // Only parse the first sheet that matches the strict unified header.
    // Prevents legacy template sheets in the same workbook from inflating counts.
    if (parsedSheet) {
      warnings.push(`Sheet "${sheet.name}" skipped — only the first unified data sheet ("${parsedSheetName}") is imported.`);
      continue;
    }
    parsedSheet = true;
    parsedSheetName = sheet.name;
    const { idx, cols } = found;

    for (let r = idx + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] ?? [];
      const tagRaw = row[cols.tag];
      const tag = tagRaw == null ? '' : String(tagRaw).trim();
      if (!tag) continue;

      const house = String(row[cols.house] ?? '').trim().toUpperCase();
      if (house !== 'GH1' && house !== 'GH2') {
        invalidHouse++;
        if (invalidHouse <= 5) {
          warnings.push(`Row ${r + 1}: invalid House "${row[cols.house]}" — must be GH1 or GH2`);
        }
        continue;
      }

      const penRaw = String(row[cols.pen] ?? '').trim();
      const ps = splitPenCell(penRaw);
      if (!ps) {
        invalidPen++;
        if (invalidPen <= 5) {
          warnings.push(`Row ${r + 1}: invalid Pen cell "${penRaw}" — expected e.g. "A1"`);
        }
        continue;
      }

      const inspISO = toIsoDate(row[cols.date]) ?? todayIso;
      if (!maxDate || inspISO > maxDate) maxDate = inspISO;

      let cullVal = String(row[cols.cull] ?? '').trim();
      const condRaw = row[cols.condition];
      const conditions: string[] = [];
      if (condRaw != null && condRaw !== '') {
        const parts = String(condRaw).split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        for (const p of parts) {
          if (/^cull$/i.test(p)) {
            if (!cullVal) cullVal = '1';
          } else {
            conditions.push(p);
          }
        }
      }

      // Dedupe by inspection identity: house + pen + tag + date
      const dedupeKey = `${house}|${ps.line}${ps.slot}|${tag}|${inspISO}`;
      if (seenRowKeys.has(dedupeKey)) {
        duplicateRows++;
        continue;
      }
      seenRowKeys.add(dedupeKey);

      all.push({
        pen: house,
        line: ps.line,
        pen_slot: ps.slot,
        tag,
        belly_cm: parseNumber(row[cols.size]),
        conditions,
        last_inspected: '',
        cull: normaliseCull(cullVal),
        inspection_date: inspISO,
        csvRow: r + 1,
      });
    }
  }

  if (invalidHouse > 5) warnings.push(`…and ${invalidHouse - 5} more rows with invalid House`);
  if (invalidPen > 5) warnings.push(`…and ${invalidPen - 5} more rows with invalid Pen`);
  if (duplicateRows > 0) warnings.push(`${duplicateRows} duplicate row(s) skipped (same House+Pen+Tag+Date)`);

  if (!parsedSheet) {
    warnings.push('Could not find header row. Expected columns: House, Pen, Tag, Size, Date, Condition, Cull');
  } else if (all.length === 0) {
    warnings.push('Header row found but no data rows parsed');
  }


  return {
    inspectionDate: maxDate ?? todayIso,
    rows: all,
    warnings,
  };
}
