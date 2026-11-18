-- =====================================================================
-- LOOKBAN - complete Supabase setup in ONE file
--
-- For a NEW, EMPTY Supabase project: paste this whole file into
-- Supabase dashboard -> SQL Editor -> New query -> Run. Run it ONCE.
--
-- It is simply these files joined in order (the separate files in
-- supabase/migrations/ stay the source of truth):

--   migrations/0001_schema.sql
--   migrations/0002_rls.sql
--   migrations/0003_functions.sql
--   migrations/0004_storage.sql
--   migrations/0005_guest_checkout.sql
--   migrations/0006_remove_sample_flag.sql
--   migrations/0007_contact_messages.sql
--   migrations/0008_product_promo.sql
--   migrations/0009_hero_slides.sql
--   migrations/0010_cancel_receive_rate.sql
--   migrations/0011_guest_email_required.sql
--   migrations/0012_commission.sql
--   migrations/0013_message_replies.sql
--   migrations/0014_vendor_accounts.sql
--   migrations/0015_store_applications.sql
--   migrations/0016_account.sql
--   migrations/0017_business_documents.sql
--   seed.sql
-- =====================================================================

-- #####################################################################
-- ## migrations/0001_schema.sql
-- #####################################################################

-- =====================================================================
-- LOOKBAN 0001 — Core schema
-- Run order: 0001 -> 0002 -> 0003 -> 0004 -> seed.sql
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------- Enums ----------
create type user_role          as enum ('customer', 'vendor', 'admin');
create type store_status       as enum ('pending', 'approved', 'suspended');
create type application_status as enum ('pending', 'approved', 'rejected');
create type product_status     as enum ('active', 'archived');
create type payment_method     as enum ('cod', 'simulated_online');
-- 'simulated' = demo payment. It is NEVER a verified payment.
create type payment_status     as enum ('pending', 'paid', 'simulated', 'refunded', 'cancelled');
create type fulfillment_status as enum
  ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');

-- ---------- Shared trigger: updated_at ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles (1:1 with auth.users) ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  role        user_role not null default 'customer',
  is_active   boolean   not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);

-- ---------- addresses ----------
create table addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  label          text not null default 'Home',
  recipient_name text not null,
  phone          text not null,
  line1          text not null,           -- house no., street
  barangay       text,
  city           text not null default 'Lucban',
  province       text not null default 'Quezon',
  postal_code    text,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index addresses_user_idx on addresses(user_id);
-- at most one default address per user
create unique index addresses_one_default on addresses(user_id) where is_default;

