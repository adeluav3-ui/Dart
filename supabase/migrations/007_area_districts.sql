-- ============================================================
-- 007 – Area districts
-- ============================================================

-- Add nullable district column to areas
alter table areas add column if not exists district text;

-- Remove the placeholder Ayepe area and zone so Victor can
-- add the real sub-areas (Ayepe Inner, Ayepe Outer, etc.) via admin
delete from areas where lower(name) = 'ayepe';
delete from zones  where lower(name) = 'ayepe';
