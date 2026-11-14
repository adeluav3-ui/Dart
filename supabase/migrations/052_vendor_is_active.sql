-- Add is_active to vendors table; all existing vendors default to active.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
