

## CrocTrack — Prototype Alignment & Practical Output Improvements

After comparing the uploaded prototype (`croctrack_v4_1.html`) against the current live app, I've identified several gaps where the prototype delivers more **practical, actionable outputs** that the current app is missing or underdelivering on.

### Key Problems
1. **Dashboard is data-heavy but not actionable** — the note box, activity feed, and AI advisory show generic static text rather than specific, contextual alerts (e.g., "GH1 Row F has elevated DS cluster" or "3 MN flags on GH2 Row J — feeder check recommended").
2. **In-Treatment dialog** works but doesn't group by line or let you filter — you want to walk the farm with a printout per line/pen.
3. **Pen Map** is missing the **batch filter** and **print/export** functionality from the prototype.
4. **Croc Profile** is missing **feed consumption history**, **size history with progress bar** to cull threshold, and **projected cull timeline**.
5. **Analytics** is missing the **Treatment Hold — Healing Trajectories** panel and the **Batch Comparison** panel from the prototype.
6. **Condition Codes** page is missing **Body Locations grid**, **Severity Rating panel** (NXT, 1-4 scale), and the **Live vs Hide defect distinction** from the prototype.
7. **Dashboard KPIs** should be 5-column in prototype (currently 3) — missing "Cull Ready" and "Next Inspection" KPIs.

### Plan

#### 1. Dashboard — Make alerts specific and actionable
- Replace the generic NoteBox text with **computed alerts**: scan croc data for clusters (e.g., 3+ MN flags on the same line, DS clusters) and surface them as named warnings
- Add two more KPI cards: **Cull Ready** (count of crocs above 35cm threshold) and **Next Inspection** countdown
- Make the Activity feed show real recent actions (upload logs, condition changes) instead of static text
- AI Advisory should call out specific lines/rows with problems

#### 2. In-Treatment Dialog — Practical inspection list
- Add **group-by-line** toggle so you can print a list organized by walk route (Line A, Line B, etc.)
- Add **condition filter** dropdown to show only specific conditions (e.g., "show me all MN crocs")
- Add **severity column** showing grade/severity alongside condition codes
- Improve the print layout to be a proper **farm walk checklist** with checkboxes

#### 3. Pen Map — Add batch filter and print
- Add **Batch filter** dropdown (tag ranges like 5000–5600) that dims non-batch crocs, matching the prototype
- Wire the **Print / Export** button to generate a printable pen map (color grid + legend), matching the prototype's `printPenMap()` function
- Add **Row Summary** sidebar showing condition count per line as bar chart

#### 4. Croc Profile — Add practical tracking panels
- Add **Feed Consumption History** panel showing feed intake per cycle (from feed_records joined by pen/line)
- Add **Size History** panel with a progress bar showing % toward cull threshold (54 cm)
- Add **Projected Timeline** with ghost entries showing estimated cull date based on growth rate
- Add **CITIES Tag** placeholder field (assigned at cull)

#### 5. Analytics — Add missing panels from prototype
- Add **Treatment Hold — Healing Trajectories** panel showing avg cycles to heal per condition type
- Add **Batch Comparison** panel showing avg size by cycle for different tag ranges
- Make heatmap show both GH1 and GH2

#### 6. Condition Codes — Complete reference page
- Add **Body Locations grid** (Collar, Chest, Belly, Tail, LF, RF, RT, RB, FT, LB) with descriptions
- Add **Severity Rating panel** with the NXT/1/2/3/4 scale and their meanings
- Split the codes table into **Live Defects** and **Defects in Hide** (two side-by-side tables), with the "In Hide?" column indicator

### Technical Details

**Files to edit:**
- `src/pages/DashboardScreen.tsx` — computed alerts, 2 new KPIs, real activity feed
- `src/components/InTreatmentDialog.tsx` — group-by-line, condition filter, print checklist
- `src/pages/PenMapScreen.tsx` — batch filter, print function, row summary
- `src/pages/CrocProfileScreen.tsx` — feed history, size progress bar, projected timeline
- `src/pages/AnalyticsScreen.tsx` — healing trajectories, batch comparison panels
- `src/pages/ConditionCodesScreen.tsx` — body locations, severity scale, live/hide split

**No new tables needed** — all data comes from existing `crocs`, `inspections`, `feed_records`, and `condition_codes` tables.

**Batch filter logic:**
```typescript
const batchRanges = [
  { label: '5000–5600', min: 5000, max: 5600 },
  { label: '5601–6200', min: 5601, max: 6200 },
  // etc.
];
// Filter by parsing tag as number
const inBatch = !batchFilter || (parseInt(croc.tag) >= batch.min && parseInt(croc.tag) <= batch.max);
```

**Cluster detection (Dashboard alerts):**
```typescript
// Group conditions by line, flag any line with 3+ of the same condition
const lineCondCounts: Record<string, Record<string, number>> = {};
crocs.forEach(c => c.condition_codes.forEach(code => {
  lineCondCounts[c.line] ??= {};
  lineCondCounts[c.line][code] = (lineCondCounts[c.line][code] || 0) + 1;
}));
const alerts = Object.entries(lineCondCounts).flatMap(([line, codes]) =>
  Object.entries(codes).filter(([_, count]) => count >= 3).map(([code, count]) =>
    `${count} ${code} flags on Line ${line}`
  )
);
```

