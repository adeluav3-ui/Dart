-- ============================================================
-- 028 – Order event notification triggers
-- Auto-enqueue notifications when order status changes.
-- ============================================================

-- ── Trigger function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION _notify_on_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  orders;
  v_vendor vendors;
  v_rider  profiles;
  v_items  jsonb;
  v_dlabel text;
  v_fname  text;
  v_email  text;
BEGIN
  -- Only handle transitions that need notifications
  IF NEW.to_status NOT IN ('paid', 'picked_up', 'delivered', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_order  FROM orders  WHERE id = NEW.order_id;
  SELECT * INTO v_vendor FROM vendors WHERE id = v_order.vendor_id;

  -- Customer email (auth schema accessible from SECURITY DEFINER)
  SELECT email INTO v_email FROM auth.users WHERE id = v_order.customer_id;

  -- Delivery label: prefer area_name over address_zone
  v_dlabel := CONCAT_WS(', ',
    NULLIF(TRIM(COALESCE(v_order.area_name, v_order.address_zone, '')), ''),
    NULLIF(TRIM(COALESCE(v_order.address_landmark, '')), '')
  );

  -- Order items as JSON (for receipt / delivered emails)
  SELECT jsonb_agg(
    jsonb_build_object(
      'name',       oi.name_snapshot,
      'qty',        oi.qty,
      'options',    CASE
                      WHEN oi.options_snapshot IS NOT NULL
                        AND jsonb_typeof(oi.options_snapshot) = 'array'
                        AND jsonb_array_length(oi.options_snapshot) > 0
                      THEN (SELECT string_agg(o->>'name', ', ')
                            FROM jsonb_array_elements(oi.options_snapshot) o)
                      ELSE NULL
                    END,
      'line_total', oi.line_total
    ) ORDER BY oi.created_at
  ) INTO v_items
  FROM order_items oi
  WHERE oi.order_id = NEW.order_id;

  -- ── paid → receipt ────────────────────────────────────────────
  IF NEW.to_status = 'paid' THEN

    PERFORM enqueue_notification(
      p_event             := 'receipt',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_email   := v_email,
      p_recipient_role    := 'customer',
      p_channel           := 'email',
      p_title             := 'Order confirmed',
      p_body              := 'Your order ' || v_order.code || ' is confirmed.',
      p_url               := '/track/' || v_order.id::text,
      p_email_subject     := 'Order ' || v_order.code || ' confirmed',
      p_email_template    := 'receipt',
      p_payload           := jsonb_build_object(
        'order_code',    v_order.code,
        'vendor_name',   COALESCE(v_vendor.name, ''),
        'items',         COALESCE(v_items, '[]'::jsonb),
        'subtotal',      v_order.subtotal,
        'delivery_fee',  v_order.delivery_fee,
        'service_fee',   v_order.service_fee,
        'total',         v_order.total,
        'delivery_label', v_dlabel,
        'order_id',      v_order.id::text
      ),
      p_dedupe_key        := 'receipt:' || NEW.order_id
    );

    PERFORM enqueue_notification(
      p_event             := 'receipt',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_role    := 'customer',
      p_channel           := 'push',
      p_title             := 'Order confirmed',
      p_body              := v_order.code || ' from ' || COALESCE(v_vendor.name, 'your vendor') || ' is confirmed.',
      p_url               := '/track/' || v_order.id::text,
      p_dedupe_key        := 'receipt_push:' || NEW.order_id
    );

    -- Push alert to vendor
    PERFORM enqueue_notification(
      p_event             := 'vendor_new_order',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_vendor.owner_id,
      p_recipient_role    := 'vendor',
      p_channel           := 'push',
      p_title             := 'New order!',
      p_body              := v_order.code,
      p_url               := '/vendor',
      p_dedupe_key        := 'vendor_new_order:' || NEW.order_id
    );

  -- ── picked_up → on_the_way ────────────────────────────────────
  ELSIF NEW.to_status = 'picked_up' THEN

    SELECT * INTO v_rider FROM profiles WHERE id = v_order.rider_id;
    v_fname := split_part(COALESCE(v_rider.full_name, 'Your rider'), ' ', 1);

    PERFORM enqueue_notification(
      p_event             := 'on_the_way',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_email   := v_email,
      p_recipient_role    := 'customer',
      p_channel           := 'email',
      p_title             := 'Your order is on the way',
      p_body              := v_fname || ' has your order and is on the way.',
      p_url               := '/track/' || v_order.id::text,
      p_email_subject     := 'Your order ' || v_order.code || ' is on the way',
      p_email_template    := 'on_the_way',
      p_payload           := jsonb_build_object(
        'order_code',       v_order.code,
        'rider_first_name', v_fname,
        'rider_phone',      COALESCE(v_rider.phone, ''),
        'pin',              COALESCE(v_order.delivery_pin, ''),
        'delivery_label',   v_dlabel,
        'order_id',         v_order.id::text
      ),
      p_dedupe_key        := 'on_the_way:' || NEW.order_id
    );

    PERFORM enqueue_notification(
      p_event             := 'on_the_way',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_role    := 'customer',
      p_channel           := 'push',
      p_title             := 'On the way!',
      p_body              := v_fname || ' has your order and is coming to you.',
      p_url               := '/track/' || v_order.id::text,
      p_dedupe_key        := 'on_the_way_push:' || NEW.order_id
    );

  -- ── delivered ────────────────────────────────────────────────
  ELSIF NEW.to_status = 'delivered' THEN

    PERFORM enqueue_notification(
      p_event             := 'delivered',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_email   := v_email,
      p_recipient_role    := 'customer',
      p_channel           := 'email',
      p_title             := 'Delivered!',
      p_body              := 'Your order ' || v_order.code || ' has been delivered.',
      p_url               := '/rate/' || v_order.id::text,
      p_email_subject     := 'Order ' || v_order.code || ' delivered — how was it?',
      p_email_template    := 'delivered',
      p_payload           := jsonb_build_object(
        'order_code',   v_order.code,
        'vendor_name',  COALESCE(v_vendor.name, ''),
        'items',        COALESCE(v_items, '[]'::jsonb),
        'subtotal',     v_order.subtotal,
        'delivery_fee', v_order.delivery_fee,
        'service_fee',  v_order.service_fee,
        'total',        v_order.total,
        'delivered_at', to_char(now() AT TIME ZONE 'Africa/Lagos', 'HH12:MI AM'),
        'order_id',     v_order.id::text
      ),
      p_dedupe_key        := 'delivered:' || NEW.order_id
    );

    PERFORM enqueue_notification(
      p_event             := 'delivered',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_role    := 'customer',
      p_channel           := 'push',
      p_title             := 'Delivered!',
      p_body              := v_order.code || ' has been delivered. Enjoy!',
      p_url               := '/rate/' || v_order.id::text,
      p_dedupe_key        := 'delivered_push:' || NEW.order_id
    );

  -- ── cancelled → cancelled_refund ─────────────────────────────
  ELSIF NEW.to_status = 'cancelled' THEN

    PERFORM enqueue_notification(
      p_event             := 'cancelled_refund',
      p_order_id          := NEW.order_id,
      p_recipient_user_id := v_order.customer_id,
      p_recipient_email   := v_email,
      p_recipient_role    := 'customer',
      p_channel           := 'email',
      p_title             := 'Order cancelled',
      p_body              := 'Your order ' || v_order.code || ' was cancelled.',
      p_url               := '/track/' || v_order.id::text,
      p_email_subject     := 'Order ' || v_order.code || ' was cancelled',
      p_email_template    := 'cancelled_refund',
      p_payload           := jsonb_build_object(
        'order_code',         v_order.code,
        'vendor_name',        COALESCE(v_vendor.name, ''),
        'amount',             v_order.total,
        'refund_destination', 'wallet',
        'order_id',           v_order.id::text
      ),
      p_dedupe_key        := 'cancelled_refund:' || NEW.order_id
    );

    -- Auto-cancel by pg_cron (actor_id NULL) → vendor_missed email
    IF NEW.actor_id IS NULL THEN
      PERFORM enqueue_notification(
        p_event             := 'vendor_missed',
        p_order_id          := NEW.order_id,
        p_recipient_user_id := v_vendor.owner_id,
        p_recipient_role    := 'vendor',
        p_channel           := 'email',
        p_title             := 'Order timed out',
        p_body              := 'Order ' || v_order.code || ' was auto-cancelled.',
        p_email_subject     := 'Order ' || v_order.code || ' timed out',
        p_email_template    := 'vendor_missed',
        p_payload           := jsonb_build_object(
          'order_code',       v_order.code,
          'vendor_name',      COALESCE(v_vendor.name, ''),
          'auto_rejected_at', to_char(now() AT TIME ZONE 'Africa/Lagos', 'DD Mon YYYY, HH12:MI AM')
        ),
        p_dedupe_key        := 'vendor_missed:' || NEW.order_id
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_order_event ON order_events;
CREATE TRIGGER notify_on_order_event
  AFTER INSERT ON order_events
  FOR EACH ROW
  EXECUTE FUNCTION _notify_on_order_event();
