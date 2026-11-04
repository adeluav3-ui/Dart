-- coverage_areas: GeoJSON polygon per delivery coverage zone
create table coverage_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  polygon jsonb,                        -- GeoJSON Polygon { type, coordinates }; null until drawn
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table coverage_areas enable row level security;

-- Anyone can read active coverage areas (needed by customer app)
create policy "Anyone reads active coverage areas"
  on coverage_areas for select
  using (is_active = true);

-- Admins can do anything
create policy "Admins manage coverage areas"
  on coverage_areas for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- coverage_waitlist: customers outside coverage who want notification
create table coverage_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null
);

alter table coverage_waitlist enable row level security;

-- Anyone can join the waitlist
create policy "Anyone can join coverage waitlist"
  on coverage_waitlist for insert
  with check (true);

-- Only admins read it
create policy "Admins read coverage waitlist"
  on coverage_waitlist for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Admins can delete waitlist entries
create policy "Admins delete coverage waitlist"
  on coverage_waitlist for delete
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Seed coming-soon areas (no polygon yet — is_active=false so they won't block anyone)
insert into coverage_areas (name, polygon, is_active) values
  ('Sabo', null, false),
  ('GRA', null, false),
  ('Ayepe', null, false);