-- ---------- platform settings (admin-editable) ----------
create table settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- stores ----------
create table stores (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid unique references profiles(id) on delete set null, -- null = no owner (admin-managed store)
  slug          text not null unique,
  name          text not null,
  description   text,
  address       text,
  contact_phone text,
  contact_email text,
  logo_url      text,
  cover_url     text,
  opening_hours text,
  is_open       boolean not null default true,
  shipping_fee  numeric(10,2) check (shipping_fee >= 0), -- null => platform default
  status        store_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index stores_status_idx on stores(status);

-- ---------- vendor applications ----------
create table vendor_applications (
  id           uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references profiles(id) on delete cascade,
  store_name   text not null,
  description  text,
  address      text,
  phone        text,
  status       application_status not null default 'pending',
  admin_note   text,
  reviewed_by  uuid references profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create unique index vendor_app_one_pending on vendor_applications(applicant_id) where status = 'pending';

-- ---------- categories ----------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  image_url   text,
  sort_order  int not null default 0,
  is_featured boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- products ----------
-- One row per sellable variant (e.g. "Lucban Longganisa" / "Jumbo, 1 dozen").
create table products (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null references stores(id) on delete cascade,
  category_id          uuid references categories(id) on delete set null,
  slug                 text not null unique,
  name                 text not null,
  variant_label        text not null default '',
  description          text,
  price                numeric(10,2) not null check (price >= 0),
  stock                int not null default 0 check (stock >= 0),
  weight               text,        -- e.g. "250g"
  packaging            text,
  quantity_per_pack    text,        -- e.g. "1 dozen"
  ingredients          text,
  storage_instructions text,
  status               product_status not null default 'active',
  sold_count           int not null default 0 check (sold_count >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (store_id, name, variant_label)
);
create index products_store_idx    on products(store_id);
create index products_category_idx on products(category_id);
create index products_status_idx   on products(status);
create index products_name_trgm    on products using gin (name gin_trgm_ops);

create table product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  url          text not null,
  storage_path text,
  alt          text,
  position     int not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index product_images_product_idx on product_images(product_id, position);
create unique index product_images_one_primary on product_images(product_id) where is_primary;

-- ---------- carts ----------
create table carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references carts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity   int  not null check (quantity > 0 and quantity <= 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);
create index cart_items_cart_idx on cart_items(cart_id);

-- ---------- orders ----------
create sequence receipt_seq;

create table orders (
  id               uuid primary key default gen_random_uuid(),
  receipt_no       text not null unique,
  customer_id      uuid references profiles(id) on delete set null,
  -- customer + delivery snapshot (so receipts never change if profile changes)
  customer_name    text not null,
  customer_phone   text not null,
  customer_email   text,
  delivery_line1   text not null,
  delivery_barangay text,
  delivery_city    text not null,
  delivery_province text not null,
  delivery_postal  text,
  notes            text,
  payment_method   payment_method not null,
  payment_status   payment_status not null,
  status           fulfillment_status not null default 'pending', -- derived from store_orders
  subtotal         numeric(10,2) not null check (subtotal >= 0),
  shipping_total   numeric(10,2) not null check (shipping_total >= 0),
  total            numeric(10,2) not null check (total >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_customer_idx on orders(customer_id, created_at desc);
create index orders_created_idx  on orders(created_at desc);

-- one row per vendor within an order
create table store_orders (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  store_id           uuid references stores(id) on delete set null,
  store_name         text not null,   -- snapshot
  subtotal           numeric(10,2) not null check (subtotal >= 0),
  shipping_fee       numeric(10,2) not null check (shipping_fee >= 0),
  total              numeric(10,2) not null check (total >= 0),
  fulfillment_status fulfillment_status not null default 'pending',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (order_id, store_id)
);
create index store_orders_store_idx on store_orders(store_id, created_at desc);
create index store_orders_order_idx on store_orders(order_id);

create table order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  store_order_id    uuid not null references store_orders(id) on delete cascade,
  product_id        uuid references products(id) on delete set null,
  product_name      text not null,    -- snapshot
  variant_label     text not null default '',
  price_at_purchase numeric(10,2) not null check (price_at_purchase >= 0),
  quantity          int not null check (quantity > 0),
  line_total        numeric(10,2) generated always as (price_at_purchase * quantity) stored,
  created_at        timestamptz not null default now()
);
create index order_items_order_idx       on order_items(order_id);
create index order_items_store_order_idx on order_items(store_order_id);
create index order_items_product_idx     on order_items(product_id);

-- ---------- reviews ----------
create table reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  rating     int  not null check (rating between 1 and 5),
  comment    text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index reviews_product_idx on reviews(product_id);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','addresses','stores','products','carts','cart_items',
                           'orders','store_orders','reviews','settings']
  loop
    execute format('create trigger %I_updated_at before update on %I
                    for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- New auth user -> profile (role is ALWAYS customer here) ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- #####################################################################
-- ## migrations/0002_rls.sql
-- #####################################################################

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

-- #####################################################################
-- ## migrations/0003_functions.sql
-- #####################################################################

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

-- #####################################################################
-- ## migrations/0004_storage.sql
-- #####################################################################

-- =====================================================================
-- LOOKBAN 0004 — Storage buckets + policies
-- Path convention for uploads:  <store_id>/<unique-file-name>
-- Buckets are public-read (images are shown on the public site);
-- writes are limited to the owning vendor's folder, or admins.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('store-assets',   'store-assets',   true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function storage_folder_store_id(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return ((storage.foldername(p_name))[1])::uuid;
exception when others then
  return null;
end $$;

create policy lookban_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('product-images', 'store-assets')
    and (is_admin() or owns_store(storage_folder_store_id(name)))
  );
create policy lookban_storage_update on storage.objects for update to authenticated
  using (
    bucket_id in ('product-images', 'store-assets')
    and (is_admin() or owns_store(storage_folder_store_id(name)))
  );
create policy lookban_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('product-images', 'store-assets')
    and (is_admin() or owns_store(storage_folder_store_id(name)))
  );

-- #####################################################################
-- ## migrations/0005_guest_checkout.sql
-- #####################################################################

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

-- #####################################################################
-- ## migrations/0006_remove_sample_flag.sql
-- #####################################################################

-- =====================================================================
-- LOOKBAN 0006 - Remove the "sample listing" flag
-- For databases created before this change. Safe to run once (idempotent).
-- The two guard triggers referenced the column, so they are redefined first.
-- =====================================================================
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

alter table stores   drop column if exists is_sample;
alter table products drop column if exists is_sample;

-- #####################################################################
-- ## migrations/0007_contact_messages.sql
-- #####################################################################

-- =====================================================================
-- 0007 - Contact page messages
-- Visitors (logged in or not) can SEND a message; only admins can read, update or delete them.
-- Run after 0006.
-- =====================================================================
create table if not exists contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 100),
  email      text not null check (char_length(email) between 5 and 254),
  subject    text not null check (char_length(subject) between 2 and 100),
  message    text not null check (char_length(message) between 10 and 2000),
  status     text not null default 'new' check (status in ('new','read')),
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on contact_messages (created_at desc);

alter table contact_messages enable row level security;

drop policy if exists contact_messages_insert on contact_messages;
create policy contact_messages_insert on contact_messages for insert
  to anon, authenticated with check (status = 'new');

drop policy if exists contact_messages_admin_all on contact_messages;
create policy contact_messages_admin_all on contact_messages for all
  to authenticated using (is_admin()) with check (is_admin());

revoke all on contact_messages from anon, authenticated;
grant insert on contact_messages to anon, authenticated;
grant select, update, delete on contact_messages to authenticated; -- still limited to admins by the policy above

-- #####################################################################
-- ## migrations/0008_product_promo.sql
-- #####################################################################

-- =====================================================================
-- 0008 - Promo offers ("10% OFF")
-- `price` stays the price customers pay (checkout, stock and receipts are unchanged).
-- `compare_at_price` is the optional original price shown crossed out; it must be higher than `price`.
-- The discount percentage is calculated from the two, never stored separately.
-- Run after 0007.
-- =====================================================================
alter table products add column if not exists compare_at_price numeric(10,2);

alter table products drop constraint if exists products_compare_price_chk;
alter table products add constraint products_compare_price_chk
  check (compare_at_price is null or compare_at_price > price);

create index if not exists products_on_sale_idx on products (id) where compare_at_price is not null;

-- #####################################################################
-- ## migrations/0009_hero_slides.sql
-- #####################################################################

-- =====================================================================
-- 0009 - Home page hero photos managed by admins
-- Public can read active slides; only admins can add/change/delete. Photos live in the public
-- 'hero-banners' bucket (admin-only writes). If no slide exists the site falls back to a built-in photo.
-- =====================================================================
create table if not exists hero_slides (
  id         uuid primary key default gen_random_uuid(),
  image_url  text not null check (char_length(image_url) between 5 and 500),
  alt        text not null default 'LOOKBAN promotion' check (char_length(alt) between 1 and 200),
  link_url   text not null default '/shop' check (link_url ~ '^/[^/\\]' or link_url = '/'),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists hero_slides_order_idx on hero_slides (sort_order, created_at);

alter table hero_slides enable row level security;

drop policy if exists hero_slides_read on hero_slides;
create policy hero_slides_read on hero_slides for select to anon, authenticated using (is_active or is_admin());

drop policy if exists hero_slides_admin_write on hero_slides;
create policy hero_slides_admin_write on hero_slides for all to authenticated using (is_admin()) with check (is_admin());

revoke all on hero_slides from anon, authenticated;
grant select on hero_slides to anon, authenticated;
grant insert, update, delete on hero_slides to authenticated; -- still limited to admins by the policy above

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hero-banners', 'hero-banners', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists lookban_hero_insert on storage.objects;
create policy lookban_hero_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'hero-banners' and is_admin());
drop policy if exists lookban_hero_update on storage.objects;
create policy lookban_hero_update on storage.objects for update to authenticated
  using (bucket_id = 'hero-banners' and is_admin());
drop policy if exists lookban_hero_delete on storage.objects;
create policy lookban_hero_delete on storage.objects for delete to authenticated
  using (bucket_id = 'hero-banners' and is_admin());

-- #####################################################################
-- ## migrations/0010_cancel_receive_rate.sql
-- #####################################################################

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

-- #####################################################################
-- ## migrations/0011_guest_email_required.sql
-- #####################################################################

-- =====================================================================
-- 0011: guests must give a valid email at checkout (a second way to contact them).
-- The website form already checks this; this makes the database refuse it too.
-- Signed-in customers are unaffected: their order uses the email of their account.
-- Run AFTER 0001-0010. Safe to run twice.
-- =====================================================================
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
  if p_email is null or char_length(btrim(p_email)) > 120
     or btrim(p_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_INPUT:Please enter a valid email address';
  end if;

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

  v_order := _create_order_from_lines(null, btrim(p_email), p_name, p_phone, p_line1, p_barangay,
                                      p_city, p_province, p_postal, p_notes, p_payment_method);
  select access_token into v_token from orders where id = v_order;
  return jsonb_build_object('id', v_order, 'token', v_token);
end $$;

revoke all on function place_guest_order(jsonb,text,text,text,text,text,text,text,text,text,payment_method) from public;
grant execute on function place_guest_order(jsonb,text,text,text,text,text,text,text,text,text,payment_method) to anon, authenticated;

-- #####################################################################
-- ## migrations/0012_commission.sql
-- #####################################################################

-- =====================================================================
-- 0012: platform commission.
--
-- Rule: commission = rate x the store's ITEM subtotal (shipping is not the store's sale),
-- earned only when that store's part of the order (store_order) becomes Delivered.
-- Cancelled store_orders earn nothing.
--
--  * default rate: settings.default_commission_rate (percent, seeded at 5)
--  * optional per-store rate: stores.commission_rate (null = use the default)
--  * the rate is copied onto the order when it is placed, so changing a rate later never
--    changes old orders
--  * commission figures live in their own admin-only table, so customers who can read
--    their own orders never see them
--
-- This is a RECORD and a report. The app does not collect or move any money.
-- Run AFTER 0001-0011. Safe to run twice.
-- =====================================================================

insert into settings (key, value) values ('default_commission_rate', '5'::jsonb)
on conflict (key) do nothing;

alter table stores add column if not exists commission_rate numeric(5,2)
  check (commission_rate is null or commission_rate between 0 and 100);   -- null => platform default

create table if not exists store_order_commissions (
  store_order_id uuid primary key references store_orders(id) on delete cascade,
  store_id       uuid references stores(id) on delete set null,
  rate           numeric(5,2) not null check (rate between 0 and 100),   -- percent, fixed when the order was placed
  amount         numeric(10,2) check (amount >= 0),                      -- null until Delivered
  earned_at      timestamptz,                                            -- null until Delivered
  created_at     timestamptz not null default now(),
  check ((amount is null) = (earned_at is null))
);
create index if not exists commissions_store_idx  on store_order_commissions(store_id, earned_at);
create index if not exists commissions_earned_idx on store_order_commissions(earned_at);

-- ---------- row level security: admin (and the store's own owner) read only; nobody writes directly ----------
alter table store_order_commissions enable row level security;
drop policy if exists commissions_read on store_order_commissions;
create policy commissions_read on store_order_commissions for select to authenticated
  using (is_admin() or owns_store(store_id));
revoke all on store_order_commissions from anon, authenticated;
grant select on store_order_commissions to authenticated;

-- ---------- effective rate for a store right now ----------
create or replace function _commission_rate_for(p_store_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select commission_rate from stores where id = p_store_id),
    (select (value #>> '{}')::numeric from settings where key = 'default_commission_rate'),
    5);
$$;
revoke all on function _commission_rate_for(uuid) from public, anon, authenticated;

-- ---------- a store_order is created: fix its rate ----------
create or replace function _commission_on_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into store_order_commissions (store_order_id, store_id, rate)
  values (new.id, new.store_id, _commission_rate_for(new.store_id))
  on conflict (store_order_id) do nothing;
  return new;
end $$;

-- ---------- a store_order becomes Delivered: the commission is earned ----------
create or replace function _commission_on_delivered() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.fulfillment_status = 'delivered' and old.fulfillment_status is distinct from 'delivered' then
    insert into store_order_commissions (store_order_id, store_id, rate, amount, earned_at)
    values (new.id, new.store_id, _commission_rate_for(new.store_id),
            round(new.subtotal * _commission_rate_for(new.store_id) / 100, 2), now())
    on conflict (store_order_id) do update
      set amount = round(new.subtotal * store_order_commissions.rate / 100, 2), earned_at = now();
  end if;
  return new;
end $$;
revoke all on function _commission_on_insert()    from public, anon, authenticated;
revoke all on function _commission_on_delivered() from public, anon, authenticated;

drop trigger if exists store_orders_commission_ins on store_orders;
create trigger store_orders_commission_ins after insert on store_orders
  for each row execute function _commission_on_insert();
drop trigger if exists store_orders_commission_upd on store_orders;
create trigger store_orders_commission_upd after update of fulfillment_status on store_orders
  for each row execute function _commission_on_delivered();

-- ---------- backfill orders that existed before this migration ----------
insert into store_order_commissions (store_order_id, store_id, rate, amount, earned_at)
select so.id, so.store_id, _commission_rate_for(so.store_id),
       case when so.fulfillment_status = 'delivered' then round(so.subtotal * _commission_rate_for(so.store_id) / 100, 2) end,
       case when so.fulfillment_status = 'delivered' then coalesce(so.received_at, so.updated_at) end
  from store_orders so
on conflict (store_order_id) do nothing;

-- #####################################################################
-- ## migrations/0013_message_replies.sql
-- #####################################################################

-- =====================================================================
-- 0013 - Replies to Contact-page messages (admin only)
-- An admin can reply to a message from the Messages page. LOOKBAN does not send real
-- email in this prototype: the reply is SAVED here and shown as a simulated email
-- (delivery = 'simulated'). Only admins can read or write replies.
-- Run after 0012. Safe to run twice.
-- =====================================================================
create table if not exists contact_replies (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references contact_messages(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 2 and 2000),
  sent_by    uuid references profiles(id) on delete set null,
  delivery   text not null default 'simulated' check (delivery in ('simulated')),
  created_at timestamptz not null default now()
);
create index if not exists contact_replies_message_idx on contact_replies (message_id, created_at);

alter table contact_replies enable row level security;

drop policy if exists contact_replies_admin_all on contact_replies;
create policy contact_replies_admin_all on contact_replies for all
  to authenticated using (is_admin()) with check (is_admin());

revoke all on contact_replies from anon, authenticated;
grant select, insert, delete on contact_replies to authenticated; -- still limited to admins by the policy above

-- #####################################################################
-- ## migrations/0014_vendor_accounts.sql
-- #####################################################################

-- =====================================================================
-- 0014: vendor accounts - approval for NEW products, tighter store guard.
--
--  * Every store can have one vendor login (stores.owner_id -> profiles, role 'vendor').
--  * A vendor can edit their store, price, stock, descriptions and photos directly,
--    and update fulfilment of their own orders.
--  * A product a vendor ADDS starts as 'pending': the database forces it hidden
--    (status = 'archived') until an admin approves it. A vendor can never approve their own
--    product. Editing a rejected product sends it back to 'pending' for another review.
--  * Commission rate, shipping fee, owner and listing status stay admin-only.
-- Run AFTER 0001-0013. Safe to run twice.
-- =====================================================================

alter table products add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('approved', 'pending', 'rejected'));
alter table products add column if not exists review_note text check (char_length(review_note) <= 500);
create index if not exists products_pending_idx on products (created_at) where approval_status <> 'approved';

create or replace function guard_products() returns trigger
language plpgsql as $$
begin
  if is_client_session() and not is_admin() then
    if tg_op = 'UPDATE' then
      if new.store_id <> old.store_id or new.sold_count <> old.sold_count then
        raise exception 'Not allowed to change store or sales counters' using errcode = '42501';
      end if;
      if new.approval_status <> old.approval_status or new.review_note is distinct from old.review_note then
        raise exception 'Not allowed to change the approval status' using errcode = '42501';
      end if;
      -- Editing a rejected product resubmits it for review.
      if old.approval_status = 'rejected' then
        new.approval_status := 'pending';
        new.review_note := null;
      end if;
    else
      new.sold_count := 0;
      new.approval_status := 'pending';   -- new vendor products always wait for an admin
      new.review_note := null;
    end if;
    -- Anything not approved stays hidden, whatever the client asked for.
    if new.approval_status <> 'approved' then new.status := 'archived'; end if;
  end if;
  return new;
end $$;

create or replace function guard_stores() returns trigger
language plpgsql as $$
begin
  if is_client_session() and not is_admin() then
    if new.owner_id is distinct from old.owner_id
       or new.status <> old.status
       or new.commission_rate is distinct from old.commission_rate
       or new.shipping_fee is distinct from old.shipping_fee then
      raise exception 'Not allowed to change owner, approval status, shipping fee or commission rate' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- #####################################################################
-- ## migrations/0015_store_applications.sql
-- #####################################################################

-- =====================================================================
-- 0015: store applications with proof of business.
--
--  * A signed-in CUSTOMER can apply to open a store. The application must include the business
--    information and uploaded proof: Business/Mayor's Permit and DTI / SEC / CDA registration
--    (a Sanitary Permit or FDA licence is optional but encouraged for food).
--  * Documents live in a PRIVATE storage bucket (vendor-documents), in a folder named after the
--    applicant. Only the applicant and admins can open them.
--  * An admin approves or rejects. Approving creates the store and turns the applicant into a vendor.
--    Rejecting needs a reason. A rejected applicant may apply again.
--  * Applicants can never approve themselves: status, notes and reviewer are forced by the database.
-- Run AFTER 0001-0014. Safe to run twice.
-- =====================================================================

alter table vendor_applications add column if not exists owner_name          text;
alter table vendor_applications add column if not exists contact_email       text;
alter table vendor_applications add column if not exists permit_number       text;
alter table vendor_applications add column if not exists permit_expiry       date;
alter table vendor_applications add column if not exists registration_number text;
alter table vendor_applications add column if not exists permit_path         text;  -- Business / Mayor's Permit file
alter table vendor_applications add column if not exists registration_path   text;  -- DTI / SEC / CDA registration file
alter table vendor_applications add column if not exists sanitary_path       text;  -- optional Sanitary Permit / FDA file

-- ---------- private bucket for the proof documents ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-documents', 'vendor-documents', false, 5242880, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: <applicant user id>/<unique file name>
drop policy if exists lookban_vdocs_insert on storage.objects;
create policy lookban_vdocs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'vendor-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists lookban_vdocs_select on storage.objects;
create policy lookban_vdocs_select on storage.objects for select to authenticated
  using (bucket_id = 'vendor-documents' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- An applicant may remove a file only while no application uses it (cleans up failed submissions).
drop policy if exists lookban_vdocs_delete on storage.objects;
create policy lookban_vdocs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vendor-documents'
         and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from vendor_applications va
                          where va.applicant_id = auth.uid()
                            and name in (va.permit_path, va.registration_path, va.sanitary_path)));

-- ---------- what a new application must contain ----------
create or replace function guard_vendor_applications() returns trigger
language plpgsql set search_path = public as $$   -- NOT security definer: is_client_session() must see the caller
declare
  v_role  user_role;
  v_prefix text := new.applicant_id::text || '/';
begin
  if not (is_client_session() and not is_admin()) then return new; end if;

  select role into v_role from profiles where id = auth.uid();
  if v_role is distinct from 'customer' then
    raise exception 'INVALID:Only customer accounts can apply to open a store.';
  end if;
  if exists (select 1 from stores where owner_id = auth.uid()) then
    raise exception 'INVALID:You already have a store on LOOKBAN.';
  end if;

  if length(btrim(coalesce(new.store_name, '')))          < 2  then raise exception 'INVALID:Enter your store name.'; end if;
  if length(btrim(coalesce(new.description, '')))         < 20 then raise exception 'INVALID:Describe your store in at least 20 characters.'; end if;
  if length(btrim(coalesce(new.address, '')))             < 5  then raise exception 'INVALID:Enter your business address.'; end if;
  if length(btrim(coalesce(new.phone, '')))               < 7  then raise exception 'INVALID:Enter a contact number.'; end if;
  if length(btrim(coalesce(new.owner_name, '')))          < 2  then raise exception 'INVALID:Enter the business owner''s full name.'; end if;
  if coalesce(new.contact_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID:Enter a valid business email.'; end if;
  if length(btrim(coalesce(new.permit_number, '')))       < 3  then raise exception 'INVALID:Enter your Business / Mayor''s Permit number.'; end if;
  if new.permit_expiry is null or new.permit_expiry < current_date then
    raise exception 'INVALID:Your Business / Mayor''s Permit must still be valid (not expired).';
  end if;
  if length(btrim(coalesce(new.registration_number, ''))) < 3  then raise exception 'INVALID:Enter your DTI / SEC / CDA registration number.'; end if;

  -- proof files must exist and sit in the applicant's own folder
  if new.permit_path is null or left(new.permit_path, length(v_prefix)) <> v_prefix then
    raise exception 'INVALID:Upload your Business / Mayor''s Permit.'; end if;
  if new.registration_path is null or left(new.registration_path, length(v_prefix)) <> v_prefix then
    raise exception 'INVALID:Upload your DTI / SEC / CDA registration.'; end if;
  if new.sanitary_path is not null and left(new.sanitary_path, length(v_prefix)) <> v_prefix then
    raise exception 'INVALID:Invalid file for the Sanitary Permit.'; end if;

  -- an applicant never decides their own application
  new.status := 'pending'; new.admin_note := null; new.reviewed_by := null; new.reviewed_at := null;
  return new;
end $$;

drop trigger if exists vendor_applications_guard on vendor_applications;
create trigger vendor_applications_guard before insert on vendor_applications
  for each row execute function guard_vendor_applications();

-- ---------- admin decisions ----------
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
  if a.permit_path is null or a.registration_path is null or a.permit_number is null or a.registration_number is null then
    raise exception 'INVALID:This application has no proof of business. Reject it and ask the applicant to apply again.';
  end if;
  if a.permit_expiry is null or a.permit_expiry < current_date then
    raise exception 'INVALID:The Business / Mayor''s Permit has expired. Reject it and ask for a valid one.';
  end if;
  if exists (select 1 from stores where owner_id = a.applicant_id) then
    raise exception 'INVALID:Applicant already owns a store';
  end if;

  v_slug := slugify(a.store_name);
  if v_slug = '' or exists (select 1 from stores where slug = v_slug) then
    v_slug := coalesce(nullif(v_slug, ''), 'store') || '-' || substr(gen_random_uuid()::text, 1, 6);
  end if;

  insert into stores (owner_id, slug, name, description, address, contact_phone, contact_email, status)
  values (a.applicant_id, v_slug, a.store_name, a.description, a.address, a.phone, a.contact_email, 'approved')
  returning id into v_store;

  update profiles set role = 'vendor' where id = a.applicant_id and role = 'customer';
  update vendor_applications
     set status = 'approved', admin_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = a.id;
  return v_store;
end $$;

create or replace function reject_vendor_application(p_app_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN:Admins only' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'INVALID:Give the applicant a short reason so they can fix it and apply again.';
  end if;
  update vendor_applications
     set status = 'rejected', admin_note = btrim(p_note), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_app_id and status = 'pending';
  if not found then raise exception 'INVALID:Application not found or already reviewed'; end if;
end $$;

revoke all on function approve_vendor_application(uuid, text) from public, anon;
revoke all on function reject_vendor_application(uuid, text)  from public, anon;
grant execute on function approve_vendor_application(uuid, text) to authenticated;
grant execute on function reject_vendor_application(uuid, text)  to authenticated;

-- #####################################################################
-- ## migrations/0016_account.sql
-- #####################################################################

-- 0016 · My Account: profile photo + delete-my-account
--  * profiles.avatar_path  : storage path inside the public "avatars" bucket (<uid>/<file>)
--  * avatars bucket        : public read; each user can write only inside their own folder
--  * delete_my_account()   : customers only; blocked while an order is still being fulfilled.
--                            Orders are kept (customer_id -> null) so receipts stay accurate.

alter table profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "avatars public read"   on storage.objects;
drop policy if exists "avatars own insert"    on storage.objects;
drop policy if exists "avatars own update"    on storage.objects;
drop policy if exists "avatars own delete"    on storage.objects;

create policy "avatars public read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only an own-folder path may be stored as the avatar.
create or replace function guard_profile_avatar() returns trigger
language plpgsql as $$
begin
  if new.avatar_path is distinct from old.avatar_path
     and new.avatar_path is not null
     and split_part(new.avatar_path, '/', 1) <> new.id::text then
    raise exception 'INVALID_AVATAR:Photo must be inside your own folder' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_avatar_guard on profiles;
create trigger profiles_avatar_guard before update on profiles
  for each row execute function guard_profile_avatar();

-- ---------- delete_my_account ----------
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_role user_role;
begin
  if v_uid is null then
    raise exception 'AUTH:Please log in first' using errcode = '28000';
  end if;
  select role into v_role from profiles where id = v_uid;
  if v_role is distinct from 'customer' then
    raise exception 'FORBIDDEN:Only customer accounts can be deleted here' using errcode = '42501';
  end if;
  if exists (
    select 1 from store_orders so join orders o on o.id = so.order_id
     where o.customer_id = v_uid
       and so.fulfillment_status not in ('delivered','cancelled')
  ) then
    raise exception 'ACTIVE_ORDERS:You still have orders in progress. Wait until they are delivered or cancel them first.'
      using errcode = 'P0001';
  end if;
  -- keep order history for receipts / vendor records, just detach it from the person
  update orders set customer_id = null where customer_id = v_uid;
  -- profile, addresses, carts, reviews and applications cascade from auth.users
  delete from auth.users where id = v_uid;
end $$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

-- #####################################################################
-- ## migrations/0017_business_documents.sql
-- #####################################################################

-- =====================================================================
-- 0017: business documents on file + admin-approved updates.
--
--  * store_documents          : the VERIFIED business info of each store (permit no./expiry, registration no.,
--                               proof files). Private: only the store owner and admins can read it. Nobody
--                               can write it directly - it changes only when an admin approves a request.
--  * store_document_requests  : a vendor asks to change it (renewed permit, new file...). Pending until an
--                               admin approves or rejects (with a reason). Approving copies the new values in.
--  * Vendors see their own record + expiry status; an expired permit is only FLAGGED, never auto-suspended.
-- Run AFTER 0001-0016. Safe to run twice.
-- =====================================================================

create table if not exists store_documents (
  store_id            uuid primary key references stores(id) on delete cascade,
  permit_number       text,
  permit_expiry       date,
  registration_number text,
  permit_path         text,
  registration_path   text,
  sanitary_path       text,
  verified_by         uuid references profiles(id) on delete set null,
  verified_at         timestamptz,
  updated_at          timestamptz not null default now()
);
alter table store_documents enable row level security;
drop policy if exists store_documents_read on store_documents;
create policy store_documents_read on store_documents for select to authenticated
  using (is_admin() or owns_store(store_id));
revoke insert, update, delete on store_documents from anon, authenticated;

create table if not exists store_document_requests (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references stores(id) on delete cascade,
  requested_by        uuid references profiles(id) on delete set null,
  status              text not null default 'pending' check (status in ('pending','approved','rejected')),
  permit_number       text,          -- null = unchanged
  permit_expiry       date,
  registration_number text,
  permit_path         text,
  registration_path   text,
  sanitary_path       text,
  vendor_note         text check (vendor_note is null or length(vendor_note) <= 500),
  admin_note          text,
  reviewed_by         uuid references profiles(id) on delete set null,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists store_document_requests_store_idx on store_document_requests (store_id, created_at desc);
create unique index if not exists store_document_requests_one_pending on store_document_requests (store_id) where status = 'pending';
alter table store_document_requests enable row level security;

drop policy if exists sdr_read on store_document_requests;
create policy sdr_read on store_document_requests for select to authenticated
  using (is_admin() or owns_store(store_id));
drop policy if exists sdr_insert on store_document_requests;
create policy sdr_insert on store_document_requests for insert to authenticated
  with check (owns_store(store_id) and requested_by = auth.uid());
-- a vendor may withdraw their own request while it is still pending
drop policy if exists sdr_withdraw on store_document_requests;
create policy sdr_withdraw on store_document_requests for delete to authenticated
  using (owns_store(store_id) and status = 'pending');
revoke update on store_document_requests from anon, authenticated;

-- ---------- starting data: copy the proof of every already-approved application ----------
insert into store_documents (store_id, permit_number, permit_expiry, registration_number, permit_path, registration_path, sanitary_path, verified_by, verified_at)
select s.id, a.permit_number, a.permit_expiry, a.registration_number, a.permit_path, a.registration_path, a.sanitary_path, a.reviewed_by, a.reviewed_at
  from stores s
  join lateral (select * from vendor_applications va
                 where va.applicant_id = s.owner_id and va.status = 'approved' and va.permit_path is not null
                 order by va.reviewed_at desc nulls last limit 1) a on true
on conflict (store_id) do nothing;

-- new stores created by approving an application get their documents on file too
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
  if a.permit_path is null or a.registration_path is null or a.permit_number is null or a.registration_number is null then
    raise exception 'INVALID:This application has no proof of business. Reject it and ask the applicant to apply again.';
  end if;
  if a.permit_expiry is null or a.permit_expiry < current_date then
    raise exception 'INVALID:The Business / Mayor''s Permit has expired. Reject it and ask for a valid one.';
  end if;
  if exists (select 1 from stores where owner_id = a.applicant_id) then
    raise exception 'INVALID:Applicant already owns a store';
  end if;

  v_slug := slugify(a.store_name);
  if v_slug = '' or exists (select 1 from stores where slug = v_slug) then
    v_slug := coalesce(nullif(v_slug, ''), 'store') || '-' || substr(gen_random_uuid()::text, 1, 6);
  end if;

  insert into stores (owner_id, slug, name, description, address, contact_phone, contact_email, status)
  values (a.applicant_id, v_slug, a.store_name, a.description, a.address, a.phone, a.contact_email, 'approved')
  returning id into v_store;

  insert into store_documents (store_id, permit_number, permit_expiry, registration_number, permit_path, registration_path, sanitary_path, verified_by, verified_at)
  values (v_store, a.permit_number, a.permit_expiry, a.registration_number, a.permit_path, a.registration_path, a.sanitary_path, auth.uid(), now());

  update profiles set role = 'vendor' where id = a.applicant_id and role = 'customer';
  update vendor_applications
     set status = 'approved', admin_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = a.id;
  return v_store;
end $$;

-- ---------- what a vendor's request must contain ----------
create or replace function guard_document_requests() returns trigger
language plpgsql set search_path = public as $$   -- NOT security definer: is_client_session() must see the caller
declare
  v_owner  uuid;
  v_prefix text;
  cur      store_documents%rowtype;
  m_permit_no text; m_expiry date; m_reg_no text; m_permit_path text; m_reg_path text;
begin
  if not (is_client_session() and not is_admin()) then return new; end if;

  select owner_id into v_owner from stores where id = new.store_id;
  if v_owner is distinct from auth.uid() then raise exception 'FORBIDDEN:That is not your store.' using errcode = '42501'; end if;
  v_prefix := auth.uid()::text || '/';

  if new.permit_number is null and new.permit_expiry is null and new.registration_number is null
     and new.permit_path is null and new.registration_path is null and new.sanitary_path is null then
    raise exception 'INVALID:Change at least one thing before sending an update.';
  end if;
  if new.permit_number is not null and length(btrim(new.permit_number)) < 3 then raise exception 'INVALID:Enter a valid permit number.'; end if;
  if new.registration_number is not null and length(btrim(new.registration_number)) < 3 then raise exception 'INVALID:Enter a valid registration number.'; end if;
  if new.permit_expiry is not null and new.permit_expiry < current_date then
    raise exception 'INVALID:The new permit expiry date must be in the future.'; end if;
  if (new.permit_path       is not null and left(new.permit_path, length(v_prefix))       <> v_prefix)
  or (new.registration_path is not null and left(new.registration_path, length(v_prefix)) <> v_prefix)
  or (new.sanitary_path     is not null and left(new.sanitary_path, length(v_prefix))     <> v_prefix) then
    raise exception 'INVALID:Invalid file. Please upload your documents again.';
  end if;

  -- the record AFTER approval must be complete and still valid
  select * into cur from store_documents where store_id = new.store_id;
  m_permit_no   := coalesce(new.permit_number, cur.permit_number);
  m_expiry      := coalesce(new.permit_expiry, cur.permit_expiry);
  m_reg_no      := coalesce(new.registration_number, cur.registration_number);
  m_permit_path := coalesce(new.permit_path, cur.permit_path);
  m_reg_path    := coalesce(new.registration_path, cur.registration_path);
  if m_permit_no is null or m_expiry is null or m_reg_no is null or m_permit_path is null or m_reg_path is null then
    raise exception 'INVALID:Your store has no documents on file yet. Send the permit number, expiry date, registration number and both files together.';
  end if;
  if m_expiry < current_date then
    raise exception 'INVALID:Your Business / Mayor''s Permit would still be expired. Add the renewed permit''s expiry date and file.';
  end if;

  new.status := 'pending'; new.requested_by := auth.uid();
  new.admin_note := null; new.reviewed_by := null; new.reviewed_at := null;
  return new;
end $$;
drop trigger if exists document_requests_guard on store_document_requests;
create trigger document_requests_guard before insert on store_document_requests
  for each row execute function guard_document_requests();

-- ---------- admin decisions ----------
create or replace function approve_document_request(p_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r   store_document_requests%rowtype;
  cur store_documents%rowtype;
  n_expiry date; n_permit_no text; n_reg_no text; n_permit_path text; n_reg_path text;
begin
  if not is_admin() then raise exception 'FORBIDDEN:Admins only' using errcode = '42501'; end if;
  select * into r from store_document_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'INVALID:Request not found or already reviewed'; end if;
  select * into cur from store_documents where store_id = r.store_id;

  n_permit_no   := coalesce(r.permit_number, cur.permit_number);
  n_expiry      := coalesce(r.permit_expiry, cur.permit_expiry);
  n_reg_no      := coalesce(r.registration_number, cur.registration_number);
  n_permit_path := coalesce(r.permit_path, cur.permit_path);
  n_reg_path    := coalesce(r.registration_path, cur.registration_path);
  if n_permit_no is null or n_expiry is null or n_reg_no is null or n_permit_path is null or n_reg_path is null then
    raise exception 'INVALID:The record would be incomplete. Reject this request and ask for all documents.';
  end if;
  if n_expiry < current_date then
    raise exception 'INVALID:The permit would still be expired. Reject this request and ask for the renewed permit.';
  end if;

  insert into store_documents (store_id, permit_number, permit_expiry, registration_number, permit_path, registration_path, sanitary_path, verified_by, verified_at, updated_at)
  values (r.store_id, n_permit_no, n_expiry, n_reg_no, n_permit_path, n_reg_path, coalesce(r.sanitary_path, cur.sanitary_path), auth.uid(), now(), now())
  on conflict (store_id) do update
     set permit_number = excluded.permit_number, permit_expiry = excluded.permit_expiry,
         registration_number = excluded.registration_number, permit_path = excluded.permit_path,
         registration_path = excluded.registration_path, sanitary_path = excluded.sanitary_path,
         verified_by = excluded.verified_by, verified_at = excluded.verified_at, updated_at = now();

  update store_document_requests
     set status = 'approved', admin_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = r.id;
end $$;

create or replace function reject_document_request(p_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN:Admins only' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'INVALID:Give the vendor a short reason so they can fix it and send the update again.';
  end if;
  update store_document_requests
     set status = 'rejected', admin_note = btrim(p_note), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'pending';
  if not found then raise exception 'INVALID:Request not found or already reviewed'; end if;
end $$;

revoke all on function approve_document_request(uuid, text) from public, anon;
revoke all on function reject_document_request(uuid, text)  from public, anon;
grant execute on function approve_document_request(uuid, text) to authenticated;
grant execute on function reject_document_request(uuid, text)  to authenticated;

-- ---------- storage: a file in use (on file or in a request) cannot be deleted by the vendor ----------
drop policy if exists lookban_vdocs_delete on storage.objects;
create policy lookban_vdocs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vendor-documents'
         and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from vendor_applications va
                          where va.applicant_id = auth.uid()
                            and name in (va.permit_path, va.registration_path, va.sanitary_path))
         and not exists (select 1 from store_documents d where name in (d.permit_path, d.registration_path, d.sanitary_path))
         and not exists (select 1 from store_document_requests q where name in (q.permit_path, q.registration_path, q.sanitary_path)));

-- #####################################################################
-- ## seed.sql
-- #####################################################################

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
  ('default_shipping_fee', '50'::jsonb),         -- PHP per vendor; editable in Admin > Settings
  ('default_commission_rate', '5'::jsonb)        -- percent of a store's item subtotal; editable in Admin > Settings
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

