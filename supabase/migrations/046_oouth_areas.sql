-- Remove OOUTH Back gate and rename OOUTH Main gate → OOUTH
DELETE FROM areas WHERE name ILIKE 'OOUTH Back gate%';
UPDATE areas SET name = 'OOUTH' WHERE name ILIKE 'OOUTH Main gate%';

-- Fix existing active areas that were saved before is_active was synced with status
UPDATE areas SET is_active = true  WHERE status = 'active'       AND is_active = false;
UPDATE areas SET is_active = false WHERE status = 'coming_soon'  AND is_active = true;
