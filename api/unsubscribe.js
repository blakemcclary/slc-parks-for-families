// GET  /api/unsubscribe?e=<email>&s=<sig>  → asks "Unsubscribe?" with a button
// POST /api/unsubscribe?e=<email>&s=<sig>  → marks the contact unsubscribed
// The GET only shows a page so link scanners in mail clients can't unsubscribe
// people by prefetching it. POST also serves RFC 8058 one-click unsubscribe.
import { normalizeEmail, verifyToken, setContact, siteUrl, maskEmail, requireEnv } from './_lib.js';

export default async function handler(req, res) {
  const { e, s } = req.query || {};
  const email = normalizeEmail(e);
  const site = siteUrl();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');

  let secret;
  try {
    secret = requireEnv('SIGNING_SECRET');
  } catch (err) {
    console.error(err.message);
    return res.redirect(302, `${site}/confirmed.html?status=error`);
  }
  if (!email || !verifyToken('unsub', email, '', '0', s, secret)) {
    return res.redirect(302, `${site}/confirmed.html?status=unsub_invalid`);
  }

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(confirmPage(email));
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  try {
    await setContact(email, true);
  } catch (err) {
    console.error('Unsubscribe failed for', maskEmail(email), err.message);
    return res.redirect(303, `${site}/confirmed.html?status=error`);
  }
  return res.redirect(303, `${site}/confirmed.html?status=unsubscribed`);
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function confirmPage(email) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/>
<title>Unsubscribe · Raised in SLC</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#E0A92E;color:#2B2216;font-family:Arial,Helvetica,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:480px}h1{font-family:Georgia,serif;font-size:2rem;margin:0 0 12px}p{line-height:1.6}
button{font:700 .9rem Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#F3ECD6;background:#C44A2E;border:0;padding:16px 30px;cursor:pointer}</style></head>
<body><main><h1>Leave the list?</h1>
<p>This will unsubscribe <strong>${esc(email)}</strong> from Raised in SLC emails.</p>
<form method="post"><button type="submit">Unsubscribe</button></form></main></body></html>`;
}
