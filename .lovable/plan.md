

## Completing CrocTrack — Remaining Work

### Current Status

**Wired to live Supabase data:** Dashboard, Pen Map, Croc Profiles (with growth history), Condition Codes, Forecast, Analytics, Data Export (CSV downloads).

**Still using mock data or non-functional:**

1. **Feed Reports** — entirely driven by hardcoded `FEED_DATA` in `mockData.ts`
2. **Data Upload** — upload zone is cosmetic (fakes processing with a `setTimeout`); no CSV parsing or Supabase insertion
3. **Topbar Search** — input exists but does nothing
4. **Print Report** button on Feed Reports — no implementation

---

### Plan to Complete

#### 1. Working Data Upload (CSV Import)
- Parse uploaded CSV client-side (using `papaparse` library)
- Map columns to the `crocs` / `inspections` schema
- Show a real data preview table and run validation (duplicate tags, missing columns, out-of-range values)
- On "Confirm Import", upsert records into Supabase
- Store upload history in a new `upload_logs` table and display real history
- Accept both `.csv` and `.xlsx` files using the SheetJS library already available

#### 2. Feed Reports — Live Data
- Create a `feed_records` table in Supabase (`pen_id`, `line`, `cycle`, `feed_kg`, `recorded_date`)
- Seed it with the current mock values so the screen isn't empty
- Rewrite `FeedReportsScreen.tsx` to query `feed_records` via a new `useFeedData` hook
- Remove `FEED_DATA` from `mockData.ts`

#### 3. Global Search (Topbar)
- Wire the search input to navigate to Croc Profiles and auto-search by tag number or ID
- Support pen filtering (e.g. typing "GH2 B5" jumps to that pen slot)

#### 4. Cleanup
- Remove unused mock data generators (`genCrocData`, `penData`) from `mockData.ts`
- Remove duplicate utility functions (size band helpers exist in both `mockData.ts` and `crocUtils.ts`)
- Remove hardcoded upload history and validation report

---

### Technical Details

**New database table:**
```sql
create table public.feed_records (
  id serial primary key,
  pen_id text not null,
  line text not null,
  cycle text not null,
  feed_kg numeric not null,
  croc_count int,
  recorded_date date not null
);

create table public.upload_logs (
  id serial primary key,
  filename text not null,
  record_count int not null,
  status text not null,
  warnings int default 0,
  uploaded_at timestamptz default now()
);
```

**New dependencies:** `papaparse` for CSV parsing (lightweight, well-supported).

**Files to create/edit:**
- Create `src/hooks/useFeedData.ts`
- Create migration for `feed_records` and `upload_logs` tables
- Rewrite `src/pages/FeedReportsScreen.tsx` (swap mock for hook)
- Rewrite `src/pages/DataUploadScreen.tsx` (real parsing, validation, Supabase insert)
- Update `src/components/Topbar.tsx` (wire search)
- Clean up `src/data/mockData.ts`

