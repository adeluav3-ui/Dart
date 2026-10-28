-- Flip all existing non-live menu items to live.
-- The review workflow has been removed; vendors' items go live on save.
UPDATE menu_items
SET status = 'live'
WHERE status IN ('draft', 'in_review', 'rejected');
