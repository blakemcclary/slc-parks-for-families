// GET /api/confirm?e=<email>&z=<zip>&x=<expiry>&s=<sig>
// Verifies the double opt-in token, adds the confirmed address to the Resend
// Audience, records email + ZIP in the Google Sheet, then redirects to the
// friendly success page.
import { normalizeEmail, normalizeZip, verifyToken, logToSheet, requireEnv } from './_lib.js';

export default async function handler(req, res) {
  const { e, z, x, s } = req.query || {};
  const email = normalizeEmail(e);
  const zip = normalizeZip(z);
  const siteUrl = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');

  const secret = requireEnv('SIGNING_SECRET');
  if (!email || !verifyToken(email, zip, x, s, secret)) {
    return res.redirect(302, `${siteUrl}/confirmed.html?status=invalid`);
  }

  try {
    await addToResendAudience(email);
  } catch (err) {
    console.error('Confirm error (Resend)', err);
    return res.redirect(302, `${siteUrl}/confirmed.html?status=error`);
  }

  // Flip the sheet row to verified (upsert — appends if the subscribe-time
  // write was lost). Non-fatal — they're already on the real Resend list.
  try {
    await logToSheet(email, zip, true);
  } catch (err) {
    console.error('Sheet verify update failed (non-fatal)', err);
  }

  return res.redirect(302, `${siteUrl}/confirmed.html?status=ok`);
}

async function addToResendAudience(email) {
  const apiKey = requireEnv('RESEND_API_KEY');
  const audienceId = requireEnv('RESEND_AUDIENCE_ID');

  const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, unsubscribed: false }),
  });

  // Resend errors when the contact already exists — that's a success from the
  // user's point of view (they clicked the confirm link twice).
  if (!r.ok) {
    const detail = await r.text();
    if (!/already exists/i.test(detail)) {
      throw new Error(`Resend add-contact ${r.status}: ${detail}`);
    }
  }
}
