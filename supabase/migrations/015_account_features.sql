-- 015 – Account page features
-- Adds: addresses.is_default, profiles.marketing_emails, app_settings, support_tickets

-- addresses: add is_default
alter table addresses
  add column if not exists is_default boolean not null default false;

-- profiles: add marketing_emails
alter table profiles
  add column if not exists marketing_emails boolean not null default true;

-- app_settings
create table if not exists app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

create policy "anyone can read app_settings"
  on app_settings for select using (true);

create policy "admins can modify app_settings"
  on app_settings for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and 'admin' = any(profiles.roles)
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and 'admin' = any(profiles.roles)
    )
  );

insert into app_settings (key, value) values
  ('support_phone', '+2348000000000'),
  ('support_email', 'hello@dart.ng'),
  ('support_hours', 'Mon – Sat · 8 am – 9 pm')
on conflict (key) do nothing;

-- support_tickets
create table if not exists support_tickets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  order_id   uuid references orders(id) on delete set null,
  subject    text not null,
  body       text not null,
  status     text not null default 'open'
               check (status in ('open', 'resolved', 'closed')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table support_tickets enable row level security;

create policy "users can read own tickets"
  on support_tickets for select
  using (user_id = auth.uid());

create policy "users can insert tickets"
  on support_tickets for insert
  with check (user_id = auth.uid());

create policy "admins can do all on tickets"
  on support_tickets for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and 'admin' = any(profiles.roles)
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and 'admin' = any(profiles.roles)
    )
  );
