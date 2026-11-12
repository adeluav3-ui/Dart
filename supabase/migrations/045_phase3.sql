-- Phase 3 columns: in-store price comparison and banned-word flag reason
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS in_store_price_kobo integer;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS flag_reason text;
