-- Trigger: when a support ticket is created, email the customer a confirmation
-- and email the admin the full ticket details.

CREATE OR REPLACE FUNCTION notify_support_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_email  text;
  v_customer_name   text;
  v_order_code      text;
BEGIN
  -- Get customer email and name
  SELECT au.email, p.full_name
  INTO v_customer_email, v_customer_name
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.id = NEW.user_id;

  -- Get order code if the ticket is linked to an order
  IF NEW.order_id IS NOT NULL THEN
    SELECT code INTO v_order_code FROM orders WHERE id = NEW.order_id;
  END IF;

  -- Customer confirmation
  IF v_customer_email IS NOT NULL THEN
    PERFORM enqueue_notification(
      p_event             := 'support_ticket_confirm',
      p_recipient_user_id := NEW.user_id,
      p_recipient_email   := v_customer_email,
      p_recipient_role    := 'customer',
      p_channel           := 'email',
      p_email_subject     := 'We received your message — GoCart Support',
      p_email_template    := 'support_ticket_confirm',
      p_payload           := jsonb_build_object(
        'name',       COALESCE(v_customer_name, ''),
        'subject',    NEW.subject,
        'body',       NEW.body,
        'order_code', COALESCE(v_order_code, '')
      ),
      p_dedupe_key := 'support_confirm_' || NEW.id::text
    );
  END IF;

  -- Admin alert with full details
  PERFORM enqueue_notification(
    p_event           := 'admin_support_ticket',
    p_recipient_role  := 'admin',
    p_channel         := 'email',
    p_email_subject   := 'Support: ' || NEW.subject,
    p_email_template  := 'admin_support_ticket',
    p_payload         := jsonb_build_object(
      'customer_email', COALESCE(v_customer_email, 'Unknown'),
      'customer_name',  COALESCE(v_customer_name, ''),
      'subject',        NEW.subject,
      'body',           NEW.body,
      'order_code',     COALESCE(v_order_code, '')
    ),
    p_dedupe_key := 'admin_support_' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_support_ticket_insert
  AFTER INSERT ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION notify_support_ticket();
