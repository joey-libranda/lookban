-- =====================================================================
-- 0013 - Replies to Contact-page messages (admin only)
-- An admin can reply to a message from the Messages page. LOOKBAN does not send real
-- email in this prototype: the reply is SAVED here and shown as a simulated email
-- (delivery = 'simulated'). Only admins can read or write replies.
-- Run after 0012. Safe to run twice.
-- =====================================================================
create table if not exists contact_replies (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references contact_messages(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 2 and 2000),
  sent_by    uuid references profiles(id) on delete set null,
  delivery   text not null default 'simulated' check (delivery in ('simulated')),
  created_at timestamptz not null default now()
);
create index if not exists contact_replies_message_idx on contact_replies (message_id, created_at);

alter table contact_replies enable row level security;

drop policy if exists contact_replies_admin_all on contact_replies;
create policy contact_replies_admin_all on contact_replies for all
  to authenticated using (is_admin()) with check (is_admin());

revoke all on contact_replies from anon, authenticated;
grant select, insert, delete on contact_replies to authenticated; -- still limited to admins by the policy above
