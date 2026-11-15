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
