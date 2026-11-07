-- ============================================================
-- 027 – Notifications system (outbox + push subscriptions upgrade)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA net;

-- ── notifications (outbox) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event             text        NOT NULL,
  order_id          uuid        REFERENCES orders(id) ON DELETE SET NULL,
  recipient_user_id uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_email   text,
  recipient_role    text        NOT NULL CHECK (recipient_role IN ('customer','vendor','rider','admin')),
  channel           text        NOT NULL CHECK (channel IN ('email','push')),
  title             text,
  body              text,
  url               text,
  email_subject     text,
  email_template    text,
  payload           jsonb       NOT NULL DEFAULT '{}',
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','sent','failed','skipped')),
  attempts          int         NOT NULL DEFAULT 0,
  last_error        text,
  send_after        timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz,
  dedupe_key        text        UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_pending_idx
  ON notifications (send_after, attempts)
  WHERE status = 'pending';

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_notifications"
  ON notifications FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "service_manage_notifications"
  ON notifications FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── push_subscriptions: add missing columns ───────────────────
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent     text,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz;

-- ── enqueue_notification ──────────────────────────────────────
CREATE OR REPLACE FUNCTION enqueue_notification(
  p_event             text,
  p_order_id          uuid        DEFAULT NULL,
  p_recipient_user_id uuid        DEFAULT NULL,
  p_recipient_email   text        DEFAULT NULL,
  p_recipient_role    text        DEFAULT 'customer',
  p_channel           text        DEFAULT 'push',
  p_title             text        DEFAULT NULL,
  p_body              text        DEFAULT NULL,
  p_url               text        DEFAULT NULL,
  p_email_subject     text        DEFAULT NULL,
  p_email_template    text        DEFAULT NULL,
  p_payload           jsonb       DEFAULT '{}',
  p_dedupe_key        text        DEFAULT NULL,
  p_send_after        timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_secret text;
BEGIN
  INSERT INTO notifications (
    event, order_id, recipient_user_id, recipient_email, recipient_role,
    channel, title, body, url, email_subject, email_template,
    payload, dedupe_key, send_after
  ) VALUES (
    p_event, p_order_id, p_recipient_user_id, p_recipient_email, p_recipient_role,
    p_channel, p_title, p_body, p_url, p_email_subject, p_email_template,
    p_payload, p_dedupe_key, p_send_after
  )
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;

  -- Nothing inserted (dedupe hit) — do nothing
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Read dispatch secret from Vault (safe: SECURITY DEFINER runs as owner)
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'internal_dispatch_secret';

  -- Kick the dispatcher immediately (fire-and-forget)
  PERFORM net.http_post(
    url     := 'https://www.gocartng.com/api/internal/notifications/dispatch',
    body    := jsonb_build_object('id', v_id),
    headers := jsonb_build_object(
      'Content-Type',       'application/json',
      'x-dispatch-secret',  v_secret
    ),
    timeout_milliseconds := 5000
  );

  RETURN v_id;
END;
$$;

-- ── pg_cron: retry sweeper (every minute) ─────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-notifications-sweep');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-notifications-sweep',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://www.gocartng.com/api/internal/notifications/dispatch',
      body    := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type',      'application/json',
        'x-dispatch-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'internal_dispatch_secret'
        )
      ),
      timeout_milliseconds := 5000
    );
  $$
);
