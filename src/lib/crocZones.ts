/** Touch regions traced from the supplied hide layout, rotated head-up.
 * Keep coordinates within the capture API's existing 976 × 1091 bounds.
 */
const SCALE = 1091 / 1588;
export const CROC_W = 572 * SCALE;
export const CROC_H = 1091;

export interface CrocZone {
  key: string;
  label: string;
  points: string;
  cx: number;
  cy: number;
}

type Point = [number, number];
/** Rotate the original landscape coordinates clockwise, then uniformly scale. */
function upright([x, y]: Point): Point {
  return [(572 - y) * SCALE, x * SCALE];
}
function region(key: string, outline: Point[], anchor: Point): CrocZone {
  const [cx, cy] = upright(anchor);
  return { key, label: key, points: outline.map(upright).map(p => p.join(',')).join(' '), cx, cy };
}

// A2 underlays its four quadrants: the central cross remains an A2 touch target.
export const CROC_ZONES: CrocZone[] = [
  region('E1', [[14,307],[55,279],[105,258],[168,238],[168,363],[102,349],[52,332]], [105,303]),
  region('A1', [[168,238],[220,217],[280,203],[325,179],[365,166],[412,160],[412,421],[356,424],[308,403],[267,388],[213,389],[168,363]], [270,300]),
  region('A2', [[412,160],[421,86],[514,78],[616,85],[706,103],[748,105],[774,162],[789,188],[805,391],[791,428],[751,460],[649,487],[548,490],[448,475],[412,421]], [581,287]),
  region('Q1', [[421,86],[514,78],[572,82],[572,277],[420,277]], [492,226]),
  region('Q2', [[590,83],[706,103],[748,105],[774,162],[789,188],[797,277],[590,277]], [670,225]),
  region('Q3', [[420,295],[572,295],[572,490],[548,490],[448,475],[412,421]], [495,348]),
  region('Q4', [[590,295],[798,295],[805,391],[791,428],[751,460],[649,487],[590,489]], [675,354]),
  region('A3', [[789,188],[848,177],[963,186],[1054,193],[1119,207],[1119,346],[1033,362],[914,386],[805,401],[805,391]], [967,284]),
  region('E3', [[1119,207],[1233,227],[1375,251],[1493,266],[1575,274],[1546,291],[1473,306],[1332,325],[1218,337],[1119,346]], [1260,278]),
  region('E2', [[166,217],[163,163],[181,135],[220,118],[252,118],[273,137],[280,203],[220,217]], [217,174]),
  region('E4', [[168,374],[265,387],[260,420],[248,474],[225,495],[180,488],[159,469],[161,424]], [207,425]),
  region('F1', [[311,148],[288,96],[285,67],[310,47],[353,36],[384,41],[399,57],[397,93],[393,135],[354,139]], [344,90]),
  region('F2', [[751,80],[779,51],[810,21],[832,17],[853,32],[872,68],[889,96],[885,114],[863,125],[807,140],[785,115]], [820,78]),
  region('F3', [[783,446],[806,431],[831,436],[870,463],[902,485],[907,503],[879,522],[849,547],[833,545],[808,520],[783,485],[771,463]], [838,488]),
  region('F4', [[312,421],[350,430],[391,451],[401,482],[405,516],[393,536],[373,540],[333,530],[292,515],[287,497],[298,461]], [348,485]),
];

export const ZONE_BY_KEY: Record<string, CrocZone> = Object.fromEntries(CROC_ZONES.map(z => [z.key, z]));

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

/** Place a marker at the zone anchor when no touch coordinates are available. */
export function markerPosition(zone: CrocZone) {
  return {
    mx: zone.cx,
    my: zone.cy,
  };
}
