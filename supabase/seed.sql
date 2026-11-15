-- =====================================================================
-- LOOKBAN seed data  (run AFTER migrations 0001-0009)
--
-- Source: the "LOOKBAN: E-Commerce Platform" written report (Nov 2026).
-- Names, product variants and prices come from that report.
--
--   * Stock (50) is a placeholder for demos, NOT real inventory.
--   * No addresses, phone numbers, logos or photos are invented. Products
--     without photos show a clearly labelled placeholder tile.
-- Safe to re-run: every insert is idempotent.
-- =====================================================================

-- ---------- settings ----------
insert into settings (key, value) values
  ('default_shipping_fee', '50'::jsonb)          -- PHP per vendor; editable in Admin > Settings
on conflict (key) do nothing;

-- ---------- categories ----------
insert into categories (slug, name, description, sort_order, is_featured) values
  ('longganisang-lucban', 'Longganisang Lucban',    'Garlicky, tangy, air-dried pork sausage - Lucban''s signature.', 1, true),
  ('pancit-habhab',       'Pancit Habhab',          'Miki Lucban noodles for the famous banana-leaf pancit.',          2, true),
  ('lucban-hardinera',    'Lucban Hardinera',       'The festive Lucban meatloaf.',                                    3, false),
  ('biscuits-and-breads', 'Biscuits & Breads',      'Broas, apas, galletas and other heritage Lucban bakes.',          4, true),
  ('local-delicacies',    'Local Delicacies',       'Puto seko, meringue and other Lucban sweets.',                    5, true),
  ('kakanin',             'Kakanin',                'Traditional rice cakes and kiping-inspired treats.',              6, false),
  ('pasalubong-souvenirs','Pasalubong & Souvenirs', 'Gifts and keepsakes from Lucban.',                                7, false)
on conflict (slug) do nothing;

-- ---------- stores (no owner yet) ----------
insert into stores (slug, name, description, address, status) values
  ('pavinos-bakery',     'Pavino''s Bakery',
     'A heritage bakery operating for over 60 years in Lucban, Quezon, known for traditional freshly baked Quezon breads, biscuits and pasalubong delicacies.',
     'Lucban, Quezon', 'approved'),
  ('pectos-bakery',      'Pecto''s Bakery',
     'A long-standing Lucban bakery baking traditional breads, pasalubong biscuits and pastries since 1947, still using a traditional brick oven.',
     'Lucban, Quezon', 'approved'),
  ('eker-and-ely',       'Eker & Ely and Apo ni Eker Lucban Longganisa and Pasalubong',
     'Lucban longganisa and pasalubong.', 'Lucban, Quezon', 'approved'),
  ('aboos-lucban-longganisa', 'Aboo''s Lucban Longganisa',
     'Lucban longganisa in original and sweet & spicy garlic.', 'Lucban, Quezon', 'approved'),
  ('efrens-lucban-longganisa', 'Efren''s Lucban Longganisa',
     'Lucban longganisa.', 'Lucban, Quezon', 'approved'),
  ('gb-daza-langgonisang-lucban', 'G. B. Daza Langgonisang Lucban',
     'Lucban longganisa in regular and jumbo dozen packs.', 'Lucban, Quezon', 'approved'),
  ('center-miki-factory', 'Center Miki Factory',
     'Miki Lucban noodles for pancit habhab.', 'Lucban, Quezon', 'approved'),
  ('campvilles-food-industries', 'Campville''s Food Industries',
     'Miki Lucban noodles for pancit habhab.', 'Lucban, Quezon', 'approved'),
  ('campitas-food-product', 'Campita''s Food Product',
     'Miki Lucban noodles for pancit habhab.', 'Lucban, Quezon', 'approved'),
  ('racelis-miki-factory', 'Racelis Miki Factory',
     'Miki Lucban noodles for pancit habhab.', 'Lucban, Quezon', 'approved'),
  ('vens-food-products', 'Ven''s Food Products',
     'Puto seko and meringue from Lucban.', 'Lucban, Quezon', 'approved'),
  ('veners-food-industries', 'Vener''s Food Industries',
     'Puto seko and meringue from Lucban.', 'Lucban, Quezon', 'approved')
