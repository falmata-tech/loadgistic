import Link from 'next/link';
import {Inbox} from 'lucide-react';
import {listTransportRequests} from '@/lib/transport-requests';
import {Text} from './localization';
export async function TransportRequestQueueSummary({actor}:{actor:{id:string}}){
 const first=await listTransportRequests(actor,'NEW',1);
 const last=first.pageCount>1?await listTransportRequests(actor,'NEW',first.pageCount):first;
 const oldest=last.items.at(-1)?.created_at;
 return <aside className="card callback-queue-summary"><Link className="button" href="/brokerage?view=ALL&queue=ALL"><Inbox aria-hidden="true"/><Text message="Transport requests"/></Link><div><strong><Text message="New requests: {count}" values={{count:first.total}}/></strong>{oldest?<span><Text message="Oldest request: {time}" values={{time:new Date(oldest).toLocaleString()}}/></span>:<span><Text message="No new requests."/></span>}</div></aside>;
}
