-- Add type column so places search/details calls are tracked separately from Routes API calls
ALTER TABLE google_call_log
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'routes';
