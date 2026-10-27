-- ============================================================
-- 009 – Fare levels + gate pickup + rider availability
-- Includes all of 008 (which rolled back) + new rider availability work.
-- Safe to run even if some statements were previously applied.
-- ============================================================

-- ── 1. fare_levels table (from 008) ──────────────────────────
create table if not exists fare_levels (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  okada_price  int  not null,
  rider_pay    int  not null,
  delivery_fee int  not null,
  sort_order   int  not null default 0
);

alter table fare_levels enable row level security;

drop policy if exists "All can read fare_levels"   on fare_levels;
drop policy if exists "Admin manages fare_levels"  on fare_levels;

create policy "All can read fare_levels"
  on fare_levels for select using (true);

create policy "Admin manages fare_levels"
  on fare_levels for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Seed 4 levels (money in kobo); skip if already present
insert into fare_levels (name, okada_price, rider_pay, delivery_fee, sort_order)
select * from (values
  ('Short',      200, 300, 400, 1),
  ('Medium',     300, 400, 500, 2),
  ('Long',       400, 500, 600, 3),
  ('Extra long', 500, 600, 700, 4)
) as v(name, okada_price, rider_pay, delivery_fee, sort_order)
where not exists (select 1 from fare_levels);

-- ── 2. areas: gate_pickup column (from 008) ───────────────────
alter table areas add column if not exists gate_pickup boolean not null default false;

-- ── 3. areas: district column (from 007) ─────────────────────
alter table areas add column if not exists district text;

-- ── 4. zone_fares: replace fee amounts with level reference ──
alter table zone_fares drop column if exists delivery_fee;
alter table zone_fares drop column if exists rider_pay;
alter table zone_fares add column if not exists fare_level_id uuid references fare_levels(id);

-- ── 5. orders: gate pickup columns (from 008) ────────────────
alter table orders add column if not exists is_gate_pickup  boolean     not null default false;
alter table orders add column if not exists gate_arrived_at timestamptz;
alter table orders add column if not exists gate_no_show    boolean     not null default false;
alter table orders add column if not exists gate_no_show_at timestamptz;

-- ── 6. zones: drop fee columns that blocked 008 ──────────────
alter table zones drop column if exists delivery_fee;
alter table zones drop column if exists rider_pay;

-- ── 7. Unique name index on zones ────────────────────────────
create unique index if not exists zones_name_unique on zones (lower(name));

-- ── 8. Seed 6 launch zones ───────────────────────────────────
-- Delete old rows with these names first to avoid duplicates
delete from areas where lower(name) in (
  'oouth main gate','oouth back gate','hospital road',
  'isale-oko','akarigbo road','ijoku'
);
delete from zones where lower(name) in (
  'oouth main gate','oouth back gate','hospital road',
  'isale-oko','akarigbo road','ijoku'
);

insert into zones (name, is_active) values
  ('OOUTH Main Gate', true),
  ('OOUTH Back Gate', true),
  ('Hospital Road',   true),
  ('Isale-Oko',       true),
  ('Akarigbo Road',   true),
  ('Ijoku',           true)
on conflict (lower(name)) do nothing;

-- ── 9. Seed 6 launch areas ───────────────────────────────────
insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'OOUTH Main Gate', null, z.id,
       array['OOUTH','Teaching Hospital','Main gate'], 'active', 1, true
from zones z where lower(z.name) = 'oouth main gate';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'OOUTH Back Gate', null, z.id,
       array['Back gate'], 'active', 2, true
from zones z where lower(z.name) = 'oouth back gate';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Hospital Road', null, z.id,
       array[]::text[], 'active', 3, false
from zones z where lower(z.name) = 'hospital road';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Isale-Oko', null, z.id,
       array['Isale Oko','Isaleoko','Isale-Oko garage'], 'active', 4, false
from zones z where lower(z.name) = 'isale-oko';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Akarigbo Road', null, z.id,
       array['Akarigbo Palace','Palace road'], 'active', 5, false
