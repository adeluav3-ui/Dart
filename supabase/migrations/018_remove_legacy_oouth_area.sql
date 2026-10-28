-- Remove the original combined "OOUTH and hospital road" area created in migration 004.
-- It was superseded in migration 008 by three distinct areas:
--   OOUTH Main Gate, OOUTH Back Gate, Hospital Road.
-- The combined name is misleading and should no longer appear anywhere in the app.

DELETE FROM areas WHERE lower(name) = 'oouth and hospital road';
