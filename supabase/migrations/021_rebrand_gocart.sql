-- Rebrand: change order code prefix from SD- to GC-
-- Existing orders keep their SD- codes; new orders get GC-XXXX.
create or replace function generate_order_code()
  returns text language sql as $$
  select 'GC-' || lpad(nextval('order_code_seq')::text, 4, '0')
$$;
