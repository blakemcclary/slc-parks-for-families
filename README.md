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

Hosted on **Vercel** (project `slc-parks-for-families`). The static `index.html`
is served as-is and the `api/` folder runs as serverless functions. Pushes to
`main` deploy automatically once the GitHub repo is connected to the Vercel
project and DNS for `raisedinslc.org` points at Vercel.

## Waitlist signup (Resend, double opt-in)

Email signup uses a two-step confirmation to keep spam out of the list:

1. Visitor submits the form → `POST /api/subscribe` validates the address and
   emails a confirmation link (a stateless HMAC token — no database needed).
2. Visitor clicks the link → `GET /api/confirm` verifies the token and adds the
   address to a **Resend Audience** (the confirmed waitlist), then redirects to
   `confirmed.html`.

A hidden honeypot field (`company`) on each form catches basic bots.

Required environment variables (see `.env.example`): `RESEND_API_KEY`,
`RESEND_AUDIENCE_ID`, `SIGNING_SECRET`, `RESEND_FROM`.

> Sending to real signups requires a **verified sending domain** in Resend
> (DKIM/SPF DNS records at the domain's DNS provider). Until then Resend's
> `onboarding@resend.dev` only delivers to the account owner's own address.

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
