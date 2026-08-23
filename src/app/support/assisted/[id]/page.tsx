import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {getGuestSupportConversationForTeam} from '@/lib/repository.js';
import {GuestSupportThread} from '@/components/guest-support-thread';

export default async function AssistedMatchingConversation({params}:{params:Promise<{id:string}>}){
  const user=await requireUser(['SUPPORT','ADMIN'],{allowLimited:true});const {id}=await params;
  let conversation;try{conversation=getGuestSupportConversationForTeam(user,id);}catch{notFound();}
  return <div className="page support-page"><GuestSupportThread conversation={conversation} team/></div>;
}
