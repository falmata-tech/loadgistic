import {providerWorkspaceCapabilities} from '../provider-workspace.js';

// Effective workspace is presentation/routing only. Every business command
// revalidates membership in PostgreSQL; stored profile roles confer no access.
export function withBusinessContext(user, context) {
  const platformRole = user.platform_role || user.role;
  const base = {...user, role:platformRole, platform_role:platformRole};
  const providerAvailable = Boolean(user.active && ['TRANSPORTER','DRIVER'].includes(platformRole)
    && (user.organization_id || user.provider_profile_id || user.employer_provider_profile_id));
  const empty = {...base, provider_workspace_available:providerAvailable,
    business_workspace_eligible:false, business_workspaces:[], business_invitations:[], selected_business_workspace:null};
  if (['ADMIN','SUPPORT'].includes(platformRole) || !context) return empty;
  if (context.actorId !== user.id || !Array.isArray(context.workspaces) || !Array.isArray(context.invitations)
    || context.workspaces.some(item => item.actorId !== user.id || item.actorRole !== 'CUSTOMER')
    || context.selectedWorkspaceId && !context.workspaces.some(item => item.id === context.selectedWorkspaceId)) {
    throw new Error('MANAGED_BUSINESS_CONTEXT_FAILED');
  }
  const selected = user.active ? context.workspaces.find(item => item.id === context.selectedWorkspaceId) || null : null;
  return {...empty, role:selected ? 'CUSTOMER' : platformRole, business_workspace_eligible:true,
    business_workspaces:context.workspaces, business_invitations:context.invitations,
    selected_business_workspace:selected};
}

export function managedBusinessContext(user) {
  const selected = user?.selected_business_workspace;
  return user?.active === true && user?.role === 'CUSTOMER'
    && !['ADMIN','SUPPORT'].includes(user.platform_role)
    && selected?.actorId === user.id && selected?.actorRole === 'CUSTOMER'
    && user.business_workspaces?.some(item => item.id === selected.id && item.membershipRevision === selected.membershipRevision)
    ? selected : null;
}

export function mobileBusinessContext(user) {
  const selected = managedBusinessContext(user);
  // Provider capabilities are computed from the effective role. They must be
  // absent in a customer context even when the person also owns a provider.
  return {platformRole:user.platform_role || user.role,
    providerWorkspaceAvailable:user.provider_workspace_available === true,
    businessWorkspaceEligible:user.business_workspace_eligible === true,
    businessWorkspaces:user.business_workspaces || [], businessInvitations:user.business_invitations || [],
    selectedBusinessWorkspace:selected, ...providerWorkspaceCapabilities(user)};
}
