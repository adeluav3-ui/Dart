-- ============================================================
-- 037 – Admin alert: vendor not responding within 5 minutes
-- A pg_cron job runs every minute, finds paid orders older than
-- 5 minutes, and enqueues one admin email per order (deduped).
-- The dispatch route skips the notification if the order has
-- already moved past 'paid' by the time it's dispatched.
-- ============================================================

DO $$
BEGIN
  PERFORM cron.unschedule('alert-vendor-silent');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'alert-vendor-silent',
  '* * * * *',
  $$
    SELECT enqueue_notification(
      p_event          := 'admin_vendor_silent',
      p_order_id       := o.id,
      p_recipient_role := 'admin',
      p_channel        := 'email',
      p_title          := 'Vendor not responding: ' || o.code,
      p_body           := v.name || ' has not accepted ' || o.code || ' for 5+ minutes.',
      p_email_subject  := 'Vendor not responding: ' || o.code,
      p_email_template := 'admin_vendor_silent',
      p_payload        := jsonb_build_object(
        'order_code',  o.code,
        'vendor_name', v.name,
        'paid_at',     to_char(o.paid_at AT TIME ZONE 'Africa/Lagos', 'HH12:MI AM'),
        'order_id',    o.id::text
      ),
      p_dedupe_key     := 'admin_vendor_silent:' || o.id::text
    )
    FROM orders o
    JOIN vendors v ON v.id = o.vendor_id
    WHERE o.status = 'paid'
      AND o.paid_at < now() - interval '5 minutes';
  $$
);
