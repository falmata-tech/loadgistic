import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
export default async function AdminLayout({children}:{children:React.ReactNode}){const user=await requireUser(['ADMIN']);return <AppShell user={{id:user.id,name:user.name,role:user.role}}>{children}</AppShell>}
