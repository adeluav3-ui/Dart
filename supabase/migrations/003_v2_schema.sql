-- ============================================================
-- Dart v2 Schema Updates
-- Auth: email + Google OAuth (phone becomes optional/contact only)
-- Delivery fee: zone_fares (vendor zone → customer zone)
-- New tables: riders, vendor_riders, zone_fares, push_subscriptions
-- ============================================================

-- ============================================================
-- PROFILES: make phone optional (auth is now email-based)
-- ============================================================

alter table profiles
  drop constraint if exists profiles_phone_key,
  alter column phone drop not null;

create unique index if not exists profiles_phone_unique
  on profiles(phone) where phone is not null;

-- Update handle_new_user to work with email auth
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, phone, full_name, role)
  values (
    new.id,
    nullif(coalesce(new.phone, new.raw_user_meta_data->>'phone'), ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer')
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$;

-- ============================================================
-- VENDORS: add zone_id (the zone the vendor operates from)
-- ============================================================

alter table vendors
  add column if not exists zone_id uuid references zones(id) on delete set null;

-- ============================================================
-- ZONE_FARES: (vendor zone → customer zone) delivery fees
-- Replaces flat delivery_fee / rider_pay on zones.
-- Keep zones.delivery_fee / rider_pay for backward compat during migration.
-- ============================================================

create table if not exists zone_fares (
  id           uuid primary key default uuid_generate_v4(),
  from_zone    uuid not null references zones(id) on delete cascade,
  to_zone      uuid not null references zones(id) on delete cascade,
  delivery_fee int not null default 0, -- kobo
  rider_pay    int not null default 0, -- kobo
  unique(from_zone, to_zone)
);

alter table zone_fares enable row level security;

create policy "Zone fares publicly readable"
  on zone_fares for select using (true);

create policy "Admin manages zone fares"
  on zone_fares for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- RIDERS: Dart's own riders, onboarded by admin
-- id = profiles.id so RLS `auth.uid() = id` works
-- ============================================================

create table if not exists riders (
  id         uuid primary key references profiles(id) on delete cascade,
  is_active  boolean not null default true,
  notes      text,
  created_at timestamptz not null default now()
);

alter table riders enable row level security;

create policy "Riders readable by admin and vendors"
  on riders for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'vendor'))
    or id = auth.uid()
  );

create policy "Admin manages riders"
  on riders for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- VENDOR_RIDERS: matched riders per vendor (shown first in dispatch)
-- ============================================================

create table if not exists vendor_riders (
  id         uuid primary key default uuid_generate_v4(),
  vendor_id  uuid not null references vendors(id) on delete cascade,
  rider_id   uuid not null references riders(id) on delete cascade,
  sort_order int not null default 0,
  unique(vendor_id, rider_id)
);

alter table vendor_riders enable row level security;

create policy "Vendor riders readable by admin and owner"
  on vendor_riders for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from vendors where id = vendor_id and owner_id = auth.uid())
  );

create policy "Admin and vendors manage vendor_riders"
  on vendor_riders for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from vendors where id = vendor_id and owner_id = auth.uid())
  );

-- ============================================================
-- ORDERS: add rider_pay snapshot; update rider_id FK to riders
-- ============================================================

alter table orders
  add column if not exists rider_pay int not null default 0;

-- Re-point rider_id to riders table (same UUID space as profiles)
alter table orders
  drop constraint if exists orders_rider_id_fkey;

alter table orders
  add constraint orders_rider_id_fkey
  foreign key (rider_id) references riders(id) on delete set null;

-- ============================================================
-- PUSH_SUBSCRIPTIONS: web push for vendor alerts
-- ============================================================

create table if not exists push_subscriptions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on push_subscriptions for all using (auth.uid() = user_id);

create policy "Service role full access to push_subscriptions"
  on push_subscriptions for all using (auth.role() = 'service_role');

-- ============================================================
-- Fix transition_order: capture from_status before UPDATE
-- ============================================================

