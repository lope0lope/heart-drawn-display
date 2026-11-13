import { describe, it, expect } from 'vitest';
import { parsePen, parseCull, parseComment, validateRow, blankRow, rowsFromGrid } from '@/lib/sheetEntry';

const codes = ['BS', 'TH', 'R'];
describe('sheet entry decoding', () => {
  it('accepts lowercase and uppercase pens', () => {
    expect(parsePen('a12')).toEqual({ line: 'A', pen: 12 });
    expect(parsePen('B4')).toEqual({ line: 'B', pen: 4 });
    expect(parsePen('Z4')).toBeNull();
  });
  it('maps Nxt/next and 1,2,3', () => {
    expect(parseCull('next')).toBe('NXT');
    expect(parseCull('Nxt')).toBe('NXT');
    expect(parseCull('2')).toBe('2');
    expect(parseCull('5')).toBeNull();
  });
  it('matches condition codes regardless of case and detects Cull', () => {
    expect(parseComment('bs, Th', codes)).toEqual({ codes: ['BS', 'TH'], cull: false, unknown: [] });
    expect(parseComment('Cull', codes).cull).toBe(true);
  });
  it('Cull in the comment marks the croc culled', () => {
    const r = { ...blankRow('GH1'), pen: 'c6', tag: '371', comment: 'cull' };
    const v = validateRow(r, 'GH1', codes);
    expect(v.ok && v.value.cull).toBe('CULLED');
  });
  it('reads Excel rows by column names', () => {
    const { rows } = rowsFromGrid([['Pen', 'Size', 'Cull', 'Tag', 'Comment'], ['a1', 30, 'nxt', 'T1', 'bs']]);
    expect(rows[0]).toMatchObject({ pen: 'a1', size: '30', cull: 'nxt', tag: 'T1', comment: 'bs' });
  });
});

describe('R marker, NT tags and small codes', () => {
  it('accepts R as rejected and NX as NXT, rejects 3', () => {
    expect(parseCull('r')).toBe('R');
    expect(parseCull('NX')).toBe('NXT');
    expect(parseCull('3')).toBeNull();
  });
  it('gives NT crocs a per-pen id so they never merge', () => {
    const a = validateRow({ ...blankRow(), pen: 'a1', tag: 'nt' }, 'GH1', codes);
    const b = validateRow({ ...blankRow(), pen: 'a2', tag: 'NT' }, 'GH1', codes);
    expect(a.ok && a.value.tag).toBe('NT-GH1-A1');
    expect(b.ok && b.value.tag).toBe('NT-GH1-A2');
  });
  it('reads comma-separated conditions incl. small versions', () => {
    expect(parseComment('BS,DS,bss', ['BS', 'DS', 'BSS']).codes).toEqual(['BS', 'DS', 'BSS']);
  });
});
