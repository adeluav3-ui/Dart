-- ============================================================
-- 022 – Distance-based delivery pricing
-- ============================================================

-- ── vendors: direct lat/lng pin ──────────────────────────────
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- ── delivery_pricing_settings (single admin-editable row) ────
CREATE TABLE IF NOT EXISTS delivery_pricing_settings (
  id                    int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_fare_kobo        int  NOT NULL DEFAULT 15000,
  per_km_kobo           int  NOT NULL DEFAULT 12500,
  min_fare_kobo         int  NOT NULL DEFAULT 20000,
  round_to_kobo         int  NOT NULL DEFAULT 5000,
  rider_extra_kobo      int  NOT NULL DEFAULT 10000,
  gocart_extra_kobo     int  NOT NULL DEFAULT 10000,
  max_distance_m        int  NOT NULL DEFAULT 6000,
  daily_google_call_cap int  NOT NULL DEFAULT 400,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_pricing"
  ON delivery_pricing_settings FOR SELECT USING (true);

CREATE POLICY "admin_update_pricing"
  ON delivery_pricing_settings FOR ALL
  USING  ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

INSERT INTO delivery_pricing_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── route_distance_cache ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_distance_cache (
  key        text PRIMARY KEY,
  distance_m int  NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE route_distance_cache ENABLE ROW LEVEL SECURITY;

-- Only the service-role (admin) client writes to this table
CREATE POLICY "service_manage_cache"
  ON route_distance_cache FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── google_call_log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS google_call_log (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  called_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_manage_call_log"
  ON google_call_log FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admin_read_call_log"
  ON google_call_log FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ── areas: is_active flag ─────────────────────────────────────
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Deactivate OOUTH Back Gate (keep row for existing orders)
UPDATE areas SET is_active = false WHERE name = 'OOUTH Back Gate';

-- Rename Akarigbo Road → Akarigbo Palace
UPDATE areas SET name = 'Akarigbo Palace' WHERE name = 'Akarigbo Road';
UPDATE zones  SET name = 'Akarigbo Palace' WHERE name = 'Akarigbo Road';

-- ── orders: pricing snapshot columns ─────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pin_lat           double precision,
  ADD COLUMN IF NOT EXISTS pin_lng           double precision,
  ADD COLUMN IF NOT EXISTS distance_m        int,
  ADD COLUMN IF NOT EXISTS distance_source   text,
  ADD COLUMN IF NOT EXISTS okada_fare_kobo   int,
  ADD COLUMN IF NOT EXISTS rider_pay_kobo    int,
  ADD COLUMN IF NOT EXISTS delivery_fee_kobo int,
  ADD COLUMN IF NOT EXISTS pricing_snapshot  jsonb;
