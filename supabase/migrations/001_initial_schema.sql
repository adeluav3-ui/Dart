-- ============================================================
-- Dart MVP — Initial Schema
-- Run this in Supabase SQL editor (once, on a fresh project).
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('customer', 'vendor', 'rider', 'admin');
create type vendor_type as enum ('restaurant', 'supermarket', 'pharmacy');
create type order_status as enum (
  'pending_payment', 'paid', 'accepted', 'ready', 'picked_up', 'delivered',
  'cancelled', 'expired'
);
create type ledger_party as enum ('vendor', 'rider', 'platform', 'customer');
create type ledger_kind as enum ('earning', 'payout', 'refund', 'adjustment');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');

-- ============================================================
-- PROFILES
-- ============================================================

create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  phone        text unique not null,
  full_name    text,
  role         user_role not null default 'customer',
  created_at   timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Service role full access to profiles"
  on profiles for all using (auth.role() = 'service_role');

-- Auto-create profile on sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, phone, role)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- VENDORS
-- ============================================================

create table vendors (
  id                  uuid primary key default uuid_generate_v4(),
  owner_id            uuid references profiles(id) on delete set null,
  name                text not null,
  slug                text unique not null,
  type                vendor_type not null default 'restaurant',
  category            text,
  cover_photo_url     text,
  description         text,
  is_verified         boolean not null default false,
  is_open             boolean not null default false,
  avg_prep_mins       int not null default 20,
  commission_rate     numeric(5,4) not null default 0.10,
  rating_avg          numeric(3,2) not null default 0,
  rating_count        int not null default 0,
  payout_bank         text,
  payout_account_name text,
  payout_account_no   text,
  created_at          timestamptz not null default now()
);

alter table vendors enable row level security;

create policy "Vendors are publicly readable"
  on vendors for select using (true);

create policy "Owner can update own vendor"
  on vendors for update using (
    auth.uid() = owner_id
  );

create policy "Admin full access to vendors"
  on vendors for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- VENDOR HOURS
-- ============================================================

