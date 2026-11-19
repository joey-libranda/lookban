-- =====================================================================
-- 0018: returns & refunds (after delivery).
--
-- A signed-in customer can ask for a return/refund (or a replacement) on ONE store's part of a delivered order,
-- within a window (setting `return_window_days`, default 3). The STORE reviews it; if it rejects, the customer can
-- escalate once and a LOOKBAN admin makes the final decision. Approved requests are completed by recording the
-- refund reference. Nothing here moves real money or sends email: the refund is a record.
--
--  * Everything is written through the SECURITY DEFINER functions below; nobody can write the tables directly.
--  * Refund amounts always come from the prices saved on the order (price_at_purchase), never from the browser.
--  * Evidence photos live in the private bucket `return-evidence` (folder = customer uid).
-- Run AFTER 0001-0017. Safe to run twice.
-- =====================================================================

insert into settings (key, value) values ('return_window_days', '3'::jsonb) on conflict (key) do nothing;

alter table store_orders add column if not exists refunded_amount numeric(10,2) not null default 0 check (refunded_amount >= 0);

create table if not exists return_requests (
  id              uuid primary key default gen_random_uuid(),
  store_order_id  uuid not null references store_orders(id) on delete cascade,
  store_id        uuid references stores(id) on delete set null,
  customer_id     uuid references profiles(id) on delete set null,
  status          text not null default 'requested'
                  check (status in ('requested','approved','rejected','escalated','completed','cancelled')),
  reason          text not null check (reason in ('damaged','wrong_item','missing_item','not_as_described','other')),
  details         text not null check (char_length(details) between 5 and 1000),
  desired         text not null check (desired in ('refund','replacement')),
  resolution      text check (resolution in ('refund','replacement')),
  items_refund    numeric(10,2) not null default 0 check (items_refund >= 0),
  shipping_refund numeric(10,2) not null default 0 check (shipping_refund >= 0),
  refund_amount   numeric(10,2) generated always as (items_refund + shipping_refund) stored,
  store_note      text,
  admin_note      text,
  refund_reference text,
  escalated_at    timestamptz,
  decided_by      uuid references profiles(id) on delete set null,
  decided_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists return_requests_store_idx    on return_requests (store_id, created_at desc);
create index if not exists return_requests_customer_idx on return_requests (customer_id, created_at desc);
create index if not exists return_requests_status_idx   on return_requests (status);
-- one live request per store order (rejected / cancelled ones do not count)
create unique index if not exists return_requests_one_live on return_requests (store_order_id)
  where status in ('requested','approved','escalated','completed');

create table if not exists return_request_items (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references return_requests(id) on delete cascade,
  order_item_id uuid references order_items(id) on delete set null,
  product_name  text not null,
  variant_label text not null default '',
  quantity      int not null check (quantity > 0),
  unit_price    numeric(10,2) not null check (unit_price >= 0),
  line_refund   numeric(10,2) generated always as (unit_price * quantity) stored,
  unique (request_id, order_item_id)
);
create table if not exists return_request_photos (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references return_requests(id) on delete cascade,
  path       text not null,
  created_at timestamptz not null default now()
);
create table if not exists return_request_events (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references return_requests(id) on delete cascade,
  actor_id   uuid references profiles(id) on delete set null,
  actor_role text not null check (actor_role in ('customer','store','admin')),
  event      text not null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists return_request_events_idx on return_request_events (request_id, created_at);

alter table return_requests       enable row level security;
alter table return_request_items  enable row level security;
alter table return_request_photos enable row level security;
alter table return_request_events enable row level security;

drop policy if exists rr_read on return_requests;
create policy rr_read on return_requests for select to authenticated
  using (customer_id = auth.uid() or owns_store(store_id) or is_admin());
-- children are readable exactly when their request is (RLS on return_requests applies inside the sub-select)
drop policy if exists rri_read on return_request_items;
create policy rri_read on return_request_items for select to authenticated using (request_id in (select id from return_requests));
drop policy if exists rrp_read on return_request_photos;
create policy rrp_read on return_request_photos for select to authenticated using (request_id in (select id from return_requests));
drop policy if exists rre_read on return_request_events;
create policy rre_read on return_request_events for select to authenticated using (request_id in (select id from return_requests));

revoke insert, update, delete on return_requests, return_request_items, return_request_photos, return_request_events from anon, authenticated;

-- ---------- private evidence bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('return-evidence', 'return-evidence', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "return evidence insert" on storage.objects;
drop policy if exists "return evidence select" on storage.objects;
drop policy if exists "return evidence delete" on storage.objects;
create policy "return evidence insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'return-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
-- the customer sees their own folder; the store and admins see photos that belong to a request they can read
create policy "return evidence select" on storage.objects for select to authenticated
  using (bucket_id = 'return-evidence'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or exists (select 1 from return_request_photos p where p.path = name)));
create policy "return evidence delete" on storage.objects for delete to authenticated
  using (bucket_id = 'return-evidence' and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from return_request_photos p where p.path = name));

-- ---------- helpers ----------
create or replace function _return_window_days() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from settings where key = 'return_window_days'), 3);
$$;
revoke all on function _return_window_days() from public, anon;
grant execute on function _return_window_days() to authenticated;

