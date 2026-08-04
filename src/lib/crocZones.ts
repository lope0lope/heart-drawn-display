/**
 * Crocodile body-zone geometry for location-based condition capture.
 *
 * The diagram is 976 x 1091. Body bands are generated from a smoothed
 * silhouette profile (half-width per y) so each hotspot hugs the animal.
 * Every band is split left/right; limbs are simple ellipses.
 */

export const CROC_W = 976;
export const CROC_H = 1091;
const CX = 488;

const KEYFRAMES: [number, number][] = [
  [20, 10], [128, 45], [260, 58], [380, 62], [500, 97],
  [610, 84], [700, 70], [790, 55], [890, 36], [1079, 3],
];

const SEGMENTS = [
  { key: 'snout', label: 'Snout', y0: 20, y1: 128 },
  { key: 'head', label: 'Head', y0: 128, y1: 260 },
  { key: 'chest', label: 'Chest', y0: 260, y1: 380 },
  { key: 'belly', label: 'Belly', y0: 380, y1: 610 },
  { key: 'pelvis', label: 'Pelvis', y0: 610, y1: 790 },
  { key: 'upper-tail', label: 'Upper Tail', y0: 790, y1: 890 },
  { key: 'lower-tail', label: 'Lower Tail', y0: 890, y1: 1079 },
];

const LIMBS = [
  { key: 'arm', side: 'left', label: 'Arm', cx: 377, cy: 310, rx: 53, ry: 70 },
  { key: 'arm', side: 'right', label: 'Arm', cx: 599, cy: 310, rx: 53, ry: 70 },
  { key: 'leg', side: 'left', label: 'Leg', cx: 388, cy: 705, rx: 43, ry: 85 },
  { key: 'leg', side: 'right', label: 'Leg', cx: 588, cy: 705, rx: 43, ry: 85 },
];

export interface CrocZone {
  key: string;
  label: string;
  /** SVG polygon points, when the zone is a body band. */
  points?: string;
  /** Ellipse geometry, when the zone is a limb. */
  ellipse?: { cx: number; cy: number; rx: number; ry: number };
  /** Anchor for marker placement. */
  cx: number;
  cy: number;
}

function buildProfile(points: [number, number][], samplesPerSeg: number) {
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      const y = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const w = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([y, Math.max(0, w)]);
    }
  }
  out.push([...points[points.length - 1]] as [number, number]);
  return out;
}

function widthAt(profile: [number, number][], y: number) {
  for (let i = 0; i < profile.length - 1; i++) {
    if (y >= profile[i][0] && y <= profile[i + 1][0]) {
      const span = profile[i + 1][0] - profile[i][0];
      const t = span === 0 ? 0 : (y - profile[i][0]) / span;
      return profile[i][1] + (profile[i + 1][1] - profile[i][1]) * t;
    }
  }
  return profile[profile.length - 1][1];
}

function buildZones(): CrocZone[] {
  const profile = buildProfile(KEYFRAMES, 14);
  const zones: CrocZone[] = [];

  for (const seg of SEGMENTS) {
    const band = profile.filter(p => p[0] >= seg.y0 && p[0] <= seg.y1);
    const hw0 = widthAt(profile, seg.y0), hw1 = widthAt(profile, seg.y1);
    if (!band.length || band[0][0] > seg.y0) band.unshift([seg.y0, hw0]);
    if (band[band.length - 1][0] < seg.y1) band.push([seg.y1, hw1]);

    const midY = (seg.y0 + seg.y1) / 2;
    const midHw = widthAt(profile, midY);

    const toStr = (pts: [number, number][]) => pts.map(p => `${p[0]},${p[1]}`).join(' ');
    const left: [number, number][] = [[CX, seg.y0], ...band.map(p => [CX - p[1], p[0]] as [number, number]), [CX, seg.y1]];
    const right: [number, number][] = [[CX, seg.y0], ...band.map(p => [CX + p[1], p[0]] as [number, number]), [CX, seg.y1]];

    zones.push({ key: `left-${seg.key}`, label: `Left ${seg.label}`, points: toStr(left), cx: CX - midHw * 0.55, cy: midY });
    zones.push({ key: `right-${seg.key}`, label: `Right ${seg.label}`, points: toStr(right), cx: CX + midHw * 0.55, cy: midY });
  }

  for (const limb of LIMBS) {
    zones.push({
      key: `${limb.side}-${limb.key}`,
      label: `${limb.side === 'left' ? 'Left' : 'Right'} ${limb.label}`,
      ellipse: { cx: limb.cx, cy: limb.cy, rx: limb.rx, ry: limb.ry },
      cx: limb.cx,
      cy: limb.cy,
    });
  }

  return zones;
}

export const CROC_ZONES: CrocZone[] = buildZones();

export const ZONE_BY_KEY: Record<string, CrocZone> = Object.fromEntries(
  CROC_ZONES.map(z => [z.key, z]),
);

/** A single condition pinned to a body location. */
export interface ConditionMark {
  id: string;
  zoneKey: string;
  zoneLabel: string;
  code: string;
  name: string;
  /** Marker coordinates in diagram space. */
  mx: number;
  my: number;
}

/** Detailed history string, e.g. "BA@Left Chest". */
export function markToString(m: ConditionMark) {
  return `${m.code}@${m.zoneLabel}`;
}

/** Unique plain condition codes (keeps existing analytics working). */
export function marksToCodes(marks: ConditionMark[]) {
  return [...new Set(marks.map(m => m.code))];
}

/** Place a marker inside a zone with a little jitter so repeats don't stack. */
export function markerPosition(zone: CrocZone) {
  return {
    mx: zone.cx + (Math.random() - 0.5) * 55,
    my: zone.cy + (Math.random() - 0.5) * 55,
  };
}
