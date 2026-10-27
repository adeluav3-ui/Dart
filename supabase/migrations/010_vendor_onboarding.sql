-- ============================================================
-- 010 – Vendor onboarding + menu management
-- Adds menu_items status machine, menu_templates with seed data
-- ============================================================

-- ── 1. menu_items: status fields ─────────────────────────────
alter table menu_items
  add column if not exists status           text    not null default 'draft'
    check (status in ('draft','in_review','live','rejected')),
  add column if not exists review_note      text,
  add column if not exists is_sold_out      boolean not null default false,
  add column if not exists pending_price    int,
  add column if not exists pending_photo_url text;

-- Upgrade items that already have price + photo to live
update menu_items
set status = 'live'
where base_price > 0 and photo_url is not null and status = 'draft';

-- ── 2. RLS update for menu_items ─────────────────────────────
-- Drop existing open policies that allowed reading all items regardless of status
drop policy if exists "Menu items are publicly readable" on menu_items;
drop policy if exists "Owner or admin can manage menu items" on menu_items;

drop policy if exists "Vendors manage own items" on menu_items;
create policy "Vendors manage own items"
  on menu_items for all using (
    vendor_id in (
      select id from vendors where owner_id = auth.uid()
    )
  );

-- Customers can read live items
drop policy if exists "Customers read live items" on menu_items;
create policy "Customers read live items"
  on menu_items for select using (
    status = 'live'
    or vendor_id in (
      select id from vendors where owner_id = auth.uid()
    )
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── 3. menu_templates table ───────────────────────────────────
create table if not exists menu_templates (
  id           uuid primary key default uuid_generate_v4(),
  store_type   text not null check (store_type in ('restaurant','supermarket','pharmacy')),
  pack_name    text not null,
  category_name text not null,
  item_name    text not null,
  description  text,
  default_option_groups jsonb,
  sort_order   int  not null default 0
);

alter table menu_templates enable row level security;

drop policy if exists "All can read menu_templates" on menu_templates;
drop policy if exists "Admin manages menu_templates" on menu_templates;

create policy "All can read menu_templates"
  on menu_templates for select using (true);

create policy "Admin manages menu_templates"
  on menu_templates for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── 4. Seed menu templates ────────────────────────────────────
delete from menu_templates;

-- Choose-protein option group used by rice/swallow items
-- (price_delta 0 means extra protein costs 0 by default; vendor sets real prices)
do $$
declare
  protein_group jsonb := '[{
    "name": "Choose protein",
    "min_select": 0,
    "max_select": 1,
    "options": [
      {"name": "No protein",      "price_delta": 0},
      {"name": "Grilled Chicken", "price_delta": 0},
      {"name": "Fried Chicken",   "price_delta": 0},
      {"name": "Goat Meat",       "price_delta": 0},
      {"name": "Beef",            "price_delta": 0},
      {"name": "Fish",            "price_delta": 0}
    ]
  }]';
begin

-- ── Kitchen: Rice dishes ─────────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('restaurant','Rice dishes','Rice','Fried Rice',    'Nigerian-style fried rice with vegetables', protein_group, 1),
  ('restaurant','Rice dishes','Rice','Jollof Rice',   'Party jollof with smoky tomato sauce',      protein_group, 2),
  ('restaurant','Rice dishes','Rice','White Rice',    'Plain boiled long-grain rice',              protein_group, 3),
  ('restaurant','Rice dishes','Rice','Coconut Rice',  'Rice cooked in coconut milk',               protein_group, 4);

-- ── Kitchen: Swallow and soups ───────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('restaurant','Swallow and soups','Swallow','Eba',         'Garri swallow',           protein_group, 10),
  ('restaurant','Swallow and soups','Swallow','Amala',       'Yam flour swallow',       protein_group, 11),
  ('restaurant','Swallow and soups','Swallow','Pounded Yam', 'Smooth pounded yam',      protein_group, 12),
  ('restaurant','Swallow and soups','Swallow','Fufu',        'Cassava fufu',            protein_group, 13),
  ('restaurant','Swallow and soups','Soup','Egusi Soup',     'Ground melon seed soup',  null,          14),
  ('restaurant','Swallow and soups','Soup','Okro Soup',      'Okra with assorted meat', null,          15),
  ('restaurant','Swallow and soups','Soup','Ewedu Soup',     'Jute leaf soup',          null,          16),
  ('restaurant','Swallow and soups','Soup','Banga Soup',     'Palm nut soup',           null,          17);

-- ── Kitchen: Proteins ────────────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('restaurant','Proteins','Protein','Grilled Chicken','1 piece of grilled chicken', null, 20),
  ('restaurant','Proteins','Protein','Fried Chicken',  '1 piece of fried chicken',  null, 21),
  ('restaurant','Proteins','Protein','Goat Meat',      'Per piece, well-seasoned',  null, 22),
  ('restaurant','Proteins','Protein','Beef',           'Per piece',                 null, 23),
  ('restaurant','Proteins','Protein','Ponmo',          'Cowskin per serving',       null, 24),
  ('restaurant','Proteins','Protein','Fish',           'Croaker or tilapia',        null, 25);

-- ── Kitchen: Breakfast ───────────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('restaurant','Breakfast','Breakfast','Akara',     'Bean cake fried with pepper and onion', null, 30),
  ('restaurant','Breakfast','Breakfast','Moi Moi',   'Steamed bean pudding',                  null, 31),
  ('restaurant','Breakfast','Breakfast','Oatmeal',   'Creamy oatmeal porridge',               null, 32),
  ('restaurant','Breakfast','Breakfast','Yam & Egg', 'Boiled yam with fried egg',             null, 33);

