import { afterEach, describe, expect, it, vi } from 'vitest';
import { wipeFarmData } from '@/lib/wipeFarmData';

afterEach(() => vi.unstubAllGlobals());

describe('complete farm wipe', () => {
  it('requests the complete Cloud wipe, including API records, with explicit confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await wipeFarmData();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/functions/v1/farm-write/wipe'), expect.objectContaining({ method: 'POST', body: '{"confirmation":"WIPE"}' }));
  });
  it('never reports success when deletion fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'Deletion blocked' }) }));
    await expect(wipeFarmData()).rejects.toThrow('Deletion blocked');
  });
  it('requires a confirmed successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(wipeFarmData()).rejects.toThrow('Wipe failed');
  });
});