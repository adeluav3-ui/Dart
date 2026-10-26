-- update_vendor_rating — called after a review is inserted
create or replace function update_vendor_rating(p_vendor_id uuid)
returns void language plpgsql security definer as $$
declare
  v_avg numeric;
  v_count int;
begin
  select avg(rating)::numeric(3,2), count(*)::int
  into v_avg, v_count
  from reviews
  where vendor_id = p_vendor_id;

  update vendors
  set rating_avg = coalesce(v_avg, 0),
      rating_count = coalesce(v_count, 0)
  where id = p_vendor_id;
end;
$$;

-- update_vendor_rating RPC accessible from client
grant execute on function update_vendor_rating(uuid) to authenticated;
grant execute on function transition_order(uuid, order_status, uuid, text, int) to authenticated;
grant execute on function generate_order_code() to service_role;
