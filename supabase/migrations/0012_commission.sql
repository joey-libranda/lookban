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
