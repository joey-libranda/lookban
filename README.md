# LOOKBAN - Local finds, Lucban pride.

Multi-vendor pasalubong marketplace for Lucban, Quezon.
Next.js 16 (App Router) - TypeScript - Tailwind v4 - Supabase (Postgres, Auth, Storage).

> **Status: Phases 1-5 complete (foundation, browsing, cart/checkout/receipts, admin + account).** Phase 5 (hardening + deploy guide) is done - see DEPLOYMENT.md. See "What works today".

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project values
   (Supabase dashboard -> Project Settings -> API Keys).
   - `NEXT_PUBLIC_SUPABASE_URL` - `https://<ref>.supabase.co` (the project URL, **without** `/rest/v1/`)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - safe for the browser (RLS protects data)
   - `SUPABASE_SECRET_KEY` - **server only**, never prefix with `NEXT_PUBLIC_`, never commit
3. **Create the database.** Supabase dashboard -> SQL Editor -> paste and run **`supabase/lookban_supabase_setup.sql`** once
   (new, empty project), then run `supabase/verify_setup.sql` to confirm. Already ran some numbered files, or want the
   details? See **`supabase/SETUP.md`**.
4. **Authentication settings** (Authentication -> URL Configuration):
   - Site URL: `http://localhost:3000` (your Vercel URL in production)
   - Redirect URLs: `http://localhost:3000/auth/callback` and `https://<your-app>.vercel.app/auth/callback`
   - For quick demos you may turn off Authentication -> Providers -> Email -> "Confirm email".
     When it is on, new users must click the emailed link before logging in.
5. `npm run dev` -> http://localhost:3000

### Create the first admin
Register normally on `/register`, then in the SQL Editor run:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

Roles can only be changed by admins or from the SQL Editor; a database trigger blocks everyone else,
including users trying to edit their own profile.

## Database

| Table | Purpose |
|---|---|
| `profiles`, `addresses` | users (1:1 with `auth.users`) and delivery addresses |
| `stores`, `vendor_applications` | one store per vendor; admin-approved applications |
| `categories`, `products`, `product_images` | catalog; one product row per sellable variant |
| `carts`, `cart_items` | persistent per-user cart |
| `orders`, `store_orders`, `order_items` | one order -> one `store_order` per vendor -> items with `price_at_purchase` |
| `reviews`, `settings` | reviews (delivered buyers only); admin-editable settings (default shipping fee) |

Key guarantees (all enforced in Postgres, not in the UI):
- **RLS on every table.** Customers see only their own data; vendors only their store, products and store_orders; admins platform-wide.
- **`place_order()`** is one transaction: locks products, checks stock, prices everything from the database, splits by vendor,
  snapshots prices, deducts stock, clears the cart. Client-sent prices are never accepted.
- Simulated payments are stored as `payment_status = 'simulated'` and can never become `paid`.
- Shipping: flat PHP 50 per vendor by default (`settings.default_shipping_fee`, per-store override in `stores.shipping_fee`).

### Tests
`npm test` runs the cart-maths unit tests (`tests/logic.test.ts`).

### Database tests
`supabase/tests/rls_and_orders.sql` (135 checks: privilege escalation, RLS isolation, order creation, overselling,
atomic rollback, price snapshots, vendor boundaries, status flow, restock on cancel). It runs inside a transaction that is rolled back.
Local run against a throwaway Postgres: apply `supabase/tests/00_local_supabase_stub.sql` (stand-ins for Supabase's `auth`/`storage`
schemas), then the migrations, `seed.sql`, then the test file with `psql -v ON_ERROR_STOP=1 -f ...`.

## Project layout

```
src/app/(site)/     public pages with header/footer (home, account, vendor, admin, ...)
src/app/(auth)/     login, register, forgot/reset password
src/app/auth/callback   email-link handler
src/proxy.ts            session refresh + redirect anonymous users from private routes
src/lib/supabase/       browser / server / admin (service-role, server-only) clients
src/lib/auth/guards.ts  requireUser / requireAdmin (requireVendor dormant) (server-side role checks)
src/lib/validators/     Zod schemas (shared by forms and server actions)
src/server/actions/     mutations (Server Actions)    src/server/queries/  reads
supabase/               SETUP.md (start here), one-file setup, verify script, migrations, seed.sql, tests
```

