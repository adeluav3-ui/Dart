-- ============================================================
-- 006 – Payout requests, vendor applications, rider applications
-- ============================================================

-- ============================================================
-- PAYOUT_REQUESTS: wallet "move to bank" — admin approves manually
-- ============================================================

create table if not exists payout_requests (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references profiles(id) on delete cascade,
  amount       int  not null,
  bank_name    text not null,
  account_no   text not null,
  account_name text not null,
  status       text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  note         text,
  created_at   timestamptz not null default now()
);

alter table payout_requests enable row level security;

create policy "Users can submit payout requests"
  on payout_requests for insert with check (auth.uid() = user_id);

create policy "Users can read own payout requests"
  on payout_requests for select using (auth.uid() = user_id);

create policy "Admin manages payout requests"
  on payout_requests for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- VENDOR_APPLICATIONS: "Sell on Dart" interest form
-- ============================================================

create table if not exists vendor_applications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id) on delete set null,
  business_name text not null,
  type         text not null,
  area_name    text not null,
  phone        text not null,
  created_at   timestamptz not null default now()
);

alter table vendor_applications enable row level security;

create policy "Anyone can submit vendor application"
  on vendor_applications for insert with check (true);

create policy "Admin reads vendor applications"
  on vendor_applications for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- RIDER_APPLICATIONS: "Ride with Dart" interest form
-- ============================================================

create table if not exists rider_applications (
  id        uuid primary key default uuid_generate_v4(),
  user_id   uuid references profiles(id) on delete set null,
  full_name text not null,
  phone     text not null,
  area_name text not null,
  has_bike  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table rider_applications enable row level security;

create policy "Anyone can submit rider application"
  on rider_applications for insert with check (true);

create policy "Admin reads rider applications"
  on rider_applications for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
