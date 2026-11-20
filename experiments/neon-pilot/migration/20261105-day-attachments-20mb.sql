-- Viaggio / Neon: align trip/day attachment metadata with the 20 MiB client limit.
-- Apply separately to the two production Neon projects (viaggio-lab-onboarding-01 and -02),
-- database viaggio_lab. Do NOT apply to the old Supabase database.
-- Previous check: size_bytes > 0 AND size_bytes <= 6291456 (6 MiB).
-- Media upload endpoint accepts up to 25,000,000 bytes; 20 MiB = 20,971,520 bytes.
-- This operation changes metadata validation only; existing attachments are preserved.
ALTER TABLE viaggio_app.day_attachments
  DROP CONSTRAINT day_attachments_size_bytes_check,
  ADD CONSTRAINT day_attachments_size_bytes_check
  CHECK (size_bytes > 0 AND size_bytes <= 20971520);
