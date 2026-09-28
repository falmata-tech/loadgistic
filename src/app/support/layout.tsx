import { AppShell } from '@/components/app-shell';
import { requireUser } from '@/lib/auth';

export default async function SupportLayout({children}:{children:React.ReactNode}) {
  const user=await requireUser(['SUPPORT','ADMIN'],{allowLimited:true});
  return <AppShell user={{id:user.id,name:user.name,role:user.role,can_manage_support:user.can_manage_support,can_manage_brokerage:user.can_manage_brokerage,can_manage_featured:user.can_manage_featured,can_manage_customers:user.can_manage_customers,can_manage_operations:user.can_manage_operations,can_manage_trust:user.can_manage_trust,can_manage_billing:user.can_manage_billing}}>{children}</AppShell>;
}
