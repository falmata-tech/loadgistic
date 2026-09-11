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

const LOCAL_TRACKING_CODE_SECRET='local-development-tracking-code-secret-not-for-production';
const CROCKFORD_ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const UNSAFE_TRACKING_CODE_SECRETS=new Set([
  '',LOCAL_TRACKING_CODE_SECRET,'local-development-secret-change-before-production-1234',
  'ci-only-session-secret-not-for-production-123456',
  'ci-only-tracking-code-secret-not-for-production-123456'
]);

export function trackingCodeSecretConfigured(environment=process.env) {
  const value=String(environment.TRACKING_CODE_SECRET||'');
  return value.length>=32&&!UNSAFE_TRACKING_CODE_SECRETS.has(value)&&value!==String(environment.SESSION_SECRET||'');
}

function trackingCodeSecret(environment=process.env) {
  const value=String(environment.TRACKING_CODE_SECRET||'');
  if(environment.NODE_ENV==='production'&&!trackingCodeSecretConfigured(environment))throw new Error('TRACKING_CODE_SECRET_REQUIRED');
  return value||LOCAL_TRACKING_CODE_SECRET;
}

function encodedTrackingToken(scope,shipmentId,environment=process.env) {
  const bytes=crypto.createHmac('sha256',trackingCodeSecret(environment))
    .update(`${scope}:${String(shipmentId||'')}`)
    .digest()
    .subarray(0,10);
  let value=0n;
  for(const byte of bytes)value=(value<<8n)|BigInt(byte);
  let encoded='';
  for(let shift=75n;shift>=0n;shift-=5n)encoded+=CROCKFORD_ALPHABET[Number((value>>shift)&31n)];
  return encoded.match(/.{4}/g).join('-');
}

function normalizedTrackingCode(value) {
  return String(value||'').trim().toUpperCase();
}


function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function trackingAccessCode(shipmentId,environment=process.env) {
  return `LG-${encodedTrackingToken('tracking-owner',shipmentId,environment)}`;
}

export function reviewAccessCode(shipmentId,environment=process.env) {
  return `LG-RV-${encodedTrackingToken('tracking-review',shipmentId,environment)}`;
}

export function privateContactDigest(email) {
  return crypto.createHmac('sha256',secret()).update(`private-contact:${String(email||'').trim().toLowerCase()}`).digest('hex');
}

export function providerTrackingRecipientDigest(email,environment=process.env) {
  return crypto.createHmac('sha256',trackingCodeSecret(environment))
    .update(`tracking-recipient:${String(email||'').trim().toLowerCase()}`)
    .digest('hex');
}

export function sharedCapacityOtpCode(challengeId) {
  const digest=crypto.createHmac('sha256',secret()).update(`shared-capacity-otp:${challengeId}`).digest();
  const value=digest.readUInt32BE(0)%1_000_000;
  return String(value).padStart(6,'0');
}

export function providerTrackingOtpCode(challengeId) {
  const digest=crypto.createHmac('sha256',secret()).update(`provider-tracking-otp:${challengeId}`).digest();
  const value=digest.readUInt32BE(0)%1_000_000;
  return String(value).padStart(6,'0');
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

export function verifyReviewAccessCode(shipmentId,value,environment=process.env) {
  const actual=Buffer.from(hashProviderTrackingCode(value,environment));
  const expected=Buffer.from(hashProviderTrackingCode(reviewAccessCode(shipmentId,environment),environment));
  return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
}

export function hashProviderTrackingCode(value,environment=process.env) {
  return crypto.createHmac('sha256',trackingCodeSecret(environment))
    .update(`tracking-code-digest:${normalizedTrackingCode(value)}`)
    .digest('base64url');
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
