-- Pin metadata on areas (lat/lng already exist from 004)
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS accuracy_m   real,
  ADD COLUMN IF NOT EXISTS pin_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS pin_saved_by uuid REFERENCES auth.users(id);

-- One row per replaced pin — enables undo
CREATE TABLE IF NOT EXISTS area_pin_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id     uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  accuracy_m  real,
  saved_at    timestamptz NOT NULL,
  saved_by    uuid REFERENCES auth.users(id),
  replaced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE area_pin_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_pin_history"
  ON area_pin_history FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Tracks GPS detection suggestions vs. final customer choice
CREATE TABLE IF NOT EXISTS location_detection_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id_suggested uuid REFERENCES areas(id),
  area_id_chosen    uuid REFERENCES areas(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE location_detection_log ENABLE ROW LEVEL SECURITY;
-- Anonymous customers can insert (no PII stored)
CREATE POLICY "anon_insert_detection_log"
  ON location_detection_log FOR INSERT
  WITH CHECK (true);
CREATE POLICY "admin_read_detection_log"
  ON location_detection_log FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
