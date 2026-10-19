import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { redirect } from 'next/navigation';
import {providerWorkspaceCapabilities} from '@/lib/provider-workspace.js';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(undefined,{allowLimited:true});
  if(user.role==='SUPPORT')redirect('/support');
  const capabilities=providerWorkspaceCapabilities(user);
  const safeUser = {
    id: user.id,
    name: user.name,
    role: user.role,
    active: user.active,
    selected_business_workspace:user.selected_business_workspace,
    business_workspaces:user.business_workspaces,
    owns_provider_account: capabilities.ownsProviderAccount,
    can_manage_fleet: capabilities.canManageFleet,
    drives_truck: capabilities.drivesTruck,
    organization_name: user.organization_name,
    provider_business_name: user.provider_business_name,
    driver_kind:user.driver_kind,
    provider_operating_model:user.provider_operating_model,
    can_browse_load_board:Boolean(user.can_browse_load_board),
    can_contact_businesses:Boolean(user.can_contact_businesses),
    can_negotiate_loads:Boolean(user.can_negotiate_loads),
    can_manage_capacity:Boolean(user.can_manage_capacity),
  };
  return <AppShell user={safeUser}>{children}</AppShell>;
}
