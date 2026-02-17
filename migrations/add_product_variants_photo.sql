-- DoorDash Integrated Modifier Images: optional photo per variant (option-level original_image_url).
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS photo TEXT;

COMMENT ON COLUMN product_variants.photo IS 'Optional image path or URL for DoorDash modifier (option) images. Same rules as item images: .jpg/.jpeg/.png, public URL.';
