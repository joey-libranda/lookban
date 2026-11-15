-- =====================================================================
-- LOOKBAN 0003 — Business logic (all SECURITY DEFINER, all validate auth)
-- =====================================================================

create or replace function slugify(p_text text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'))
$$;

-- ---------------------------------------------------------------------
-- place_order: ONE transaction that
--   locks the products, validates availability + stock, prices every line
--   from the DATABASE, splits the order per store, snapshots prices,
--   deducts stock, and empties the cart. Client prices are never accepted.
-- Errors are raised as 'CODE:detail' so the app can show friendly messages.
-- ---------------------------------------------------------------------
create or replace function place_order(
  p_name text, p_phone text, p_line1 text, p_barangay text,
  p_city text, p_province text, p_postal text, p_notes text,
  p_payment_method payment_method
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid         uuid := auth.uid();
  v_cart        uuid;
  v_default_fee numeric(10,2);
  v_order_id    uuid;
  v_so_id       uuid;
  v_subtotal    numeric(10,2) := 0;
  v_shipping    numeric(10,2) := 0;
  v_email       text;
  r             record;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED:Please log in to place an order' using errcode = '28000';
  end if;
  if not exists (select 1 from profiles where id = v_uid and is_active) then
    raise exception 'ACCOUNT_DISABLED:This account is disabled' using errcode = '42501';
  end if;

  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_phone), '') = ''
     or coalesce(btrim(p_line1), '') = '' or coalesce(btrim(p_city), '') = ''
     or coalesce(btrim(p_province), '') = '' then
    raise exception 'INVALID_INPUT:Name, phone and delivery address are required';
  end if;

  select id into v_cart from carts where user_id = v_uid;
  if v_cart is null or not exists (select 1 from cart_items where cart_id = v_cart) then
    raise exception 'EMPTY_CART:Your cart is empty';
  end if;

  -- Lock product rows in a stable order (prevents deadlocks and overselling).
  perform 1 from products
   where id in (select product_id from cart_items where cart_id = v_cart)
   order by id for update;

  -- Validate every line against current database state.
  for r in
    select p.name, p.status, p.stock, ci.quantity, s.status as store_status
      from cart_items ci
      join products p on p.id = ci.product_id
      join stores   s on s.id = p.store_id
     where ci.cart_id = v_cart
  loop
    if r.status <> 'active' or r.store_status <> 'approved' then
      raise exception 'UNAVAILABLE:%', r.name;
    end if;
    if r.stock < r.quantity then
      raise exception 'INSUFFICIENT_STOCK:%', r.name;
    end if;
  end loop;

  select coalesce((value #>> '{}')::numeric, 50) into v_default_fee
    from settings where key = 'default_shipping_fee';
  v_default_fee := coalesce(v_default_fee, 50);

  -- Pass 1: totals (one shipping fee per store).
  for r in
    select s.id as store_id,
           sum(p.price * ci.quantity) as sub,
           coalesce(s.shipping_fee, v_default_fee) as fee
      from cart_items ci
      join products p on p.id = ci.product_id
      join stores   s on s.id = p.store_id
     where ci.cart_id = v_cart
     group by s.id, s.shipping_fee
  loop
    v_subtotal := v_subtotal + r.sub;
    v_shipping := v_shipping + r.fee;
  end loop;

  select email into v_email from profiles where id = v_uid;

  insert into orders (
    receipt_no, customer_id, customer_name, customer_phone, customer_email,
    delivery_line1, delivery_barangay, delivery_city, delivery_province, delivery_postal, notes,
    payment_method, payment_status, subtotal, shipping_total, total
  ) values (
    'LB-' || to_char(now() at time zone 'Asia/Manila', 'YYYYMMDD') || '-' || lpad(nextval('receipt_seq')::text, 5, '0'),
    v_uid, btrim(p_name), btrim(p_phone), v_email,
    btrim(p_line1), nullif(btrim(p_barangay), ''), btrim(p_city), btrim(p_province),
    nullif(btrim(p_postal), ''), nullif(btrim(p_notes), ''),
    p_payment_method,
    case p_payment_method when 'cod' then 'pending'::payment_status else 'simulated'::payment_status end,
    v_subtotal, v_shipping, v_subtotal + v_shipping
  ) returning id into v_order_id;

  -- Pass 2: one store_order per vendor + snapshot line items.
  for r in
    select s.id as store_id, s.name as store_name,
           sum(p.price * ci.quantity) as sub,
           coalesce(s.shipping_fee, v_default_fee) as fee
      from cart_items ci
      join products p on p.id = ci.product_id
      join stores   s on s.id = p.store_id
     where ci.cart_id = v_cart
     group by s.id, s.name, s.shipping_fee
  loop
    insert into store_orders (order_id, store_id, store_name, subtotal, shipping_fee, total)
    values (v_order_id, r.store_id, r.store_name, r.sub, r.fee, r.sub + r.fee)
    returning id into v_so_id;

    insert into order_items (order_id, store_order_id, product_id, product_name, variant_label,
                             price_at_purchase, quantity)
    select v_order_id, v_so_id, p.id, p.name, p.variant_label, p.price, ci.quantity
      from cart_items ci join products p on p.id = ci.product_id
     where ci.cart_id = v_cart and p.store_id = r.store_id;
  end loop;

  -- Deduct stock (CHECK stock >= 0 is the last line of defence).
  update products p
     set stock = p.stock - ci.quantity,
         sold_count = p.sold_count + ci.quantity
    from cart_items ci
   where ci.cart_id = v_cart and ci.product_id = p.id;

  delete from cart_items where cart_id = v_cart;
  return v_order_id;
end $$;

-- ---------------------------------------------------------------------
-- update_store_order_status: vendors (own store) and admins move a
-- store_order forward or cancel it. Cancelling restocks. The parent order
-- status / payment status are derived here.
-- ---------------------------------------------------------------------
create or replace function fulfillment_rank(s fulfillment_status) returns int
language sql immutable as $$
  select case s when 'pending' then 1 when 'confirmed' then 2 when 'preparing' then 3
                when 'out_for_delivery' then 4 when 'delivered' then 5 else 0 end
$$;

create or replace function update_store_order_status(p_store_order_id uuid, p_status fulfillment_status)
returns void
language plpgsql security definer set search_path = public as $$
declare
  so          store_orders%rowtype;
  v_method    payment_method;
  v_active    int;
  v_delivered int;
  v_total     int;
  v_cancelled int;
  v_min_rank  int;
begin
  select * into so from store_orders where id = p_store_order_id for update;
  if not found then raise exception 'NOT_FOUND:Order not found'; end if;

  if not (is_admin() or owns_store(so.store_id)) then
    raise exception 'FORBIDDEN:You cannot update this order' using errcode = '42501';
  end if;
  if so.fulfillment_status in ('delivered', 'cancelled') then
    raise exception 'INVALID_TRANSITION:This order is already %', so.fulfillment_status;
  end if;
  if p_status <> 'cancelled'
     and fulfillment_rank(p_status) <= fulfillment_rank(so.fulfillment_status) then
    raise exception 'INVALID_TRANSITION:Status can only move forward';
  end if;

  if p_status = 'cancelled' then
    update products p
       set stock = p.stock + oi.quantity,
           sold_count = greatest(p.sold_count - oi.quantity, 0)
      from order_items oi
     where oi.store_order_id = so.id and oi.product_id = p.id;
  end if;

  update store_orders set fulfillment_status = p_status where id = so.id;

  -- Derive parent order status.
  select count(*), count(*) filter (where fulfillment_status = 'cancelled'),
         count(*) filter (where fulfillment_status = 'delivered'),
         min(fulfillment_rank(fulfillment_status)) filter (where fulfillment_status <> 'cancelled')
    into v_total, v_cancelled, v_delivered, v_min_rank
    from store_orders where order_id = so.order_id;
  v_active := v_total - v_cancelled;
  select payment_method into v_method from orders where id = so.order_id;

  update orders o set
    status = case
      when v_active = 0 then 'cancelled'::fulfillment_status
      when v_min_rank = 1 then 'pending' when v_min_rank = 2 then 'confirmed'
      when v_min_rank = 3 then 'preparing' when v_min_rank = 4 then 'out_for_delivery'
      else 'delivered' end,
    -- COD cash is collected on delivery. Simulated payments never become 'paid'.
    payment_status = case
      when v_active = 0 then 'cancelled'
      when v_method = 'cod' and v_delivered = v_active then 'paid'
      else o.payment_status end
  where o.id = so.order_id;
end $$;

-- ---------------------------------------------------------------------
-- Vendor applications (admin only)
-- ---------------------------------------------------------------------
create or replace function approve_vendor_application(p_app_id uuid, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a       vendor_applications%rowtype;
  v_slug  text;
  v_store uuid;
begin
  if not is_admin() then raise exception 'FORBIDDEN:Admins only' using errcode = '42501'; end if;
  select * into a from vendor_applications where id = p_app_id for update;
  if not found or a.status <> 'pending' then
    raise exception 'INVALID:Application not found or already reviewed';
  end if;
  if exists (select 1 from stores where owner_id = a.applicant_id) then
    raise exception 'INVALID:Applicant already owns a store';
  end if;

  v_slug := slugify(a.store_name);
  if v_slug = '' or exists (select 1 from stores where slug = v_slug) then
    v_slug := coalesce(nullif(v_slug, ''), 'store') || '-' || substr(gen_random_uuid()::text, 1, 6);
  end if;

  insert into stores (owner_id, slug, name, description, address, contact_phone, status)
  values (a.applicant_id, v_slug, a.store_name, a.description, a.address, a.phone, 'approved')
  returning id into v_store;

  update profiles set role = 'vendor' where id = a.applicant_id and role = 'customer';
  update vendor_applications
     set status = 'approved', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = a.id;
  return v_store;
end $$;

create or replace function reject_vendor_application(p_app_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN:Admins only' using errcode = '42501'; end if;
  update vendor_applications
     set status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_app_id and status = 'pending';
  if not found then raise exception 'INVALID:Application not found or already reviewed'; end if;
end $$;

-- ---------- Function privileges ----------
revoke all on function place_order(text,text,text,text,text,text,text,text,payment_method) from public, anon;
revoke all on function update_store_order_status(uuid, fulfillment_status)                 from public, anon;
revoke all on function approve_vendor_application(uuid, text)                              from public, anon;
revoke all on function reject_vendor_application(uuid, text)                               from public, anon;
revoke all on function handle_new_user()                                                   from public, anon, authenticated;
grant execute on function place_order(text,text,text,text,text,text,text,text,payment_method) to authenticated;
grant execute on function update_store_order_status(uuid, fulfillment_status)                 to authenticated;
grant execute on function approve_vendor_application(uuid, text)                              to authenticated;
grant execute on function reject_vendor_application(uuid, text)                               to authenticated;
