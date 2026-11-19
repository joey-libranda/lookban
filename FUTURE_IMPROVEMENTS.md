# LOOKBAN: Future Improvements

Things we deliberately left out of the school-project version. Each one is a real feature or safeguard that a live marketplace would need.

## Accounts

1. **Change email address, with confirmation.** Today the email is the login and is read-only in My Account. A safe change needs a confirmation link sent to the new address (and a notice to the old one) before the login changes. Deferred because the vendor logins use made-up addresses and the project has no real email sending yet.
2. **Multiple saved delivery addresses.** Customers have one saved address. Later: a list with a default, plus labels like "Home" and "Office".
3. **Email notification preferences.** Order updates and promotions are not emailed yet, so there is nothing to opt in or out of.
4. **Unique per-seller passwords and real vendor emails.** The vendor accounts created by `npm run vendors:create` share the demo password `Password123` and made-up `@lookban.com` emails. Before going live, give each store its own password (or a set-your-password email link) and the owner's real email.

## Security hardening

5. **Rate limiting and CAPTCHA** on guest checkout, the contact form, order tracking, login and registration.
6. **Stricter Content-Security-Policy** (the current one is intentionally loose so images and fonts load everywhere).
7. **Independent penetration test** and a full test of photo and document uploads against a live Supabase project.

## Orders and money

8. **Real payment and refund integration.** Online payment, refunds and commission settlement are records only; no money moves.
9. **Real email sending**: order confirmations, status updates and replies to Contact messages (replies are saved but not emailed).

## Store applications

10. **Permit expiry reminders.** Expiring and expired permits are flagged on the vendor dashboard and the admin store page, but nobody is emailed and stores are never suspended automatically. Add email reminders (30 and 7 days before) and an optional auto-suspend once real email exists.
11. **Document history.** Old files replaced by an approved update are kept in storage but not listed anywhere; add a viewable history per store.

## Returns and refunds

12. **Guest returns.** Return requests need a signed-in customer; guest orders (tracking link) cannot send one yet.
13. **Refund payments and email.** Refunds are recorded with a reference but the money is sent outside LOOKBAN, and nobody is emailed about decisions.
14. **Automatic restocking and partial offers.** Stock is not restored when a return is approved, and a store cannot approve only some of the items or a different amount.
15. **Return window setting screen.** The window (`return_window_days`, default 3) lives in the settings table; add a field for it in Admin Settings.
