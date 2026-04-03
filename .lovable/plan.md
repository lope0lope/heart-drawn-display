# CrocTrack — Live Data Integration Plan

## Overview

We'll set up Supabase, not lovable cloud but rather superbase directly as the backend, import your Excel data, and wire each screen to real data. Here's the phased approach:

---

## Phase 1: Database Setup

**Parse your Excel file** to understand the data structure (columns, sheets, relationships).

**Create database tables** based on your data. Likely tables:

- `pens` — pen identifiers (GH1, GH2, etc.)
- `crocs` — individual croc records (tag_id, pen, row, col, size_cm, condition_codes, readiness, grade, batch)
- `inspections` — inspection history per croc (date, measurements, conditions found)
- `feed_records` — feed consumption per line/cycle
- `condition_codes` — reference table for all condition definitions

**Set up RLS policies** for data access.

## Phase 2: Data Import

**Import your Excel data** into the database tables using a script. We'll parse the XLSX and insert rows via Supabase.

## Phase 3: Connect Screens to Live Data (one at a time)

Replace mock data with real queries, screen by screen:

1. **Dashboard** — summary stats, counts, condition breakdowns from `crocs` table
2. **Pen Map** — grid populated from `crocs` where pen = selected pen
3. **Croc Profiles** — individual croc lookup by tag_id with inspection history
4. **Condition Codes** — driven by `condition_codes` table (editable)
5. **Feed Reports** — consumption data from `feed_records`
6. **Forecasting** — size band distribution + growth projections from croc measurements
7. **Analytics** — query builder hitting real data
8. **Data Upload** — actual CSV parsing and insertion into the database

---

## Recommended Next Step

**Upload your Excel file** so I can parse it, understand the exact column structure, and design the database schema to match. Then we'll set up Lovable Cloud and start building.