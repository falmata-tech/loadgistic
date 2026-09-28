import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {readTransportChat} from '@/lib/transport-chat';
import {TransportConversation} from '@/components/transport-conversation';
import {Text} from '@/components/localization';
export default async function BrokerageConversation({params}:{params:Promise<{id:string}>}){
 const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});const {id}=await params;
 if(!/^[a-f0-9-]{36}$/.test(id)||user.role!=='ADMIN'&&!user.can_manage_brokerage)notFound();
 let initial;try{initial=await readTransportChat({requestId:id,digest:null,actorId:user.id});}catch(error){if(error instanceof Error&&error.message==='FORBIDDEN')notFound();throw error;}
 return <div className="page brokerage-conversation-page"><Link className="button secondary" href={user.role==='ADMIN'?'/admin/support/transport-requests?view=ALL':'/brokerage?view=ALL'}><Text message="Back to requests"/></Link><h1><Text message="Brokerage conversation"/></h1><TransportConversation endpoint={`/api/brokerage/${id}/messages`} staff canReopen={user.role==='ADMIN'} initial={initial}/></div>;
}
