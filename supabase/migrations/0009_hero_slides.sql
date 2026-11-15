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
