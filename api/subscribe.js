// POST /api/subscribe  { email }
// Validates the address, then emails a double opt-in confirmation link.
// Nothing is stored here — the address only lands in the list after it's confirmed.
import {
  TOKEN_TTL_MS,
  normalizeEmail,
  normalizeZip,
  isValidEmail,
  signToken,
  logToSheet,
  requireEnv,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};

  // Honeypot: real users leave this hidden field blank; bots tend to fill it.
  if (body.company) return res.status(200).json({ ok: true });

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }
  const zip = normalizeZip(body.zip);

  const secret = requireEnv('SIGNING_SECRET');
  const apiKey = requireEnv('RESEND_API_KEY');
  const siteUrl = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
  const from = process.env.RESEND_FROM || 'Raised in SLC <onboarding@resend.dev>';

  // Capture the lead immediately as unverified, so we keep people who sign up
  // but never click the confirmation link. Non-fatal — don't block the email.
  try {
    await logToSheet(email, zip, false);
  } catch (err) {
    console.error('Sheet append (unverified) failed', err);
  }

  const expiry = Date.now() + TOKEN_TTL_MS;
  const sig = signToken(email, zip, String(expiry), secret);
  const confirmUrl =
    `${siteUrl}/api/confirm?e=${encodeURIComponent(email)}` +
    `&z=${encodeURIComponent(zip)}&x=${expiry}&s=${encodeURIComponent(sig)}`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Confirm your spot with Raised in SLC',
        // Email images must be publicly reachable — always the production
        // domain, never the (SSO-protected) preview host.
        html: confirmationEmail(confirmUrl, process.env.PUBLIC_ASSET_URL || 'https://raisedinslc.org'),
        text:
          `Thanks for joining Raised in SLC!\n\n` +
          `Please confirm your email to finish signing up:\n${confirmUrl}\n\n` +
          `This link expires in 24 hours. If you didn't request this, you can ignore it.`,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('Resend send failed', r.status, detail);
      return res.status(502).json({ ok: false, error: 'send_failed' });
    }
  } catch (err) {
    console.error('Resend request error', err);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }

  return res.status(200).json({ ok: true });
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

// On-brand "campaign poster" email (playground decision 2026-07-14-confirm-email,
// option A revised): full-bleed mustard field, quiet paper chip, plain-ink
// headline so the terra CTA is the only loud element, duck march on the brown
// footer strip. Email-client-safe: tables + inline styles, offset shadows faked
// with borders, Georgia as the serif fallback, absolute PNG asset URLs.
function confirmationEmail(url, siteUrl) {
  const assets = `${siteUrl}/assets/email`;
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#E0A92E;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E0A92E" style="background-color:#E0A92E;">
    <tr>
      <td align="center" style="padding:44px 24px 0;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">
          <tr>
            <td align="left" style="padding-bottom:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#F3ECD6" style="background-color:#F3ECD6;padding:9px 18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:3px;color:#43301F;border-right:4px solid #C0902A;border-bottom:4px solid #C0902A;">
                    ONE LAST STEP
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="left" style="font-family:Georgia,'Times New Roman',serif;font-weight:900;font-size:40px;line-height:1.15;color:#2B2216;padding-bottom:22px;">
              Confirm your email.
            </td>
          </tr>
          <tr>
            <td align="left" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:#43301F;padding-bottom:34px;">
              Thanks for joining <strong>Raised in SLC</strong>. We're parents pushing for parks worth showing up to and homes families can own. Click below and you're on the list.
            </td>
          </tr>
          <tr>
            <td align="left" style="padding-bottom:26px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#C44A2E" style="background-color:#C44A2E;border-right:6px solid #43301F;border-bottom:6px solid #43301F;">
                    <a href="${url}" style="display:inline-block;padding:18px 36px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:1px;color:#F3ECD6;text-decoration:none;text-transform:uppercase;">
                      Confirm my email &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="left" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6E5A3A;">
              This link expires in 24 hours. Didn't sign up? Ignore this email and nothing happens.<br/>
              No spam. No party politics. Just parents who want SLC to work for kids.
            </td>
          </tr>
          <tr>
            <td align="left" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#8A7346;padding-top:14px;word-break:break-all;">
              Button not working? Paste this into your browser:<br/>${url}
            </td>
          </tr>
          <tr>
            <td align="right" style="padding:30px 0 0;vertical-align:bottom;">
              <img src="${assets}/duckling-3.png" width="34" alt="" style="display:inline-block;vertical-align:bottom;margin-right:14px;border:0;"/>
              <img src="${assets}/duckling-2.png" width="40" alt="" style="display:inline-block;vertical-align:bottom;margin-right:14px;border:0;"/>
              <img src="${assets}/duckling-1.png" width="46" alt="" style="display:inline-block;vertical-align:bottom;margin-right:14px;border:0;"/>
              <img src="${assets}/duck-mama.png" width="96" alt="A cut-paper mama duck leading her ducklings" style="display:inline-block;vertical-align:bottom;border:0;"/>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td bgcolor="#43301F" style="background-color:#43301F;padding:16px 24px;" align="center">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#EFE6CE;text-transform:uppercase;">Raised in SLC &middot; Parent-led &middot; Nonpartisan</span>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
