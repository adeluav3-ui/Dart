-- Fix support email and clear placeholder phone number
INSERT INTO app_settings (key, value)
VALUES ('support_email', 'support@gocartng.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Remove placeholder phone — no real support number yet
DELETE FROM app_settings WHERE key = 'support_phone';
