-- Raise default max delivery distance from 6 km to 7 km
-- Only applies if still at the original default (doesn't override admin changes)
UPDATE delivery_pricing_settings
SET max_distance_m = 7000
WHERE id = 1
  AND max_distance_m = 6000;
