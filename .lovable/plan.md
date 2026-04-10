

## Make CrocTrack 100% Live — Remove All Fake Data & Fix Remaining Issues

### What's Still Fake or Broken

After auditing every screen, here is everything that is not driven by real data:

1. **`CULL_READINESS` (Dashboard)** — Hardcoded worker vs AI counts (218, 194, 341, etc.) in `mockData.ts`. Not computed from actual croc data.

2. **`YTD_CULLED` (Forecast)** — Hardcoded array `[88, 142, 170, 210, 98, 42]` in `crocUtils.ts`. Should come from a cull log or be tracked in Supabase.

3. **`GROWTH_RATES` (Forecast)** — Hardcoded `[5.2, 4.8, 4.5, 4.1, 3.6, 2.9]`. Should be computed from actual inspection history deltas.

4. **AI Culling Advisory (Forecast)** — Entirely hardcoded HTML text ("cull 94 units", "shortfall of 68 units"). Not generated from data.

5. **Month-by-Month Cull Plan (Forecast)** — Hardcoded grid of numbers on line 33. Not based on any real planning data.

6. **AI Advisory (Dashboard)** — Static text about "33-34 cm shortfall" and "45+ cm surplus". Not computed.

7. **Cull Impact table (Feed Reports)** — `cullData` on line 44 is hardcoded batch/cull stats.

8. **Feed Reports default cycle** — Hardcodes `'Cycle 3'` instead of picking the latest available cycle.

9. **Analytics Query Builder** — The "Run" button and filters are cosmetic; they don't actually filter data.

10. **RLS missing for crocs/inspections** — No INSERT/UPDATE policies, so the Data Upload "Confirm Import" will silently fail.

11. **No feed data uploaded for GH2** — Feed records only exist as seed data; you mentioned you haven't uploaded real feed data yet.

---

### Plan

#### 1. Create a `cull_records` table and compute YTD culled from real data
- New Supabase table: `cull_records (id, croc_id, cull_date, size_band, reason)`
- Replace `YTD_CULLED` constant with a query hook `useCullStats()` that counts records per size band
- Update Forecast and Dashboard screens to use this hook

#### 2. Compute growth rates from inspection history
- Replace `GROWTH_RATES` constant with a function that calculates average belly growth per size band from the `inspections` table (delta between consecutive inspections per croc)
- Create `useGrowthRates()` hook

#### 3. Generate AI advisories dynamically from live data
- Replace hardcoded AI text on Dashboard and Forecast with computed advisories based on:
  - Current size band counts vs targets
  - Computed growth rates
  - YTD cull progress
- Generate the cull plan grid programmatically (distribute remaining target across months)
- Replace `CULL_READINESS` with computed values from size bands and growth projections

#### 4. Fix Feed Reports
- Compute `cullData` from `cull_records` joined with feed history instead of hardcoding
- Default cycle selector to the latest cycle returned by `useFeedCycles()`

#### 5. Wire the Analytics Query Builder
- Make the "Run" button actually filter croc data based on selected condition/pen/size/line
- Display filtered results in the chosen format (heatmap/table/bar chart)

#### 6. Add RLS policies for data import
- Migration to add INSERT and UPDATE policies on `crocs` and `inspections` tables so the upload screen works

#### 7. Seed GH2 feed data
- Since you don't have real feed data to upload yet, seed realistic GH2 feed records into the `feed_records` table (this is already partially done for GH1 + GH2 in the migration, but we can verify it's complete)

#### 8. Cleanup
- Remove `CULL_READINESS` from `mockData.ts`
- Remove `YTD_CULLED` and `GROWTH_RATES` constants from `crocUtils.ts`
- All remaining data flows from Supabase

---

### Technical Details

**New table:**
```sql
create table public.cull_records (
  id serial primary key,
  croc_id int references public.crocs(id),
  cull_date date not null,
  size_band_index int not null,
  reason text,
  created_at timestamptz default now()
);
```

**New hooks:**
- `useCullStats()` — counts cull records per size band, YTD
- `useGrowthRates()` — computes avg growth per size band from inspections
- `useCullReadiness()` — derives worker/AI cull readiness from size data + growth projections

**New migration:** RLS policies for `crocs` (INSERT, UPDATE) and `inspections` (INSERT)

**Files to create/edit:**
- New migration SQL file
- `src/hooks/useCullData.ts` (new)
- `src/hooks/useCrocs.ts` (add growth rate computation)
- `src/pages/ForecastScreen.tsx` (replace all hardcoded data)
- `src/pages/DashboardScreen.tsx` (replace CULL_READINESS + AI advisory)
- `src/pages/FeedReportsScreen.tsx` (dynamic default cycle, remove hardcoded cullData)
- `src/pages/AnalyticsScreen.tsx` (wire query builder)
- `src/data/mockData.ts` (remove CULL_READINESS)
- `src/lib/crocUtils.ts` (remove YTD_CULLED, GROWTH_RATES)

