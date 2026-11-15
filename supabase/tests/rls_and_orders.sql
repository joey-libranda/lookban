-- =====================================================================
-- LOOKBAN database tests: RLS, privilege guards, place_order, stock, snapshots.
-- Run on a database that has migrations 0001-0004 + seed.sql applied.
-- Everything happens inside one transaction that is ROLLED BACK at the end.
-- Any failed assertion raises an exception and stops the script (use -v ON_ERROR_STOP=1).
-- =====================================================================
begin;

create schema t;
grant usage on schema t to anon, authenticated;

create function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

-- statement must raise an error containing `needle`
create function t.fails(stmt text, needle text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if position(lower(needle) in lower(sqlerrm)) > 0 then
      raise notice 'PASS: % (%)', label, sqlerrm; return;
    end if;
    raise exception 'FAIL: % - wrong error: %', label, sqlerrm;
  end;
  raise exception 'FAIL: % - statement succeeded but should have failed', label;
end $$;

-- rows touched by a DML statement
create function t.affected(stmt text) returns int language plpgsql as $$
declare n int;
begin execute stmt; get diagnostics n = row_count; return n; end $$;

create function t.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
end $$;
create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ---------- fixtures (as superuser) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.dev',  '{"full_name":"Alice Customer"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.dev',    '{"full_name":"Bob Customer"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'v1@test.dev',     '{"full_name":"Vendor One"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'v2@test.dev',     '{"full_name":"Vendor Two"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.dev',  '{"full_name":"Admin"}');
update profiles set role = 'admin'  where id = '00000000-0000-0000-0000-0000000000ad';
update profiles set role = 'vendor' where id in ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2');
update stores set owner_id = '00000000-0000-0000-0000-0000000000c1' where slug = 'aboos-lucban-longganisa';
update stores set owner_id = '00000000-0000-0000-0000-0000000000c2' where slug = 'center-miki-factory';

select t.ok((select role = 'customer' from profiles where id = '00000000-0000-0000-0000-00000000000a'),
            'new auth user gets a customer profile via trigger');

-- handy ids
create temp table ids as
select
  (select id from stores   where slug = 'aboos-lucban-longganisa')                      as s1,
  (select id from stores   where slug = 'center-miki-factory')                          as s2,
  (select id from products where slug = 'aboos-lucban-longganisa-lucban-longganisa-small-bite-sweet-spicy-garlic-1-dozen') as p_long,
  (select id from products where slug = 'center-miki-factory-miki-lucban-250g-pack')    as p_miki;
grant select on ids to anon, authenticated;
select t.ok((select p_long is not null and p_miki is not null from ids), 'seed products found');

-- ================= PUBLIC (anon) =================
select t.as_anon();
select t.ok((select count(*) from products) = 45, 'anon can read active products of approved stores');
select t.ok((select count(*) from stores) = 12,   'anon can read approved stores');
select t.ok((select count(*) from profiles) = 0,  'anon cannot read profiles');
select t.ok((select count(*) from orders) = 0,    'anon cannot read orders');
select t.fails($$ select place_order('x','1','a',null,'c','p',null,null,'cod') $$, 'permission denied', 'anon cannot call place_order');
reset role;

-- ================= PRIVILEGE ESCALATION =================
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.fails($$ update profiles set role = 'admin' where id = auth.uid() $$, 'Not allowed', 'customer cannot promote self to admin');
select t.fails($$ update profiles set is_active = true, email = 'x@y.z' where id = auth.uid() $$, 'Not allowed', 'customer cannot change own email/status');
select t.ok(t.affected($$ update profiles set full_name = 'Alice R.' where id = auth.uid() $$) = 1, 'customer can edit own name');
select t.ok(t.affected($$ update profiles set full_name = 'hack' where id = '00000000-0000-0000-0000-00000000000b' $$) = 0, 'customer cannot edit another profile');
select t.fails($$ insert into stores (slug, name, status) values ('evil','Evil','approved') $$, 'row-level security', 'customer cannot create a store');
select t.fails($$ insert into orders (receipt_no, customer_name, customer_phone, delivery_line1, delivery_city, delivery_province,
                    payment_method, payment_status, subtotal, shipping_total, total)
                  values ('LB-FAKE','a','1','x','y','z','cod','paid',0,0,0) $$, 'row-level security', 'customer cannot insert orders directly');
select t.ok(t.affected($$ update products set price = 1 $$) = 0, 'customer cannot change product prices');
select t.fails($$ select approve_vendor_application(gen_random_uuid()) $$, 'Admins only', 'customer cannot approve vendors');
reset role;

-- ================= CART RLS =================
select t.as_user('00000000-0000-0000-0000-00000000000a');
insert into carts (user_id) values (auth.uid());
select t.fails($$ insert into carts (user_id) values ('00000000-0000-0000-0000-00000000000b') $$, 'row-level security', 'cannot create cart for another user');
insert into cart_items (cart_id, product_id, quantity)
  select (select id from carts where user_id = auth.uid()), p_long, 2 from ids;
insert into cart_items (cart_id, product_id, quantity)
  select (select id from carts where user_id = auth.uid()), p_miki, 3 from ids;
select t.fails($$ insert into cart_items (cart_id, product_id, quantity)
                  select (select id from carts where user_id = auth.uid()), p_miki, 0 from ids $$, 'check constraint', 'quantity 0 rejected');
reset role;
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((select count(*) from cart_items) = 0, 'other customer cannot see Alice''s cart items');
reset role;

-- ================= place_order =================
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.fails($$ select place_order('', '0917', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'INVALID_INPUT', 'empty name rejected');
create temp table placed(order_id uuid);
grant all on placed to authenticated;
insert into placed select place_order('Alice Customer','09171234567','12 Rizal St','Brgy 1','Lucban','Quezon','4328','leave at gate','cod');
select t.ok((select count(*) from orders) = 1, 'order created');
select t.ok((select count(*) from store_orders) = 2, 'one store_order per vendor (2 vendors in cart)');
select t.ok((select subtotal = 135*2 + 77*3 and shipping_total = 100 and total = 135*2 + 77*3 + 100 from orders),
            'server computed subtotal 501 + shipping 100 (50 per vendor) = 601');
select t.ok((select payment_status = 'pending' from orders), 'COD payment stays pending');
select t.ok((select count(*) from cart_items) = 0, 'cart emptied after order');
reset role;
select t.ok((select stock = 48 and sold_count = 2 from products where id = (select p_long from ids)), 'stock deducted for longganisa');
select t.ok((select stock = 47 from products where id = (select p_miki from ids)), 'stock deducted for miki');

-- price snapshot survives price change
update products set price = 999 where id = (select p_long from ids);
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select price_at_purchase = 135 from order_items where product_id = (select p_long from ids)), 'price_at_purchase unaffected by later price change');
reset role;

-- ================= OVERSELL / ATOMICITY =================
update products set stock = 1 where id = (select p_long from ids);
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into carts (user_id) values (auth.uid());
insert into cart_items (cart_id, product_id, quantity) select (select id from carts where user_id = auth.uid()), p_miki, 1 from ids;
insert into cart_items (cart_id, product_id, quantity) select (select id from carts where user_id = auth.uid()), p_long, 2 from ids;
select t.fails($$ select place_order('Bob','0918','1 St',null,'Lucban','Quezon',null,null,'simulated_online') $$, 'INSUFFICIENT_STOCK', 'cannot order more than stock');
select t.ok((select count(*) from orders) = 0, 'failed order created nothing for Bob');
reset role;
select t.ok((select stock = 47 from products where id = (select p_miki from ids)), 'failed order did not deduct stock from other lines (atomic)');

-- fix stock and place simulated order
update products set stock = 5 where id = (select p_long from ids);
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into placed select place_order('Bob','0918','1 St',null,'Lucban','Quezon',null,null,'simulated_online');
select t.ok((select payment_status = 'simulated' from orders), 'simulated payment is marked simulated, never paid');
reset role;

-- ================= VISIBILITY ACROSS ROLES =================
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from orders) = 1, 'Alice sees only her own order');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.ok((select count(*) from store_orders) = 2 and (select bool_and(store_id = (select s1 from ids)) from store_orders), 'vendor 1 sees only store_orders of their store');
select t.ok((select count(*) from order_items) = 2, 'vendor 1 sees only items of their store');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok((select count(*) from orders) = 2, 'admin sees all orders');
reset role;

-- ================= VENDOR BOUNDARIES =================
create temp table so_ids as select id, store_id, order_id from store_orders;   -- built as superuser
grant select on so_ids to authenticated;
create temp table alice_order as select id from orders where customer_id = '00000000-0000-0000-0000-00000000000a';
grant select on alice_order to authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.affected($$ update products set price = 140 where id = (select p_long from ids) $$) = 1, 'vendor can edit own product');
select t.ok(t.affected($$ update products set price = 1 where id = (select p_miki from ids) $$) = 0, 'vendor cannot edit another store''s product');
select t.fails($$ update stores set status = 'suspended' where id = (select s1 from ids) $$, 'Not allowed', 'vendor cannot change own approval status');
select t.fails($$ update products set sold_count = 9999 where id = (select p_long from ids) $$, 'Not allowed', 'vendor cannot tamper sold_count');
select t.fails($$ insert into products (store_id, slug, name, price) select s2, 'x-hack', 'Hack', 1 from ids $$, 'row-level security', 'vendor cannot add product to another store');
select t.ok(t.affected($$ update stores set description = 'New description' where id = (select s1 from ids) $$) = 1, 'vendor can edit own store details');
select t.fails($$ select update_store_order_status((select id from so_ids where store_id = (select s2 from ids) limit 1), 'confirmed') $$, 'FORBIDDEN', 'vendor 1 cannot update vendor 2''s store_order');
reset role;

