-- =====================================================================
-- LOOKBAN - check that the database setup is complete (READ ONLY).
-- Paste into Supabase -> SQL Editor and run. It changes nothing.
-- Every row should say "ok". Any "MISSING" row tells you which step to run.
-- =====================================================================
with expected_tables(name, step) as (values
  ('profiles','0001'),('addresses','0001'),('stores','0001'),('vendor_applications','0001'),('categories','0001'),
  ('products','0001'),('product_images','0001'),('carts','0001'),('cart_items','0001'),('orders','0001'),
  ('store_orders','0001'),('order_items','0001'),('reviews','0001'),('settings','0001'),
  ('contact_messages','0007'),('hero_slides','0009')),
expected_functions(name, step) as (values
  ('place_order','0003'),('place_guest_order','0005'),('get_order_by_token','0005'),('track_order','0005'),
  ('update_store_order_status','0003'),('is_admin','0002'),
  ('cancel_my_store_order','0010'),('confirm_my_store_order_received','0010'),('rate_my_store_order','0010'),
  ('cancel_store_order_by_token','0010'),('confirm_store_order_received_by_token','0010')),
expected_buckets(name, step) as (values
  ('product-images','0004'),('store-assets','0004'),('hero-banners','0009'))
select 'table' as kind, t.name, t.step,
       case when exists (select 1 from information_schema.tables where table_schema='public' and table_name=t.name) then 'ok' else 'MISSING - run '||t.step end as status
  from expected_tables t
union all
select 'function', f.name, f.step,
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=f.name) then 'ok' else 'MISSING - run '||f.step end
  from expected_functions f
union all
select 'storage bucket', b.name, b.step,
       case when exists (select 1 from storage.buckets where id=b.name) then 'ok' else 'MISSING - run '||b.step end
  from expected_buckets b
union all
select 'column', 'products.compare_at_price', '0008',
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='compare_at_price') then 'ok' else 'MISSING - run 0008' end
union all
select 'column', 'store_orders.rating', '0010',
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='store_orders' and column_name='rating') then 'ok' else 'MISSING - run 0010' end
union all
select 'function', 'place_guest_order requires an email', '0011',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='place_guest_order' and p.prosrc like '%valid email%') then 'ok' else 'MISSING - run 0011' end
union all
select 'row security', c.relname, '0002',
       case when c.relrowsecurity then 'ok' else 'MISSING - run 0002' end
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
union all
select 'data', 'categories (seed)', 'seed',
       case when (select count(*) from public.categories) > 0 then 'ok' else 'EMPTY - run seed.sql' end
union all
select 'data', 'an admin exists', 'README',
       case when exists (select 1 from public.profiles where role='admin') then 'ok' else 'NONE - see "Make yourself admin" in supabase/SETUP.md' end
order by 1, 2;
