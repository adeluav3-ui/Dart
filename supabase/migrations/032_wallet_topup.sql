-- ============================================================
-- 032: Wallet top-up support
-- ============================================================

-- 1. Add 'topup' to the ledger_kind enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'topup'
      AND enumtypid = 'ledger_kind'::regtype
  ) THEN
    ALTER TYPE ledger_kind ADD VALUE 'topup';
  END IF;
END$$;

-- 2. Make payments.order_id nullable (topup payments have no order)
ALTER TABLE payments
  ALTER COLUMN order_id DROP NOT NULL;

-- Drop and re-add the FK so it remains intact but allows NULL
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
ALTER TABLE payments
  ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 3. Add payment type and topup owner columns
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS topup_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_type_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_type_check
  CHECK (type IN ('order', 'wallet_topup'));

-- 4. Make ledger_entries.order_id nullable (topup ledger entries have no order)
ALTER TABLE ledger_entries
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_order_id_fkey;
ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 5. Add wallet_applied_kobo to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS wallet_applied_kobo integer NOT NULL DEFAULT 0;

-- 6. RLS: allow topup owner to read their topup payment rows
DROP POLICY IF EXISTS "Topup owner can read own topup payment" ON payments;
CREATE POLICY "Topup owner can read own topup payment"
  ON payments FOR SELECT
  USING (topup_user_id = auth.uid());