-- ================= FULFILLMENT FLOW =================
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select update_store_order_status(id, 'confirmed') from so_ids where store_id = (select s1 from ids) and order_id = (select id from alice_order);
select t.fails($$ select update_store_order_status((select id from so_ids where store_id = (select s1 from ids) and order_id = (select id from alice_order)), 'pending') $$, 'forward', 'status cannot move backwards');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000c2');
select update_store_order_status(id, 'delivered') from so_ids where store_id = (select s2 from ids) and order_id = (select id from alice_order);
reset role;
select t.ok((select status = 'confirmed' from orders where id = (select id from alice_order)), 'parent order status follows the slowest vendor (confirmed + delivered => confirmed)');
select t.ok((select payment_status = 'pending' from orders where id = (select id from alice_order)), 'COD stays unpaid until every active store_order is delivered');

-- cancelling restocks
select t.as_user('00000000-0000-0000-0000-0000000000c2');
select t.ok((select stock from products where id = (select p_miki from ids)) is not null, 'vendor reads own stock');
reset role;
do $$
declare before_stock int; after_stock int; so uuid;
begin
  select stock into before_stock from products where id = (select p_miki from ids);
  select id into so from store_orders where store_id = (select s2 from ids)
     and fulfillment_status = 'pending' limit 1;   -- Bob's order, not yet touched
  perform t.as_user('00000000-0000-0000-0000-0000000000c2');
  perform update_store_order_status(so, 'cancelled');
  reset role;
  select stock into after_stock from products where id = (select p_miki from ids);
  perform t.ok(after_stock = before_stock + 1, 'cancelling a store_order restocks its items');
