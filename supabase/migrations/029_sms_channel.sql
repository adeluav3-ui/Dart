-- ============================================================
-- 029 – SMS channel
-- Adds 'sms' to notifications.channel and auto-enqueues SMS
-- for key order events via a new trigger function.
-- ============================================================

-- ── Extend channel check to include sms ──────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_channel_check
  CHECK (channel IN ('email', 'push', 'sms'));

-- ── SMS trigger function ──────────────────────────────────────
-- Runs after notify_on_order_event (alphabetical trigger order:
-- 'n' before 'n' — same prefix, but the trigger names differ so
-- Postgres fires them in creation order; both run in the same tx).
CREATE OR REPLACE FUNCTION _notify_sms_on_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  orders;
  v_vendor vendors;
BEGIN
  IF NEW.to_status NOT IN ('paid', 'picked_up', 'delivered', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_order  FROM orders  WHERE id = NEW.order_id;
  SELECT * INTO v_vendor FROM vendors WHERE id = v_order.vendor_id;

  -- ── paid: SMS to customer with PIN ───────────────────────────
  IF NEW.to_status = 'paid' THEN

    PERFORM enqueue_notification(
      p_event             := 'receipt',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_role    := 'customer',
      p_channel           := 'sms',
      p_title             := 'Order confirmed',
      p_body              := 'GoCart: Order ' || v_order.code || ' confirmed! PIN: '
                             || COALESCE(v_order.delivery_pin, '----')
                             || '. Give this to your rider ONLY when your order is in hand.',
      p_dedupe_key        := 'receipt_sms:' || NEW.order_id
    );

    -- Vendor SMS reminder 2 min after payment (skipped by dispatcher if order
    -- is no longer 'paid', i.e. vendor already accepted/rejected)
    PERFORM enqueue_notification(
      p_event             := 'vendor_new_order',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_vendor.owner_id,
      p_recipient_role    := 'vendor',
      p_channel           := 'sms',
      p_title             := 'New order',
      p_body              := 'GoCart: New order ' || v_order.code
                             || '. Open the GoCart app to accept — it auto-cancels in 8 mins.',
      p_dedupe_key        := 'vendor_new_order_sms:' || NEW.order_id,
      p_send_after        := now() + interval '2 minutes'
    );

  -- ── picked_up: SMS to customer with PIN reminder ─────────────
  ELSIF NEW.to_status = 'picked_up' THEN

    PERFORM enqueue_notification(
      p_event             := 'on_the_way',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_role    := 'customer',
      p_channel           := 'sms',
      p_title             := 'Order on the way',
      p_body              := 'GoCart: ' || v_order.code || ' is on the way! PIN: '
                             || COALESCE(v_order.delivery_pin, '----')
                             || '. Only share when order is in hand.',
      p_dedupe_key        := 'on_the_way_sms:' || NEW.order_id
    );

  -- ── delivered: SMS to customer ───────────────────────────────
  ELSIF NEW.to_status = 'delivered' THEN

    PERFORM enqueue_notification(
      p_event             := 'delivered',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_role    := 'customer',
      p_channel           := 'sms',
      p_title             := 'Delivered',
      p_body              := 'GoCart: ' || v_order.code || ' has been delivered. Enjoy!',
      p_dedupe_key        := 'delivered_sms:' || NEW.order_id
    );

  -- ── cancelled: SMS to customer ───────────────────────────────
  ELSIF NEW.to_status = 'cancelled' THEN

    PERFORM enqueue_notification(
      p_event             := 'cancelled_refund',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_role    := 'customer',
      p_channel           := 'sms',
      p_title             := 'Order cancelled',
      p_body              := 'GoCart: Order ' || v_order.code
                             || ' was cancelled. Your refund will be added to your wallet credit.',
      p_dedupe_key        := 'cancelled_refund_sms:' || NEW.order_id
    );

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_sms_on_order_event ON order_events;
CREATE TRIGGER notify_sms_on_order_event
  AFTER INSERT ON order_events
  FOR EACH ROW
  EXECUTE FUNCTION _notify_sms_on_order_event();
