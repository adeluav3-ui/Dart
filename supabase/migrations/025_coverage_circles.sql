-- §1 radius_m on areas
ALTER TABLE areas ADD COLUMN IF NOT EXISTS radius_m integer NOT NULL DEFAULT 800;

-- §4 delivery_spots
CREATE TABLE IF NOT EXISTS delivery_spots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label       text NOT NULL CHECK (label IN ('Home', 'Hostel', 'Work', 'Other')),
  custom_label text,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  area_id     uuid REFERENCES areas,
  description text,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own spots"
  ON delivery_spots FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
