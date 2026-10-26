-- ============================================================
-- 005 – Set launch areas; add Ayepe Road; seed coordinates
-- ============================================================

-- Mark everything coming_soon first (clean slate for status)
update areas set status = 'coming_soon';

-- Activate the 4 launch areas
update areas set status = 'active'
where lower(name) in (
  'oouth and hospital road',
  'isale-oko',
  'ijokun'
);

-- Add Ayepe Road (launch area, Central zone)
insert into areas (zone_id, name, aliases, status, sort_order)
select id, 'Ayepe Road', array['ayepe','aiyepe road','aiyepe'], 'active', 20
from zones where name = 'Central' limit 1
on conflict (lower(name)) do update set status = 'active';

-- ============================================================
-- Approximate coordinates for location detection
-- Verify and adjust these via /admin/areas once you're on the ground
-- ============================================================
update areas set lat = 6.8332, lng = 3.6455 where lower(name) = 'oouth and hospital road';
update areas set lat = 6.8418, lng = 3.6368 where lower(name) = 'isale-oko';
update areas set lat = 6.8521, lng = 3.6283 where lower(name) = 'ijokun';
update areas set lat = 6.8305, lng = 3.6512 where lower(name) = 'ayepe road';
