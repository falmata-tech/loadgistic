import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { getWorkspaceAccess } from '@/lib/repository.js';
import { redirect } from 'next/navigation';
import { TrustSafetyNotice } from '@/components/trust-safety-notice';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(undefined,{allowLimited:true});
  if(user.role==='SUPPORT')redirect('/support');
  const access = getWorkspaceAccess(user);
  const safeUser = {
    id: user.id,
    name: user.name,
    role: user.role,
    organization_name: user.organization_name,
    provider_business_name: user.provider_business_name,
    driver_kind:user.driver_kind,
    can_browse_load_board:Boolean(user.can_browse_load_board),
    can_contact_businesses:Boolean(user.can_contact_businesses),
    can_negotiate_loads:Boolean(user.can_negotiate_loads),
    can_manage_capacity:Boolean(user.can_manage_capacity),
    billing_limited:!access.granted,
    billing_status:access.status
  };
  return <AppShell user={safeUser}><TrustSafetyNotice/>{children}</AppShell>;
}
