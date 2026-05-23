I’ll fix this by treating the uploaded workbook as the source of truth and tightening both parsing and import safeguards.

Plan:

1. Inspect the workbook structure
   - Read the uploaded `Total_DB.xlsx` at sheet/cell level.
   - Confirm the exact sheet names, header rows, row counts, blank rows, and whether duplicate/old template sheets are being parsed.
   - Verify the real expected dataset count against rows that have valid `House | Pen | Tag | Size | Grading | Date | Condition | Cull` values.

2. Fix the parser to only accept the unified format
   - Require the 8-column layout in this order: `House, Pen, Tag, Size, Grading, Date, Condition, Cull`.
   - Stop parsing old GH1/GH2 template-style sheets or any extra workbook tabs that happen to contain partial matching headers.
   - Validate each row before counting it:
     - `House` must be `GH1` or `GH2`.
     - `Pen` must be like `A1`, `B11`, etc.
     - `Tag` must be present.
     - `Size` must be numeric.
     - `Grading` must be only `1` or `2`.
     - `Condition` must stay in conditions, not grade.
     - `Cull` must be only `NXT/NX/NEXT`, `1`, `2`, `3`, or blank.

3. Prevent inflated record counts
   - Add protection against parsing multiple valid-looking sheets when only one unified data sheet should be imported.
   - Add duplicate row detection based on the actual inspection identity: `House + Pen + Tag + Date`.
   - Count only valid data rows, not formatted blanks, summary rows, old template sheets, or duplicate rows.

4. Make import integration safer
   - Deduplicate tags before fetching existing crocs.
   - Deduplicate inspections before insert so the same croc/date is not inserted twice.
   - Keep existing live croc update behavior, but ensure bad rows cannot create partial or conflicting records.
   - Improve upload validation messages so the preview shows exactly why rows were skipped.

5. Verify against your file
   - Run the parser against `Total_DB.xlsx` directly.
   - Confirm the parsed count matches the real workbook count, not 2600.
   - Spot-check several rows to confirm: size, grade, condition, cull, GH1/GH2, and pen position are all mapped correctly.