-- =====================================================================
-- 0010: customer cancel / "received" / rating, and correct totals after a cancel.
--
--  * The status logic moves into one internal function (_set_store_order_status)
--    so admins and customers share exactly the same rules (restock, derived
--    order status, payment status, totals).
--  * orders.subtotal / shipping_total / total now mean "what is still payable":
--    the sum of the store_orders that are NOT cancelled. The cancelled store_orders
--    keep their own figures, so the refund amount can always be read from them.
--  * Customers (signed in, or guests holding the secret tracking link) can cancel a
--    store_order until it is "out for delivery", and confirm it was received once it is
--    out for delivery. Only signed-in customers can rate (reviews need an account).
-- Run AFTER 0001-0009. Safe to run twice.
-- =====================================================================

-- ---------- rating columns on store_orders ----------
alter table store_orders add column if not exists received_at    timestamptz;
alter table store_orders add column if not exists rating         int check (rating between 1 and 5);
alter table store_orders add column if not exists rating_comment text check (char_length(rating_comment) <= 1000);
alter table store_orders add column if not exists rated_at       timestamptz;

-- ---------- internal core: NO permission checks here, callers do them ----------
create or replace function _set_store_order_status(p_store_order_id uuid, p_status fulfillment_status)
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

  update store_orders
     set fulfillment_status = p_status,
         received_at = case when p_status = 'delivered' then coalesce(received_at, now()) else received_at end
   where id = so.id;

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
      else o.payment_status end,
    -- Totals = what is still payable (cancelled stores are left out).
    subtotal       = coalesce((select sum(s.subtotal)     from store_orders s where s.order_id = o.id and s.fulfillment_status <> 'cancelled'), 0),
    shipping_total = coalesce((select sum(s.shipping_fee) from store_orders s where s.order_id = o.id and s.fulfillment_status <> 'cancelled'), 0),
    total          = coalesce((select sum(s.total)        from store_orders s where s.order_id = o.id and s.fulfillment_status <> 'cancelled'), 0)
  where o.id = so.order_id;
end $$;

-- ---------- admin / vendor: same signature as before, now a thin wrapper ----------
create or replace function update_store_order_status(p_store_order_id uuid, p_status fulfillment_status)
returns void
language plpgsql security definer set search_path = public as $$
declare so store_orders%rowtype;
begin
  select * into so from store_orders where id = p_store_order_id;
  if not found then raise exception 'NOT_FOUND:Order not found'; end if;
  if not (is_admin() or owns_store(so.store_id)) then
    raise exception 'FORBIDDEN:You cannot update this order' using errcode = '42501';
  end if;
  perform _set_store_order_status(p_store_order_id, p_status);
end $$;

