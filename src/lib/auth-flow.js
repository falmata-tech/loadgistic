export const MANAGED_AUTH_ERROR = 'We could not sign you in. Check your details or try again.';
export const MANAGED_AUTH_UNAVAILABLE = 'Sign in is temporarily unavailable. Please try again shortly.';
export const MANAGED_AUTH_CODE_SENT = 'If this email can sign in, a code has been sent.';

export function localFixturePasswordLoginEnabled(environment = process.env) {
  return environment.NODE_ENV !== 'production'
    && environment.ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN === 'true';
}

export function normalizeManagedAuthEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isNumericEmailOtp(value) {
  return /^\d{6}$/.test(String(value || '').trim());
}

export function managedWorkspaceDestination(role) {
  return role === 'SUPPORT' ? '/support' : '/app/home';
}

export function managedAuthCallbackUrl({ environment = process.env, requestUrl = '' } = {}) {
  const configured = String(environment.APP_URL || '').trim();
  if (environment.NODE_ENV === 'production' && !configured) return null;
  try {
    const origin = new URL(configured || requestUrl);
    if (!new Set(['http:', 'https:']).has(origin.protocol)) return null;
    if (origin.username || origin.password) return null;
    if (environment.NODE_ENV === 'production' && origin.protocol !== 'https:') return null;
    return new URL('/api/auth/callback', origin.origin).toString();
  } catch {
    return null;
  }
}