end $$;

-- ================= REVIEWS =================
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.fails($$ insert into reviews (product_id, user_id, rating) select p_long, auth.uid(), 5 from ids $$, 'row-level security', 'cannot review a product that has not been delivered');
reset role;

-- ================= ADMIN MANAGEMENT (two-role UI: customer + admin) =================
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok(t.affected($$ insert into categories (slug, name) values ('test-cat', 'Test cat') $$) = 1, 'admin can create a category');
select t.ok(t.affected($$ update categories set name = 'Test cat 2' where slug = 'test-cat' $$) = 1, 'admin can edit a category');
select t.ok(t.affected($$ insert into stores (slug, name, status) values ('test-store', 'Test store', 'approved') $$) = 1, 'admin can create a store');
select t.ok(t.affected($$ update stores set shipping_fee = 75, is_open = false where slug = 'test-store' $$) = 1, 'admin can edit a store (fee, open flag)');
select t.ok(t.affected($$ insert into products (store_id, category_id, slug, name, price, stock)
  select s.id, c.id, 'test-prod', 'Test prod', 99.50, 5 from stores s, categories c where s.slug = 'test-store' and c.slug = 'test-cat' $$) = 1, 'admin can create a product in any store');
select t.ok(t.affected($$ update products set price = 120, stock = 9 where slug = 'test-prod' $$) = 1, 'admin can change price and stock');
select t.ok(t.affected($$ insert into product_images (product_id, url, storage_path, is_primary)
  select id, 'http://x/y.jpg', store_id::text || '/a.jpg', true from products where slug = 'test-prod' $$) = 1, 'admin can add a product image row');
