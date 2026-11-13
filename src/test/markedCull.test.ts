import { describe, expect, it } from 'vitest';
import { countSizeBuckets, isMarkedCull } from '@/lib/crocUtils';
import type { CrocRecord } from '@/hooks/useCrocs';

const croc = (overrides: Partial<CrocRecord> = {}): CrocRecord => ({
  id: 1, pen_id: 'GH1', line: 'A', pen_slot: 12, tag: '371', belly_cm: 30,
  inspection_date: '2026-11-13', condition_codes: [], cull_schedule: null,
  ...overrides,
});

describe('dashboard Cull reporting', () => {
  it('includes Cull written in the conditions list, including mixed case and comma-separated codes', () => {
    expect(isMarkedCull(croc({ condition_codes: ['BS', 'cUlL'] }))).toBe(true);
    expect(isMarkedCull(croc({ condition_codes: ['BS, Cull,DS'] }))).toBe(true);
  });
  it('includes the CULLED status saved when an inspection comment says Cull', () => {
    expect(isMarkedCull(croc({ cull_schedule: 'CULLED' }))).toBe(true);
  });
  it('does not mistake future cycles or rejection for an immediate Cull', () => {
    for (const marker of ['NX', 'NXT', '1', '2', 'R']) {
      expect(isMarkedCull(croc({ cull_schedule: marker, condition_codes: [`CULL-${marker}`] }))).toBe(false);
    }
  });
  it('counts Cull crocs by individual belly size without omitting unmeasured crocs from the list', () => {
    const list = [
      croc({ cull_schedule: 'CULLED', belly_cm: 30 }),
      croc({ id: 2, condition_codes: ['Cull'], belly_cm: 41 }),
      croc({ id: 3, cull_schedule: 'CULLED', belly_cm: null }),
      croc({ id: 4, cull_schedule: 'NXT', belly_cm: 30 }),
    ].filter(isMarkedCull);
    expect(list.map(c => c.id)).toEqual([1, 2, 3]);
    const sizes = countSizeBuckets(list);
    expect(sizes[5]).toBe(1);
    expect(sizes[16]).toBe(1);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(2);
  });
});