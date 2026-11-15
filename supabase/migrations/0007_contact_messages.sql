-- =====================================================================
-- 0007 - Contact page messages
-- Visitors (logged in or not) can SEND a message; only admins can read, update or delete them.
-- Run after 0006.
-- =====================================================================
create table if not exists contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 100),
  email      text not null check (char_length(email) between 5 and 254),
  subject    text not null check (char_length(subject) between 2 and 100),
  message    text not null check (char_length(message) between 10 and 2000),
  status     text not null default 'new' check (status in ('new','read')),
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on contact_messages (created_at desc);

alter table contact_messages enable row level security;

drop policy if exists contact_messages_insert on contact_messages;
create policy contact_messages_insert on contact_messages for insert
  to anon, authenticated with check (status = 'new');

drop policy if exists contact_messages_admin_all on contact_messages;
create policy contact_messages_admin_all on contact_messages for all
  to authenticated using (is_admin()) with check (is_admin());

revoke all on contact_messages from anon, authenticated;
grant insert on contact_messages to anon, authenticated;
grant select, update, delete on contact_messages to authenticated; -- still limited to admins by the policy above
