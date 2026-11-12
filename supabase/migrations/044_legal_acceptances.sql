-- Legal document acceptances
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_slug    text        NOT NULL,
  document_version text        NOT NULL,
  accepted_at      timestamptz NOT NULL DEFAULT now(),
  role             text        NOT NULL CHECK (role IN ('customer', 'vendor', 'rider')),
  vendor_id        uuid        REFERENCES vendors(id) ON DELETE SET NULL,
  business_type    text        CHECK (business_type IN ('restaurant', 'supermarket', 'pharmacy')),
  ip_address       text,
  user_agent       text
);

-- Idempotent: one row per (user, slug, version, vendor).
-- vendor_id is nullable, so we coerce NULLs to a sentinel UUID for uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS legal_acceptances_unique_idx
  ON legal_acceptances (
    user_id,
    document_slug,
    document_version,
    coalesce(vendor_id::text, '00000000-0000-0000-0000-000000000000')
  );

ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can read their own acceptance rows.
CREATE POLICY "legal_acceptances_select_own"
  ON legal_acceptances FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated users —
-- all writes go through the server's admin client (service role bypasses RLS).

-- SQL helper called from server to gate order/open-shop/available checks.
CREATE OR REPLACE FUNCTION has_accepted_current(
  p_user_id uuid,
  p_slug    text,
  p_version text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM legal_acceptances
    WHERE user_id          = p_user_id
      AND document_slug    = p_slug
      AND document_version = p_version
  );
$$;
