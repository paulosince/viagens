-- Apply to the active auth-federation-validation branches of both user projects.
-- Matches DAY_ATTACHMENT_MAX_BYTES (20 MiB); media gateway permits 25,000,000 bytes.
-- Atomic constraint replacement: no attachments, media records or bytes are changed.
BEGIN;
ALTER TABLE viaggio_app.day_attachments
  DROP CONSTRAINT day_attachments_size_bytes_check,
  ADD CONSTRAINT day_attachments_size_bytes_check
    CHECK (size_bytes > 0 AND size_bytes <= 20971520);
COMMIT;
