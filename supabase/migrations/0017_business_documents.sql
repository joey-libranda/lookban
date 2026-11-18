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
