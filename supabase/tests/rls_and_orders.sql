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
grant select on alice_order to anon, authenticated;
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

-- ================= CANCEL / RECEIVED / RATING (migration 0010) =================
create temp table sx as
  select so.id, so.order_id, so.store_id, o.access_token as tok, o.customer_id
    from store_orders so join orders o on o.id = so.order_id;
grant select on sx to anon, authenticated;
create temp table bob_o1 as select id from orders where customer_id = '00000000-0000-0000-0000-00000000000b';
grant select on bob_o1 to anon, authenticated;

-- a vendor-side cancel already removed Bob's miki store_order: totals now cover only what is still payable
select t.ok((select o.total = (select sum(total) from store_orders where order_id = o.id and fulfillment_status <> 'cancelled')
                and o.subtotal = (select sum(subtotal) from store_orders where order_id = o.id and fulfillment_status <> 'cancelled')
                and o.shipping_total = 50
            from orders o where o.id = (select id from bob_o1)),
            'cancelled store_order drops out of the order totals (items, shipping and total)');
select t.ok((select payment_status = 'simulated' from orders where id = (select id from bob_o1)),
            'partial cancel keeps online payment status (never turns into paid)');

-- guests: tracking-link holders can cancel before delivery, others cannot
select t.as_anon();
select t.fails($$ select cancel_store_order_by_token((select order_id from sx where store_id = (select s1 from ids) and order_id = (select id from alice_order)),
                   gen_random_uuid(), (select id from sx where store_id = (select s1 from ids) and order_id = (select id from alice_order))) $$,
               'NOT_FOUND', 'wrong tracking token cannot cancel an order');
select t.fails($$ select cancel_my_store_order((select id from sx limit 1)) $$, 'permission denied', 'visitor cannot call the signed-in cancel');
select t.fails($$ select rate_my_store_order((select id from sx limit 1), 5, 'x') $$, 'permission denied', 'visitor cannot rate');
select cancel_store_order_by_token(order_id, tok, id) from sx where store_id = (select s1 from ids) and order_id = (select id from alice_order);
reset role;
select t.ok((select fulfillment_status = 'cancelled' from store_orders where id = (select id from sx where store_id = (select s1 from ids) and order_id = (select id from alice_order))),
            'guest with the tracking link cancelled a confirmed store_order');
select t.ok((select total = (select total from store_orders where order_id = o.id and store_id = (select s2 from ids)) and status = 'delivered' and payment_status = 'paid'
               from orders o where id = (select id from alice_order)),
            'Alice''s order: total = only the delivered store, COD marked paid');

-- signed-in customers
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.fails($$ select cancel_my_store_order((select id from sx where order_id = (select id from alice_order) and store_id = (select s2 from ids))) $$, 'NOT_FOUND', 'customer cannot cancel someone else''s order');
select t.fails($$ select rate_my_store_order((select id from sx where order_id = (select id from alice_order) and store_id = (select s2 from ids)), 5, 'x') $$, 'NOT_FOUND', 'customer cannot rate someone else''s order');
reset role;
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.fails($$ select cancel_my_store_order((select id from sx where order_id = (select id from alice_order) and store_id = (select s2 from ids))) $$, 'no longer be cancelled', 'delivered order cannot be cancelled');
select t.fails($$ select confirm_my_store_order_received((select id from sx where order_id = (select id from alice_order) and store_id = (select s2 from ids))) $$, 'out for delivery', 'cannot confirm receipt unless out for delivery');
select t.fails($$ select rate_my_store_order((select id from sx where order_id = (select id from alice_order) and store_id = (select s1 from ids)), 5, 'x') $$, 'after it is delivered', 'cancelled order cannot be rated');
select t.fails($$ select rate_my_store_order((select id from sx where order_id = (select id from alice_order) and store_id = (select s2 from ids)), 6, 'x') $$, '1 to 5', 'rating must be 1 to 5');
select rate_my_store_order((select id from sx where order_id = (select id from alice_order) and store_id = (select s2 from ids)), 4, '  Masarap!  ');
select t.fails($$ select rate_my_store_order((select id from sx where order_id = (select id from alice_order) and store_id = (select s2 from ids)), 5, null) $$, 'already rated', 'an order can be rated only once');
reset role;
select t.ok((select rating = 4 and rating_comment = 'Masarap!' and rated_at is not null from store_orders
              where id = (select id from sx where order_id = (select id from alice_order) and store_id = (select s2 from ids))),
            'rating and trimmed feedback saved on the store_order');
