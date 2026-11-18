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
