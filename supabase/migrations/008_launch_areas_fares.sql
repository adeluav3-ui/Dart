-- ============================================================
-- 008 – Fare levels, launch areas, gate pickup
-- ============================================================

-- ── fare_levels ──────────────────────────────────────────────
create table if not exists fare_levels (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  okada_price  int  not null,
  rider_pay    int  not null,
  delivery_fee int  not null,
  sort_order   int  not null default 0
);

alter table fare_levels enable row level security;

create policy "All can read fare_levels"
  on fare_levels for select using (true);

create policy "Admin manages fare_levels"
  on fare_levels for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Seed 4 levels (money in kobo)
insert into fare_levels (name, okada_price, rider_pay, delivery_fee, sort_order) values
  ('Short',      200, 300, 400, 1),
  ('Medium',     300, 400, 500, 2),
  ('Long',       400, 500, 600, 3),
  ('Extra long', 500, 600, 700, 4);

-- ── areas: gate_pickup column ─────────────────────────────────
alter table areas add column if not exists gate_pickup boolean not null default false;

-- ── zone_fares: replace amounts with level reference ──────────
alter table zone_fares drop column if exists delivery_fee;
alter table zone_fares drop column if exists rider_pay;
alter table zone_fares add column if not exists fare_level_id uuid references fare_levels(id);

-- ── orders: gate arrival tracking ────────────────────────────
alter table orders add column if not exists is_gate_pickup  boolean     not null default false;
alter table orders add column if not exists gate_arrived_at timestamptz;
alter table orders add column if not exists gate_no_show    boolean     not null default false;
alter table orders add column if not exists gate_no_show_at timestamptz;

-- ── Clear existing fares + areas + zones (fresh launch seed) ──
delete from zone_fares;

delete from areas where name in (
  'OOUTH Main Gate', 'OOUTH Back Gate', 'Hospital Road',
  'Isale-Oko', 'Akarigbo Road', 'Ijoku'
);

delete from zones where name in (
  'OOUTH Main Gate', 'OOUTH Back Gate', 'Hospital Road',
  'Isale-Oko', 'Akarigbo Road', 'Ijoku'
);

-- ── 6 launch zones (1 per area) ──────────────────────────────
insert into zones (name, is_active) values
  ('OOUTH Main Gate', true),
  ('OOUTH Back Gate', true),
  ('Hospital Road',   true),
  ('Isale-Oko',       true),
  ('Akarigbo Road',   true),
  ('Ijoku',           true);

-- ── 6 launch areas ────────────────────────────────────────────
insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'OOUTH Main Gate', null, z.id,
       array['OOUTH','Teaching Hospital','Main gate'],
       'active', 1, true
from zones z where z.name = 'OOUTH Main Gate';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'OOUTH Back Gate', null, z.id,
       array['Back gate'],
       'active', 2, true
from zones z where z.name = 'OOUTH Back Gate';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Hospital Road', null, z.id,
       array[]::text[],
       'active', 3, false
from zones z where z.name = 'Hospital Road';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Isale-Oko', null, z.id,
       array['Isale Oko','Isaleoko','Isale-Oko garage'],
       'active', 4, false
from zones z where z.name = 'Isale-Oko';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Akarigbo Road', null, z.id,
       array['Akarigbo Palace','Palace road'],
       'active', 5, false
from zones z where z.name = 'Akarigbo Road';

insert into areas (name, district, zone_id, aliases, status, sort_order, gate_pickup)
select 'Ijoku', null, z.id,
       array['Ijokun'],
       'active', 6, false
from zones z where z.name = 'Ijoku';

-- ── 21 zone_fare pairs ────────────────────────────────────────
-- Using LEAST/GREATEST to store canonical (smaller UUID, larger UUID) pairs,
-- matching the .sort() ordering used in application code.
with zn as (
  select name, id from zones
  where name in ('OOUTH Main Gate','OOUTH Back Gate','Hospital Road',
                 'Isale-Oko','Akarigbo Road','Ijoku')
),
lv as (select name, id from fare_levels),
pairs (a, b, level) as (values
  -- Short: all 6 same-zone
  ('OOUTH Main Gate', 'OOUTH Main Gate', 'Short'),
  ('OOUTH Back Gate', 'OOUTH Back Gate', 'Short'),
  ('Hospital Road',   'Hospital Road',   'Short'),
  ('Isale-Oko',       'Isale-Oko',       'Short'),
  ('Akarigbo Road',   'Akarigbo Road',   'Short'),
  ('Ijoku',           'Ijoku',           'Short'),
  -- Short cross-zone
  ('OOUTH Main Gate', 'Akarigbo Road',   'Short'),
  ('OOUTH Back Gate', 'Isale-Oko',       'Short'),
  -- Medium
  ('OOUTH Main Gate', 'OOUTH Back Gate', 'Medium'),
  ('OOUTH Main Gate', 'Hospital Road',   'Medium'),
  ('OOUTH Main Gate', 'Isale-Oko',       'Medium'),
  ('OOUTH Back Gate', 'Hospital Road',   'Medium'),
  ('Hospital Road',   'Akarigbo Road',   'Medium'),
  ('Isale-Oko',       'Akarigbo Road',   'Medium'),
  ('Akarigbo Road',   'Ijoku',           'Medium'),
  -- Long
  ('OOUTH Main Gate', 'Ijoku',           'Long'),
  ('OOUTH Back Gate', 'Akarigbo Road',   'Long'),
  ('Hospital Road',   'Isale-Oko',       'Long'),
  ('Hospital Road',   'Ijoku',           'Long'),
  ('Isale-Oko',       'Ijoku',           'Long'),
  -- Extra long
  ('OOUTH Back Gate', 'Ijoku',           'Extra long')
)
insert into zone_fares (zone_a, zone_b, fare_level_id, is_serviceable)
select
  least(za.id, zb.id),
  greatest(za.id, zb.id),
  lv.id,
  true
from pairs p
join zn za on za.name = p.a
join zn zb on zb.name = p.b
join lv on lv.name = p.level;
