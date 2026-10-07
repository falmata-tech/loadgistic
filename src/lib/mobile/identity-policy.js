export function mobileBearer(header) {
  if (typeof header !== 'string' || header.length > 8192) return null;
  const match = header.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  return match ? match[1] : null;
}
export function mobileAccountState(user, authId, { canJoin = false, canSignUp = false } = {}) {
  if (!user || user.id !== authId) return 'DENIED';
  if (['ADMIN', 'SUPPORT'].includes(user.role)) return 'WEB_ONLY';
  if (user.active) return ['TRANSPORTER', 'DRIVER'].includes(user.role) ? 'ACTIVE' : 'DENIED';
  if (canJoin) return 'JOIN_FLEET';
  if (canSignUp) return 'ONBOARDING';
  return 'DENIED';
}
export function mobileIdentity(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role,
    organizationName: user.organization_name || null,
    businessName: user.provider_business_name || null,
    operatingModel: user.provider_operating_model || null };
}
