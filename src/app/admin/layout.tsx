import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
export default async function AdminLayout({children}:{children:React.ReactNode}){const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});return <AppShell user={{id:user.id,name:user.name,role:user.role,can_manage_customers:user.can_manage_customers,can_manage_operations:user.can_manage_operations,can_manage_trust:user.can_manage_trust,can_manage_billing:user.can_manage_billing,can_manage_support:user.can_manage_support}}>{children}</AppShell>}