select t.ok(t.affected($$ insert into settings (key, value) values ('default_shipping_fee', '60') on conflict (key) do update set value = excluded.value $$) = 1, 'admin can change the default shipping fee');
select t.ok(t.affected($$ update profiles set is_active = false where id = '00000000-0000-0000-0000-00000000000b' $$) = 1, 'admin can deactivate a customer');
select t.ok((select count(*) from profiles) >= 5, 'admin can list all profiles');
select t.ok(t.affected($$ delete from products where slug = 'test-prod' $$) = 1, 'admin can delete a product that was never ordered');
reset role;
select t.ok(not exists (select 1 from product_images where storage_path like '%/a.jpg'), 'deleting a product removes its image rows');
update profiles set is_active = true where id = '00000000-0000-0000-0000-00000000000b';

-- a customer cannot do any of it
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.fails($$ insert into categories (slug, name) values ('hack', 'Hack') $$, 'row-level security', 'customer cannot create a category');
select t.fails($$ insert into stores (slug, name) values ('hack', 'Hack') $$, 'row-level security', 'customer cannot create a store');
select t.fails($$ insert into products (store_id, slug, name, price, stock) select id, 'hack', 'Hack', 1, 1 from stores limit 1 $$, 'row-level security', 'customer cannot create a product');
select t.ok(t.affected($$ update products set price = 1 $$) = 0, 'customer cannot change any product price');
select t.ok(t.affected($$ update stores set name = 'x' $$) = 0, 'customer cannot edit any store');
select t.ok(t.affected($$ update settings set value = '0' where key = 'default_shipping_fee' $$) = 0, 'customer cannot change settings');
select t.ok(t.affected($$ update profiles set is_active = false where id = '00000000-0000-0000-0000-00000000000b' $$) = 0, 'customer cannot deactivate another customer');
select t.fails($$ update profiles set role = 'admin' where id = auth.uid() $$, '', 'customer cannot promote themselves to admin');

-- one saved delivery address per customer
select t.ok(t.affected($$ insert into addresses (user_id, recipient_name, phone, line1, is_default) values (auth.uid(), 'Alice', '09171234567', '1 Rizal St', true) $$) = 1, 'customer can save their address');
select t.fails($$ insert into addresses (user_id, recipient_name, phone, line1, is_default) values (auth.uid(), 'Alice 2', '09171234567', '2 Rizal St', true) $$, 'addresses_one_default', 'a second default address is rejected (one saved address)');
select t.ok(t.affected($$ update addresses set line1 = '9 Rizal St' where user_id = auth.uid() and is_default $$) = 1, 'customer can update their saved address');
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((select count(*) from addresses) = 0, 'another customer cannot see Alice''s address');
reset role;

