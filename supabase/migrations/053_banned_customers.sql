-- Table to store banned email/phone combinations.
-- Checked by handle_new_user so banned identifiers can never re-register.
CREATE TABLE IF NOT EXISTS banned_customers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,                                           -- original user, for reference
  email      text,
  phone      text,
  reason     text,
  banned_at  timestamptz NOT NULL DEFAULT now(),
  banned_by  uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE banned_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage banned_customers"
  ON banned_customers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Block banned emails from creating a new account.
-- Raising an exception rolls back the auth.users INSERT → signup fails.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM banned_customers WHERE email = NEW.email
  ) THEN
    RAISE EXCEPTION 'This account is banned from GoCart.';
  END IF;

  INSERT INTO profiles (id, phone, full_name, role)
  VALUES (
    NEW.id,
    NULLIF(COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'), ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
END;
$$;
