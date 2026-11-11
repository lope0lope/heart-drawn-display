# Project rules

- Farm imports resolve to the Cloud data adapter through matching Vite/TypeScript aliases; keep generated integration files untouched. Account-free reads use RLS, while writes pass through a connection-key-checked function so public clients cannot alter farm data directly.

- External apps and Field Capture both commit through `ingest-capture`; the app's own origins upload keyless while external apps need x-api-key, and transactional client_id idempotency; one commit path prevents drift. Store original photo bytes privately and resolve temporary signed URLs for viewing.

- The Data Entry Sheet keeps drafts on the device (autosaved) and commits rows through `ingest-capture` like Field Capture; condition codes in the Comment column become general-zone marks, so all capture paths share one commit route.
