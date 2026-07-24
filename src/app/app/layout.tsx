import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const safeUser = {
    id: user.id,
    name: user.name,
    role: user.role,
    organization_name: user.organization_name,
    provider_business_name: user.provider_business_name
  };
  return <AppShell user={safeUser}>{children}</AppShell>;
}
