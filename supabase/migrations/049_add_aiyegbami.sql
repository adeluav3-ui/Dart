-- Add Aiyegbami as a coming-soon area.
-- Admin will add the GPS pin via /admin/areas; pin route auto-promotes to active.

INSERT INTO zones (name, is_active)
SELECT 'Aiyegbami', false
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE name ILIKE 'Aiyegbami');

INSERT INTO areas (name, district, zone_id, aliases, status, is_active, sort_order, gate_pickup)
SELECT
  'Aiyegbami',
  null,
  z.id,
  ARRAY['aiyegbami'],
  'coming_soon',
  false,
  COALESCE((SELECT MAX(sort_order) FROM areas), 0) + 1,
  false
FROM zones z
WHERE z.name = 'Aiyegbami'
  AND NOT EXISTS (SELECT 1 FROM areas WHERE name ILIKE 'Aiyegbami');