## Security model (three layers)
1. `proxy.ts` redirects anonymous users away from `/account`, `/checkout`, `/orders`, `/vendor`, `/admin`.
2. Server guards verify the user with Supabase Auth and check role/store ownership on every protected page and action.
3. Row Level Security in Postgres is the final authority, even if layers 1-2 were bypassed.

## What works today
**Phase 1:** schema, RLS, `place_order()`, storage policies, seed data (tested on local Postgres 16);
register / log in / log out / forgot + reset password; protected routes and role guards.

**Phase 2:** homepage (live "compare longganisa" panel, categories, products, stores, Discover Lucban),
shop with search, category/store filters, sorting (newest, bestselling, price, A-Z) and pagination,
**Compare stores** view (same product across stores, cheapest first, unit price when sizes are comparable),
product pages (stock, packaging, compare table, more from this store, related), stores directory,
store pages with category filter, categories, About. Loading, empty, error and 404 states.

**Phase 3:** real Add to Cart (quantity selector, stock re-checked on the server, login required), header cart badge,
cart grouped by store with per-store shipping, checkout (Cash on Delivery or clearly-labelled *simulated* online payment),
order creation through `place_order()` (prices, stock, shipping and payment status all computed in the database),
order confirmation, order details, order history, and a printable A4 receipt (price-at-purchase snapshots, per-vendor sections).

## Not built yet
Not yet run against a live Supabase from the build sandbox - your first real run is the true test (see `DEPLOYMENT.md` for Vercel).
The vendor role exists in the database but is unused: LOOKBAN's UI has two roles, customer and admin.
Visitors can add to a browser-only cart and check out as guests (see "Shopping rules" below).

## Known caveats
- **Seed data.** Stores and products come from the project report; prices, stock (50) and photos are placeholders to edit in the admin dashboard.
  No photos are included - products show a labelled placeholder until real images are uploaded.
- **Tropika Island font** (`public/fonts/`) ships with a *Demo for Personal Use* license. Buy a commercial license or
  replace it (one `@font-face` + `--font-display` in `globals.css`) before a public launch.
- Auth flows, Storage uploads and the catalog queries have **not** been run against a live Supabase project yet. Catalog pages were
  rendered against a stand-in REST server serving the seed data, which checks the UI and filtering logic but not PostgREST itself.
- No real product/store photos yet: every image slot shows a labelled placeholder.


**Phase 4 (two roles):** Admin area at `/admin` - dashboard (counts, sales summary, recent orders, low stock), products
(create/edit/archive/delete, photo upload straight to Supabase Storage, cover photo), stores (details, logo/cover, shipping fee,
open/closed, status), categories, orders (per-store fulfilment status via `update_store_order_status`), customers
(activate/deactivate), settings (default shipping fee). Customers edit their profile and one saved delivery address at `/account`
(prefills checkout). All admin writes use the admin's own RLS session; no service key is needed.

**Phase 5:** security headers (no framing, nosniff, HSTS, referrer/permissions policy), `robots.txt` + live `sitemap.xml`
(private areas excluded; admin is `noindex`), global/admin error boundaries and loading skeletons, friendly messages when the network
fails during add-to-cart / cart edits / checkout, a layout fix for 360px phones, and `DEPLOYMENT.md` (Vercel + Supabase checklist).
Verified: all 27 pages at 360/768/1280px with no sideways scroll or JS errors; anonymous visitors are redirected to login and
customers get the access-denied page on `/admin`; the production client bundle contains no secret key.

**Shopping rules (clarified):**
- **Visitors (no account):** can browse, add to a cart that lives only in their browser tab (gone when it closes), see real totals,
  and **check out as a guest**. They get a secret tracking link, or can use *Track order* (receipt no. + mobile number).
- **Customers (logged in):** saved cart (a visitor cart is merged in on login), details prefilled at checkout, order history, progress tracker.
- **Admins:** no cart, no add-to-cart, cannot place orders (enforced in the database, not just hidden). They see *Edit in admin* instead.
- Order progress shown to customers: Order placed -> Confirmed -> Preparing -> Out for delivery -> Delivered (set by the admin, per store).
- Migration `0005` adds `place_guest_order`, `get_order_by_token`, `track_order`; guests still have **no direct read access** to any order table.
