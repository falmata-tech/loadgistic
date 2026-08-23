import Link from 'next/link';
import { ArrowLeft, Headphones } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getSupportConversation } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { SupportThread } from '@/components/support-thread';

export default async function SupportConversationPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['SUPPORT','ADMIN'],{allowLimited:true});
  const {id}=await params;
  const query=await searchParams;
  const conversation:any=await getSupportConversation(user,id);
  return <div className="page support-page">
    <PageHeader icon={Headphones} title={conversation.customer_name} subtitle={`${conversation.customer_workspace_name} · ${conversation.customer_role.replaceAll('_',' ')}`} action={<Link className="button secondary" href={user.role==='ADMIN'?'/admin/support':'/support'}><ArrowLeft aria-hidden="true"/>Inbox</Link>}/>
    <Flash error={query.error} success={query.success}/>
    <SupportThread conversation={conversation} user={user} canClose/>
  </div>;
}
