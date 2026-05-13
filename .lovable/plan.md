## Goal
Reduce the visual/conceptual load of CrocTrack so the client sees only what matters: how many crocs are marked for cull, by horizon. Pen Map gains a condition-breakdown panel for the current pen view.

## 1. Hide Forecasting & Feed Reports from navigation
- Edit `src/components/AppSidebar.tsx`: remove the `forecast` and `feed` entries from `navItems`. The `Records` section will now start with `upload`.
- Leave the screen files, routing in `Index.tsx`, and all hooks intact so the pages can be re-enabled by restoring two lines in the future.
- No file deletion.

## 2. New cull-marker semantics
Update `src/lib/crocUtils.ts` → `cullEligibleCycle()` to use the client's literal mapping:

| `cull_schedule` (uppercased, trimmed) | Cycles until cull |
|---|---|
| `NX` / `NXT` / `NEXT` | 0 (next cycle = "ready next cycle") |
| `1` | 1 |
| `2` | 2 |
| `3` | 3 |
| anything else / empty | not marked (excluded from the four KPIs) |

Active conditions no longer block the marker — staff judgement (the marker itself) is the single source of truth, matching the client's intent.

A new helper `cullMarkerHorizon(croc): 0|1|2|3|null` will be added to keep the new dashboard logic clean and leave the legacy `cullEligibleCycle` available for any other callers.

## 3. Dashboard rebuild (`src/pages/DashboardScreen.tsx`)
Replace the current 5 KPI cards with these five, all clickable:

1. **Total Crocodile Count** — `occupied.length` (no drill-down dialog; click is a no-op or toggles the existing size snapshot panel).
2. **Ready for Cull — Next Cycle (NX)** — count where `cullMarkerHorizon === 0`.
3. **Ready in 1 More Cycle** — count where `cullMarkerHorizon === 1`.
4. **Ready in 2 More Cycles** — `=== 2`.
5. **Ready in 3 More Cycles** — `=== 3`.

Click behaviour: clicking a cull KPI opens a dialog (`CullHorizonDialog`, new component in `src/components/`) showing the **size category snapshot** for just that group — i.e. the same `SIZE_BANDS` bar list rendered in the existing "Size Category Snapshot" panel, but counted from the filtered subset. Clicking "Total" can either show the full snapshot or be non-interactive; default to non-interactive to keep things simple.

Sections to remove from the dashboard to match the simplification request:
- `Stock Available to Cull — All Size Bands` (forecast-driven, no longer needed).
- `AI Advisory — This Month` panel.
- `Recent Activity` panel.
- `Active Conditions` panel.
- `Farm Alerts` collapsible (cluster detection).

Sections to keep:
- The `Size Category Snapshot — Today` panel (still useful as the at-a-glance size mix).

The screen will then contain: 5 KPI cards → Size Category Snapshot panel. Nothing else.

`InTreatmentDialog` import and `treatmentOpen` state are removed. `useCullProjections`, `useAiAdvisory`, `useUploadLogs` imports are removed from this file.

## 4. Pen Map — Condition Breakdown panel (`src/pages/PenMapScreen.tsx`)
Add a new panel beneath (or beside) the existing pen grid that lists every condition code present in the **currently selected pen** (respecting only the pen selector, not the in-grid filters — so the count is a stable reference) with a count of affected crocs.

Implementation:
- Use existing `countConditions(crocs)` from `crocUtils.ts` (already counts per code).
- Render as a two-column list: `code — name` (from `useConditionCodes`) and the count, sorted descending by count.
- Group/parse codes by their **type prefix** via `parseConditionCode` so e.g. `THChest` and `THTail` both roll up under `TH — Tooth Hole` with a sub-list of locations and per-location counts.
- Place this panel in the right rail (the `xl:grid-cols-[1fr_220px]` column), or add a new full-width row below the grid on smaller viewports. Default: full-width row beneath the grid for clarity.
- Title: `Conditions in {pen}` with a pill showing total flagged crocs.
- An "ALL" toggle in the existing pen selector (already present elsewhere as `'ALL'` for Feed) is **not** added here — the client said "selected pen (or combined pen view)", so we add a `Both (GH1+GH2)` option to the pen `<select>` in this screen only and have the breakdown panel honour it. When `Both` is chosen, the grid hides (or shows GH1 then GH2 stacked — TBD during implementation; default to: grid stays on the last single pen, breakdown shows combined). Simpler default: keep grid bound to the single pen selection and only widen the breakdown's data fetch via `useAllCrocs` when `Both` is picked.

## 5. Memory updates
- Update `mem://features/cull-management` to note the new horizon semantics (NX/1/2/3) and the dashboard's role as the cull-counter cockpit.
- Update `mem://features/farm-management-alerts` to mark cluster detection as removed from the dashboard (still computable in code if needed later).
- Add a short `mem://features/dashboard-simplification` note recording the client's "less is more" preference so future agents don't re-add panels.

## Files touched
- `src/components/AppSidebar.tsx` — remove 2 nav entries.
- `src/lib/crocUtils.ts` — add `cullMarkerHorizon`, adjust `cullEligibleCycle` mapping.
- `src/pages/DashboardScreen.tsx` — large rewrite: 5 new KPIs, drill-down dialog, drop 4 panels.
- `src/components/CullHorizonDialog.tsx` — new file, size-band breakdown for a horizon group.
- `src/pages/PenMapScreen.tsx` — add `Both` pen option + condition breakdown panel.
- Memory files as listed above.

## Out of scope
- Forecast and Feed source files remain on disk untouched.
- Analytics, Croc Profile, Condition Codes, Data Upload screens unchanged.
- No DB schema changes; cull markers continue to live in `cull_schedule` text column.
