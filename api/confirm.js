// GET /api/confirm?e=<email>&z=<zip>&x=<expiry>&s=<sig>
// Verifies the double opt-in token and only then makes the address an active
// Resend Audience contact. Safe to click twice. Redirects to the static
// confirmation page on the main site.
import {
  normalizeEmail,
  normalizeZip,
  verifyToken,
  setContact,
  unsubscribeUrl,
  apiBaseUrl,
  siteUrl,
  maskEmail,
  logToSheet,
  requireEnv,
} from './_lib.js';

export default async function handler(req, res) {
  const { e, z, x, s } = req.query || {};
  const email = normalizeEmail(e);
  const zip = normalizeZip(z);
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
  if (!email || !verifyToken('confirm', email, zip, x, s, secret)) {
    return res.redirect(302, `${site}/confirmed.html?status=invalid`);
  }

  try {
    await setContact(email, false);
  } catch (err) {
    console.error('Confirm failed for', maskEmail(email), err.message);
    return res.redirect(302, `${site}/confirmed.html?status=error`);
  }

  try {
    await logToSheet(email, zip, true);
  } catch (err) {
    console.error('Sheet verify update failed (non-fatal)', err.message);
  }

  // Hand the confirmed page a working unsubscribe link for this address.
  const unsub = unsubscribeUrl(apiBaseUrl(req), email, secret);
  return res.redirect(302, `${site}/confirmed.html?status=ok&unsub=${encodeURIComponent(unsub)}`);
}
