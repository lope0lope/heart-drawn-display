/**
 * Condition code utilities.
 *
 * Codes follow the pattern <TYPE><LOCATION>, e.g. "THChest" = Tooth Hole on Chest,
 * "RTail" = Rub on Tail. Type is the leading uppercase letters; the remainder is
 * the body location.
 *
 * A croc may carry multiple codes in a single inspection field, comma-separated:
 *   "THChest,RTail" -> [{type:'TH', location:'Chest'}, {type:'R', location:'Tail'}]
 */

export interface ParsedCondition {
  raw: string;
  type: string;
  location: string;
}

/** Parse one condition code into its type prefix and location suffix. */
export function parseConditionCode(code: string): ParsedCondition {
  const trimmed = code.trim();
  // Type = leading run of uppercase letters; location = rest.
  const m = trimmed.match(/^([A-Z]+)(.*)$/);
  if (!m) return { raw: trimmed, type: trimmed, location: '' };
  return { raw: trimmed, type: m[1], location: m[2].trim() };
}

/** Parse a list of condition codes (already split into an array). */
export function parseConditionCodes(codes: string[]): ParsedCondition[] {
  return codes.map(parseConditionCode);
}

/**
 * True if `croc` has any condition matching `filter`.
 * Matches by exact code OR by type prefix (so filter "TH" matches "THChest", "THTail", etc.)
 * OR by location suffix (so filter "Chest" matches "THChest", "RChest").
 */
export function matchesConditionFilter(crocCodes: string[], filter: string): boolean {
  if (!filter) return true;
  const f = filter.trim();
  if (!f) return true;
  for (const code of crocCodes) {
    if (code === f) return true;
    const parsed = parseConditionCode(code);
    if (parsed.type === f) return true;
    if (parsed.location && parsed.location.toLowerCase() === f.toLowerCase()) return true;
  }
  return false;
}

/** Unique list of type prefixes present across all croc codes. */
export function extractTypes(allCodes: string[]): string[] {
  const types = new Set<string>();
  for (const c of allCodes) types.add(parseConditionCode(c).type);
  return [...types].sort();
}

/** Unique list of locations present across all croc codes. */
export function extractLocations(allCodes: string[]): string[] {
  const locs = new Set<string>();
  for (const c of allCodes) {
    const p = parseConditionCode(c);
    if (p.location) locs.add(p.location);
  }
  return [...locs].sort();
}
