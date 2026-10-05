import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowRight,Phone,Truck} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {listBrokerageRequests} from '@/lib/transport-requests';
import {PageHeader} from './page-header';
import {SupportRefresh} from './support-refresh';
import {Pagination} from './pagination';
import {Text,Localized} from './localization';
import {TransportRequestFollowUp} from './transport-request-follow-up';
import {TransportRequestAssignment} from './transport-request-assignment';
const views=[['ACTIVE','Active chats'],['FOLLOW_UP','Follow-up'],['CLOSED','Resolved'],['ALL','All']] as const;
export async function BrokerageQueue({query,path}:{query:Record<string,string|undefined>;path:string}){
 const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true}),admin=user.role==='ADMIN';
 if(!admin&&!user.can_manage_brokerage)notFound();
 const view=[...views.map(([id])=>id),'NEW','CONTACTED'].includes(query.view||'')?query.view!:'ACTIVE';
 const queues=admin?[['ALL','All requests'],['UNASSIGNED','Unassigned'],['MINE','Mine']]:[['MINE','Mine'],['UNASSIGNED','Unassigned']];
 const queue=queues.some(([id])=>id===query.queue)?query.queue!:admin?'ALL':'MINE';
 const result=await listBrokerageRequests(user,queue,view,query.page);
 const href=(q:string,v:string)=>`${path}?${new URLSearchParams({queue:q,view:v})}`;
 return <div className="page transport-requests-page">
  <SupportRefresh endpoint={`/api/brokerage/updates?${new URLSearchParams({queue,view,page:String(result.page)})}`} intervalMs={5000}/>
  <PageHeader icon={Truck} title={<Text message="Transport requests"/>} subtitle={<Text message="Reply to customers and coordinate transport."/>}/>
  <Localized as="nav" copy={['aria-label']} className="support-tabs" aria-label="Brokerage queues">{queues.map(([id,label])=><Link href={href(id,view)} key={id} className={queue===id?'active':''} aria-current={queue===id?'page':undefined}><Text message={label}/><strong>{result.queues[id as keyof typeof result.queues]}</strong></Link>)}</Localized>
  <Localized as="nav" copy={['aria-label']} className="support-tabs transport-request-tabs" aria-label="Transport request status">{views.map(([id,label])=><Link key={id} href={href(queue,id)} className={view===id?'active':''} aria-current={view===id?'page':undefined}><Text message={label}/><strong>{result.counts[id]}</strong></Link>)}</Localized>
  <section className="transport-request-list">{result.items.map(request=><article className="card transport-request-card" key={request.id} data-request-id={request.id}>
   <header><h2>{request.origin}<ArrowRight aria-hidden="true"/><span className="sr-only"><Text message="To"/></span>{request.destination}</h2><time dateTime={request.created_at}>{new Date(request.created_at).toLocaleString()}</time></header>
   <p><Text message="Assigned to"/>: {request.assigned_agent_name||<Text message="Unassigned"/>}</p>
   {request.phone?<div className="transport-request-contact"><strong>{request.requester_name}</strong><a className="button secondary" href={`tel:${request.phone}`}><Phone aria-hidden="true"/>{request.phone}</a></div>:null}
   {request.chat_enabled?<div className="brokerage-chat-action">{request.status==='CLOSED'?<small><Text message="Resolved"/></small>:request.chat_ended_at||request.chat_expires_at&&Date.parse(request.chat_expires_at)<=Date.now()?<small><Text message="Chat ended · call to follow up"/></small>:null}{request.awaiting_reply?<strong className="transport-chat-awaiting"><Text message="Awaiting reply"/></strong>:null}{admin||request.assigned_agent_user_id===user.id?<Link className="button" href={`/brokerage/${request.id}`}><Text message={request.status==='CLOSED'||request.chat_ended_at||request.chat_expires_at&&Date.parse(request.chat_expires_at)<=Date.now()?'View chat history':'Open conversation'}/></Link>:<small><Text message="Claim this request to reply."/></small>}</div>:<small><Text message="Phone follow-up"/></small>}
   <TransportRequestAssignment id={request.id} version={request.version} assignee={request.assigned_agent_user_id} agents={result.agents} admin={admin} closed={request.status==='CLOSED'}/>
   {request.phone&&(admin||request.assigned_agent_user_id===user.id)?<TransportRequestFollowUp canReopen={admin} request={{id:request.id,status:request.status,version:request.version,follow_up_note:request.follow_up_note||''}}/>:null}
   {request.activity.length?<details className="brokerage-activity"><summary><Text message="Recent activity"/></summary><ol>{request.activity.map(event=><li key={event.id}><strong>{event.actor_name||<Text message="System"/>}</strong> · <Text message={event.status==='NEW'?'New':event.status==='CONTACTED'?'Contacted':'Resolved'}/><br/><Text message="Assigned to"/>: {event.assigned_agent_name||<Text message="Unassigned"/>}<time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>{event.note?<p>{event.note}</p>:null}</li>)}</ol><small><Text message="Latest 10 changes. Earlier history is retained."/></small></details>:null}
  </article>)}</section>
  {!result.items.length?<div className="empty-state"><Truck aria-hidden="true"/><strong><Text message="No transport requests here yet."/></strong>{queue==='MINE'?<Link className="button secondary" href={href('UNASSIGNED','ALL')}><Text message="View unassigned requests"/></Link>:null}</div>:null}
  <Pagination path={path} query={{view,queue}} page={result.page} pageCount={result.pageCount} total={result.total}/>
 </div>;
}
