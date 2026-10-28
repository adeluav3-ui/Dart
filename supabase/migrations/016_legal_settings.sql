-- 016 – Legal policy settings for placeholder substitution
-- These are editable from the admin panel via app_settings

insert into app_settings (key, value) values
  ('company_name',          'Dart Ltd'),
  ('company_rc_number',     ''),
  ('company_address',       'Sagamu, Ogun State'),
  ('privacy_email',         ''),
  ('payment_partner_name',  'Monnify'),
  ('terms_last_updated',    ''),
  ('privacy_last_updated',  ''),
  ('refunds_last_updated',  '')
on conflict (key) do nothing;

-- Update the placeholder phone/email to real values
update app_settings set value = '+2348139672432' where key = 'support_phone'  and value = '+2348000000000';
update app_settings set value = 'hello@dart.ng'  where key = 'support_email'  and value = 'hello@dart.ng';