create table vendor_hours (
  id          uuid primary key default uuid_generate_v4(),
  vendor_id   uuid not null references vendors(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Sun
  opens_at    time not null,
  closes_at   time not null,
  unique (vendor_id, day_of_week)
);

alter table vendor_hours enable row level security;

create policy "Vendor hours are publicly readable"
  on vendor_hours for select using (true);

create policy "Owner or admin can manage vendor hours"
  on vendor_hours for all using (
    exists (select 1 from vendors where id = vendor_id and owner_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- MENU CATEGORIES
-- ============================================================

create table menu_categories (
  id         uuid primary key default uuid_generate_v4(),
  vendor_id  uuid not null references vendors(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0
);

alter table menu_categories enable row level security;

create policy "Menu categories are publicly readable"
  on menu_categories for select using (true);

create policy "Owner or admin can manage categories"
  on menu_categories for all using (
    exists (select 1 from vendors where id = vendor_id and owner_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- MENU ITEMS
-- ============================================================

create table menu_items (
  id           uuid primary key default uuid_generate_v4(),
  vendor_id    uuid not null references vendors(id) on delete cascade,
  category_id  uuid references menu_categories(id) on delete set null,
  name         text not null,
  description  text,
  photo_url    text,
  base_price   int not null, -- kobo
  pack_size    text, -- "1 L", "5 kg" — for supermarkets/pharmacies
  stock_qty    int, -- nullable = unlimited
  is_available boolean not null default true,
  sort_order   int not null default 0
);

alter table menu_items enable row level security;

create policy "Menu items are publicly readable"
  on menu_items for select using (true);

create policy "Owner or admin can manage menu items"
  on menu_items for all using (
    exists (select 1 from vendors where id = vendor_id and owner_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- OPTION GROUPS
-- ============================================================

create table option_groups (
  id         uuid primary key default uuid_generate_v4(),
  item_id    uuid not null references menu_items(id) on delete cascade,
  name       text not null,
  min_select int not null default 0,
  max_select int not null default 1,
  sort_order int not null default 0
);

alter table option_groups enable row level security;

create policy "Option groups are publicly readable"
  on option_groups for select using (true);

create policy "Owner or admin can manage option groups"
  on option_groups for all using (
    exists (
      select 1 from menu_items mi
      join vendors v on v.id = mi.vendor_id
      where mi.id = item_id and v.owner_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- OPTIONS
-- ============================================================

create table options (
  id           uuid primary key default uuid_generate_v4(),
  group_id     uuid not null references option_groups(id) on delete cascade,
  name         text not null,
  price_delta  int not null default 0, -- kobo, can be negative
  is_available boolean not null default true,
  sort_order   int not null default 0
);

alter table options enable row level security;

create policy "Options are publicly readable"
  on options for select using (true);

create policy "Owner or admin can manage options"
  on options for all using (
    exists (
      select 1 from option_groups og
      join menu_items mi on mi.id = og.item_id
      join vendors v on v.id = mi.vendor_id
      where og.id = group_id and v.owner_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- ZONES
-- ============================================================

create table zones (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  delivery_fee  int not null, -- kobo
  rider_pay     int not null, -- kobo
  is_active     boolean not null default true
);

alter table zones enable row level security;

create policy "Zones are publicly readable"
  on zones for select using (true);

create policy "Admin can manage zones"
  on zones for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- ADDRESSES
-- ============================================================

create table addresses (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  zone_id    uuid references zones(id) on delete set null,
  label      text,
  landmark   text not null,
  details    text,
  phone      text,
  created_at timestamptz not null default now()
);

alter table addresses enable row level security;

create policy "Users can read own addresses"
  on addresses for select using (auth.uid() = user_id);

create policy "Users can manage own addresses"
  on addresses for all using (auth.uid() = user_id);

-- ============================================================
-- ORDERS
-- ============================================================

create table orders (
  id               uuid primary key default uuid_generate_v4(),
  code             text unique not null,
  customer_id      uuid not null references profiles(id),
  vendor_id        uuid not null references vendors(id),
  zone_id          uuid not null references zones(id),
  -- address snapshot
  address_zone     text not null,
  address_landmark text not null,
  address_details  text,
  address_phone    text not null,
  -- status
  status           order_status not null default 'pending_payment',
  -- money (all kobo)
  subtotal         int not null,
  delivery_fee     int not null,
  service_fee      int not null,
  total            int not null,
  commission_amount int not null,
  -- logistics
  rider_id         uuid references profiles(id),
  delivery_pin     text not null, -- 4 digits, stored as text
  prep_mins        int,
  -- timestamps
  created_at       timestamptz not null default now(),
  paid_at          timestamptz,
  accepted_at      timestamptz,
  ready_at         timestamptz,
  picked_up_at     timestamptz,
  delivered_at     timestamptz
);

alter table orders enable row level security;

create policy "Customers can read own orders"
  on orders for select using (auth.uid() = customer_id);

create policy "Vendors can read their orders"
  on orders for select using (
    auth.uid() = (select owner_id from vendors where id = vendor_id)
  );

create policy "Riders can read assigned orders"
  on orders for select using (auth.uid() = rider_id);

create policy "Admin can read all orders"
  on orders for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Service role full access to orders"
  on orders for all using (auth.role() = 'service_role');

-- ============================================================
-- ORDER ITEMS
-- ============================================================

create table order_items (
  id               uuid primary key default uuid_generate_v4(),
  order_id         uuid not null references orders(id) on delete cascade,
  item_id          uuid references menu_items(id) on delete set null,
  name_snapshot    text not null,
  unit_price       int not null, -- kobo
  qty              int not null default 1,
  options_snapshot jsonb not null default '[]',
  line_total       int not null,
  is_unavailable   boolean not null default false
);

alter table order_items enable row level security;

create policy "Order items follow order access"
  on order_items for select using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (
          o.customer_id = auth.uid()
          or o.rider_id = auth.uid()
          or exists (select 1 from vendors v where v.id = o.vendor_id and v.owner_id = auth.uid())
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

create policy "Service role full access to order_items"
  on order_items for all using (auth.role() = 'service_role');

-- ============================================================
-- ORDER EVENTS (append-only audit log)
-- ============================================================

create table order_events (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references orders(id) on delete cascade,
  from_status order_status,
  to_status   order_status not null,
  actor_id    uuid references profiles(id),
  note        text,
  created_at  timestamptz not null default now()
);

alter table order_events enable row level security;

create policy "Order events follow order access"
  on order_events for select using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (
          o.customer_id = auth.uid()
          or o.rider_id = auth.uid()
          or exists (select 1 from vendors v where v.id = o.vendor_id and v.owner_id = auth.uid())
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

create policy "Service role full access to order_events"
  on order_events for all using (auth.role() = 'service_role');

-- ============================================================
-- PAYMENTS
-- ============================================================

create table payments (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references orders(id) on delete cascade,
  reference   text unique not null,
  provider    text not null default 'monnify',
  amount      int not null, -- kobo
  status      payment_status not null default 'pending',
  raw_webhook jsonb,
  created_at  timestamptz not null default now()
);

alter table payments enable row level security;

create policy "Customers can read own payments"
  on payments for select using (
    exists (select 1 from orders where id = order_id and customer_id = auth.uid())
  );

create policy "Admin can read all payments"
  on payments for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Service role full access to payments"
  on payments for all using (auth.role() = 'service_role');

-- ============================================================
-- LEDGER ENTRIES
-- ============================================================

create table ledger_entries (
  id         uuid primary key default uuid_generate_v4(),
  order_id   uuid not null references orders(id) on delete cascade,
  party_type ledger_party not null,
  party_id   uuid references profiles(id),
  amount     int not null, -- kobo
  kind       ledger_kind not null,
  note       text,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table ledger_entries enable row level security;

create policy "Vendors see own ledger"
  on ledger_entries for select using (
    party_id = auth.uid() and party_type = 'vendor'
  );

create policy "Riders see own ledger"
  on ledger_entries for select using (
    party_id = auth.uid() and party_type = 'rider'
  );

create policy "Customers see own ledger"
  on ledger_entries for select using (
    party_id = auth.uid() and party_type = 'customer'
  );

create policy "Admin can read all ledger"
  on ledger_entries for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Service role full access to ledger"
  on ledger_entries for all using (auth.role() = 'service_role');

-- ============================================================
-- REVIEWS
-- ============================================================

create table reviews (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid unique not null references orders(id),
  customer_id uuid not null references profiles(id),
  vendor_id   uuid not null references vendors(id),
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

alter table reviews enable row level security;

create policy "Reviews are publicly readable"
  on reviews for select using (true);

create policy "Customers can insert own review"
  on reviews for insert with check (auth.uid() = customer_id);

create policy "Service role full access to reviews"
  on reviews for all using (auth.role() = 'service_role');

-- ============================================================
-- ORDER CODE GENERATOR  (SD-XXXX format)
-- ============================================================

create sequence order_code_seq start 1000;

create or replace function generate_order_code()
returns text language sql as $$
  select 'SD-' || lpad(nextval('order_code_seq')::text, 4, '0')
$$;

-- ============================================================
-- transition_order — THE ONLY WAY TO CHANGE ORDER STATUS
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
  v_order    orders;
  v_allowed  boolean := false;
begin
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found: %', p_order_id;
  end if;

  -- Validate transition
  v_allowed := case
    when v_order.status = 'pending_payment' and p_to_status = 'paid'        then true
    when v_order.status = 'pending_payment' and p_to_status = 'expired'     then true
    when v_order.status = 'pending_payment' and p_to_status = 'cancelled'   then true
    when v_order.status = 'paid'            and p_to_status = 'accepted'    then true
    when v_order.status = 'paid'            and p_to_status = 'cancelled'   then true
    when v_order.status = 'accepted'        and p_to_status = 'ready'       then true
    when v_order.status = 'accepted'        and p_to_status = 'cancelled'   then true -- admin only
    when v_order.status = 'ready'           and p_to_status = 'picked_up'   then true
    when v_order.status = 'picked_up'       and p_to_status = 'delivered'   then true
    else false
  end;

  if not v_allowed then
    raise exception 'Invalid transition: % -> %', v_order.status, p_to_status;
  end if;

  -- Update timestamps
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

  -- Append to audit log
  insert into order_events (order_id, from_status, to_status, actor_id, note)
  values (p_order_id, v_order.status, p_to_status, p_actor_id, p_note);

  -- Write ledger on delivery
  if p_to_status = 'delivered' then
    perform write_delivery_ledger(p_order_id);
  end if;

  return v_order;
end;
$$;

-- ============================================================
-- write_delivery_ledger
-- ============================================================

create or replace function write_delivery_ledger(p_order_id uuid)
returns void language plpgsql security definer as $$
declare
  v_order orders;
  v_vendor vendors;
  v_zone   zones;
begin
  select * into v_order from orders where id = p_order_id;
  select * into v_vendor from vendors where id = v_order.vendor_id;
  select * into v_zone   from zones   where id = v_order.zone_id;

  -- Vendor earns: subtotal minus commission
  insert into ledger_entries (order_id, party_type, party_id, amount, kind)
  values (p_order_id, 'vendor', v_vendor.owner_id,
          v_order.subtotal - v_order.commission_amount, 'earning');

  -- Rider earns: zone rider_pay
  if v_order.rider_id is not null then
    insert into ledger_entries (order_id, party_type, party_id, amount, kind)
    values (p_order_id, 'rider', v_order.rider_id, v_zone.rider_pay, 'earning');
  end if;

  -- Platform earns: commission + service_fee + (delivery_fee - rider_pay)
  insert into ledger_entries (order_id, party_type, party_id, amount, kind)
  values (p_order_id, 'platform', null,
          v_order.commission_amount + v_order.service_fee + (v_order.delivery_fee - v_zone.rider_pay),
          'earning');
end;
$$;

-- ============================================================
-- pg_cron: expire unpaid orders after 30 min
-- ============================================================

select cron.schedule(
  'expire-unpaid-orders',
  '* * * * *', -- every minute
  $$
    update orders set status = 'expired'
    where status = 'pending_payment'
      and created_at < now() - interval '30 minutes';

    insert into order_events (order_id, from_status, to_status, note)
    select id, 'pending_payment', 'expired', 'Auto-expired after 30 min'
    from orders
    where status = 'expired'
      and id not in (select order_id from order_events where to_status = 'expired');
  $$
);

-- ============================================================
-- pg_cron: auto-reject orders not accepted within 10 min of payment
-- ============================================================

select cron.schedule(
  'auto-reject-unaccepted-orders',
  '* * * * *',
  $$
    with to_cancel as (
      select id from orders
      where status = 'paid'
        and paid_at < now() - interval '10 minutes'
    )
    update orders set status = 'cancelled'
    where id in (select id from to_cancel);

    insert into order_events (order_id, from_status, to_status, note)
    select id, 'paid', 'cancelled', 'Auto-cancelled: vendor did not accept within 10 min'
    from orders
    where status = 'cancelled'
      and paid_at is not null
      and id not in (select order_id from order_events where to_status = 'cancelled');
  $$
);

-- ============================================================
-- Storage buckets
-- ============================================================

insert into storage.buckets (id, name, public) values ('vendor-photos', 'vendor-photos', true);
insert into storage.buckets (id, name, public) values ('item-photos', 'item-photos', true);

create policy "Public read vendor-photos"
  on storage.objects for select using (bucket_id = 'vendor-photos');

create policy "Admin upload vendor-photos"
  on storage.objects for insert with check (
    bucket_id = 'vendor-photos'
    and exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'vendor'))
  );

create policy "Public read item-photos"
  on storage.objects for select using (bucket_id = 'item-photos');

create policy "Admin upload item-photos"
  on storage.objects for insert with check (
    bucket_id = 'item-photos'
    and exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'vendor'))
  );

create policy "Admin delete photos"
  on storage.objects for delete using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'vendor'))
  );

-- Update/delete policies for photos
create policy "Admin update vendor-photos"
  on storage.objects for update using (
    bucket_id = 'vendor-photos'
    and exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'vendor'))
  );
