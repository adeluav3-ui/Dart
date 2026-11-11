-- ============================================================
-- 042 – Add payout_bank_code to vendors and riders
--
-- Monnify's Single Transfer API requires the bank code (e.g. "044"),
-- not the bank name string. Store it alongside the existing payout_bank
-- (name) column so withdrawals can be initiated automatically.
-- ============================================================

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payout_bank_code text;
ALTER TABLE riders  ADD COLUMN IF NOT EXISTS payout_bank_code text;