-- ---------- customer rules (shared by the signed-in and the guest versions) ----------
create or replace function _customer_cancel(p_store_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s fulfillment_status;
begin
  select fulfillment_status into s from store_orders where id = p_store_order_id for update;
  if s is null then raise exception 'NOT_FOUND:Order not found'; end if;
  if s not in ('pending', 'confirmed', 'preparing') then
    raise exception 'INVALID_TRANSITION:This order can no longer be cancelled. It is already % - please contact the store.',
      replace(s::text, '_', ' ');
  end if;
  perform _set_store_order_status(p_store_order_id, 'cancelled');
end $$;

create or replace function _customer_receive(p_store_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s fulfillment_status;
begin
  select fulfillment_status into s from store_orders where id = p_store_order_id for update;
  if s is null then raise exception 'NOT_FOUND:Order not found'; end if;
  if s <> 'out_for_delivery' then
    raise exception 'INVALID_TRANSITION:You can confirm receipt only while the order is out for delivery.';
  end if;
  perform _set_store_order_status(p_store_order_id, 'delivered');
end $$;

-- ---------- signed-in customer ----------
create or replace function cancel_my_store_order(p_store_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
       select 1 from store_orders so join orders o on o.id = so.order_id
        where so.id = p_store_order_id and o.customer_id = auth.uid()) then
    raise exception 'NOT_FOUND:Order not found';
  end if;
  perform _customer_cancel(p_store_order_id);
end $$;

create or replace function confirm_my_store_order_received(p_store_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
       select 1 from store_orders so join orders o on o.id = so.order_id
        where so.id = p_store_order_id and o.customer_id = auth.uid()) then
    raise exception 'NOT_FOUND:Order not found';
  end if;
  perform _customer_receive(p_store_order_id);
end $$;

-- ---------- guest holding the secret tracking link ----------
create or replace function cancel_store_order_by_token(p_order_id uuid, p_token uuid, p_store_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from store_orders so join orders o on o.id = so.order_id
                  where so.id = p_store_order_id and o.id = p_order_id and o.access_token = p_token) then
    raise exception 'NOT_FOUND:Order not found';
  end if;
  perform _customer_cancel(p_store_order_id);
end $$;

create or replace function confirm_store_order_received_by_token(p_order_id uuid, p_token uuid, p_store_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from store_orders so join orders o on o.id = so.order_id
                  where so.id = p_store_order_id and o.id = p_order_id and o.access_token = p_token) then
    raise exception 'NOT_FOUND:Order not found';
  end if;
  perform _customer_receive(p_store_order_id);
end $$;

-- ---------- rating (signed-in customers, delivered store_orders only, once) ----------
-- Saves the rating on the store_order and as a review on each product in it,
-- so product ratings on the shop are built from real, delivered purchases.
create or replace function rate_my_store_order(p_store_order_id uuid, p_rating int, p_comment text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare so store_orders%rowtype; v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'INVALID:Choose a rating from 1 to 5 stars.';
  end if;
  if v_comment is not null and char_length(v_comment) > 1000 then
    raise exception 'INVALID:Feedback is too long (1000 characters max).';
  end if;
  select s.* into so from store_orders s join orders o on o.id = s.order_id
   where s.id = p_store_order_id and o.customer_id = auth.uid() and auth.uid() is not null
   for update of s;
  if not found then raise exception 'NOT_FOUND:Order not found'; end if;
  if so.fulfillment_status <> 'delivered' then
    raise exception 'INVALID_TRANSITION:You can rate an order after it is delivered.';
  end if;
  if so.rated_at is not null then raise exception 'INVALID_TRANSITION:You already rated this order.'; end if;

  update store_orders set rating = p_rating, rating_comment = v_comment, rated_at = now() where id = so.id;

  insert into reviews (product_id, user_id, rating, comment)
  select distinct oi.product_id, auth.uid(), p_rating, v_comment
    from order_items oi where oi.store_order_id = so.id and oi.product_id is not null
  on conflict (product_id, user_id)
  do update set rating = excluded.rating, comment = excluded.comment;
end $$;

-- ---------- privileges ----------
revoke all on function _set_store_order_status(uuid, fulfillment_status) from public, anon, authenticated;
revoke all on function _customer_cancel(uuid)  from public, anon, authenticated;
revoke all on function _customer_receive(uuid) from public, anon, authenticated;
revoke all on function update_store_order_status(uuid, fulfillment_status) from public, anon;
revoke all on function cancel_my_store_order(uuid)                  from public, anon;
revoke all on function confirm_my_store_order_received(uuid)        from public, anon;
revoke all on function rate_my_store_order(uuid, int, text)         from public, anon;
revoke all on function cancel_store_order_by_token(uuid, uuid, uuid)           from public;
revoke all on function confirm_store_order_received_by_token(uuid, uuid, uuid) from public;
grant execute on function update_store_order_status(uuid, fulfillment_status) to authenticated;
grant execute on function cancel_my_store_order(uuid)                  to authenticated;
grant execute on function confirm_my_store_order_received(uuid)        to authenticated;
grant execute on function rate_my_store_order(uuid, int, text)         to authenticated;
grant execute on function cancel_store_order_by_token(uuid, uuid, uuid)           to anon, authenticated;
grant execute on function confirm_store_order_received_by_token(uuid, uuid, uuid) to anon, authenticated;

-- ---------- backfill: orders that already had a cancelled store_order ----------
update orders o set
  subtotal       = coalesce((select sum(s.subtotal)     from store_orders s where s.order_id = o.id and s.fulfillment_status <> 'cancelled'), 0),
  shipping_total = coalesce((select sum(s.shipping_fee) from store_orders s where s.order_id = o.id and s.fulfillment_status <> 'cancelled'), 0),
  total          = coalesce((select sum(s.total)        from store_orders s where s.order_id = o.id and s.fulfillment_status <> 'cancelled'), 0)
where exists (select 1 from store_orders s where s.order_id = o.id and s.fulfillment_status = 'cancelled');
