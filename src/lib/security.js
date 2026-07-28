import crypto from 'node:crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [salt, expectedHex] = stored.split(':');
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function secret() {
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET_REQUIRED');
  return process.env.SESSION_SECRET || 'local-development-secret-change-before-production-1234';
}


function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function trackingAccessCode(shipmentId) {
  const digest = crypto.createHmac('sha256', secret()).update(`tracking:${shipmentId}`).digest('hex').toUpperCase();
  return `LG-${digest.slice(0,4)}-${digest.slice(4,8)}`;
}

export function hashTrackingAccessCode(value) {
  return sign(`tracking-code:${String(value || '').trim().toUpperCase()}`);
}

export function createSessionToken(userId, maxAgeSeconds = 60 * 60 * 12) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.sub || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function randomId(prefix = '') {
  return `${prefix}${crypto.randomUUID()}`;
}

export function randomCode(prefix = 'LGX') {
  const part = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${part}`;
}
