import type { CrocRecord } from '@/hooks/useCrocs';
import type { CullRecord } from '@/hooks/useCullData';
import { countSizeBands, cullMarkerHorizon, isMarkedCull } from '@/lib/crocUtils';

export function summarizeLine(crocs: CrocRecord[]) {
  const horizons = [0, 0, 0];
  for (const croc of crocs) {
    const horizon = cullMarkerHorizon(croc);
    if (horizon !== null) horizons[horizon]++;
  }

  return {
    sizes: countSizeBands(crocs),
    cull: crocs.filter(isMarkedCull).length,
    nx: horizons[0],
    one: horizons[1],
    two: horizons[2],
  };
}

export interface CulledReportRow {
  croc: CrocRecord;
  date: string;
  usesInspectionDate: boolean;
}

export function buildCulledReportRows(crocs: CrocRecord[], records: CullRecord[]): CulledReportRow[] {
  const cullDates = new Map<number, string>();
  for (const record of records) {
    if (record.croc_id === null) continue;
    const existing = cullDates.get(record.croc_id);
    if (!existing || record.cull_date > existing) cullDates.set(record.croc_id, record.cull_date);
  }

  return crocs
    .filter(isMarkedCull)
    .map(croc => {
      const date = cullDates.get(croc.id);
      return {
        croc,
        date: date ?? croc.inspection_date,
        usesInspectionDate: !date,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.croc.line.localeCompare(b.croc.line) || a.croc.pen_slot - b.croc.pen_slot);
}