-- ================= GUEST CHECKOUT, TOKENS, TRACKING, ADMIN CANNOT SHOP =================
insert into stores (id, slug, name, status, is_open) values
  ('00000000-0000-0000-0000-0000000000f1', 'g-store-1', 'Guest Store 1', 'approved', true),
  ('00000000-0000-0000-0000-0000000000f2', 'g-store-2', 'Guest Store 2', 'approved', true);
insert into products (id, store_id, slug, name, price, stock) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'gp1', 'Guest prod 1', 100, 10),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f2', 'gp2', 'Guest prod 2', 40, 5);
create temp table gres(res jsonb);
grant all on gres to anon, authenticated;

select t.as_anon();
select t.fails($$ select place_guest_order('[]'::jsonb, null, 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'EMPTY_CART', 'guest: empty cart rejected');
select t.fails($$ select place_guest_order('{"a":1}'::jsonb, null, 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'EMPTY_CART', 'guest: non-array items rejected');
select t.fails($$ select place_guest_order('[{"product_id":"nope","quantity":1}]'::jsonb, null, 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'INVALID_INPUT', 'guest: malformed product id rejected');
select t.fails($$ select place_guest_order('[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":0}]'::jsonb, null, 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'INVALID_INPUT', 'guest: zero quantity rejected');
select t.fails($$ select place_guest_order('[{"product_id":"00000000-0000-0000-0000-00000000dead","quantity":1}]'::jsonb, null, 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'UNAVAILABLE', 'guest: unknown product rejected');
select t.fails($$ select place_guest_order('[{"product_id":"00000000-0000-0000-0000-0000000000a2","quantity":6}]'::jsonb, null, 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'INSUFFICIENT_STOCK', 'guest: cannot exceed stock');
select t.fails($$ select place_guest_order('[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1}]'::jsonb, null, '', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'INVALID_INPUT', 'guest: name and address required');
-- a client-supplied "price" field is ignored; duplicates of one product are merged
insert into gres select place_guest_order(
  '[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1,"price":1},
    {"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1},
    {"product_id":"00000000-0000-0000-0000-0000000000a2","quantity":2}]'::jsonb,
  'guest@example.com', 'Guest Gina', '0917-123-4567', '5 Mabini St', null, 'Lucban', 'Quezon', '4328', null, 'cod');
select t.ok((select res->>'token' is not null from gres), 'guest order returns an access token');
select t.ok((select count(*) from orders) = 0, 'anonymous users cannot read orders directly (RLS)');
select t.ok((select count(*) from store_orders) = 0 and (select count(*) from order_items) = 0, 'anonymous users cannot read store_orders/order_items');
select t.ok(t.affected($$ update orders set total = 1 $$) = 0, 'anonymous users cannot modify orders');
reset role;
select t.ok((select customer_id is null and subtotal = 280 and shipping_total = 2 * (select (value #>> '{}')::numeric from settings where key = 'default_shipping_fee') and total = subtotal + shipping_total and payment_status = 'pending'
               from orders where id = (select (res->>'id')::uuid from gres)),
            'guest order: no customer, prices from DB (2x100 + 2x40) + one shipping fee per store');
select t.ok((select count(*) = 2 from store_orders where order_id = (select (res->>'id')::uuid from gres)), 'guest order split per store');
select t.ok((select stock = 8 from products where id = '00000000-0000-0000-0000-0000000000a1')
        and (select stock = 3 from products where id = '00000000-0000-0000-0000-0000000000a2'), 'guest order deducted stock');

select t.as_anon();
select t.ok((select jsonb_array_length(get_order_by_token((res->>'id')::uuid, (res->>'token')::uuid)->'store_orders') = 2 from gres), 'right token reads the order (2 stores)');
select t.ok((select get_order_by_token((res->>'id')::uuid, gen_random_uuid()) is null from gres), 'wrong token reads nothing');
select t.ok((select not (get_order_by_token((res->>'id')::uuid, (res->>'token')::uuid) ? 'access_token') from gres), 'token is not echoed back in the payload');
reset role;
create temp table rn as select receipt_no, customer_phone from orders where id = (select (res->>'id')::uuid from gres);
grant all on rn to anon;
select t.as_anon();
select t.ok((select track_order(receipt_no, '+63 917 123 4567') is not null from rn), 'track: receipt + phone (any format) finds the order');
select t.ok((select track_order(lower(receipt_no), '09171234567') is not null from rn), 'track: receipt number is case-insensitive');
select t.ok((select track_order(receipt_no, '09179999999') is null from rn), 'track: wrong phone finds nothing');
select t.ok((select track_order(receipt_no, '') is null from rn), 'track: empty phone finds nothing');
reset role;

-- admins do not shop
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.fails($$ select place_order('Admin','09171234567','x',null,'Lucban','Quezon',null,null,'cod') $$, 'ADMIN_NOT_ALLOWED', 'admin cannot place orders');
reset role;

-- contact messages: anyone may send, only admins may read/modify
select t.as_anon();
select t.ok(t.affected($$ insert into contact_messages (name, email, subject, message) values ('Juan', 'juan@example.com', 'Other', 'Hello, is longganisa available?') $$) = 1, 'anonymous visitor can send a contact message');
select t.fails($$ insert into contact_messages (name, email, subject, message, status) values ('Juan', 'juan@example.com', 'Other', 'Hello there friend', 'read') $$, 'row-level security', 'visitor cannot insert a pre-read message');
select t.fails($$ insert into contact_messages (name, email, subject, message) values ('J', 'juan@example.com', 'Other', 'too short name') $$, 'check constraint', 'contact message length limits enforced');
select t.fails($$ select * from contact_messages $$, 'permission denied', 'anonymous cannot read contact messages');
reset role;
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok(t.affected($$ select * from contact_messages $$) = 0, 'customer cannot read contact messages');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok((select count(*) >= 1 from contact_messages), 'admin can read contact messages');
reset role;

-- promo pricing: original price must be higher than the selling price
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.fails($$ update products set compare_at_price = price where id = (select id from products limit 1) $$, 'check constraint', 'promo original price must be higher than price');
select t.ok(t.affected($$ update products set compare_at_price = price + 10 where id = (select id from products limit 1) $$) = 1, 'admin can set a promo original price');
reset role;

-- hero slides: public reads active ones, only admins write
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok(t.affected($$ insert into hero_slides (image_url, alt, link_url, is_active) values ('https://x.test/a.jpg', 'A', '/shop', true) $$) = 1, 'admin can add a hero slide');
select t.ok(t.affected($$ insert into hero_slides (image_url, alt, link_url, is_active) values ('https://x.test/b.jpg', 'B', '/stores', false) $$) = 1, 'admin can add an inactive hero slide');
select t.fails($$ insert into hero_slides (image_url, alt, link_url) values ('https://x.test/c.jpg', 'C', 'https://evil.example') $$, 'check constraint', 'hero link must be a site page');
select t.fails($$ insert into hero_slides (image_url, alt, link_url) values ('https://x.test/c.jpg', 'C', '//evil.example') $$, 'check constraint', 'hero link cannot be protocol-relative');
reset role;
select t.as_anon();
select t.ok((select count(*) from hero_slides) = 1, 'visitor sees only active hero slides');
select t.fails($$ insert into hero_slides (image_url, alt, link_url) values ('https://x.test/d.jpg', 'D', '/shop') $$, 'permission denied', 'visitor cannot add hero slides');
reset role;
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from hero_slides) = 1, 'customer sees only active hero slides');
select t.ok(t.affected($$ delete from hero_slides $$) = 0, 'customer cannot delete hero slides');
reset role;

select 'ALL DATABASE TESTS PASSED' as result;
rollback;