-- ── Kitchen: Drinks ──────────────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('restaurant','Drinks','Drinks','Zobo',       'Hibiscus flower drink',    null, 40),
  ('restaurant','Drinks','Drinks','Kunu',       'Millet spice drink',       null, 41),
  ('restaurant','Drinks','Drinks','Malt',       '35cl bottle',              null, 42),
  ('restaurant','Drinks','Drinks','Soft Drink', 'Pepsi / Coke / Fanta 35cl', null, 43),
  ('restaurant','Drinks','Drinks','Water',      '75cl bottled water',        null, 44);

-- ── Supermarket: Food staples ────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('supermarket','Food staples','Grains & Carbs','Rice (1kg)',         'Long grain parboiled rice',  null, 50),
  ('supermarket','Food staples','Grains & Carbs','Garri (1kg)',        'Yellow or white garri',      null, 51),
  ('supermarket','Food staples','Grains & Carbs','Semovita (1kg)',     'Semovita semolina flour',    null, 52),
  ('supermarket','Food staples','Cooking Essentials','Groundnut Oil (1L)',  'Refined groundnut oil', null, 53),
  ('supermarket','Food staples','Cooking Essentials','Palm Oil (500ml)',    'Red palm oil',          null, 54),
  ('supermarket','Food staples','Cooking Essentials','Maggi (10 cubes)',    'Seasoning cubes pack',  null, 55),
  ('supermarket','Food staples','Cooking Essentials','Tomato Paste (200g)', 'Tomato paste tin',      null, 56);

-- ── Supermarket: Beverages ───────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('supermarket','Beverages','Hot Drinks','Milo (400g)',         'Chocolate malt drink',       null, 60),
  ('supermarket','Beverages','Hot Drinks','Bournvita (400g)',    'Cocoa-based malt drink',     null, 61),
  ('supermarket','Beverages','Hot Drinks','Lipton Tea (25 bags)','Yellow label tea bags',      null, 62),
  ('supermarket','Beverages','Cold Drinks','Coke (35cl)',        'Coca-Cola glass bottle',     null, 63),
  ('supermarket','Beverages','Cold Drinks','Pepsi (35cl)',       'Pepsi bottle',               null, 64),
  ('supermarket','Beverages','Cold Drinks','Water (75cl)',       'Bottled drinking water',     null, 65);

-- ── Supermarket: Drinks ──────────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('supermarket','Drinks','Drinks','Malta Guinness (35cl)', 'Non-alcoholic malt drink',    null, 70),
  ('supermarket','Drinks','Drinks','Lacasera (35cl)',       'Apple-flavoured soft drink',   null, 71),
  ('supermarket','Drinks','Drinks','Ribena (250ml)',        'Blackcurrant fruit drink',     null, 72);

-- ── Supermarket: Home & Toiletries ───────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('supermarket','Home and toiletries','Toiletries','Key Soap (200g)',    'Laundry soap bar',         null, 80),
  ('supermarket','Home and toiletries','Toiletries','Omo (500g)',         'Washing powder',           null, 81),
  ('supermarket','Home and toiletries','Toiletries','Dettol Soap (100g)', 'Antiseptic bathing soap',  null, 82),
  ('supermarket','Home and toiletries','Toiletries','Toothpaste (100ml)', 'Fluoride toothpaste',      null, 83),
  ('supermarket','Home and toiletries','Home','Air Freshener (300ml)',    'Room spray can',           null, 84);

-- ── Pharmacy: Pain & Fever ───────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('pharmacy','Pain/fever','Pain & Fever','Paracetamol (500mg)', '10-tab strip — Emzor / Panadol', null, 90),
  ('pharmacy','Pain/fever','Pain & Fever','Ibuprofen (400mg)',   '10-tab strip',                   null, 91),
  ('pharmacy','Pain/fever','Pain & Fever','Buscopan (10mg)',     '10 tabs — abdominal cramp',      null, 92);

-- ── Pharmacy: Cold & Cough ───────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('pharmacy','Cold/cough','Cold & Cough','Piriton (4mg)',         '10 tabs — allergy and cold relief', null, 95),
  ('pharmacy','Cold/cough','Cold & Cough','Actifed Syrup (100ml)', 'Decongestant syrup',                null, 96),
  ('pharmacy','Cold/cough','Cold & Cough','Vitamin C (500mg)',     '10-tab strip',                      null, 97);

-- ── Pharmacy: First Aid ──────────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('pharmacy','First aid','First Aid','Plaster (10 strips)',       'Adhesive wound strips',       null, 100),
  ('pharmacy','First aid','First Aid','Cotton Wool (50g)',         'Medical cotton wool',         null, 101),
  ('pharmacy','First aid','First Aid','Methylated Spirit (200ml)', 'Antiseptic spirit',           null, 102),
  ('pharmacy','First aid','First Aid','Savlon (100ml)',            'Antiseptic liquid wound wash', null, 103);

-- ── Pharmacy: Vitamins ───────────────────────────────────────
insert into menu_templates (store_type, pack_name, category_name, item_name, description, default_option_groups, sort_order) values
  ('pharmacy','Vitamins','Vitamins','Multivitamin (30 tabs)', 'Daily vitamin supplement', null, 110),
  ('pharmacy','Vitamins','Vitamins','Zinc (20mg)',            '10-tab strip',             null, 111),
  ('pharmacy','Vitamins','Vitamins','Folic Acid (5mg)',       '10-tab strip',             null, 112);

end $$;