create or replace function _return_event(p_request uuid, p_event text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_role text; v_store uuid;
begin
  select store_id into v_store from return_requests where id = p_request;
  v_role := case when is_admin() then 'admin' when owns_store(v_store) then 'store' else 'customer' end;
  insert into return_request_events (request_id, actor_id, actor_role, event, note)
  values (p_request, auth.uid(), v_role, p_event, nullif(btrim(coalesce(p_note, '')), ''));
end $$;
revoke all on function _return_event(uuid, text, text) from public, anon, authenticated;

-- ---------- customer: ask for a return / refund ----------
create or replace function create_return_request(
  p_store_order_id uuid, p_reason text, p_details text, p_desired text, p_items jsonb, p_photos text[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  so    store_orders%rowtype;
  o     orders%rowtype;
  v_delivered timestamptz;
  v_id  uuid;
  it    jsonb;
  oi    order_items%rowtype;
  v_qty int;
  v_total numeric(10,2) := 0;
  ph    text;
begin
  if v_uid is null then raise exception 'AUTH:Please log in first'; end if;
  select * into so from store_orders where id = p_store_order_id;
  if not found then raise exception 'NOT_FOUND:Order not found'; end if;
  select * into o from orders where id = so.order_id;
  if o.customer_id is distinct from v_uid then raise exception 'FORBIDDEN:That is not your order' using errcode = '42501'; end if;
  if so.fulfillment_status <> 'delivered' then raise exception 'INVALID:You can only ask for a return after the order is delivered.'; end if;

  v_delivered := coalesce((select earned_at from store_order_commissions where store_order_id = so.id), so.updated_at);
  if now() > v_delivered + make_interval(days => _return_window_days()) then
    raise exception 'INVALID:The % day return window for this order has passed.', _return_window_days();
  end if;
  if p_reason not in ('damaged','wrong_item','missing_item','not_as_described','other') then raise exception 'INVALID:Choose a reason.'; end if;
  if p_desired not in ('refund','replacement') then raise exception 'INVALID:Choose refund or replacement.'; end if;
  if char_length(btrim(coalesce(p_details, ''))) < 5 then raise exception 'INVALID:Please describe the problem (at least 5 characters).'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then raise exception 'INVALID:Choose at least one item.'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 3 then raise exception 'INVALID:You can attach up to 3 photos.'; end if;
  foreach ph in array coalesce(p_photos, '{}') loop
    if left(ph, length(v_uid::text) + 1) <> v_uid::text || '/' then raise exception 'INVALID:Invalid photo. Please upload it again.'; end if;
  end loop;
  if p_reason in ('damaged','wrong_item','not_as_described') and coalesce(array_length(p_photos, 1), 0) = 0 then
    raise exception 'INVALID:Please attach at least one photo of the problem.';
  end if;
  if exists (select 1 from return_requests where store_order_id = so.id and status = 'rejected') then
    raise exception 'INVALID:Your earlier request was declined. Open it and escalate it to LOOKBAN instead of sending a new one.';
  end if;

  insert into return_requests (store_order_id, store_id, customer_id, reason, details, desired)
  values (so.id, so.store_id, v_uid, p_reason, btrim(p_details), p_desired)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into oi from order_items where id = (it ->> 'order_item_id')::uuid and store_order_id = so.id;
    if not found then raise exception 'INVALID:One of the items is not part of this order.'; end if;
    v_qty := (it ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > oi.quantity then raise exception 'INVALID:Quantity for % is not valid.', oi.product_name; end if;
    insert into return_request_items (request_id, order_item_id, product_name, variant_label, quantity, unit_price)
    values (v_id, oi.id, oi.product_name, oi.variant_label, v_qty, oi.price_at_purchase);
    v_total := v_total + v_qty * oi.price_at_purchase;
  end loop;
  update return_requests set items_refund = v_total where id = v_id;
  foreach ph in array coalesce(p_photos, '{}') loop
    insert into return_request_photos (request_id, path) values (v_id, ph);
  end loop;
  perform _return_event(v_id, 'requested', p_details);
  return v_id;
end $$;

-- ---------- store (or admin): approve or reject ----------
create or replace function respond_return_request(
  p_id uuid, p_decision text, p_note text default null, p_resolution text default null, p_include_shipping boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r  return_requests%rowtype;
  so store_orders%rowtype;
  v_admin boolean := is_admin();
  v_res text;
begin
  select * into r from return_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND:Request not found'; end if;
  if not (v_admin or owns_store(r.store_id)) then raise exception 'FORBIDDEN:Not allowed' using errcode = '42501'; end if;
  if r.status = 'escalated' and not v_admin then raise exception 'FORBIDDEN:LOOKBAN is reviewing this request.' using errcode = '42501'; end if;
  if r.status not in ('requested','escalated') then raise exception 'INVALID:This request has already been decided.'; end if;
  if p_decision not in ('approve','reject') then raise exception 'INVALID:Choose approve or reject.'; end if;
  select * into so from store_orders where id = r.store_order_id;

  if p_decision = 'reject' then
    if char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'INVALID:Give the customer a short reason (at least 5 characters).'; end if;
    update return_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now(),
           store_note = case when v_admin then store_note else btrim(p_note) end,
           admin_note = case when v_admin then btrim(p_note) else admin_note end
     where id = r.id;
    perform _return_event(r.id, 'rejected', p_note);
  else
    v_res := coalesce(p_resolution, r.desired);
    if v_res not in ('refund','replacement') then raise exception 'INVALID:Choose refund or replacement.'; end if;
    update return_requests set status = 'approved', resolution = v_res, decided_by = auth.uid(), decided_at = now(), updated_at = now(),
           items_refund    = case when v_res = 'refund' then items_refund else 0 end,
           shipping_refund = case when v_res = 'refund' and p_include_shipping then so.shipping_fee else 0 end,
           store_note = case when v_admin then store_note else nullif(btrim(coalesce(p_note, '')), '') end,
           admin_note = case when v_admin then nullif(btrim(coalesce(p_note, '')), '') else admin_note end
     where id = r.id;
    perform _return_event(r.id, 'approved', p_note);
  end if;
end $$;

-- ---------- customer: escalate a store's rejection, or withdraw ----------
create or replace function escalate_return_request(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r return_requests%rowtype;
begin
  select * into r from return_requests where id = p_id for update;
  if not found or r.customer_id is distinct from auth.uid() then raise exception 'FORBIDDEN:Not allowed' using errcode = '42501'; end if;
  if r.status <> 'rejected' or r.escalated_at is not null then raise exception 'INVALID:Only a request declined by the store can be escalated, once.'; end if;
  update return_requests set status = 'escalated', escalated_at = now(), updated_at = now() where id = r.id;
  perform _return_event(r.id, 'escalated', p_note);
end $$;

create or replace function cancel_return_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r return_requests%rowtype;
begin
  select * into r from return_requests where id = p_id for update;
  if not found or r.customer_id is distinct from auth.uid() then raise exception 'FORBIDDEN:Not allowed' using errcode = '42501'; end if;
  if r.status <> 'requested' then raise exception 'INVALID:Only a request that is still waiting can be withdrawn.'; end if;
  update return_requests set status = 'cancelled', updated_at = now() where id = r.id;
  perform _return_event(r.id, 'withdrawn', null);
end $$;

-- ---------- store (or admin): record that the refund was sent / the replacement was arranged ----------
create or replace function complete_return_request(p_id uuid, p_reference text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r  return_requests%rowtype;
  so store_orders%rowtype;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
begin
  select * into r from return_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND:Request not found'; end if;
  if not (is_admin() or owns_store(r.store_id)) then raise exception 'FORBIDDEN:Not allowed' using errcode = '42501'; end if;
  if r.status <> 'approved' then raise exception 'INVALID:Only an approved request can be completed.'; end if;
  if r.resolution = 'refund' and (v_ref is null or char_length(v_ref) < 3) then
    raise exception 'INVALID:Enter the refund reference (e.g. GCash or bank reference number).';
  end if;
  update return_requests set status = 'completed', completed_at = now(), updated_at = now(), refund_reference = v_ref where id = r.id;

  if r.resolution = 'refund' then
    update store_orders set refunded_amount = least(total, refunded_amount + r.refund_amount) where id = r.store_order_id returning * into so;
    -- the store earns commission only on what stayed sold
    update store_order_commissions c
       set amount = round(greatest(so.subtotal - (select coalesce(sum(items_refund), 0) from return_requests
                                                   where store_order_id = so.id and status = 'completed' and resolution = 'refund'), 0) * c.rate / 100, 2)
     where c.store_order_id = so.id and c.amount is not null;
    if not exists (select 1 from store_orders where order_id = so.order_id and fulfillment_status <> 'cancelled' and refunded_amount < total) then
      update orders set payment_status = 'refunded' where id = so.order_id and payment_status in ('paid','simulated');
    end if;
  end if;
  perform _return_event(r.id, case when r.resolution = 'refund' then 'refund_recorded' else 'replacement_arranged' end, v_ref);
end $$;

revoke all on function create_return_request(uuid, text, text, text, jsonb, text[]) from public, anon;
revoke all on function respond_return_request(uuid, text, text, text, boolean)      from public, anon;
revoke all on function escalate_return_request(uuid, text)                          from public, anon;
revoke all on function cancel_return_request(uuid)                                  from public, anon;
revoke all on function complete_return_request(uuid, text)                          from public, anon;
grant execute on function create_return_request(uuid, text, text, text, jsonb, text[]) to authenticated;
grant execute on function respond_return_request(uuid, text, text, text, boolean)      to authenticated;
grant execute on function escalate_return_request(uuid, text)                          to authenticated;
grant execute on function cancel_return_request(uuid)                                  to authenticated;
grant execute on function complete_return_request(uuid, text)                          to authenticated;

-- ---------- when does the return window close? (the customer cannot read the commission table themselves) ----------
create or replace function return_deadline(p_store_order_id uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select earned_at from store_order_commissions where store_order_id = so.id), so.updated_at)
         + make_interval(days => _return_window_days())
    from store_orders so join orders o on o.id = so.order_id
   where so.id = p_store_order_id and so.fulfillment_status = 'delivered'
     and (o.customer_id = auth.uid() or is_admin());
$$;
revoke all on function return_deadline(uuid) from public, anon;
grant execute on function return_deadline(uuid) to authenticated;
