-- Expand card cover file formats without weakening path isolation.
-- Existing .webp covers remain valid. The original receipt is untouched.
BEGIN;
ALTER TABLE viaggio_app.day_attachments
  DROP CONSTRAINT IF EXISTS day_attachments_card_image_path_check;
ALTER TABLE viaggio_app.day_attachments
  ADD CONSTRAINT day_attachments_card_image_path_check
  CHECK (
    card_image_path IS NULL OR (
      split_part(card_image_path,'/',1)=trip_id::text
      AND split_part(card_image_path,'/',2)='general'
      AND array_length(string_to_array(card_image_path,'/'),1)=3
      AND split_part(card_image_path,'/',3) LIKE 'card-%'
      AND (
        right(card_image_path,5)='.webp'
        OR right(card_image_path,4)='.jpg'
        OR right(card_image_path,4)='.png'
      )
    )
  );
COMMIT;
