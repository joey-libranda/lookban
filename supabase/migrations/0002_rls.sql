-- =====================================================================
-- LOOKBAN 0002 — Helper functions, guard triggers, Row Level Security
-- =====================================================================

-- ---------- Helpers (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active)
$$;

create or replace function owns_store(p_store_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from stores s
    join profiles p on p.id = s.owner_id
    where s.id = p_store_id and s.owner_id = auth.uid() and p.is_active
  )
$$;

-- Cross-table checks used by order policies. They are SECURITY DEFINER so the
-- orders <-> store_orders policies do not trigger each other (infinite recursion).
create or replace function is_my_order(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orders where id = p_order_id and customer_id = auth.uid())
$$;

create or replace function order_has_my_store(p_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from store_orders where order_id = p_order_id and owns_store(store_id))
$$;

create or replace function owns_store_order(p_store_order_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from store_orders where id = p_store_order_id and owns_store(store_id))
$$;

-- True when the statement comes straight from a client (PostgREST) session.
-- Inside SECURITY DEFINER functions, SQL editor, or service_role this is false.
create or replace function is_client_session() returns boolean
language sql stable as $$ select current_user in ('anon', 'authenticated') $$;

-- ---------- Guard triggers: protect privileged columns ----------
create or replace function guard_profiles() returns trigger
language plpgsql as $$
begin
  if is_client_session() and not is_admin() then
    if new.role <> old.role or new.is_active <> old.is_active or new.email is distinct from old.email then
      raise exception 'Not allowed to change role, status or email' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles
  for each row execute function guard_profiles();

create or replace function guard_stores() returns trigger
language plpgsql as $$
begin
  if is_client_session() and not is_admin() then
    if new.owner_id is distinct from old.owner_id
       or new.status <> old.status then
      raise exception 'Not allowed to change owner or approval status' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger stores_guard before update on stores
  for each row execute function guard_stores();

create or replace function guard_products() returns trigger
language plpgsql as $$
begin
  if is_client_session() and not is_admin() then
    if tg_op = 'UPDATE' then
      if new.store_id <> old.store_id or new.sold_count <> old.sold_count then
        raise exception 'Not allowed to change store or sales counters' using errcode = '42501';
      end if;
    else
      new.sold_count := 0;
    end if;
  end if;
  return new;
end $$;
create trigger products_guard before insert or update on products
  for each row execute function guard_products();

-- ---------- Enable RLS on every table ----------
alter table profiles            enable row level security;
alter table addresses           enable row level security;
alter table settings            enable row level security;
alter table stores              enable row level security;
alter table vendor_applications enable row level security;
alter table categories          enable row level security;
alter table products            enable row level security;
alter table product_images      enable row level security;
alter table carts               enable row level security;
alter table cart_items          enable row level security;
alter table orders              enable row level security;
alter table store_orders        enable row level security;
alter table order_items         enable row level security;
alter table reviews             enable row level security;

-- ---------- profiles ----------
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on profiles for update to authenticated
  using (is_admin()) with check (is_admin());
-- No insert policy: rows are created by the handle_new_user trigger.
-- No delete policy: accounts are deactivated (is_active) by admins.

-- ---------- addresses ----------
create policy addresses_own on addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- settings ----------
create policy settings_read  on settings for select to anon, authenticated using (true);
create policy settings_admin on settings for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- stores ----------
create policy stores_public_read on stores for select to anon, authenticated
  using (status = 'approved' or owner_id = auth.uid() or is_admin());
create policy stores_owner_update on stores for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy stores_admin_all on stores for all to authenticated
  using (is_admin()) with check (is_admin());
-- Stores are created only by approve_vendor_application() (see 0003).

-- ---------- vendor_applications ----------
create policy vendor_apps_insert on vendor_applications for insert to authenticated
  with check (applicant_id = auth.uid() and status = 'pending');
create policy vendor_apps_select on vendor_applications for select to authenticated
  using (applicant_id = auth.uid() or is_admin());
create policy vendor_apps_admin_update on vendor_applications for update to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- categories ----------
create policy categories_read  on categories for select to anon, authenticated using (true);
create policy categories_admin on categories for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- products ----------
create policy products_public_read on products for select to anon, authenticated
  using (
    (status = 'active' and exists (select 1 from stores s where s.id = store_id and s.status = 'approved'))
    or owns_store(store_id) or is_admin()
  );
create policy products_owner_insert on products for insert to authenticated
  with check (
    owns_store(store_id)
    and exists (select 1 from stores s where s.id = store_id and s.status = 'approved')
  );
create policy products_owner_update on products for update to authenticated
  using (owns_store(store_id)) with check (owns_store(store_id));
create policy products_owner_delete on products for delete to authenticated
  using (owns_store(store_id));
create policy products_admin_all on products for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- product_images ----------
create policy product_images_read on product_images for select to anon, authenticated
  using (exists (select 1 from products p where p.id = product_id));  -- inherits products RLS
create policy product_images_owner on product_images for all to authenticated
  using (exists (select 1 from products p where p.id = product_id and owns_store(p.store_id)))
  with check (exists (select 1 from products p where p.id = product_id and owns_store(p.store_id)));
create policy product_images_admin on product_images for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- carts ----------
create policy carts_own on carts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on cart_items for all to authenticated
  using (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()));

-- ---------- orders / store_orders / order_items ----------
-- Read-only for clients. All writes go through place_order() and
-- update_store_order_status() (SECURITY DEFINER, see 0003).
create policy orders_select on orders for select to authenticated
  using (customer_id = auth.uid() or is_admin() or order_has_my_store(id));
create policy store_orders_select on store_orders for select to authenticated
  using (owns_store(store_id) or is_admin() or is_my_order(order_id));
create policy order_items_select on order_items for select to authenticated
  using (is_admin() or is_my_order(order_id) or owns_store_order(store_order_id));

-- ---------- reviews ----------
create policy reviews_read on reviews for select to anon, authenticated using (true);
-- Only customers who actually received the product can review it.
create policy reviews_insert on reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from order_items oi
      join store_orders so on so.id = oi.store_order_id
      join orders o on o.id = oi.order_id
      where oi.product_id = reviews.product_id
        and o.customer_id = auth.uid()
        and so.fulfillment_status = 'delivered'
    )
  );
create policy reviews_update_own on reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete_own on reviews for delete to authenticated
  using (user_id = auth.uid() or is_admin());
