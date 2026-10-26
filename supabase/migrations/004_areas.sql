-- ============================================================
-- 004 – areas, area_requests, zone_fares unordered-pair rewrite
-- ============================================================

-- ============================================================
-- AREAS: named delivery destinations within a zone
-- ============================================================

create table if not exists areas (
  id         uuid primary key default uuid_generate_v4(),
  zone_id    uuid references zones(id) on delete set null,
  name       text not null,
  aliases    text[] not null default '{}',
  lat        double precision,
  lng        double precision,
  status     text not null default 'active' check (status in ('active', 'coming_soon')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists areas_name_key on areas (lower(name));

alter table areas enable row level security;

create policy "Areas publicly readable"
  on areas for select using (true);

create policy "Admin manages areas"
  on areas for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- AREA_REQUESTS: waitlist for unserved areas
-- ============================================================

create table if not exists area_requests (
  id         uuid primary key default uuid_generate_v4(),
  area_name  text not null,
  user_id    uuid references profiles(id) on delete set null,
  email      text,
  created_at timestamptz not null default now()
);

alter table area_requests enable row level security;

create policy "Anyone can submit area request"
  on area_requests for insert with check (true);

create policy "Admin reads area requests"
  on area_requests for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- VENDORS: add area_id
-- ============================================================

alter table vendors
  add column if not exists area_id uuid references areas(id) on delete set null;

-- ============================================================
-- ORDERS: add area_id + area_name snapshot
-- ============================================================

alter table orders
  add column if not exists area_id   uuid references areas(id) on delete set null,
  add column if not exists area_name text;

-- ============================================================
-- ZONE_FARES: rewrite to unordered pair (zone_a, zone_b)
-- zone_a <= zone_b enforced by check, allowing same-zone delivery
-- ============================================================

-- 1. Add new columns (nullable initially to allow migrating existing rows)
alter table zone_fares
  add column if not exists zone_a         uuid,
  add column if not exists zone_b         uuid,
  add column if not exists is_serviceable boolean not null default true;

-- 2. Populate zone_a/zone_b from existing data with canonical ordering
update zone_fares
set
  zone_a = case when from_zone::text <= to_zone::text then from_zone else to_zone end,
  zone_b = case when from_zone::text <= to_zone::text then to_zone   else from_zone end
where zone_a is null and from_zone is not null;

-- 3. Make not null
alter table zone_fares
  alter column zone_a set not null,
  alter column zone_b set not null;

-- 4. FK constraints (idempotent via DO block)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'zone_fares_zone_a_fkey') then
    alter table zone_fares
      add constraint zone_fares_zone_a_fkey foreign key (zone_a) references zones(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'zone_fares_zone_b_fkey') then
    alter table zone_fares
      add constraint zone_fares_zone_b_fkey foreign key (zone_b) references zones(id) on delete cascade;
  end if;
end $$;

-- 5. Canonical-order check
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'zone_fares_zone_order') then
    alter table zone_fares add constraint zone_fares_zone_order check (zone_a <= zone_b);
  end if;
end $$;

-- 6. Unique constraint on unordered pair
create unique index if not exists zone_fares_pair_unique on zone_fares (zone_a, zone_b);

-- 7. Drop old unique constraint and old columns
alter table zone_fares drop constraint if exists zone_fares_from_zone_to_zone_key;

alter table zone_fares
  drop column if exists from_zone,
  drop column if exists to_zone;

-- Update RLS policies for zone_fares (same logic, no column references needed)
drop policy if exists "Zone fares publicly readable" on zone_fares;
drop policy if exists "Admin manages zone fares"     on zone_fares;

create policy "Zone fares publicly readable"
  on zone_fares for select using (true);

create policy "Admin manages zone fares"
  on zone_fares for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- SEED: 2 zones + 19 areas
-- Idempotent: zones use WHERE NOT EXISTS (no unique name constraint),
-- areas use ON CONFLICT on the lower(name) expression index.
-- ============================================================

insert into zones (name, is_active, delivery_fee, rider_pay)
select 'Central', true, 0, 0
where not exists (select 1 from zones where name = 'Central');

insert into zones (name, is_active, delivery_fee, rider_pay)
select 'North', true, 0, 0
where not exists (select 1 from zones where name = 'North');

do $$
declare
  v_central uuid;
  v_north   uuid;
begin
  select id into v_central from zones where name = 'Central' limit 1;
  select id into v_north   from zones where name = 'North'   limit 1;

  -- Central zone (12 areas)
  insert into areas (zone_id, name, aliases, status, sort_order) values
    (v_central, 'OOUTH and hospital road', array['oouth','hospital road','oouth hospital'],    'active',      1),
    (v_central, 'Makun',                   array['makun city'],                                'active',      2),
    (v_central, 'Makun Station',           array['makun station','station'],                   'active',      3),
    (v_central, 'Sabo',                    array['sabo sagamu'],                               'active',      4),
    (v_central, 'Offin',                   array['offin sagamu'],                              'active',      5),
    (v_central, 'Itunshokun',              array['itunshokun'],                                'active',      6),
    (v_central, 'Ajaka',                   array['ajaka'],                                     'active',      7),
    (v_central, 'Isale-Oko',               array['isale oko','isaleoko'],                      'active',      8),
    (v_central, 'Isote',                   array['isote'],                                     'active',      9),
    (v_central, 'Epe',                     array['epe sagamu'],                                'active',     10),
    (v_central, 'Soyindo',                 array['soyindo'],                                   'active',     11),
    (v_central, 'Surulere',                array['surulere sagamu'],                           'active',     12)
  on conflict (lower(name)) do nothing;

  -- North zone (6 areas)
  insert into areas (zone_id, name, aliases, status, sort_order) values
    (v_north, 'Ijagba',    array['ijagba'],                                 'active',     13),
    (v_north, 'Ewu-Oluwo', array['ewu oluwo','ewuoluwo'],                   'active',     14),
    (v_north, 'Simawa',    array['simawa'],                                 'active',     15),
    (v_north, 'GRA',       array['gra sagamu','government reserved area'],  'active',     16),
    (v_north, 'Ijokun',    array['ijokun'],                                 'active',     17),
    (v_north, 'Batoro',    array['batoro'],                                 'active',     18)
  on conflict (lower(name)) do nothing;

  -- Coming soon (1 area)
  insert into areas (zone_id, name, aliases, status, sort_order) values
    (null, 'Ogijo', array['ogijo'], 'coming_soon', 19)
  on conflict (lower(name)) do nothing;
end;
$$;