select t.ok((select rating = 4 and comment = 'Masarap!' from reviews
              where user_id = '00000000-0000-0000-0000-00000000000a' and product_id = (select p_miki from ids)),
            'rating also became a product review');

-- Bob cancels his still-pending store_order: stock comes back, order becomes cancelled, total 0
do $$
declare before_stock int; after_stock int;
begin
  select stock into before_stock from products where id = (select p_long from ids);
  perform t.as_user('00000000-0000-0000-0000-00000000000b');
  perform cancel_my_store_order((select id from sx where order_id = (select id from bob_o1) and store_id = (select s1 from ids)));
  reset role;
  select stock into after_stock from products where id = (select p_long from ids);
  perform t.ok(after_stock = before_stock + 2, 'customer cancel restocks the items');
end $$;
select t.ok((select status = 'cancelled' and payment_status = 'cancelled' and total = 0 from orders where id = (select id from bob_o1)),
            'fully cancelled order: status cancelled, nothing left to pay');

-- a second order for Bob, then out for delivery: no more cancelling, but "received" works
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into cart_items (cart_id, product_id, quantity) select (select id from carts where user_id = auth.uid()), p_miki, 1 from ids;
insert into cart_items (cart_id, product_id, quantity) select (select id from carts where user_id = auth.uid()), p_long, 1 from ids;
insert into placed select place_order('Bob','0918','1 St',null,'Lucban','Quezon',null,null,'cod');
reset role;
create temp table bob_o3 as select id from orders where customer_id = '00000000-0000-0000-0000-00000000000b' and id <> (select id from bob_o1);
grant select on bob_o3 to anon, authenticated;
create temp table sx3 as
  select so.id, so.store_id, o.access_token as tok, so.order_id from store_orders so join orders o on o.id = so.order_id where so.order_id = (select id from bob_o3);
grant select on sx3 to anon, authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select update_store_order_status(id, 'out_for_delivery') from sx3;
reset role;
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.fails($$ select cancel_my_store_order((select id from sx3 where store_id = (select s1 from ids))) $$, 'no longer be cancelled', 'out-for-delivery order cannot be cancelled by the customer');
select confirm_my_store_order_received((select id from sx3 where store_id = (select s1 from ids)));
select t.fails($$ select confirm_my_store_order_received((select id from sx3 where store_id = (select s1 from ids))) $$, 'out for delivery', 'receipt cannot be confirmed twice');
select rate_my_store_order((select id from sx3 where store_id = (select s1 from ids)), 5, null);
reset role;
select t.ok((select received_at is not null and fulfillment_status = 'delivered' and rating = 5 and rating_comment is null from store_orders where id = (select id from sx3 where store_id = (select s1 from ids))),
            'customer confirmed receipt then rated 5 stars with no feedback');
select t.as_anon();
select confirm_store_order_received_by_token(order_id, tok, id) from sx3 where store_id = (select s2 from ids);
reset role;
select t.ok((select status = 'delivered' and payment_status = 'paid' from orders where id = (select id from bob_o3)),
            'guest tracking link can confirm receipt; order delivered, COD paid');

