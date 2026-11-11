// Shared helpers for the waitlist API (no external dependencies).
import crypto from 'node:crypto';

// How long a confirmation link stays valid.
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// The public site lives on GitHub Pages; these functions run on Vercel. Browser
// calls are cross-origin, so only the real site (plus local dev) may call us.
const DEFAULT_ORIGINS = ['https://raisedinslc.org', 'https://www.raisedinslc.org'];

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

// Reasonable email sanity check — not RFC-perfect, just enough to reject junk.
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

// ZIP is optional. Returns '' when blank, the 5 digits when valid, or null when
// something was entered that isn't a 5-digit ZIP (so the caller can reject it).
export function parseZip(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return /^\d{5}$/.test(s) ? s : null;
}

// Lenient form for values that come back inside our own signed links.
export function normalizeZip(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 5);
}

// Stateless signed tokens. The purpose is part of the MAC so a confirm token
// can never be replayed as an unsubscribe token (or vice versa). The pending
// signup lives entirely in the confirm link: nothing is activated until a valid,
// unexpired link comes back.
export function signToken(purpose, email, zip, expiry, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${purpose}.${email}.${zip}.${expiry}`)
    .digest('base64url');
}

export function verifyToken(purpose, email, zip, expiry, sig, secret) {
  // expiry "0" means no expiry (unsubscribe links must keep working).
  const expNum = Number(expiry);
  if (!Number.isFinite(expNum) || (expNum !== 0 && Date.now() > expNum)) return false;
  const expected = Buffer.from(signToken(purpose, email, zip, String(expiry), secret));
  const given = Buffer.from(String(sig || ''));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function confirmUrl(apiBase, email, zip, secret) {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const s = signToken('confirm', email, zip, String(expiry), secret);
  return `${apiBase}/api/confirm?e=${encodeURIComponent(email)}&z=${encodeURIComponent(zip)}` +
    `&x=${expiry}&s=${encodeURIComponent(s)}`;
}

export function unsubscribeUrl(apiBase, email, secret) {
  const s = signToken('unsub', email, '', '0', secret);
  return `${apiBase}/api/unsubscribe?e=${encodeURIComponent(email)}&s=${encodeURIComponent(s)}`;
}

// Fail loudly at request time if the deploy is missing configuration.
export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// Where the static pages live (GitHub Pages). Redirect targets only.
export function siteUrl() {
  return (process.env.SITE_URL || 'https://raisedinslc.org').replace(/\/$/, '');
}

// Where these functions live (Vercel). Used to build confirm/unsubscribe links.
export function apiBaseUrl(req) {
  return (process.env.API_BASE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
}

function allowedOrigins() {
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...extra]);
}

// Sets CORS headers. Returns false when a browser call comes from an origin we
// don't serve, which blocks drive-by posts from other sites.
export function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (!origin) return true; // same-origin or non-browser request
  if (!allowedOrigins().has(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  return true;
}

// Best-effort per-IP throttle. Serverless instances don't share memory, so this
// only slows a single burst; the honeypot, origin check and the "one email per
// address while pending" rule do the rest. A shared store (e.g. Upstash) would
// be needed for a hard global limit.
const hits = new Map();
export function rateLimited(ip, limit = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > limit;
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress || 'unknown';
}

// ---- Resend Audience contacts (the subscriber list) -------------------------
// Status lives on the contact: missing = never confirmed, unsubscribed:false =
// active, unsubscribed:true = opted out. Unconfirmed signups are never written
// here, so nothing becomes active without a confirmation click.

async function resend(path, init = {}) {
  const r = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { ok: r.ok, status: r.status, body };
}

function contactsPath(email) {
  const base = `/audiences/${encodeURIComponent(requireEnv('RESEND_AUDIENCE_ID'))}/contacts`;
  return email ? `${base}/${encodeURIComponent(email)}` : base;
}

// Returns 'active' | 'unsubscribed' | 'none'.
export async function getContactStatus(email) {
  const r = await resend(contactsPath(email));
  if (r.status === 404) return 'none';
  if (!r.ok) throw new Error(`Resend get-contact ${r.status}`);
  return r.body?.unsubscribed ? 'unsubscribed' : 'active';
}

// Idempotent: creates the contact, or flips an existing one, to the given state.
export async function setContact(email, unsubscribed) {
  const upd = await resend(contactsPath(email), {
    method: 'PATCH',
    body: JSON.stringify({ unsubscribed }),
  });
  if (upd.ok) return;
  if (upd.status !== 404) throw new Error(`Resend update-contact ${upd.status}`);
  if (unsubscribed) return; // nobody to unsubscribe
  const add = await resend(contactsPath(), {
    method: 'POST',
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (!add.ok && !/already exists/i.test(JSON.stringify(add.body))) {
    throw new Error(`Resend add-contact ${add.status}`);
  }
}

export async function sendEmail(payload) {
  const r = await resend('/emails', { method: 'POST', body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(`Resend send ${r.status}: ${r.body?.name || r.body?.message || ''}`);
}

// Logs never carry full addresses.
export function maskEmail(email) {
  const [u, d] = String(email).split('@');
  return `${(u || '').slice(0, 2)}***@${d || ''}`;
}

// Optional mirror of signups into the Google Sheet (email + zip + verified).
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
  if (!r.ok) throw new Error(`Sheet webhook ${r.status}`);
}
