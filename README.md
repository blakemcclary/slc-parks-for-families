# Raised in SLC

A civic advocacy website for Salt Lake City families. Parent-led, nonpartisan — focused on two issues: parks that work and homes families can afford to own.

**Live site:** [raisedinslc.org](https://raisedinslc.org)

## What it is

A single-page static site (plain HTML/CSS/JS — no build step, no framework) that:

- Makes the case for why SLC is losing families and what needs to change
- Covers two focus areas: parks and attainable homeownership
- Collects email signups via [Formspree](https://formspree.io)
- Tracks visits via Google Analytics 4

## Structure

```
index.html   # Everything — layout, styles, and scripts in one file
favicon.svg  # Mountain SVG favicon
CNAME        # GitHub Pages custom domain (raisedinslc.org)
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

## Key integrations

| Integration | Purpose | Config location |
|---|---|---|
| Google Analytics 4 | Page analytics | GA tag in `<head>` (ID: `G-ZC7HTN3EQ1`) |
| Resend | Waitlist signup + email confirmation | `api/subscribe.js`, `api/confirm.js` |
| Google Fonts | Fraunces + Space Grotesk typefaces | `<link>` in `<head>` |

## Contact

hello@raisedinslc.org
