-- ============================================================
-- 039 – Write customer wallet refund inside transition_order
--
-- Auto-cancel runs transition_order directly via pg_cron, so the
-- refund must live in the DB function — not in the Next.js route.
-- Covers: paid → cancelled, accepted → cancelled.
-- pending_payment → cancelled needs no refund (customer never paid).
-- ============================================================

CREATE OR REPLACE FUNCTION transition_order(
  p_order_id  uuid,
  p_to_status order_status,
  p_actor_id  uuid DEFAULT null,
  p_note      text DEFAULT null,
  p_prep_mins int  DEFAULT null
)
RETURNS orders LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order       orders;
  v_from_status order_status;
  v_allowed     boolean := false;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  v_from_status := v_order.status;

  v_allowed := CASE
    WHEN v_order.status = 'pending_payment' AND p_to_status = 'paid'      THEN true
    WHEN v_order.status = 'pending_payment' AND p_to_status = 'expired'   THEN true
    WHEN v_order.status = 'pending_payment' AND p_to_status = 'cancelled' THEN true
    WHEN v_order.status = 'paid'            AND p_to_status = 'accepted'  THEN true
    WHEN v_order.status = 'paid'            AND p_to_status = 'cancelled' THEN true
    WHEN v_order.status = 'accepted'        AND p_to_status = 'ready'     THEN true
    WHEN v_order.status = 'accepted'        AND p_to_status = 'cancelled' THEN true
    WHEN v_order.status = 'ready'           AND p_to_status = 'picked_up' THEN true
    WHEN v_order.status = 'picked_up'       AND p_to_status = 'delivered' THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', v_order.status, p_to_status;
  END IF;

  UPDATE orders SET
    status       = p_to_status,
    prep_mins    = COALESCE(p_prep_mins, prep_mins),
    paid_at      = CASE WHEN p_to_status = 'paid'      THEN now() ELSE paid_at      END,
    accepted_at  = CASE WHEN p_to_status = 'accepted'  THEN now() ELSE accepted_at  END,
    ready_at     = CASE WHEN p_to_status = 'ready'     THEN now() ELSE ready_at     END,
    picked_up_at = CASE WHEN p_to_status = 'picked_up' THEN now() ELSE picked_up_at END,
    delivered_at = CASE WHEN p_to_status = 'delivered' THEN now() ELSE delivered_at END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO order_events (order_id, from_status, to_status, actor_id, note)
  VALUES (p_order_id, v_from_status, p_to_status, p_actor_id, p_note);

  -- On delivery: write vendor / rider / platform earnings
  IF p_to_status = 'delivered' THEN
    PERFORM write_delivery_ledger(p_order_id);
  END IF;

  -- On cancellation from a paid state: refund the full order total to the
  -- customer wallet and mark the payment record as refunded.
  IF p_to_status = 'cancelled' AND v_from_status IN ('paid', 'accepted') THEN
    INSERT INTO ledger_entries (order_id, party_type, party_id, amount, kind, note)
    VALUES (
      p_order_id,
      'customer',
      v_order.customer_id,
      v_order.total,
      'refund',
      CASE
        WHEN p_actor_id IS NULL THEN 'Auto-cancelled: no vendor response'
        ELSE 'Order cancelled — full refund'
      END
    );

    UPDATE payments
    SET    status = 'refunded'
    WHERE  order_id = p_order_id
      AND  status   = 'paid';
  END IF;

  RETURN v_order;
END;
$$;
