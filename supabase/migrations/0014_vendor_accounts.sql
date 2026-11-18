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
