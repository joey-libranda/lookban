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
