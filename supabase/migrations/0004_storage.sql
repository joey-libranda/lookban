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
