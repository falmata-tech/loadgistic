import crypto from 'node:crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [salt, expectedHex] = stored.split(':');
    const actual = await new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,derivedKey)=>error?reject(error):resolve(derivedKey)));
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

export function reviewAccessCode(shipmentId) {
  const digest = crypto.createHmac('sha256', secret()).update(`review:${shipmentId}`).digest('hex').toUpperCase();
  return `LG-RV-${digest.slice(0,4)}-${digest.slice(4,8)}`;
}

export function privateContactDigest(email) {
  return crypto.createHmac('sha256',secret()).update(`private-contact:${String(email||'').trim().toLowerCase()}`).digest('hex');
}

export function sharedCapacityOtpCode(challengeId) {
  const digest=crypto.createHmac('sha256',secret()).update(`shared-capacity-otp:${challengeId}`).digest();
  const value=digest.readUInt32BE(0)%100_000_000;
  return String(value).padStart(8,'0');
}

export function guestSupportAccessCode(conversationId) {
  const digest=crypto.createHmac('sha256',secret()).update(`guest-support:${conversationId}`).digest('hex').toUpperCase();
  return `LG-HELP-${digest.slice(0,4)}-${digest.slice(4,8)}`;
}

export function verifyPrivateAccessCode(expected,value) {
  const actual=Buffer.from(sign(`private-code:${String(value||'').trim().toUpperCase()}`));
  const target=Buffer.from(sign(`private-code:${String(expected||'').trim().toUpperCase()}`));
  return actual.length===target.length&&crypto.timingSafeEqual(actual,target);
}

export function verifyReviewAccessCode(shipmentId,value) {
  const actual=Buffer.from(hashTrackingAccessCode(value));
  const expected=Buffer.from(hashTrackingAccessCode(reviewAccessCode(shipmentId)));
  return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
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
