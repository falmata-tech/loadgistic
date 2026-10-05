import {GuestSupportAssignment} from '@/components/guest-support-assignment';
import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {getGuestSupportConversationForTeam,listSupportAgents} from '@/lib/support.js';
import {GuestSupportThread} from '@/components/guest-support-thread';

export default async function AssistedMatchingConversation({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['SUPPORT','ADMIN'],{allowLimited:true});const {id}=await params;
  const query=await searchParams;
  let conversation;try{conversation=await getGuestSupportConversationForTeam(user,id,{beforeMessageId:query.before});}catch{notFound();}
  const agents=user.role==='ADMIN'&&conversation.status!=='CLOSED'?await listSupportAgents(user,{pageSize:50}):null;
  return <div className="page support-page">{agents?<GuestSupportAssignment id={id} assignee={conversation.assigned_agent_user_id} agents={agents.items.filter((a:{active:boolean;available:boolean;can_manage_support:boolean})=>a.active&&a.available&&a.can_manage_support)}/>:null}<GuestSupportThread conversation={conversation} team/></div>;
}
