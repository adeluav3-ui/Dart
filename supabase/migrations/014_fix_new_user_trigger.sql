-- 014 – Fix handle_new_user trigger for Google OAuth / email sign-ups
--
-- Problems fixed:
-- 1. phone could be '' (empty string) from metadata → nullif guard
-- 2. role assignment used bare text literals without explicit ::user_role cast,
--    which can fail under the trg_sync_role BEFORE-INSERT trigger
-- 3. full_name was omitted from the insert (lost Google display name)
-- 4. Defensive: ensure phone column is nullable in case 003 wasn't applied

alter table profiles
  alter column phone drop not null;

drop index if exists profiles_phone_key;

create unique index if not exists profiles_phone_unique
  on profiles(phone) where phone is not null;

-- Recreate the function with explicit casts and all columns
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, phone, full_name, role, roles)
  values (
    new.id,
    nullif(coalesce(
      new.raw_user_meta_data->>'phone',
      new.phone::text
    ), ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    'customer'::user_role,
    array['customer']::text[]
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone     = coalesce(excluded.phone,     profiles.phone);
  return new;
end;
$$;
