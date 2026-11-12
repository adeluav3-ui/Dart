-- Remove OOUTH Back gate and rename OOUTH Main gate → OOUTH
DELETE FROM areas WHERE name ILIKE 'OOUTH Back gate%';
UPDATE areas SET name = 'OOUTH' WHERE name ILIKE 'OOUTH Main gate%';

-- Fix existing active areas that were saved before is_active was synced with status
UPDATE areas SET is_active = true  WHERE status = 'active'       AND is_active = false;
UPDATE areas SET is_active = false WHERE status = 'coming_soon'  AND is_active = true;

-- Promote pinned areas that are still marked coming_soon to active
UPDATE areas
SET status = 'active', is_active = true
WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = 'coming_soon';
