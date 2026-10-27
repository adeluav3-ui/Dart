-- ============================================================
-- 009 – Fix zones schema + rider availability
-- ============================================================

-- ── 1. Drop fee columns from zones that blocked migration 008 ─
alter table zones drop column if exists delivery_fee;
alter table zones drop column if exists rider_pay;

-- ── 2. Unique name index so we can use ON CONFLICT ────────────
create unique index if not exists zones_name_unique on zones (lower(name));

-- ── 3. Re-seed what migration 008 failed to insert ────────────
insert into zones (name, is_active) values
  ('OOUTH Main Gate', true),
  ('OOUTH Back Gate', true),
  ('Hospital Road',   true),
  ('Isale-Oko',       true),
  ('Akarigbo Road',   true),
  ('Ijoku',           true)
on conflict (lower(name)) do nothing;

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'OOUTH Main Gate', null, z.id,
       array['OOUTH','Teaching Hospital','Main gate'], 'active', 1, true
from zones z where lower(z.name) = 'oouth main gate'
  and not exists (select 1 from areas a where lower(a.name) = 'oouth main gate');

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'OOUTH Back Gate', null, z.id,
       array['Back gate'], 'active', 2, true
from zones z where lower(z.name) = 'oouth back gate'
  and not exists (select 1 from areas a where lower(a.name) = 'oouth back gate');

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Hospital Road', null, z.id,
       array[]::text[], 'active', 3, false
from zones z where lower(z.name) = 'hospital road'
  and not exists (select 1 from areas a where lower(a.name) = 'hospital road');

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Isale-Oko', null, z.id,
       array['Isale Oko','Isaleoko','Isale-Oko garage'], 'active', 4, false
from zones z where lower(z.name) = 'isale-oko'
  and not exists (select 1 from areas a where lower(a.name) = 'isale-oko');

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Akarigbo Road', null, z.id,
       array['Akarigbo Palace','Palace road'], 'active', 5, false
from zones z where lower(z.name) = 'akarigbo road'
  and not exists (select 1 from areas a where lower(a.name) = 'akarigbo road');

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Ijoku', null, z.id,
       array['Ijokun'], 'active', 6, false
from zones z where lower(z.name) = 'ijoku'
  and not exists (select 1 from areas a where lower(a.name) = 'ijoku');

-- Seed approximate coordinates (adjust in /admin/areas once on the ground)
update areas set lat = 6.8308, lng = 3.6481 where lower(name) = 'oouth main gate'  and lat is null;
update areas set lat = 6.8302, lng = 3.6468 where lower(name) = 'oouth back gate'  and lat is null;
update areas set lat = 6.8320, lng = 3.6492 where lower(name) = 'hospital road'    and lat is null;
update areas set lat = 6.8418, lng = 3.6368 where lower(name) = 'isale-oko'        and lat is null;
update areas set lat = 6.8305, lng = 3.6512 where lower(name) = 'akarigbo road'    and lat is null;
update areas set lat = 6.8521, lng = 3.6283 where lower(name) = 'ijoku'            and lat is null;

-- Re-seed 21 zone_fare pairs (migration 008 cleared the table; insert failed)
with zn as (
  select name, id from zones
  where lower(name) in (
    'oouth main gate','oouth back gate','hospital road',
    'isale-oko','akarigbo road','ijoku'
  )
),
lv as (select name, id from fare_levels),
pairs (a, b, level) as (values
  ('OOUTH Main Gate', 'OOUTH Main Gate', 'Short'),
  ('OOUTH Back Gate', 'OOUTH Back Gate', 'Short'),
  ('Hospital Road',   'Hospital Road',   'Short'),
  ('Isale-Oko',       'Isale-Oko',       'Short'),
  ('Akarigbo Road',   'Akarigbo Road',   'Short'),
  ('Ijoku',           'Ijoku',           'Short'),
  ('OOUTH Main Gate', 'Akarigbo Road',   'Short'),
  ('OOUTH Back Gate', 'Isale-Oko',       'Short'),
  ('OOUTH Main Gate', 'OOUTH Back Gate', 'Medium'),
  ('OOUTH Main Gate', 'Hospital Road',   'Medium'),
  ('OOUTH Main Gate', 'Isale-Oko',       'Medium'),
  ('OOUTH Back Gate', 'Hospital Road',   'Medium'),
  ('Hospital Road',   'Akarigbo Road',   'Medium'),
  ('Isale-Oko',       'Akarigbo Road',   'Medium'),
  ('Akarigbo Road',   'Ijoku',           'Medium'),
  ('OOUTH Main Gate', 'Ijoku',           'Long'),
  ('OOUTH Back Gate', 'Akarigbo Road',   'Long'),
  ('Hospital Road',   'Isale-Oko',       'Long'),
  ('Hospital Road',   'Ijoku',           'Long'),
  ('Isale-Oko',       'Ijoku',           'Long'),
  ('OOUTH Back Gate', 'Ijoku',           'Extra long')
)
insert into zone_fares (zone_a, zone_b, fare_level_id, is_serviceable)
select
  least(za.id, zb.id),
  greatest(za.id, zb.id),
  lv.id,
  true
from pairs p
join zn za on lower(za.name) = lower(p.a)
join zn zb on lower(zb.name) = lower(p.b)
join lv  on lower(lv.name)  = lower(p.level);

-- ── 4. Snapshot rider_pay on orders ──────────────────────────
-- Checkout already computes and inserts this; the column just needs to exist.
alter table orders add column if not exists rider_pay int not null default 0;

-- Replace write_delivery_ledger: use snapshotted rider_pay from the order
-- rather than reading zones.rider_pay (column now dropped).
create or replace function write_delivery_ledger(p_order_id uuid)
returns void language plpgsql security definer as $$
declare
  v_order  orders;
  v_vendor vendors;
begin
  select * into v_order  from orders  where id = p_order_id;
  select * into v_vendor from vendors where id = v_order.vendor_id;

  -- Vendor earns: subtotal minus commission
  insert into ledger_entries (order_id, party_type, party_id, amount, kind)
  values (p_order_id, 'vendor', v_vendor.owner_id,
          v_order.subtotal - v_order.commission_amount, 'earning');

  -- Rider earns: snapshotted at checkout via fare level
  if v_order.rider_id is not null then
    insert into ledger_entries (order_id, party_type, party_id, amount, kind)
    values (p_order_id, 'rider', v_order.rider_id, v_order.rider_pay, 'earning');
  end if;

  -- Platform earns: commission + service_fee + spread between delivery fee and rider pay
  insert into ledger_entries (order_id, party_type, party_id, amount, kind)
  values (p_order_id, 'platform', null,
          v_order.commission_amount + v_order.service_fee +
          greatest(0, v_order.delivery_fee - v_order.rider_pay),
          'earning');
end;
$$;

-- ── 5. Rider availability ─────────────────────────────────────
alter table riders add column if not exists is_available        boolean    not null default false;
alter table riders add column if not exists lat                 float8;
alter table riders add column if not exists lng                 float8;
alter table riders add column if not exists location_accuracy   float4;
alter table riders add column if not exists location_updated_at timestamptz;

-- Riders update their own row for availability/location
drop policy if exists "Riders can update own availability" on riders;
create policy "Riders can update own availability"
  on riders for update using (id = auth.uid());

-- ── 6. Order pickup distance snapshot ────────────────────────
alter table orders add column if not exists pickup_lat         float8;
alter table orders add column if not exists pickup_lng         float8;
alter table orders add column if not exists pickup_distance_m  integer;
alter table orders add column if not exists rider_assigned_at  timestamptz;