create or replace function transition_order(
  p_order_id  uuid,
  p_to_status order_status,
  p_actor_id  uuid default null,
  p_note      text default null,
  p_prep_mins int default null
)
returns orders language plpgsql security definer as $$
declare
  v_order       orders;
  v_from_status order_status;
  v_allowed     boolean := false;
begin
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found: %', p_order_id;
  end if;

  v_from_status := v_order.status;

  -- Validate transition
  v_allowed := case
    when v_order.status = 'pending_payment' and p_to_status = 'paid'      then true
    when v_order.status = 'pending_payment' and p_to_status = 'expired'   then true
    when v_order.status = 'pending_payment' and p_to_status = 'cancelled' then true
    when v_order.status = 'paid'            and p_to_status = 'accepted'  then true
    when v_order.status = 'paid'            and p_to_status = 'cancelled' then true
    when v_order.status = 'accepted'        and p_to_status = 'ready'     then true
    when v_order.status = 'accepted'        and p_to_status = 'cancelled' then true
    when v_order.status = 'ready'           and p_to_status = 'picked_up' then true
    when v_order.status = 'picked_up'       and p_to_status = 'delivered' then true
    else false
  end;

  if not v_allowed then
    raise exception 'Invalid transition: % -> %', v_order.status, p_to_status;
  end if;

  update orders set
    status       = p_to_status,
    prep_mins    = coalesce(p_prep_mins, prep_mins),
    paid_at      = case when p_to_status = 'paid'      then now() else paid_at      end,
    accepted_at  = case when p_to_status = 'accepted'  then now() else accepted_at  end,
    ready_at     = case when p_to_status = 'ready'     then now() else ready_at     end,
    picked_up_at = case when p_to_status = 'picked_up' then now() else picked_up_at end,
    delivered_at = case when p_to_status = 'delivered' then now() else delivered_at end
  where id = p_order_id
  returning * into v_order;

  insert into order_events (order_id, from_status, to_status, actor_id, note)
  values (p_order_id, v_from_status, p_to_status, p_actor_id, p_note);

  if p_to_status = 'delivered' then
    perform write_delivery_ledger(p_order_id);
  end if;

  return v_order;
end;
$$;

-- ============================================================
-- Update write_delivery_ledger to use rider_pay from orders
-- ============================================================

create or replace function write_delivery_ledger(p_order_id uuid)
returns void language plpgsql security definer as $$
declare
  v_order  orders;
  v_vendor vendors;
begin
  select * into v_order  from orders  where id = p_order_id;
  select * into v_vendor from vendors where id = v_order.vendor_id;

  insert into ledger_entries (order_id, party_type, party_id, amount, kind)
  values (p_order_id, 'vendor', v_vendor.owner_id,
          v_order.subtotal - v_order.commission_amount, 'earning');

  if v_order.rider_id is not null then
    insert into ledger_entries (order_id, party_type, party_id, amount, kind)
    values (p_order_id, 'rider', v_order.rider_id, v_order.rider_pay, 'earning');
  end if;

  insert into ledger_entries (order_id, party_type, party_id, amount, kind)
  values (p_order_id, 'platform', null,
          v_order.commission_amount + v_order.service_fee
          + (v_order.delivery_fee - v_order.rider_pay),
          'earning');
end;
$$;

-- ============================================================
-- Update pg_cron jobs to use transition function (not direct UPDATE)
-- ============================================================

select cron.unschedule('expire-unpaid-orders');
select cron.unschedule('auto-reject-unaccepted-orders');

select cron.schedule(
  'expire-unpaid-orders',
  '* * * * *',
  $$
    select transition_order(id, 'expired', null, 'Auto-expired after 30 min')
    from orders
    where status = 'pending_payment'
      and created_at < now() - interval '30 minutes';
  $$
);

select cron.schedule(
  'auto-cancel-unaccepted-orders',
  '* * * * *',
  $$
    select transition_order(id, 'cancelled', null, 'Auto-cancelled: no vendor response in 10 min')
    from orders
    where status = 'paid'
      and paid_at < now() - interval '10 minutes';
  $$
);
