import { describe, expect, it } from 'vitest';
import type { CrocRecord } from '@/hooks/useCrocs';
import type { CullRecord } from '@/hooks/useCullData';
import { buildCulledReportRows, summarizeLine } from '@/lib/lineReports';

const croc = (overrides: Partial<CrocRecord> = {}): CrocRecord => ({
  id: 1,
  pen_id: 'GH1',
  line: 'M',
  pen_slot: 1,
  tag: 'T1',
  belly_cm: 31,
  inspection_date: '2026-10-12',
  condition_codes: [],
  cull_schedule: null,
  ...overrides,
});

describe('line reports', () => {
  it('counts existing size bands, Cull markers, and NX/1/2 schedules', () => {
    const summary = summarizeLine([
      croc({ cull_schedule: 'NX' }),
      croc({ id: 2, belly_cm: 42, cull_schedule: '1' }),
      croc({ id: 3, belly_cm: 38, cull_schedule: '2' }),
      croc({ id: 4, condition_codes: ['Cull'] }),
    ]);

    expect(summary).toMatchObject({ cull: 1, nx: 1, one: 1, two: 1 });
    expect(summary.sizes).toHaveLength(6);
    expect(summary.sizes[1]).toBe(2);
    expect(summary.sizes[3]).toBe(1);
    expect(summary.sizes[4]).toBe(1);
  });

  it('uses the recorded cull date and falls back to inspection date when none exists', () => {
    const records: CullRecord[] = [{
      id: 1,
      croc_id: 1,
      cull_date: '2026-11-05',
      size_band_index: 1,
      reason: null,
      created_at: '2026-11-05T00:00:00Z',
    }];
    const rows = buildCulledReportRows([
      croc({ cull_schedule: 'CULLED' }),
      croc({ id: 2, cull_schedule: 'CULLED', inspection_date: '2026-09-10' }),
      croc({ id: 3, cull_schedule: 'NXT' }),
      croc({ id: 4, condition_codes: ['Cull'], inspection_date: '2026-08-02' }),
    ], records);

    expect(rows.map(row => [row.date, row.usesInspectionDate])).toEqual([
      ['2026-11-05', false],
      ['2026-09-10', true],
      ['2026-08-02', true],
    ]);
  });
});
