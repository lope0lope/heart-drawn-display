import { describe, expect, it } from 'vitest';
import { CROC_H, CROC_W, CROC_ZONES, ZONE_BY_KEY } from '../lib/crocZones';

function contains(points: string, x: number, y: number) {
  const vertices = points.split(' ').map(p => p.split(',').map(Number));
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [xi, yi] = vertices[i];
    const [xj, yj] = vertices[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

describe('upright hide touch regions', () => {
  it('rotates head above tail and preserves all supplied zone identifiers', () => {
    expect(CROC_H).toBeGreaterThan(CROC_W);
    expect(CROC_ZONES.map(z => z.key).sort()).toEqual(['A1','A2','A3','E1','E2','E3','E4','F1','F2','F3','F4','Q1','Q2','Q3','Q4'].sort());
    expect(ZONE_BY_KEY.E1.cy).toBeLessThan(ZONE_BY_KEY.E3.cy);
  });
  it('keeps every touch anchor inside its region and all vertices within upload bounds', () => {
    for (const zone of CROC_ZONES) {
      expect(contains(zone.points, zone.cx, zone.cy), zone.key).toBe(true);
      for (const point of zone.points.split(' ')) {
        const [x, y] = point.split(',').map(Number);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(CROC_W);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1091);
      }
    }
  });
});