-- ================= GUEST CHECKOUT NEEDS AN EMAIL (migration 0011) =================
select t.as_anon();
select t.fails($$ select place_guest_order(jsonb_build_array(jsonb_build_object('product_id', (select p_miki from ids), 'quantity', 1)),
                   '', 'Guest', '09171234567', '1 St', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'valid email', 'guest checkout without an email is refused');
select t.fails($$ select place_guest_order(jsonb_build_array(jsonb_build_object('product_id', (select p_miki from ids), 'quantity', 1)),
                   'not-an-email', 'Guest', '09171234567', '1 St', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'valid email', 'guest checkout with a malformed email is refused');
create temp table guest_o(r jsonb);
grant all on guest_o to anon;
insert into guest_o select place_guest_order(jsonb_build_array(jsonb_build_object('product_id', (select p_miki from ids), 'quantity', 1)),
                   '  guest@example.com ', 'Guest', '09171234567', '1 St', null, 'Lucban', 'Quezon', null, null, 'cod');
reset role;
select t.ok((select customer_email = 'guest@example.com' and customer_id is null from orders where id = ((select r->>'id' from guest_o))::uuid),
            'guest order saves the trimmed email');

-- ================= COMMISSION (migration 0012) =================
select t.ok((select value = '5'::jsonb from settings where key = 'default_commission_rate'), 'default commission rate is seeded at 5 percent');
select t.ok(not exists (select 1 from store_orders so left join store_order_commissions c on c.store_order_id = so.id where c.store_order_id is null),
            'every store_order got a commission record when it was placed');
select t.ok((select bool_and(rate = 5) from store_order_commissions), 'orders placed with no store override use the 5 percent default');
select t.ok(not exists (select 1 from store_orders so join store_order_commissions c on c.store_order_id = so.id
                         where (so.fulfillment_status = 'delivered') <> (c.amount is not null and c.earned_at is not null)),
            'commission is earned only for delivered store_orders (cancelled and open ones earn nothing)');
select t.ok(not exists (select 1 from store_orders so join store_order_commissions c on c.store_order_id = so.id
                         where c.amount is not null and c.amount <> round(so.subtotal * c.rate / 100, 2)),
            'commission = rate x item subtotal, rounded to centavos (shipping excluded)');

-- a store with its own rate: 7.5 percent, then rates change after the order is placed
update stores set commission_rate = 7.5 where id = (select s1 from ids);
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into cart_items (cart_id, product_id, quantity) select (select id from carts where user_id = auth.uid()), p_long, 1 from ids;
insert into cart_items (cart_id, product_id, quantity) select (select id from carts where user_id = auth.uid()), p_miki, 1 from ids;
insert into placed select place_order('Bob','0918','1 St',null,'Lucban','Quezon',null,null,'cod');
reset role;
create temp table bob_o4 as select id from orders where customer_id = '00000000-0000-0000-0000-00000000000b'
  and id not in (select id from bob_o1 union select id from bob_o3);
create temp table sx4 as select so.id, so.store_id, so.subtotal from store_orders so where so.order_id = (select id from bob_o4);
grant select on bob_o4, sx4 to anon, authenticated;
select t.ok((select rate = 7.5 from store_order_commissions where store_order_id = (select id from sx4 where store_id = (select s1 from ids))),
            'a store''s own rate overrides the default');
select t.ok((select rate = 5 from store_order_commissions where store_order_id = (select id from sx4 where store_id = (select s2 from ids))),
            'a store without an override uses the default');
select t.ok((select amount is null and earned_at is null from store_order_commissions where store_order_id = (select id from sx4 where store_id = (select s1 from ids))),
            'nothing is earned while the order is still open');

-- rates change AFTER the order was placed: the order keeps the rate it was placed with
update stores set commission_rate = 20 where id = (select s1 from ids);
update settings set value = '9'::jsonb where key = 'default_commission_rate';
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select update_store_order_status(id, 'out_for_delivery') from sx4;
select update_store_order_status(id, 'delivered') from sx4;
reset role;
select t.ok((select rate = 7.5 and amount = round((select subtotal from sx4 where store_id = (select s1 from ids)) * 7.5 / 100, 2)
               from store_order_commissions where store_order_id = (select id from sx4 where store_id = (select s1 from ids))),
            'earned at the rate fixed when the order was placed, not the later rate');
select t.ok((select rate = 5 and amount is not null from store_order_commissions where store_order_id = (select id from sx4 where store_id = (select s2 from ids))),
            'default-rate store keeps its placed rate too');

-- new orders pick up the new rates
select t.ok(_commission_rate_for((select s1 from ids)) = 20 and _commission_rate_for((select s2 from ids)) = 9, 'new orders use the updated store and default rates');
update stores set commission_rate = null where id = (select s1 from ids);
update settings set value = '5'::jsonb where key = 'default_commission_rate';

-- cancelling earns nothing
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into cart_items (cart_id, product_id, quantity) select (select id from carts where user_id = auth.uid()), p_miki, 1 from ids;
insert into placed select place_order('Bob','0918','1 St',null,'Lucban','Quezon',null,null,'cod');
reset role;
create temp table sx5 as select so.id from store_orders so join orders o on o.id = so.order_id
 where o.customer_id = '00000000-0000-0000-0000-00000000000b' and o.id not in (select id from bob_o1 union select id from bob_o3 union select id from bob_o4);
grant select on sx5 to anon, authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000b');
select cancel_my_store_order(id) from sx5;
reset role;
select t.ok((select amount is null and earned_at is null from store_order_commissions where store_order_id = (select id from sx5)),
            'a cancelled store_order earns no commission');

-- who can see commission figures
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((select count(*) = 0 from store_order_commissions), 'customers cannot see commission figures, even for their own orders');
select t.fails($$ update store_order_commissions set amount = 999 $$, 'permission denied', 'customers cannot edit commissions');
reset role;
select t.as_anon();
select t.fails($$ select * from store_order_commissions $$, 'permission denied', 'visitors cannot read commissions');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.ok((select count(*) > 0 and bool_and(store_id = (select s1 from ids)) from store_order_commissions), 'a store owner sees only their own store''s commissions');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok((select count(*) = (select count(*) from store_order_commissions) and count(*) > 0 from store_order_commissions), 'admin sees all commissions');
select t.fails($$ insert into store_order_commissions (store_order_id, rate) select id, 1 from store_orders limit 1 $$, 'permission denied', 'even admins cannot write commissions directly');
select t.fails($$ update stores set commission_rate = 150 where true $$, 'violates check', 'commission rate must be 0 to 100');
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
select t.fails($$ select place_guest_order('[]'::jsonb, 'g@example.com', 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'EMPTY_CART', 'guest: empty cart rejected');
select t.fails($$ select place_guest_order('{"a":1}'::jsonb, 'g@example.com', 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'EMPTY_CART', 'guest: non-array items rejected');
select t.fails($$ select place_guest_order('[{"product_id":"nope","quantity":1}]'::jsonb, 'g@example.com', 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'INVALID_INPUT', 'guest: malformed product id rejected');
select t.fails($$ select place_guest_order('[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":0}]'::jsonb, 'g@example.com', 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'INVALID_INPUT', 'guest: zero quantity rejected');
select t.fails($$ select place_guest_order('[{"product_id":"00000000-0000-0000-0000-00000000dead","quantity":1}]'::jsonb, 'g@example.com', 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'UNAVAILABLE', 'guest: unknown product rejected');
select t.fails($$ select place_guest_order('[{"product_id":"00000000-0000-0000-0000-0000000000a2","quantity":6}]'::jsonb, 'g@example.com', 'G', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'INSUFFICIENT_STOCK', 'guest: cannot exceed stock');
select t.fails($$ select place_guest_order('[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1}]'::jsonb, 'g@example.com', '', '09171234567', 'x', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'INVALID_INPUT', 'guest: name and address required');
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

-- replies to contact messages: admin only, saved as simulated email
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok(t.affected($$ insert into contact_replies (message_id, body, sent_by) select id, 'Hi! Yes, we have longganisa.', auth.uid() from contact_messages limit 1 $$) = 1, 'admin can reply to a contact message');
select t.ok((select delivery = 'simulated' from contact_replies limit 1), 'replies are recorded as simulated, never as really sent');
select t.fails($$ insert into contact_replies (message_id, body) select id, 'x' from contact_messages limit 1 $$, 'check constraint', 'reply body length limit enforced');
select t.fails($$ insert into contact_replies (message_id, body, delivery) select id, 'Hello there', 'sent' from contact_messages limit 1 $$, 'check constraint', 'a reply cannot claim real delivery');
reset role;
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok(t.affected($$ select * from contact_replies $$) = 0, 'customer cannot read replies');
select t.fails($$ insert into contact_replies (message_id, body) values (gen_random_uuid(), 'Sneaky reply') $$, 'row-level security', 'customer cannot write replies');
reset role;
select t.as_anon();
select t.fails($$ select * from contact_replies $$, 'permission denied', 'anonymous cannot read replies');
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


-- ================= VENDOR ACCOUNTS: approval for new products (migration 0014) =================
create temp table vp(id uuid);
grant all on vp to anon, authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000c1');
-- the vendor TRIES to publish straight away (asks for approved + active)
with n as (
  insert into products (store_id, slug, name, price, stock, status, approval_status)
  select s1, 'vendor-new-item', 'Vendor New Item', 80, 20, 'active', 'approved' from ids returning id)
insert into vp select id from n;
select t.ok((select approval_status = 'pending' and status = 'archived' from products where id = (select id from vp)),
            'a product added by a vendor is forced to pending + hidden, even if they ask for approved');
select t.fails($$ update products set approval_status = 'approved' where id = (select id from vp) $$, 'Not allowed', 'vendor cannot approve their own product');
select t.fails($$ update products set review_note = 'looks great' where id = (select id from vp) $$, 'Not allowed', 'vendor cannot write the review note');
select t.ok(t.affected($$ update products set status = 'active', price = 85 where id = (select id from vp) $$) = 1, 'vendor can still edit a pending product');
select t.ok((select status = 'archived' and price = 85 from products where id = (select id from vp)), 'a pending product stays hidden whatever the vendor sets');
select t.ok(t.affected($$ update products set price = 150, stock = 33, description = 'Fresh batch' where id = (select p_long from ids) $$) = 1, 'vendor updates price, stock and description of an approved product directly');
select t.ok((select approval_status = 'approved' and status = 'active' from products where id = (select p_long from ids)), 'a routine edit does not need approval and keeps the product live');
select t.fails($$ update stores set commission_rate = 0 where id = (select s1 from ids) $$, 'Not allowed', 'vendor cannot change their own commission rate');
select t.fails($$ update stores set shipping_fee = 0 where id = (select s1 from ids) $$, 'Not allowed', 'vendor cannot change their own shipping fee');
select t.fails($$ update stores set owner_id = '00000000-0000-0000-0000-0000000000c2' where id = (select s1 from ids) $$, 'Not allowed', 'vendor cannot hand their store to someone else');
select t.ok(t.affected($$ update stores set is_open = false where id = (select s1 from ids) $$) = 1, 'vendor can close and reopen their own store');
update stores set is_open = true where id = (select s1 from ids);
reset role;

select t.as_anon();
select t.ok((select count(*) from products where id = (select id from vp)) = 0, 'visitors cannot see a pending product');
select t.fails($$ select place_guest_order(jsonb_build_array(jsonb_build_object('product_id', (select id from vp), 'quantity', 1)),
                   'a@example.com', 'Guest', '09171234567', '1 St', null, 'Lucban', 'Quezon', null, null, 'cod') $$, 'UNAVAILABLE', 'a pending product cannot be ordered');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000c2');
select t.ok((select count(*) from products where id = (select id from vp)) = 0, 'another vendor cannot see a pending product');
reset role;
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from products where id = (select id from vp)) = 0, 'customers cannot see a pending product');
reset role;

-- admin reviews: reject first, then approve
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok(t.affected($$ update products set approval_status = 'rejected', review_note = 'Please add a photo and weight' where id = (select id from vp) $$) = 1, 'admin can reject a product with a note');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.ok((select approval_status = 'rejected' and review_note like 'Please add%' from products where id = (select id from vp)), 'vendor sees the rejection note');
select t.ok(t.affected($$ update products set weight = '250g' where id = (select id from vp) $$) = 1, 'vendor fixes the product');
select t.ok((select approval_status = 'pending' and review_note is null and status = 'archived' from products where id = (select id from vp)), 'editing a rejected product resubmits it for review');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok(t.affected($$ update products set approval_status = 'approved', status = 'active', review_note = null where id = (select id from vp) $$) = 1, 'admin can approve a product');
reset role;
select t.as_anon();
select t.ok((select count(*) from products where id = (select id from vp)) = 1, 'an approved product is visible to visitors');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.ok((select count(*) from store_orders where store_id <> (select s1 from ids)) = 0, 'vendor still sees only their own store orders');
select t.ok(t.affected($$ delete from products where id = (select id from vp) $$) = 1, 'vendor can delete their own product that was never ordered');
reset role;

-- ================= STORE APPLICATIONS with proof of business (migration 0015) =================
-- Alice (customer) applies; she needs the business info AND proof files in her own folder.
create temp table app_ids (id uuid);
grant select, insert, delete on app_ids to anon, authenticated;
grant insert, delete on storage.objects to authenticated;

select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.fails($$ insert into vendor_applications (applicant_id, store_name, description, address, phone)
  values (auth.uid(), 'Alice Sweets', 'Homemade kakanin and sweets from Lucban', 'Brgy. Ayuti, Lucban', '09171234567') $$,
  'owner', 'an application without owner name is refused');
select t.fails($$ insert into vendor_applications (applicant_id, store_name, description, address, phone, owner_name, contact_email, permit_number, permit_expiry, registration_number)
  values (auth.uid(), 'Alice Sweets', 'Homemade kakanin and sweets from Lucban', 'Brgy. Ayuti, Lucban', '09171234567', 'Alice A', 'alice@test.dev', 'BP-2026-001', current_date + 200, 'DTI-123456') $$,
  'Upload your Business', 'an application without the permit file is refused');
select t.fails($$ insert into vendor_applications (applicant_id, store_name, description, address, phone, owner_name, contact_email, permit_number, permit_expiry, registration_number, permit_path, registration_path)
  values (auth.uid(), 'Alice Sweets', 'Homemade kakanin and sweets from Lucban', 'Brgy. Ayuti, Lucban', '09171234567', 'Alice A', 'alice@test.dev', 'BP-2026-001', current_date + 200, 'DTI-123456',
          '00000000-0000-0000-0000-00000000000b/permit.pdf', '00000000-0000-0000-0000-00000000000a/dti.pdf') $$,
  'Upload your Business', 'proof files must be in the applicant''s own folder');
select t.fails($$ insert into vendor_applications (applicant_id, store_name, description, address, phone, owner_name, contact_email, permit_number, permit_expiry, registration_number, permit_path, registration_path)
  values (auth.uid(), 'Alice Sweets', 'Homemade kakanin and sweets from Lucban', 'Brgy. Ayuti, Lucban', '09171234567', 'Alice A', 'alice@test.dev', 'BP-2025-001', current_date - 1, 'DTI-123456',
          '00000000-0000-0000-0000-00000000000a/permit.pdf', '00000000-0000-0000-0000-00000000000a/dti.pdf') $$,
  'not expired', 'an expired permit is refused');
select t.fails($$ insert into vendor_applications (applicant_id, store_name, description, address, phone, owner_name, contact_email, permit_number, permit_expiry, registration_number, permit_path, registration_path)
  values (auth.uid(), 'Alice Sweets', 'Homemade kakanin and sweets from Lucban', 'Brgy. Ayuti, Lucban', '09171234567', 'Alice A', 'not-an-email', 'BP-2026-001', current_date + 200, 'DTI-123456',
          '00000000-0000-0000-0000-00000000000a/permit.pdf', '00000000-0000-0000-0000-00000000000a/dti.pdf') $$,
  'valid business email', 'an invalid business email is refused');

-- storage: she can upload into her own folder only, and only she (and admins) can read it
select t.ok(t.affected($$ insert into storage.objects (bucket_id, name) values ('vendor-documents', '00000000-0000-0000-0000-00000000000a/permit.pdf') $$) = 1, 'applicant can upload into her own documents folder');
select t.fails($$ insert into storage.objects (bucket_id, name) values ('vendor-documents', '00000000-0000-0000-0000-00000000000b/permit.pdf') $$, 'row-level security', 'applicant cannot upload into someone else''s folder');
insert into storage.objects (bucket_id, name) values ('vendor-documents', '00000000-0000-0000-0000-00000000000a/dti.pdf');

-- a complete application; she tries to approve herself
with ins as (
  insert into vendor_applications (applicant_id, store_name, description, address, phone, owner_name, contact_email, permit_number, permit_expiry, registration_number, permit_path, registration_path, status, admin_note, reviewed_by)
  values (auth.uid(), 'Alice Sweets', 'Homemade kakanin and sweets from Lucban', 'Brgy. Ayuti, Lucban', '09171234567', 'Alice A', 'alice@test.dev', 'BP-2026-001', current_date + 200, 'DTI-123456',
          '00000000-0000-0000-0000-00000000000a/permit.pdf', '00000000-0000-0000-0000-00000000000a/dti.pdf', 'approved', 'trust me', auth.uid())
  returning id)
insert into app_ids select id from ins;
select t.ok((select status = 'pending' and admin_note is null and reviewed_by is null from vendor_applications where id = (select id from app_ids)), 'a complete application is accepted but always starts pending (self-approval ignored)');
select t.fails($$ insert into vendor_applications (applicant_id, store_name, description, address, phone, owner_name, contact_email, permit_number, permit_expiry, registration_number, permit_path, registration_path)
  values (auth.uid(), 'Alice Two', 'Another store description here ok', 'Brgy. Ayuti, Lucban', '09171234567', 'Alice A', 'alice@test.dev', 'BP-2026-002', current_date + 200, 'DTI-654321',
          '00000000-0000-0000-0000-00000000000a/permit.pdf', '00000000-0000-0000-0000-00000000000a/dti.pdf') $$, 'vendor_app_one_pending', 'only one pending application at a time');
select t.ok(t.affected($$ update vendor_applications set status = 'approved' where id = (select id from app_ids) $$) = 0, 'applicant cannot approve her own application');
select t.fails($$ select approve_vendor_application((select id from app_ids)) $$, 'Admins only', 'applicant cannot call approve');
select t.ok(t.affected($$ delete from storage.objects where name = '00000000-0000-0000-0000-00000000000a/permit.pdf' $$) = 0, 'a file used by an application cannot be removed by the applicant');
reset role;

-- privacy: Bob cannot read Alice's application or documents; admin can
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((select count(*) from vendor_applications) = 0, 'another customer cannot see the application');
select t.ok((select count(*) from storage.objects where bucket_id = 'vendor-documents') = 0, 'another customer cannot read the documents');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok((select count(*) from storage.objects where bucket_id = 'vendor-documents') = 2, 'admin can read the documents');
-- rejecting needs a reason
select t.fails($$ select reject_vendor_application((select id from app_ids), '') $$, 'short reason', 'rejecting needs a reason');
select reject_vendor_application((select id from app_ids), 'Permit photo is blurry, please upload a clear copy');
select t.ok((select status = 'rejected' from vendor_applications where id = (select id from app_ids)), 'admin rejects with a reason');
reset role;

-- re-apply after rejection, then approve
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select status = 'rejected' and admin_note like 'Permit photo%' from vendor_applications where id = (select id from app_ids)), 'applicant sees the rejection reason');
delete from app_ids;
with ins as (
  insert into vendor_applications (applicant_id, store_name, description, address, phone, owner_name, contact_email, permit_number, permit_expiry, registration_number, permit_path, registration_path)
  values (auth.uid(), 'Alice Sweets', 'Homemade kakanin and sweets from Lucban', 'Brgy. Ayuti, Lucban', '09171234567', 'Alice A', 'alice@test.dev', 'BP-2026-001', current_date + 200, 'DTI-123456',
          '00000000-0000-0000-0000-00000000000a/permit.pdf', '00000000-0000-0000-0000-00000000000a/dti.pdf')
  returning id)
insert into app_ids select id from ins;
select t.ok((select count(*) from vendor_applications where status = 'pending') = 1, 'a rejected applicant can apply again');
reset role;
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select t.ok((select approve_vendor_application((select id from app_ids), 'Documents verified')) is not null, 'admin approves with valid proof');
select t.ok((select role = 'vendor' from profiles where id = '00000000-0000-0000-0000-00000000000a'), 'approval makes the applicant a vendor');
select t.ok((select status = 'approved' and owner_id = '00000000-0000-0000-0000-00000000000a' and contact_email = 'alice@test.dev' from stores where name = 'Alice Sweets'), 'approval creates the store, owned by the applicant, with the business email');
select t.fails($$ select approve_vendor_application((select id from app_ids)) $$, 'already reviewed', 'an application cannot be approved twice');
reset role;
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.fails($$ insert into vendor_applications (applicant_id, store_name, description, address, phone, owner_name, contact_email, permit_number, permit_expiry, registration_number, permit_path, registration_path)
  values (auth.uid(), 'Alice Three', 'Yet another store description ok', 'Brgy. Ayuti, Lucban', '09171234567', 'Alice A', 'alice@test.dev', 'BP-2026-009', current_date + 200, 'DTI-999999',
          '00000000-0000-0000-0000-00000000000a/permit.pdf', '00000000-0000-0000-0000-00000000000a/dti.pdf') $$, 'Only customer accounts', 'a vendor cannot apply for another store');
reset role;

select 'ALL DATABASE TESTS PASSED' as result;
rollback;
