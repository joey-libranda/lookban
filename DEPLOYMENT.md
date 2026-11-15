# Deploying LOOKBAN (Vercel + Supabase, free tiers)

You do not need GitHub to deploy. Pick **A** (CLI, no GitHub) or **B** (GitHub import).

## 0. Before you deploy
- [ ] Supabase database is set up: `supabase/lookban_supabase_setup.sql` was run once, and `supabase/verify_setup.sql` shows every row `ok`
      (details in `supabase/SETUP.md`). Storage buckets `product-images`, `store-assets` and `hero-banners` exist (created by the SQL).
- [ ] You have an admin user (see README -> "Create the first admin").
- [ ] `npm run build` works locally (`npm test` passes).
- [ ] **Rotate the Supabase secret key** if it was ever pasted in a chat or committed. LOOKBAN does not use it at all, so
      **do not add it to Vercel**.

## 1. Environment variables (Vercel -> Project -> Settings -> Environment Variables)
| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR-REF.supabase.co` (Supabase -> Settings -> API; no `/rest/v1/`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_...` key |
| `NEXT_PUBLIC_SITE_URL` | your final URL, e.g. `https://lookban.vercel.app` (no trailing slash) |

Add them for Production **and** Preview. Redeploy after changing any `NEXT_PUBLIC_*` value (they are baked in at build time).

## 2A. Deploy with the CLI (no GitHub)
```bash
npm i -g vercel
cd lookban
vercel            # first time: log in, accept defaults (Framework: Next.js)
vercel --prod     # production deploy
```
## 2B. Deploy from GitHub
Push the project, then Vercel -> **Add New -> Project -> Import** the repo -> add the env vars -> Deploy.
(`.env.local` is git-ignored; never commit it.)

## 3. Tell Supabase about your live URL (Authentication -> URL Configuration)
- **Site URL:** `https://YOUR-APP.vercel.app`
- **Redirect URLs:** add `https://YOUR-APP.vercel.app/**` (and `http://localhost:3000/**` for local work)

Without this, password-reset / confirmation links send people to the wrong place.

## 4. Supabase Auth settings to check (Authentication -> Sign In / Providers)
- Email provider **enabled**, **Allow new users to sign up** **on** (customers register on the site).
- **Confirm email**: off is easiest for a demo. If on, Supabase's built-in mailer is heavily rate-limited (a few emails/hour) -
  fine for a quick test, not for a class demo with many sign-ups; use your own SMTP (Authentication -> SMTP) if you need it.

## 5. Smoke test the live site (10 minutes)
0. **As a visitor** (private window, not logged in): add items from two stores, see the totals, check out as a guest, open the tracking link, then try *Track order* with the receipt number + mobile number. Close the tab and reopen the site: the cart should be empty.
1. Register a new customer -> you land logged in.
2. Shop -> add products from **two different stores** -> cart groups them by store.
3. Checkout (Cash on Delivery) -> confirmation page (with the progress tracker) -> **Print receipt** (use "Save as PDF").
4. Log in as admin -> `/admin/orders` -> open the order -> advance each store's status separately.
5. `/admin/products` -> open a product -> upload a photo -> confirm it appears in the shop.
6. Log in as a customer and open `/admin` -> you must see the "access denied" page. Log in as admin: there is no cart icon or Add to cart button, and `/cart` sends you to `/admin`.
7. Check stock dropped, and cancelling a store's part returns it.

## 6. Free-tier things to know
- A **free Supabase project pauses after ~1 week of inactivity** - open the dashboard and click Restore before a demo.
- Vercel Hobby is for non-commercial use; fine for a school project.
- Supabase Storage free tier: 1 GB. Photos over 5 MB are rejected by the bucket.

## 7. Known limitations (be honest in your presentation)
- Online payment is **simulated**: never marked paid, clearly labelled. Cash on Delivery orders become "paid" only once every store part is delivered.
- Seed stores and products come from the project report; prices, stock (50) and photos are placeholders until you edit them in the admin dashboard.
- The Tropika display font is a demo licence - buy the licence (or swap the font) before a real launch.
- The `vendor` role exists in the database for future expansion but has no screens: admins manage everything.
- Guest orders are not attached to an account (a guest who registers later does not see earlier guest orders in history). Guest checkout has no CAPTCHA/rate limit yet - add one before a public launch.
- Deactivating a customer blocks logging in to the site and placing orders; their existing browser session is cut off on the next page load.