from zones z where lower(z.name) = 'akarigbo road';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Ijoku', null, z.id,
       array['Ijokun'], 'active', 6, false
from zones z where lower(z.name) = 'ijoku';

-- Approximate coordinates (adjust in /admin/areas once on the ground)
update areas set lat = 6.8308, lng = 3.6481 where lower(name) = 'oouth main gate';
update areas set lat = 6.8302, lng = 3.6468 where lower(name) = 'oouth back gate';
update areas set lat = 6.8320, lng = 3.6492 where lower(name) = 'hospital road';
update areas set lat = 6.8418, lng = 3.6368 where lower(name) = 'isale-oko';
update areas set lat = 6.8305, lng = 3.6512 where lower(name) = 'akarigbo road';
update areas set lat = 6.8521, lng = 3.6283 where lower(name) = 'ijoku';

-- ── 10. Seed 21 zone_fare pairs ───────────────────────────────
delete from zone_fares;

with zn as (
  select lower(name) as lname, id from zones
  where lower(name) in (
    'oouth main gate','oouth back gate','hospital road',
    'isale-oko','akarigbo road','ijoku'
  )
),
lv as (select lower(name) as lname, id from fare_levels),
pairs (a, b, level) as (values
  ('oouth main gate', 'oouth main gate', 'short'),
  ('oouth back gate', 'oouth back gate', 'short'),
  ('hospital road',   'hospital road',   'short'),
  ('isale-oko',       'isale-oko',       'short'),
  ('akarigbo road',   'akarigbo road',   'short'),
  ('ijoku',           'ijoku',           'short'),
  ('oouth main gate', 'akarigbo road',   'short'),
  ('oouth back gate', 'isale-oko',       'short'),
  ('oouth main gate', 'oouth back gate', 'medium'),
  ('oouth main gate', 'hospital road',   'medium'),
  ('oouth main gate', 'isale-oko',       'medium'),
  ('oouth back gate', 'hospital road',   'medium'),
  ('hospital road',   'akarigbo road',   'medium'),
  ('isale-oko',       'akarigbo road',   'medium'),
  ('akarigbo road',   'ijoku',           'medium'),
  ('oouth main gate', 'ijoku',           'long'),
  ('oouth back gate', 'akarigbo road',   'long'),
  ('hospital road',   'isale-oko',       'long'),
  ('hospital road',   'ijoku',           'long'),
  ('isale-oko',       'ijoku',           'long'),
  ('oouth back gate', 'ijoku',           'extra long')
)
insert into zone_fares (zone_a, zone_b, fare_level_id, is_serviceable)
select
  least(za.id, zb.id),
  greatest(za.id, zb.id),
  lv.id,
  true
from pairs p
join zn za on za.lname = p.a
join zn zb on zb.lname = p.b
join lv  on lv.lname  = p.level;

-- ── 11. orders: rider_pay snapshot ───────────────────────────
alter table orders add column if not exists rider_pay int not null default 0;

-- ── 12. Fix write_delivery_ledger (uses orders.rider_pay now) ─
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
          v_order.commission_amount + v_order.service_fee +
          greatest(0, v_order.delivery_fee - v_order.rider_pay),
          'earning');
end;
$$;

-- ── 13. Rider availability fields ────────────────────────────
alter table riders add column if not exists is_available        boolean    not null default false;
alter table riders add column if not exists lat                 float8;
alter table riders add column if not exists lng                 float8;
alter table riders add column if not exists location_accuracy   float4;
alter table riders add column if not exists location_updated_at timestamptz;

drop policy if exists "Riders can update own availability" on riders;
create policy "Riders can update own availability"
  on riders for update using (id = auth.uid());

-- ── 14. Order pickup distance snapshot ───────────────────────
alter table orders add column if not exists pickup_lat         float8;
alter table orders add column if not exists pickup_lng         float8;
alter table orders add column if not exists pickup_distance_m  integer;
alter table orders add column if not exists rider_assigned_at  timestamptz;
