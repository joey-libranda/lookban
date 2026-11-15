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
