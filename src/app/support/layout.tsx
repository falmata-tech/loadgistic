import { AppShell } from '@/components/app-shell';
import { requireUser } from '@/lib/auth';

export default async function SupportLayout({children}:{children:React.ReactNode}) {
  const user=await requireUser(['SUPPORT','ADMIN'],{allowLimited:true});
  return <AppShell user={{id:user.id,name:user.name,role:user.role}}>{children}</AppShell>;
}
