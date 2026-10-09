export type AccountSession = {
  accessToken: string; refreshToken: string; expiresAt: number;
  state: 'ACTIVE' | 'JOIN_FLEET' | 'ONBOARDING';
  user: { id: string; name: string; email: string; role: string; organizationName: string | null; businessName: string | null; operatingModel?: string | null; review?:true };
  access: { granted: boolean; status: string } | null;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid sign-in response');
  return value as Record<string, unknown>;
};
const text = (value: unknown, max = 8192): string => {
  if (typeof value !== 'string' || !value.length || value.length > max) throw new Error('Invalid sign-in response');
  return value;
};
const optional = (value: unknown) => value === null ? null : text(value, 200);
export function parseSession(value: unknown): AccountSession {
  const data = record(value), user = record(data.user);
  const state = text(data.state), role = text(user.role);
  if (!['ACTIVE', 'JOIN_FLEET', 'ONBOARDING'].includes(state) || ['ADMIN', 'SUPPORT'].includes(role) || (state === 'ACTIVE' && !['DRIVER', 'TRANSPORTER'].includes(role))) throw new Error('Invalid sign-in response');
  if (typeof data.expiresAt !== 'number' || !Number.isFinite(data.expiresAt) || data.expiresAt <= 0) throw new Error('Invalid sign-in response');
  const access = state === 'ACTIVE' ? record(data.access) : null;
  if (access && (typeof access.granted !== 'boolean' || typeof access.status !== 'string')) throw new Error('Invalid sign-in response');
  return {
    accessToken: text(data.accessToken), refreshToken: text(data.refreshToken), expiresAt: data.expiresAt,
    state: state as AccountSession['state'],
    user: { id: text(user.id, 128), name: text(user.name, 200), email: text(user.email, 254), role, organizationName: optional(user.organizationName), businessName: optional(user.businessName), operatingModel: ['COMPANY_DRIVER','OWNER_OPERATOR','SELF_MANAGED_DRIVER','FLEET_TRANSPORTER'].includes(String(user.operatingModel)) ? String(user.operatingModel) : null,...(user.review===true?{review:true as const}:{}) },
    access: access ? { granted: access.granted as boolean, status: access.status as string } : null,
  };
}
