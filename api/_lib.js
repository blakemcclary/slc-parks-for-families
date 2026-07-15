// Shared helpers for the waitlist API (no external dependencies).
import crypto from 'node:crypto';

// How long a confirmation link stays valid.
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

// Reasonable email sanity check — not RFC-perfect, just enough to reject junk.
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Digits-only ZIP, capped at 5 chars. Empty string if absent/invalid.
export function normalizeZip(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 5);
}

// Stateless double opt-in token: HMAC over "email.zip.expiry" with a server
// secret. No database needed — the link proves the address was reachable and
// that neither the email nor the ZIP was tampered with in transit.
export function signToken(email, zip, expiry, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${email}.${zip}.${expiry}`)
    .digest('base64url');
}

export function verifyToken(email, zip, expiry, sig, secret) {
  const expNum = Number(expiry);
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false;
  const expected = signToken(email, zip, String(expiry), secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Fail loudly at request time if the deploy is missing configuration.
export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// Upsert a signup into the Google Sheet (email + zip + verified flag).
// The Apps Script dedupes by email, so calling this at subscribe time
// (verified:false) and again at confirm time (verified:true) updates one row.
// No-op if the webhook isn't configured; throws on a webhook error so callers
// can decide whether it's fatal.
export async function logToSheet(email, zip, verified) {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) return;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.SHEET_SECRET || '',
      email,
      zip,
      verified: !!verified,
    }),
  });
  if (!r.ok) throw new Error(`Sheet webhook ${r.status}: ${await r.text()}`);
}
