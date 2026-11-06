# Project rules

- Farm imports resolve to the Cloud data adapter through matching Vite/TypeScript aliases; keep generated integration files untouched. Account-free reads use RLS, while writes pass through a connection-key-checked function so public clients cannot alter farm data directly.

- External apps and Field Capture both commit through `ingest-capture` with x-api-key auth and transactional client_id idempotency; one commit path prevents drift. Store original photo bytes privately and resolve temporary signed URLs for viewing.
