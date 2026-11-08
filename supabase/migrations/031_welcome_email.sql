-- 031 — Send welcome email when a customer completes their profile
--
-- Fires AFTER UPDATE on profiles when full_name and phone both become
-- non-null for the first time. Uses the existing enqueue_notification()
-- infrastructure (outbox → dispatcher → Resend).
-- dedupe_key 'welcome:{id}' ensures it fires at most once per user.

create or replace function _send_welcome_on_profile_complete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text;
begin
  -- Only proceed when both name and phone are being set for the first time
  if not (
    (old.full_name is null or old.phone is null)
    and new.full_name is not null
    and new.phone is not null
  ) then
    return new;
  end if;

  -- Fetch the user's email from auth.users (accessible because SECURITY DEFINER)
  select email into v_email from auth.users where id = new.id;
  if v_email is null then
    return new;
  end if;

  perform enqueue_notification(
    p_event             := 'welcome',
    p_order_id          := null,
    p_recipient_user_id := new.id,
    p_recipient_email   := v_email,
    p_recipient_role    := 'customer',
    p_channel           := 'email',
    p_title             := 'Welcome to GoCart!',
    p_body              := 'Your account is ready. Order food, groceries and pharmacy items delivered to you in Sagamu.',
    p_url               := '/home',
    p_email_subject     := 'Welcome to GoCart',
    p_email_template    := 'welcome',
    p_payload           := jsonb_build_object('name', new.full_name),
    p_dedupe_key        := 'welcome:' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists send_welcome_on_profile_complete on profiles;
create trigger send_welcome_on_profile_complete
  after update on profiles
  for each row
  execute function _send_welcome_on_profile_complete();
