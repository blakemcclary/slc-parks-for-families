// POST /api/subscribe  { email, zip?, company (honeypot), t (ms on page) }
// Validates input, then emails a double opt-in confirmation link through Resend.
// Nothing is activated here: the address only joins the list once the signed,
// expiring link in that email is clicked (see confirm.js).
import {
  normalizeEmail,
  parseZip,
  isValidEmail,
  confirmUrl,
  apiBaseUrl,
  applyCors,
  rateLimited,
  clientIp,
  getContactStatus,
  sendEmail,
  maskEmail,
  logToSheet,
  requireEnv,
} from './_lib.js';

export default async function handler(req, res) {
  if (!applyCors(req, res)) {
    return res.status(403).json({ ok: false, error: 'forbidden_origin' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};

  // Bot traps: real users leave the hidden field blank and take more than a
  // moment to fill the form. Pretend success so bots learn nothing.
  if (body.company) return res.status(200).json({ ok: true, status: 'pending' });
  if (body.t !== undefined && Number(body.t) < 800) {
    return res.status(200).json({ ok: true, status: 'pending' });
  }

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }
  const zip = parseZip(body.zip);
  if (zip === null) {
    return res.status(400).json({ ok: false, error: 'invalid_zip' });
  }

  let secret, from;
  try {
    secret = requireEnv('SIGNING_SECRET');
    requireEnv('RESEND_API_KEY');
    requireEnv('RESEND_AUDIENCE_ID');
    from = requireEnv('RESEND_FROM');
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  }

  // Already confirmed and active: don't send another email.
  try {
    if ((await getContactStatus(email)) === 'active') {
      return res.status(200).json({ ok: true, status: 'already_subscribed' });
    }
  } catch (err) {
    console.error('Contact lookup failed', err.message);
    return res.status(502).json({ ok: false, error: 'upstream_error' });
  }

  // Optional unverified mirror in the Google Sheet. Non-fatal.
  try {
    await logToSheet(email, zip, false);
  } catch (err) {
    console.error('Sheet append (unverified) failed', err.message);
  }

  const link = confirmUrl(apiBaseUrl(req), email, zip, secret);
  try {
    await sendEmail({
      from,
      to: email,
      subject: 'Confirm your spot with Raised in SLC',
      // Email images must be publicly reachable: always the production domain.
      html: confirmationEmail(link, process.env.PUBLIC_ASSET_URL || 'https://raisedinslc.org'),
      text:
        `Thanks for joining Raised in SLC!\n\n` +
        `Please confirm your email to finish signing up:\n${link}\n\n` +
        `This link expires in 24 hours. If you didn't request this, you can ignore it.`,
    });
  } catch (err) {
    console.error('Confirmation send failed for', maskEmail(email), err.message);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }

  return res.status(200).json({ ok: true, status: 'pending' });
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
