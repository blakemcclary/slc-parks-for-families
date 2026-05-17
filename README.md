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

The site is hosted on **GitHub Pages**. Pushes to `main` deploy automatically via the CNAME file pointing to `raisedinslc.org`.

## Key integrations

| Integration | Purpose | Config location |
|---|---|---|
| Google Analytics 4 | Page analytics | GA tag in `<head>` (ID: `G-ZC7HTN3EQ1`) |
| Formspree | Email signup form | Form `action` URL in `#join` section |
| Google Fonts | Fraunces + Nunito typefaces | `<link>` in `<head>` |

## Contact

hello@raisedinslc.org
