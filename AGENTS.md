# Project rules

- Farm imports resolve to the Cloud data adapter through matching Vite/TypeScript aliases; keep generated integration files untouched. Account-free reads use RLS, while writes pass through a connection-key-checked function so public clients cannot alter farm data directly.

- External apps and Field Capture both commit through `ingest-capture`; the app's own origins upload keyless while external apps need x-api-key, and transactional client_id idempotency; one commit path prevents drift. Store original photo bytes privately and resolve temporary signed URLs for viewing.

- The Data Entry Sheet keeps drafts on the device (autosaved) and commits rows through `ingest-capture` like Field Capture; condition codes in the Comment column become general-zone marks, so all capture paths share one commit route.

- Full dataset wipes use the authorized `farm-write/wipe` endpoint and service-only transactional `wipe_farm_data` function; clear API deduplication and photo-history dependencies before crocs so wipes cannot silently leave API entries behind. Device drafts and unreferenced storage bytes are not cleared by a dataset wipe.

- Every wipe DELETE must use an explicit predicate on its non-null primary key; Cloud rejects unqualified DELETE statements even inside service-only functions.

- Hide-layout touch zones use labelled polygons transformed with the upright image; keep their uniformly scaled coordinates within the existing capture API bounds so uploads remain compatible.
