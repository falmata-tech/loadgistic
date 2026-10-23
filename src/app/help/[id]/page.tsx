import {notFound} from 'next/navigation';
import {PublicHeader} from '@/components/public-header';
import {GuestSupportThread} from '@/components/guest-support-thread';
import {getGuestSupportSession} from '@/lib/auth';
import {getGuestSupportConversationForGuest} from '@/lib/support.js';

export const dynamic='force-dynamic';
export default async function GuestHelpConversationPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {id}=await params;const session=await getGuestSupportSession(id);if(!session)notFound();
  const query=await searchParams;
  let conversation;try{conversation=await getGuestSupportConversationForGuest(id,session.emailDigest,{beforeMessageId:query.before});}catch{notFound();}
  return <><PublicHeader/><main className="public-app-page guest-support-workspace"><div className="container"><GuestSupportThread conversation={conversation}/></div></main></>;
}
