// Creates one vendor login for every store that has none, and links it to the store.
//
//   Email:     <short name>@lookban.com. Short names come from scripts/vendor-emails.json (store web address -> name).
//              A store that is not listed gets its name without spaces/symbols, cut to 20 characters.
//              Edit the JSON and run the script again to RENAME the email of a store that already has a login.
//   Password:  Password123  (demo only - see "Before a real launch" in SETUP.md)
//
// Run it on YOUR computer only (never on Vercel):
//   1. Put the Supabase secret key in .env.local as SUPABASE_SECRET_KEY (that file is git-ignored).
//   2. npm run vendors:create
// Safe to run again: stores that already have a vendor are skipped. New stores get an account.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const PASSWORD = process.env.VENDOR_DEFAULT_PASSWORD || "Password123";
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

let SHORT = {};
try { SHORT = JSON.parse(readFileSync(new URL("./vendor-emails.json", import.meta.url), "utf8")); } catch { /* optional file */ }
const clean = (t) => t.normalize("NFD").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const emailFor = (store) => `${SHORT[store.slug] ? clean(SHORT[store.slug]) : clean(store.name).slice(0, 20)}@lookban.com`;

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

const { data: stores, error } = await db.from("stores").select("id, name, slug, owner_id").order("name");
if (error) { console.error("Could not read stores:", error.message); process.exit(1); }

const used = new Set();
const rows = [];
for (const s of stores) {
  if (s.owner_id) {
    // Already has a login: rename its email only if the JSON lists a different short name.
    const want = SHORT[s.slug] ? emailFor(s) : null;
    const { data: cur } = await db.auth.admin.getUserById(s.owner_id);
    const have = cur?.user?.email?.toLowerCase();
    if (want && have && want !== have) {
      const r = await db.auth.admin.updateUserById(s.owner_id, { email: want, email_confirm: true });
      if (r.error) { rows.push([s.name, want, `RENAME FAILED: ${r.error.message}`]); continue; }
      await db.from("profiles").update({ email: want }).eq("id", s.owner_id);
      rows.push([s.name, want, `renamed (was ${have})`]);
    } else rows.push([s.name, have ?? "(login exists)", "unchanged"]);
    continue;
  }
  let email = emailFor(s), n = 2;
  while (used.has(email)) email = email.replace(/(\d*)@/, `${n++}@`);
  used.add(email);

  let user = (await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: s.name },
  })).data?.user;
  if (!user) user = await findUserByEmail(email); // account exists from an earlier run
  if (!user) { rows.push([s.name, email, "FAILED to create"]); continue; }

  // The signup trigger made a profile; make it a vendor and attach the store.
  const p = await db.from("profiles").update({ role: "vendor", full_name: s.name, email }).eq("id", user.id);
  const o = await db.from("stores").update({ owner_id: user.id }).eq("id", s.id);
  rows.push([s.name, email, p.error || o.error ? `FAILED: ${(p.error || o.error).message}` : PASSWORD]);
}
console.table(rows.map(([store, email, password]) => ({ store, email, password })));
