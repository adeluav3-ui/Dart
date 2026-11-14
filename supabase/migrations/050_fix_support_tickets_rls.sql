-- Fix admin RLS policy on support_tickets: used profiles.roles (array, doesn't exist)
-- instead of profiles.role (the actual column).
DROP POLICY IF EXISTS "admins can do all on tickets" ON support_tickets;

CREATE POLICY "admins can do all on tickets"
  ON support_tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
