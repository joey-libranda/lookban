# LOOKBAN - Supabase setup guide

Everything database-related lives in this `supabase/` folder. Nothing here is run automatically:
you paste SQL into the Supabase dashboard yourself.

```
supabase/
  SETUP.md                      <- this guide
  lookban_supabase_setup.sql    <- ALL steps below joined into one file (new projects: run this ONE file)
  verify_setup.sql              <- read-only checklist: tells you what is missing
  migrations/                   <- the same SQL split into numbered steps (source of truth)
  seed.sql                      <- starter categories, stores, products (placeholder prices/stock)
  tests/                        <- database tests for local Postgres (not for Supabase)
```

## A. New, empty Supabase project (the usual case)

1. Supabase dashboard -> **SQL Editor** -> **New query**.
2. Paste the whole of `lookban_supabase_setup.sql` and press **Run**. Run it **once**.
3. Paste `verify_setup.sql` and run it. Every row should say `ok`
   (the last row, "an admin exists", turns `ok` after step C).

## B. You already ran some of the numbered files

Do **not** run the combined file again (it would fail on things that already exist).
Run `verify_setup.sql`; each `MISSING - run 000X` row names the file to run. Run only those,
in number order, from `migrations/`. What each one adds:

| File | Adds |
|---|---|
| `0001_schema.sql` | tables, constraints, indexes, triggers |
| `0002_rls.sql` | Row Level Security policies, `is_admin()` |
| `0003_functions.sql` | `place_order()` (safe checkout), order status updates |
| `0004_storage.sql` | photo buckets `product-images`, `store-assets` |
| `0005_guest_checkout.sql` | guest checkout, order tracking |
| `0006_remove_sample_flag.sql` | removes an old sample-data flag |
| `0007_contact_messages.sql` | Contact page messages (admin **Messages**) |
| `0008_product_promo.sql` | "Original price" for promos (`compare_at_price`) |
| `0009_hero_slides.sql` | admin-managed home hero photos + `hero-banners` bucket |
| `0010_cancel_receive_rate.sql` | customer cancel / "Mark as Received" / star rating, and totals that exclude cancelled stores |
| `0011_guest_email_required.sql` | guests must give a valid email at checkout (the database refuses it otherwise) |
| `0012_commission.sql` | commission: default 5% rate (Admin → Settings), optional per-store rate, and the admin-only `store_order_commissions` table that records each store's commission when its part of an order is Delivered |
| `0013_message_replies.sql` | admins can reply to Contact-page messages from the Messages page; replies are saved as simulated email (nothing is really sent) |
| `0014_vendor_accounts.sql` | vendor logins: a vendor manages their own store, prices, stock, photos and orders; a product a vendor ADDS stays hidden until an admin approves it |
| `0015_store_applications.sql` | store registration: business info + proof of business (permit and DTI/SEC/CDA registration) uploaded to a private bucket; admin approves or rejects; rejected applicants may re-apply |
| `0016_account.sql` | My Account: profile photo (public `avatars` bucket, own folder only) and customer self-service account deletion that keeps order receipts |
| `0017_business_documents.sql` | Business documents on file per store, with vendor update requests that an admin must approve (permit expiry is flagged, never auto-suspended) |
| `0018_returns.sql` | Return & refund requests after delivery (3-day window, store review, one escalation to LOOKBAN, private photo evidence, refund records that adjust commission) |
| `seed.sql` | starter data (safe to re-run) |

## C. Make yourself admin

1. Open the site, **Register** with your email, log in once.
2. SQL Editor:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

Only admins (or the SQL Editor) can change roles; a database trigger blocks everyone else.

## C2. Vendor logins for the stores

Every store gets its own login, so the store owner can manage their own products and orders.

1. Put the Supabase **secret** key in `.env.local` on your computer as `SUPABASE_SECRET_KEY=...` (that file is git-ignored; **never** add this key to Vercel).
2. Run `npm run vendors:create`.
3. It creates `shortname@lookban.com` (short names are in `scripts/vendor-emails.json`; edit that file to change an email, then run the script again to rename existing logins) with password `Password123`
   for every store that has no login yet, links it to the store, and prints the list. Running it again is safe;
   new stores get their account, existing ones are skipped.

Vendors sign in at `/login` and land on the Vendor Dashboard. **Demo only:** a shared, guessable password and made-up
`@lookban.com` addresses are fine for a school demo but not for real sellers (no email can be received there, so
password reset will not work). Before a real launch, give each seller their own email and password.

How approval works: a vendor can edit their store, prices, stock, descriptions and photos directly. A **new** product
they add waits in Pending until an admin approves it (Admin → Products); a rejected product returns to Pending when edited.
Commission rate, shipping fee and store status stay admin-only.

## C3. New stores apply on the website

A business owner opens **Store Registration** (footer), creates a customer account, and submits the application with the
business information and proof: Business / Mayor's Permit (number, valid-until date, file) and DTI / SEC / CDA registration
(number, file). A Sanitary Permit / FDA file is optional. Files go to a **private** bucket that only the applicant and
admins can open. In **Admin -> Applications** you open the files, then Approve (creates the store and a Vendor Dashboard,
and the applicant keeps their own email and password) or Reject with a reason. A rejected applicant sees the reason and may apply again.
This replaces `npm run vendors:create` for new stores; the script is only for stores you add yourself.
The permit must not be expired, and the database refuses to approve an application without its proof.

## D. Supabase dashboard settings (not SQL)

- **Authentication -> URL Configuration:** Site URL `http://localhost:3000` (your Vercel URL when live);
  Redirect URLs `http://localhost:3000/**` and `https://YOUR-APP.vercel.app/**`.
- **Authentication -> Sign In / Providers -> Email:** enabled; for demos turn **Confirm email** off.
- **Project Settings -> API:** copy the Project URL and the **publishable** key into `.env.local`
  (see `.env.example`). The **secret** key is not used by the deployed app: leave it out of Vercel (only `npm run vendors:create` uses it, on your computer).

## E. Starting over (careful: deletes all LOOKBAN data)

Easiest: create a new Supabase project and repeat section A. Resetting inside an existing project means
dropping the tables yourself in the SQL Editor; only do that on a project with nothing you need.

## F. Updating later

When a new numbered migration arrives (for example `0010_...sql`), run just that file once.
`lookban_supabase_setup.sql` is regenerated with each release, so keep using it only for brand-new projects.

## G. Database tests (optional, local Postgres only)

`tests/rls_and_orders.sql` checks security and ordering (135 checks). Never run it on your real Supabase project.
Locally: create an empty Postgres database, then in order: `tests/00_local_supabase_stub.sql`
(stand-ins for Supabase's `auth`/`storage`), `migrations/*.sql`, `seed.sql`, `tests/rls_and_orders.sql`
(`psql -v ON_ERROR_STOP=1 -f <file>`). It ends with `ALL DATABASE TESTS PASSED`.
