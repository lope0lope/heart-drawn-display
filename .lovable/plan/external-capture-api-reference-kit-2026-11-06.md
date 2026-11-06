# External Capture API + Reference Kit

Goal: let your own local app (built elsewhere, e.g. a native Android app that can use the Arducam at full 4608x2592) send captured entries and photos into CrocTrack.

## What you will get

1. **An upload endpoint** (`ingest-capture`) that accepts one entry or a batch of entries, each with an optional full-resolution photo, and writes them into the same data the Capture page writes (inspections, croc status, cull marker, condition pins, photo history).
2. **A downloadable reference HTML page** (`CrocTrack_Capture_Reference.html`) - a single self-contained file that copies the Capture page: House / Line / Pen / Tag / Size / Date / Cull fields, the tap-to-pin croc diagram with the condition list, photo attach, an offline pending queue, and a "Send" button that calls the endpoint. It works opened straight from the phone and is meant as a blueprint to rebuild from.
3. **A protocol document** (`CrocTrack_Capture_API_Protocol.md`) covering everything your app must send.

## Endpoint behaviour

- `POST /functions/v1/ingest-capture` - JSON batch of entries (photo sent as base64 or as a separate upload, see below).
- `POST /functions/v1/ingest-capture/photo` - raw image upload (multipart), returns a photo reference to attach to an entry. Suited to large 4K files.
- `GET /functions/v1/ingest-capture/conditions` - current condition code list (so your app stays in sync).
- `GET /functions/v1/ingest-capture/health` - connection/key check.
- Secured with a private **API key** in an `x-api-key` header (separate from the website key, can be changed any time).
- Each entry carries a `client_id` (unique id made by your app) so re-sending after a bad connection never creates duplicates.
- Same rules as the Capture page: Cull values `NXT/1/2/3/CULLED`, CULLED marks the croc culled and clears the pen; pen movement/tenure history updated; size in cm.
- Per-entry results returned (saved / duplicate / rejected + reason) so your app knows what to clear from its queue.

## Protocol document contents

- Base URL, headers, API key handling
- Full field list with types, required/optional, allowed values and examples
- Condition pin format (zone, x/y position on the diagram, code)
- Photo rules: JPEG/PNG, full resolution kept, size limit, two upload options
- Request/response examples (curl + JavaScript + Kotlin snippet)
- Error codes, retry and offline-queue guidance, idempotency
- Date/time format and time zone

## Setup steps you will need to do once

Because your database is your own Supabase project, the endpoint has to be deployed there by you: I will provide the function code plus a short SQL file (adds the `client_id` duplicate guard) and exact deploy commands. You set the API key as a secret in Supabase.

## Technical details

- Supabase Edge Function (Deno) at `supabase/functions/ingest-capture/index.ts`, using the service role key server-side; reuses the parsing/normalising rules from `inspectionParser.ts` (normaliseCull, pen id mapping) duplicated into the function.
- SQL: `alter table inspections add column client_id text unique`; photos stored in existing `croc-photos` bucket + `croc_photos` rows.
- Files delivered to Files: reference HTML, protocol MD, SQL file, and a copy of the function source.
- Not verifiable by me: actual deployment to your Supabase project and calls from your app.
