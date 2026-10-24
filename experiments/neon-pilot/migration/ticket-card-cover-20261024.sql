-- Independent cover artwork for the Tickets gallery.
-- Card images are separate from the receipt in storage_path.
ALTER TABLE viaggio_app.day_attachments
  ADD COLUMN IF NOT EXISTS card_image_path text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='viaggio_app.day_attachments'::regclass
      AND conname='day_attachments_card_image_path_check'
  ) THEN
    ALTER TABLE viaggio_app.day_attachments
      ADD CONSTRAINT day_attachments_card_image_path_check CHECK (
        card_image_path IS NULL OR (
          split_part(card_image_path,'/',1)=trip_id::text
          AND split_part(card_image_path,'/',2)='general'
          AND card_image_path ~ '^[0-9a-f-]+/general/card-[0-9a-f-]+\\.webp$'
        )
      );
  END IF;
END $$;
GRANT UPDATE(card_image_path) ON viaggio_app.day_attachments TO authenticated;