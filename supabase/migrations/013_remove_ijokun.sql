-- Remove the old "Ijokun" area (incorrect spelling created in migration 004).
-- "Ijoku" (migration 008) is the correct and only name.
DELETE FROM areas WHERE lower(name) = 'ijokun';

-- Strip 'Ijokun' / 'ijokun' alias from the Ijoku area so it no longer
-- appears anywhere in the app under that misspelling.
UPDATE areas
SET aliases = array_remove(array_remove(aliases, 'Ijokun'), 'ijokun')
WHERE lower(name) = 'ijoku';
