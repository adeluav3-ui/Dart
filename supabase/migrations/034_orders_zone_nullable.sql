-- ============================================================
-- 034 – Make orders.zone_id nullable
-- Custom map-pin deliveries have no zone; the NOT NULL
-- constraint was blocking checkout for those orders.
-- ============================================================

ALTER TABLE orders
  ALTER COLUMN zone_id DROP NOT NULL;
