# Raised in SLC

A civic advocacy website for Salt Lake City families. Parent-led, nonpartisan — focused on two issues: parks that work and homes families can afford to own.

**Live site:** [raisedinslc.org](https://raisedinslc.org)

## What it is

A single-page static site (plain HTML/CSS/JS — no build step, no framework) that:

- Makes the case for why SLC is losing families and what needs to change
- Covers two focus areas: parks and attainable homeownership
- Collects email signups via Resend (double opt-in, see below)
- Takes donations through a hosted Stripe Payment Link
- Tracks visits via Google Analytics 4

## Structure

```
index.html     # The main page — layout, styles, and scripts in one file
confirmed.html # Email-confirmation landing page
api/           # Vercel serverless functions (Resend waitlist)
assets/        # Cut-paper illustrations, logo, favicon
CNAME          # Custom domain (raisedinslc.org)
```

All CSS is written inline in `<style>` tags at the top of `index.html`. All JavaScript is inline at the bottom. There are no external dependencies beyond Google Fonts and the GA4 script tag.

## Running locally

No install required. Just open `index.html` in a browser, or serve it with any static file server:

```bash
npx serve .
# or
python3 -m http.server
```

## Deploying

Two hosts, no DNS changes:

- **Static site → GitHub Pages.** `index.html`, `confirmed.html` and `assets/`
  are served from `main` at `raisedinslc.org` (see `CNAME`).
- **Signup API → Vercel** (project `slc-parks-for-families`). Only the `api/`
  functions are used there. The forms call it cross-origin at the address in
  `SIGNUP_API` near the bottom of `index.html`; the functions only accept browser
  calls from `raisedinslc.org` (add more with `ALLOWED_ORIGINS`). Pushes to
  `main` redeploy it once the repo is connected to the Vercel project.

If the Vercel production address changes, update `SIGNUP_API` in `index.html`
and `API_BASE_URL` in Vercel.

## Waitlist signup (Resend, double opt-in)

1. Visitor submits a form → `POST /api/subscribe` checks the honeypot, a
   minimum time on page, a per-IP burst limit and the email/ZIP, then emails a
   confirmation link. The pending signup lives only in that signed link
   (HMAC, expires in 24 hours). Nothing is added to the list yet. An address
   that is already active gets no email and is told it is already on the list.
2. Visitor clicks the link → `GET /api/confirm` verifies it and only then
   creates or reactivates the contact in the **Resend Audience**, then redirects
   to `confirmed.html`, which shows an unsubscribe link. Clicking twice is safe.
3. `GET /api/unsubscribe` shows an "Unsubscribe?" button; the `POST` marks the
   contact unsubscribed. People who unsubscribed must confirm again to rejoin.

The Resend Audience is the subscriber list: no contact = never confirmed,
`unsubscribed: false` = active, `unsubscribed: true` = opted out. Broadcasts
sent from Resend use Resend's own unsubscribe link, which updates the same
contact. Mirroring rows into a Google Sheet is optional (`GOOGLE_SHEET_WEBHOOK_URL`).

Limits of storing state in Resend only: the per-IP limit is per server
instance, not global, and someone can re-request confirmation emails for an
address that hasn't confirmed yet (each is rate-limited per IP).

Required Vercel environment variables (see `.env.example`): `RESEND_API_KEY`,
`RESEND_AUDIENCE_ID`, `SIGNING_SECRET`, `RESEND_FROM`, `API_BASE_URL`.

## Donations

The `Donate` buttons in the header, the homepage give section and the footer all
point at one hosted **Stripe Payment Link**. Stripe hosts the checkout page and
handles the card data, so there is no donation code here — no Stripe.js, no API
keys, no serverless endpoint. To change the amounts, currency or receipt copy,
edit the Payment Link in the Stripe Dashboard; to point the site somewhere else,
update the four `href`s in `index.html`.

Turn on **successful payment receipts** in the Stripe Dashboard (Settings →
Customer emails) so donors are acknowledged automatically.

## Key integrations

| Integration | Purpose | Config location |
|---|---|---|
| Google Analytics 4 | Page analytics | GA tag in `<head>` (ID: `G-ZC7HTN3EQ1`) |
| Resend | Waitlist signup + email confirmation | `api/subscribe.js`, `api/confirm.js` |
| Stripe | Donations via a hosted Payment Link | `index.html` (link only — no keys) |
| Google Fonts | Fraunces + Space Grotesk typefaces | `<link>` in `<head>` |

## Contact

hello@raisedinslc.org
