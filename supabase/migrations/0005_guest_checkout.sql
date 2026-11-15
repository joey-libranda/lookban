-- =====================================================================
-- LOOKBAN 0005 - Guest checkout, order tracking links, admins don't shop
--
--  * Visitors can check out WITHOUT an account (place_guest_order). Their order has no customer_id.
--  * Every order has a random access_token. A guest (or anyone with the tracking link / receipt no. + phone)
--    can read ONLY that one order through get_order_by_token() / track_order(). Anonymous users still
--    have no SELECT access to any table that holds orders.
--  * place_order (logged-in) and place_guest_order share ONE core function, so pricing, stock locking,
--    per-store split and price snapshots are identical and cannot drift apart.
--  * Admins cannot place orders (they manage the marketplace; they don't shop on it).
-- Safe to run once after 0001-0004.
-- =====================================================================

alter table orders add column if not exists access_token uuid not null default gen_random_uuid();
create unique index if not exists orders_access_token_key on orders(access_token);

-- ---------------------------------------------------------------------
-- Core: builds the order from the temp table _order_lines(product_id, quantity).
-- Never granted to clients; only the two public wrappers below call it.
-- ---------------------------------------------------------------------
create or replace function _create_order_from_lines(
  p_uid uuid, p_email text,
  p_name text, p_phone text, p_line1 text, p_barangay text,
  p_city text, p_province text, p_postal text, p_notes text,
  p_payment_method payment_method
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_default_fee numeric(10,2);
  v_order_id    uuid;
  v_so_id       uuid;
  v_subtotal    numeric(10,2) := 0;
  v_shipping    numeric(10,2) := 0;
  r             record;
begin
  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_phone), '') = ''
     or coalesce(btrim(p_line1), '') = '' or coalesce(btrim(p_city), '') = ''
     or coalesce(btrim(p_province), '') = '' then
    raise exception 'INVALID_INPUT:Name, phone and delivery address are required';
  end if;
  if not exists (select 1 from _order_lines) then
    raise exception 'EMPTY_CART:Your cart is empty';
  end if;

  -- Lock product rows in a stable order (prevents deadlocks and overselling).
  perform 1 from products where id in (select product_id from _order_lines) order by id for update;

  -- Every requested product must exist, be active, in an approved + open store, and in stock.
  for r in
    select coalesce(p.name, 'an item') as name, p.id as pid, p.status, p.stock, l.quantity,
           s.status as store_status, s.is_open
      from _order_lines l
      left join products p on p.id = l.product_id
      left join stores   s on s.id = p.store_id
  loop
    if r.pid is null or r.status <> 'active' or r.store_status <> 'approved' then
      raise exception 'UNAVAILABLE:%', r.name;
    end if;
    if not r.is_open then
      raise exception 'UNAVAILABLE:% (store is closed)', r.name;
    end if;
    if r.stock < r.quantity then
      raise exception 'INSUFFICIENT_STOCK:%', r.name;
    end if;
  end loop;

  select coalesce((value #>> '{}')::numeric, 50) into v_default_fee from settings where key = 'default_shipping_fee';
  v_default_fee := coalesce(v_default_fee, 50);

  for r in
    select sum(p.price * l.quantity) as sub, coalesce(s.shipping_fee, v_default_fee) as fee
      from _order_lines l join products p on p.id = l.product_id join stores s on s.id = p.store_id
     group by s.id, s.shipping_fee
  loop
    v_subtotal := v_subtotal + r.sub;
    v_shipping := v_shipping + r.fee;
  end loop;

  insert into orders (
    receipt_no, customer_id, customer_name, customer_phone, customer_email,
    delivery_line1, delivery_barangay, delivery_city, delivery_province, delivery_postal, notes,
    payment_method, payment_status, subtotal, shipping_total, total
  ) values (
    'LB-' || to_char(now() at time zone 'Asia/Manila', 'YYYYMMDD') || '-' || lpad(nextval('receipt_seq')::text, 5, '0'),
    p_uid, btrim(p_name), btrim(p_phone), nullif(btrim(p_email), ''),
    btrim(p_line1), nullif(btrim(p_barangay), ''), btrim(p_city), btrim(p_province),
    nullif(btrim(p_postal), ''), nullif(btrim(p_notes), ''),
    p_payment_method,
    case p_payment_method when 'cod' then 'pending'::payment_status else 'simulated'::payment_status end,
    v_subtotal, v_shipping, v_subtotal + v_shipping
  ) returning id into v_order_id;

  for r in
    select s.id as store_id, s.name as store_name, sum(p.price * l.quantity) as sub,
           coalesce(s.shipping_fee, v_default_fee) as fee
      from _order_lines l join products p on p.id = l.product_id join stores s on s.id = p.store_id
     group by s.id, s.name, s.shipping_fee
  loop
    insert into store_orders (order_id, store_id, store_name, subtotal, shipping_fee, total)
    values (v_order_id, r.store_id, r.store_name, r.sub, r.fee, r.sub + r.fee)
    returning id into v_so_id;

    insert into order_items (order_id, store_order_id, product_id, product_name, variant_label, price_at_purchase, quantity)
    select v_order_id, v_so_id, p.id, p.name, p.variant_label, p.price, l.quantity
      from _order_lines l join products p on p.id = l.product_id
     where p.store_id = r.store_id;
  end loop;

  update products p set stock = p.stock - l.quantity, sold_count = p.sold_count + l.quantity
    from _order_lines l where l.product_id = p.id;

  return v_order_id;
end $$;

-- ---------------------------------------------------------------------
-- Logged-in checkout: same signature as before, now a thin wrapper.
-- ---------------------------------------------------------------------
create or replace function place_order(
  p_name text, p_phone text, p_line1 text, p_barangay text,
  p_city text, p_province text, p_postal text, p_notes text,
  p_payment_method payment_method
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_cart  uuid;
  v_email text;
  v_order uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED:Please log in to place an order' using errcode = '28000';
  end if;
  if not exists (select 1 from profiles where id = v_uid and is_active) then
    raise exception 'ACCOUNT_DISABLED:This account is disabled' using errcode = '42501';
  end if;
  if is_admin() then
    raise exception 'ADMIN_NOT_ALLOWED:Admin accounts manage the marketplace and cannot place orders' using errcode = '42501';
  end if;

  select id into v_cart from carts where user_id = v_uid;
  if v_cart is null or not exists (select 1 from cart_items where cart_id = v_cart) then
    raise exception 'EMPTY_CART:Your cart is empty';
  end if;

  drop table if exists _order_lines;
  create temp table _order_lines (product_id uuid primary key, quantity int not null) on commit drop;
  insert into _order_lines select product_id, quantity from cart_items where cart_id = v_cart;

  select email into v_email from profiles where id = v_uid;
  v_order := _create_order_from_lines(v_uid, v_email, p_name, p_phone, p_line1, p_barangay,
                                      p_city, p_province, p_postal, p_notes, p_payment_method);
  delete from cart_items where cart_id = v_cart;
  return v_order;
end $$;

-- ---------------------------------------------------------------------
-- Guest checkout. p_items = [{"product_id": "<uuid>", "quantity": 2}, ...]
-- Only product ids and quantities are accepted - every price comes from the database.
-- Returns {"id": order uuid, "token": access token uuid}.
-- ---------------------------------------------------------------------
create or replace function place_guest_order(
  p_items jsonb, p_email text,
  p_name text, p_phone text, p_line1 text, p_barangay text,
  p_city text, p_province text, p_postal text, p_notes text,
  p_payment_method payment_method
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid;
  v_token uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'EMPTY_CART:Your cart is empty';
  end if;

  drop table if exists _order_lines;
  create temp table _order_lines (product_id uuid primary key, quantity int not null) on commit drop;
  begin
    insert into _order_lines (product_id, quantity)
    select (e->>'product_id')::uuid, least(sum((e->>'quantity')::int), 99)
      from jsonb_array_elements(p_items) e
     group by 1;
    if exists (select 1 from _order_lines where quantity < 1) then raise exception 'bad'; end if;
  exception when others then
    raise exception 'INVALID_INPUT:Your cart contains an invalid item';
  end;

  v_order := _create_order_from_lines(null, p_email, p_name, p_phone, p_line1, p_barangay,
                                      p_city, p_province, p_postal, p_notes, p_payment_method);
  select access_token into v_token from orders where id = v_order;
  return jsonb_build_object('id', v_order, 'token', v_token);
end $$;

-- ---------------------------------------------------------------------
-- Read ONE order with its access token (same JSON shape PostgREST gives for an embedded select).
-- ---------------------------------------------------------------------
create or replace function get_order_by_token(p_id uuid, p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select (to_jsonb(o) - 'access_token' - 'customer_id' - 'updated_at')
         || jsonb_build_object('store_orders', coalesce((
              select jsonb_agg(
                       (to_jsonb(so) - 'updated_at') || jsonb_build_object(
                         'store', (select jsonb_build_object('slug', s.slug, 'address', s.address, 'contact_phone', s.contact_phone)
                                     from stores s where s.id = so.store_id),
                         'order_items', coalesce((select jsonb_agg(to_jsonb(oi)) from order_items oi where oi.store_order_id = so.id), '[]'::jsonb)))
                from store_orders so where so.order_id = o.id), '[]'::jsonb))
    from orders o
   where o.id = p_id and o.access_token = p_token
$$;

-- "Where is my order?" - receipt number + the phone number used at checkout.
create or replace function track_order(p_receipt text, p_phone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', o.id, 'token', o.access_token)
    from orders o
   where upper(o.receipt_no) = upper(btrim(p_receipt))
     and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 10
     and right(regexp_replace(o.customer_phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
   limit 1
$$;

-- ---------- Privileges ----------
revoke all on function _create_order_from_lines(uuid,text,text,text,text,text,text,text,text,text,payment_method) from public, anon, authenticated;
revoke all on function place_guest_order(jsonb,text,text,text,text,text,text,text,text,text,payment_method) from public;
revoke all on function get_order_by_token(uuid, uuid) from public;
revoke all on function track_order(text, text) from public;
grant execute on function place_guest_order(jsonb,text,text,text,text,text,text,text,text,text,payment_method) to anon, authenticated;
grant execute on function get_order_by_token(uuid, uuid) to anon, authenticated;
grant execute on function track_order(text, text) to anon, authenticated;
-- place_order keeps its existing grants (authenticated only).
