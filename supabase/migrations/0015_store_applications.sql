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
