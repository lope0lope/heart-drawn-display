import { describe, expect, it } from 'vitest';
import { fetchAllPages } from '@/lib/fetchAllPages';

describe('fetchAllPages', () => {
  it('fetches and combines every row across the 1000-row API limit', async () => {
    const rows = Array.from({ length: 2050 }, (_, id) => ({ id }));
    const offsets: number[] = [];

    const result = await fetchAllPages(async (from, to) => {
      offsets.push(from);
      return { data: rows.slice(from, to + 1), error: null };
    });

    expect(result).toEqual(rows);
    expect(offsets).toEqual([0, 1000, 2000]);
  });

  it('surfaces errors from later pages instead of returning partial data', async () => {
    const failure = new Error('page request failed');

    await expect(fetchAllPages(async from => ({
      data: from === 0 ? Array.from({ length: 1000 }, (_, id) => id) : null,
      error: from === 0 ? null : failure,
    }))).rejects.toBe(failure);
  });
});
