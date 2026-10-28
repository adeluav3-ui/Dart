-- Add payout account + bike plate to riders
ALTER TABLE riders
  ADD COLUMN IF NOT EXISTS bike_plate text,
  ADD COLUMN IF NOT EXISTS payout_bank text,
  ADD COLUMN IF NOT EXISTS payout_account_name text,
  ADD COLUMN IF NOT EXISTS payout_account_no text;
