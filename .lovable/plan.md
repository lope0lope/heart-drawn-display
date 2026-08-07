# Pen Tenure, Occupancy Heatmap, Placement History, Excel Export, Optional Photos

Five additions. All build on the existing crocs / inspections / croc_photos data, with one schema change so pen history can actually be tracked over time.

## 1. Track where and when each croc was placed

Today the `inspections` table stores only croc, date, size and conditions — it does not record which pen the croc was in at that time, so pen tenure cannot be derived from existing history. Add:

- On `inspections`: `pen_id`, `line`, `pen_slot` (recorded on every new inspection, from both the Excel uploader and the field capture page).
- On `crocs`: `placement_date` and `placement_belly_cm` (first-ever record), plus `pen_since` (date the croc entered its current pen/line/slot).

Backfill: existing rows get `placement_date` / `pen_since` from their earliest known inspection date, and `placement_belly_cm` from their earliest recorded size. Historical inspections get the croc's current pen as a best-effort value, and the UI will label pre-existing tenure as "since first record" so nothing looks more precise than it is.

Maintenance: when an upload or a field entry shows a croc in a different pen/line/slot than before, `pen_since` resets to that inspection date. Same pen means `pen_since` is left alone.

## 2. Pen occupancy duration statistics

New stats block on the Pen Map page for the selected pen (or the combined GH1+GH2 view):

- Average, median, shortest and longest tenure in days.
- Distribution buckets: 0-30, 31-60, 61-90, 91-180, 180+ days.
- Count of crocs whose tenure is only known from first record (no observed move).

## 3. Occupancy duration heatmap

Add a "Tenure" option to the existing Pen Map mode selector (alongside health / condition / size). In this mode every slot is coloured on a cold-to-hot scale by days in pen: cool blue for new occupants through to deep red for the longest-standing. Legend shows the day ranges, tooltips show exact days and the date the croc entered the pen. Included in the existing print output.

## 4. Placement date and placement size on the croc profile

New "Placement History" card on the profile page showing:

- Placement date and placement size (first recorded size).
- Current pen and days in current pen.
- Total days on farm and total growth since placement.
- A compact pen movement timeline built from the inspection pen history: pen/line/slot, date moved in, size at that point, and how long the croc stayed.

## 5. Excel export with day and date-range filters

New export panel on the Data Upload page (using the `xlsx` package already installed):

- Presets: Today, Yesterday, Last 7 days, Last 30 days, All time, plus a custom start/end date range.
- Scope: all pens or a single pen.
- Output: a multi-sheet `.xlsx` — "Entries" (one row per inspection: date, house, pen, line, slot, tag, size, grade, conditions, cull marker), "Daily Summary" (entries per day, distinct crocs, distinct pens, average size) and "Current Live" (present live croc state for the chosen scope).
- The panel also shows the entry count per day for the chosen range on screen before exporting, so the count made in one day is visible without opening Excel.

## 6. Photo becomes optional on capture

- Field capture: remove the hard photo requirement — an entry can be saved and committed without one. The photo control stays prominent with an "optional" label, and the pending list marks entries with no photo so they are easy to spot.
- Profile page: the Photo History strip already renders chronologically; it will keep showing whatever photos exist and stay quiet when a croc has none.

## Technical notes

- One SQL migration for the new columns plus backfill; the profile-page pen timeline and all tenure stats read from `inspections` and need no extra table.
- New helpers in `src/lib/crocUtils.ts` for tenure calculation and heat colour scaling; new `src/lib/excelExport.ts` for the workbook build.
- Files touched: `src/pages/PenMapScreen.tsx`, `src/pages/CrocProfileScreen.tsx`, `src/pages/DataUploadScreen.tsx`, `src/pages/FieldCaptureScreen.tsx`, `src/lib/inspectionParser.ts`, `src/hooks/useCrocs.ts`, `src/lib/crocUtils.ts`.
- Since this project uses a directly connected Supabase project rather than Lovable Cloud, the migration SQL will be provided for you to run once in the Supabase SQL editor, the same way the photo table was handled.
