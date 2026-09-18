import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {getGuestSupportConversationForTeam} from '@/lib/support.js';
import {GuestSupportThread} from '@/components/guest-support-thread';

export default async function AssistedMatchingConversation({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['SUPPORT','ADMIN'],{allowLimited:true});const {id}=await params;
  const query=await searchParams;
  let conversation;try{conversation=await getGuestSupportConversationForTeam(user,id,{beforeMessageId:query.before});}catch{notFound();}
  return <div className="page support-page"><GuestSupportThread conversation={conversation} team/></div>;
}
