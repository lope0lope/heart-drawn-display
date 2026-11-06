# Project rules

- External capture apps write through the `ingest-capture` edge function (x-api-key auth, client_id idempotency via `capture_ingest_log`); keep its commit logic in sync with `FieldCaptureScreen.commitAll` so both paths store identical data.
