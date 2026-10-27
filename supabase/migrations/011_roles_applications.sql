-- ============================================================
-- 011 – roles array, last_dashboard, applications table
-- Strategy: keep `role` column as trigger-maintained cache
-- (highest privilege from roles[]) so existing RLS stays intact.
-- ============================================================

-- ── 1. Add new columns to profiles ───────────────────────────
alter table profiles
  add column if not exists roles          text[]  not null default array['customer']::text[],
  add column if not exists last_dashboard text;

-- ── 2. Migrate existing role data into roles array ────────────
update profiles set roles = array['customer']::text[]         where role = 'customer';
update profiles set roles = array['customer','vendor']::text[] where role = 'vendor';
update profiles set roles = array['customer','rider']::text[]  where role = 'rider';
update profiles set roles = array['customer','admin']::text[]  where role = 'admin';

-- ── 3. Trigger: keep role synced from roles (highest privilege) ─
create or replace function sync_role_from_roles()
returns trigger language plpgsql as $$
begin
  new.role :=
    case
      when 'admin'  = any(new.roles) then 'admin'
      when 'vendor' = any(new.roles) then 'vendor'
      when 'rider'  = any(new.roles) then 'rider'
      else 'customer'
    end;
  return new;
end;
$$;

drop trigger if exists trg_sync_role on profiles;
create trigger trg_sync_role
  before insert or update of roles on profiles
  for each row execute function sync_role_from_roles();

-- ── 4. Update handle_new_user to also initialise roles ────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, phone, role, roles)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    'customer',
    array['customer']::text[]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 5. applications table ─────────────────────────────────────
create table if not exists applications (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  kind        text        not null check (kind in ('vendor', 'rider')),
  status      text        not null default 'submitted'
              check (status in ('submitted', 'contacted', 'approved', 'rejected')),
  data        jsonb       not null default '{}',
  admin_note  text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

-- Prevent duplicate open applications (one per user per kind while active)
create unique index if not exists applications_user_kind_open
  on applications (user_id, kind)
  where status in ('submitted', 'contacted');

alter table applications enable row level security;

drop policy if exists "Users read own applications"   on applications;
drop policy if exists "Users submit applications"      on applications;
drop policy if exists "Admins manage applications"     on applications;

create policy "Users read own applications"
  on applications for select using (user_id = auth.uid());

create policy "Users submit applications"
  on applications for insert with check (user_id = auth.uid());

create policy "Admins manage applications"
  on applications for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
