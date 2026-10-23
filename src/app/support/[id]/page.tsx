
import {Text} from '@/components/localization';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import { ArrowLeft, Headphones } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getSupportConversation } from '@/lib/support.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { SupportThread } from '@/components/support-thread';
import {supportConversationReturnPath} from '@/lib/team-navigation.js';

export default async function SupportConversationPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['SUPPORT','ADMIN'],{allowLimited:true});
  const {id}=await params;
  const query=await searchParams;
  const returnTo=supportConversationReturnPath(query.returnTo,user.role);
  let conversation:any;
  try{conversation=await getSupportConversation(user,id,{beforeMessageId:query.before});}
  catch(error){if(['NOT_FOUND','INVALID_SUPPORT_CURSOR'].includes(String((error as Error)?.message)))notFound();throw error;}
  return <div className="page support-page">
    <PageHeader icon={Headphones} title={conversation.customer_name} subtitle={conversation.customer_workspace_name} action={<Link className="button secondary" href={returnTo}><ArrowLeft aria-hidden="true"/><Text message={returnTo.startsWith('/admin/operations/users/')?'Account':'Inbox'}/></Link>}/>
    <Flash error={query.error} success={query.success}/>
    <SupportThread conversation={conversation} user={user} canClose returnTo={returnTo}/>
  </div>;
}
