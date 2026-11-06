# Project rules

- Until a verified data migration, existing farm-data imports resolve to the legacy-data client via matching Vite and TypeScript aliases; leave generated Cloud integration files untouched to avoid redirecting production data to an empty database.

- External capture apps write through the `ingest-capture` edge function (x-api-key auth, client_id idempotency via `capture_ingest_log`); keep its commit logic in sync with `FieldCaptureScreen.commitAll` so both paths store identical data.
