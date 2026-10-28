-- Seed service fee configuration into app_settings.
-- All money values in kobo.
-- Defaults: 5% of subtotal, clamped ₦100–₦500, rounded to nearest ₦10.

insert into app_settings (key, value) values
  ('service_fee_enabled', 'true'),
  ('service_fee_type',    'percent'),
  ('service_fee_percent', '5'),
  ('service_fee_min',     '10000'),
  ('service_fee_max',     '50000'),
  ('service_fee_flat',    '15000')
on conflict (key) do nothing;
