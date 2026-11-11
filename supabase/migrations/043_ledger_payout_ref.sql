-- Track in-flight Monnify disbursements.
-- Set when withdrawal is initiated (PENDING); cleared on FAILED or left on SUCCESS.
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS payout_ref text;

CREATE INDEX IF NOT EXISTS idx_ledger_payout_ref
  ON ledger_entries(payout_ref)
  WHERE payout_ref IS NOT NULL;
