-- ============================================================
-- 030 – Remove SMS channel (email + push only)
-- ============================================================

DROP TRIGGER IF EXISTS notify_sms_on_order_event ON order_events;
DROP FUNCTION IF EXISTS _notify_sms_on_order_event();

-- Revert channel constraint to email + push only
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_channel_check
  CHECK (channel IN ('email', 'push'));

-- Remove any pending SMS notifications
DELETE FROM notifications WHERE channel = 'sms';
