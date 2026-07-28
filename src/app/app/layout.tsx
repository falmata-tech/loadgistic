import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
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
    can_manage_capacity:Boolean(user.can_manage_capacity)
  };
  return <AppShell user={safeUser}>{children}</AppShell>;
}