on conflict (slug) do nothing;

-- ---------- products (one row per sellable variant) ----------
with d(store_slug, cat_slug, name, variant, price, weight, per_pack, descr) as (values
  -- Lucban Longganisa ------------------------------------------------
  ('eker-and-ely','longganisang-lucban','Lucban Longganisa','Regular / Small (1 dozen)',120,null,'1 dozen','L'),
  ('eker-and-ely','longganisang-lucban','Lucban Longganisa','Jumbo / Big (1 dozen)',240,null,'1 dozen','L'),
  ('aboos-lucban-longganisa','longganisang-lucban','Lucban Longganisa','Small Bite - Sweet & Spicy Garlic (1 dozen)',135,null,'1 dozen','L'),
  ('aboos-lucban-longganisa','longganisang-lucban','Lucban Longganisa','Big Bite - Original Garlic (1 dozen)',235,null,'1 dozen','L'),
  ('aboos-lucban-longganisa','longganisang-lucban','Lucban Longganisa','Big Bite - Sweet & Spicy Garlic (1 dozen)',235,null,'1 dozen','L'),
  ('efrens-lucban-longganisa','longganisang-lucban','Lucban Longganisa','1 dozen',150,null,'1 dozen','L'),
  ('gb-daza-langgonisang-lucban','longganisang-lucban','Lucban Longganisa','Regular dozen pack',70,'approx. 250g','1 dozen','L'),
  ('gb-daza-langgonisang-lucban','longganisang-lucban','Lucban Longganisa','Jumbo dozen pack',140,'approx. 480-500g','1 dozen','L'),
  -- Miki Lucban ------------------------------------------------------
  ('center-miki-factory','pancit-habhab','Miki Lucban','250g pack',77,'250g',null,'M'),
  ('center-miki-factory','pancit-habhab','Miki Lucban','500g pack',148,'500g',null,'M'),
  ('campvilles-food-industries','pancit-habhab','Miki Lucban','Small pack (250g)',50,'250g',null,'M'),
  ('campvilles-food-industries','pancit-habhab','Miki Lucban','Big pack (500g)',90,'500g',null,'M'),
  ('campitas-food-product','pancit-habhab','Miki Lucban','Small pack (250g)',45,'250g',null,'M'),
  ('campitas-food-product','pancit-habhab','Miki Lucban','Big pack (500g)',85,'500g',null,'M'),
  ('racelis-miki-factory','pancit-habhab','Miki Lucban','Small pack (approx. 250g)',45,'approx. 250g',null,'M'),
  ('racelis-miki-factory','pancit-habhab','Miki Lucban','Big pack (500g)',85,'500g',null,'M'),
  -- Puto Seko ---------------------------------------------------------
  ('vens-food-products','local-delicacies','Puto Seko','Small pack / individual size',55,null,null,'P'),
  ('vens-food-products','local-delicacies','Puto Seko','Big pack',60,null,null,'P'),
  ('veners-food-industries','local-delicacies','Puto Seko','Small pack / individual size',45,null,null,'P'),
  ('veners-food-industries','local-delicacies','Puto Seko','Big pack',65,null,null,'P'),
  -- Meringue ----------------------------------------------------------
  ('vens-food-products','local-delicacies','Meringue','Big pack',205,null,null,'G'),
  ('veners-food-industries','local-delicacies','Meringue','Big pack',160,null,null,'G'),
  -- Pavino's Bakery: Broas -------------------------------------------
  ('pavinos-bakery','biscuits-and-breads','Broas','Square can',889,null,null,'B'),
  ('pavinos-bakery','biscuits-and-breads','Broas','Round can',449,null,null,'B'),
  ('pavinos-bakery','biscuits-and-breads','Broas','Gallon',309,null,null,'B'),
  ('pavinos-bakery','biscuits-and-breads','Broas','Small pack',94,null,null,'B'),
  ('pavinos-bakery','biscuits-and-breads','Broas','Big pack',115,null,null,'B'),
  ('pavinos-bakery','biscuits-and-breads','Broas','Repack',109,null,null,'B'),
  ('pavinos-bakery','biscuits-and-breads','Broas','Box',135,null,null,'B'),
  -- Apas
  ('pavinos-bakery','biscuits-and-breads','Apas','Gallon',309,null,null,'A'),
  ('pavinos-bakery','biscuits-and-breads','Apas','Half gallon',209,null,null,'A'),
  ('pavinos-bakery','biscuits-and-breads','Apas','Small pack',94,null,null,'A'),
  ('pavinos-bakery','biscuits-and-breads','Apas','Repack',109,null,null,'A'),
  -- Kamachile
  ('pavinos-bakery','biscuits-and-breads','Kamachile','Gallon',309,null,null,'K'),
  ('pavinos-bakery','biscuits-and-breads','Kamachile','Half gallon',209,null,null,'K'),
  ('pavinos-bakery','biscuits-and-breads','Kamachile','Repack',109,null,null,'K'),
  -- Galletas
  ('pavinos-bakery','biscuits-and-breads','Galletas','Repack',109,null,null,'E'),
  ('pavinos-bakery','biscuits-and-breads','Galletas','Small pack',94,null,null,'E'),
  ('pavinos-bakery','biscuits-and-breads','Galletas','Regular',24,null,null,'E'),
  -- Romano
  ('pavinos-bakery','biscuits-and-breads','Romano','Repack',109,null,null,'R'),
  ('pavinos-bakery','biscuits-and-breads','Romano','Small pack',94,null,null,'R'),
  ('pavinos-bakery','biscuits-and-breads','Romano','Regular',24,null,null,'R'),
  -- Sampaguita
  ('pavinos-bakery','biscuits-and-breads','Sampaguita','Repack',109,null,null,'S'),
  -- Assorted
  ('pavinos-bakery','biscuits-and-breads','Assorted Biscuits','Repack',129,null,null,'X'),
  ('pavinos-bakery','biscuits-and-breads','Assorted Biscuits','Small pack',109,null,null,'X')
),
copy(code, text) as (values
  ('L','Traditional air-dried Lucban pork sausage with a savory garlic punch, sharp vinegar tang and dried oregano, naturally colored with annatto and packed in natural hog casing.'),
  ('M','Air-dried Lucban flour noodles, the base of Pancit Habhab. Coarse, resilient texture that absorbs savory broth without turning mushy.'),
  ('P','Bite-sized Lucban rice cookie made from glutinous rice, butter, sugar and milk. Dry and chalk-white, it melts in the mouth; lovely with hot coffee or native chocolate.'),
  ('G','Crisp, ivory-white meringue drops made from whipped egg whites and sugar, slow-baked until they melt instantly on the tongue.'),
  ('B','Traditional finger-shaped Lucban sponge biscuit, baked until deeply toasted and dry. Light, airy and crunchy before it melts in the mouth.'),
  ('A','Oblong flat Lucban biscuit with coarse sugar crystals on top. Thin, crunchy and perfect for dipping in hot coffee.'),
  ('K','Pod-shaped Lucban finger biscuit, golden and crunchy, that softens into a buttery melt in coffee, salabat or native chocolate.'),
  ('E','Round, hard-baked Lucban egg biscuit with a glossy, brittle crunch that softens in hot coffee or chocolate.'),
  ('R','Rustic semi-hard Lucban bread made from a milk-and-flour dough; firm crust that softens when dipped in coffee or chocolate.'),
  ('S','Flower-shaped Lucban shortbread made from arrowroot or cornstarch, pale and brittle, dissolving into a buttery melt.'),
  ('X','Heritage sampler of Lucban biscuits: broas, apas, kamachile, galletas and romano in one pack.')
)
insert into products (store_id, category_id, slug, name, variant_label, description,
                      price, stock, weight, quantity_per_pack, status)
select s.id, c.id,
       slugify(d.store_slug || '-' || d.name || '-' || d.variant),
       d.name, d.variant, copy.text,
       d.price, 50, d.weight, d.per_pack, 'active'
  from d
  join stores s     on s.slug = d.store_slug
  join categories c on c.slug = d.cat_slug
  join copy         on copy.code = d.descr
on conflict (slug) do nothing;
