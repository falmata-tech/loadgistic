
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import { CheckCircle2, Clock3, Headphones, Inbox, PauseCircle, PlayCircle, UserCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listSupportInbox } from '@/lib/support.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { Pagination } from '@/components/pagination';
import { StatusPill } from '@/components/status-pill';
import { SupportRefresh } from '@/components/support-refresh';
import {teamQueuePath,teamConversationHref} from '@/lib/team-navigation.js';
import {supportRevisionTag} from '@/lib/support-polling.js';

const views=[
  {id:'ASSIGNED',label:'Mine',icon:UserCheck,count:'assigned'},
  {id:'WAITING',label:'Waiting',icon:Clock3,count:'waiting'},
  {id:'CLOSED',label:'Closed',icon:CheckCircle2,count:'closed'}
] as const;

export default async function SupportInboxPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['SUPPORT'],{allowLimited:true});
  if(!user.can_manage_support){if(user.can_manage_featured)redirect('/admin/featured');if(user.can_manage_customers||user.can_manage_operations)redirect('/admin/operations');if(user.can_manage_trust)redirect('/admin/reviews');redirect('/app/more');}
  const query=await searchParams;
  const requested=String(query.view||'ASSIGNED').toUpperCase();
  const view=views.some(item=>item.id===requested)?requested:'ASSIGNED';
  const result:any=await listSupportInbox(user,view,{page:query.page,pageSize:15});
  const available=Boolean(result.agent?.available);
  const returnTo=teamQueuePath('support',user.role,{view,page:result.page});

  return <div className="page support-page">
    <SupportRefresh endpoint={`/api/support/updates?view=${view}&page=${result.page}`} initialRevision={supportRevisionTag(result)}/>
    <PageHeader icon={Headphones} title={<Text message="Provider support"/>} action={<form action="/api/support/availability" method="post"><input type="hidden" name="returnTo" value={returnTo}/>{!available?<input type="hidden" name="available" value="on"/>:null}<Localized as="button" copy={['title']} className={`button ${available?'secondary':''}`} title={available?'Pause new assignments':'Take new conversations'}>{available?<><PauseCircle aria-hidden="true"/><Text message="Pause"/></>:<><PlayCircle aria-hidden="true"/><Text message="Go available"/></>}</Localized></form>}/>
    <Flash error={query.error} success={query.success}/>
    <section className="support-agent-strip">
      <span className={`live-dot ${available?'':'off'}`} aria-hidden="true"/>
      <div><strong>{available?<Text message="Available"/>:<Text message="Paused"/>}</strong><small>{result.agent.open_count}<Text message=" of "/>{result.agent.max_open_conversations}<Text message=" assigned"/></small></div>
    </section>
    <Localized as="nav" copy={["aria-label"]} className="support-tabs" aria-label="Support queue">
      {views.map(item=>{const Icon=item.icon;return <Link className={view===item.id?'active':''} href={`/support?view=${item.id}`} key={item.id}><Icon aria-hidden="true"/><span>{item.label}</span><strong>{result.counts[item.count]}</strong></Link>;})}
    </Localized>
    <section className="support-conversation-list">
      {result.items.map((item:any)=><article key={item.id}>
        {item.status==='WAITING'?<div className="support-conversation-main">
          <span className="support-avatar">{item.customer_name.split(' ').slice(0,2).map((part:string)=>part[0]).join('')}</span>
          <span><strong>{item.customer_name}</strong><small>{item.customer_workspace_name} · {item.customer_role.replaceAll('_',' ')}</small><small>{item.category.replaceAll('_',' ')} · {new Date(item.last_message_at).toLocaleString()}</small></span>
        </div>:<Link className="support-conversation-main" href={teamConversationHref('support',item.id,returnTo)}>
          <span className="support-avatar">{item.customer_name.split(' ').slice(0,2).map((part:string)=>part[0]).join('')}</span>
          <span><strong>{item.customer_name}</strong><small>{item.customer_workspace_name} · {item.customer_role.replaceAll('_',' ')}</small><small>{item.category.replaceAll('_',' ')} · {new Date(item.last_message_at).toLocaleString()}</small></span>
        </Link>}
        <StatusPill status={item.status}/>
        {item.status==='WAITING'?(item.can_claim===true?<form action={`/api/support/conversations/${item.id}/claim`} method="post"><input type="hidden" name="returnTo" value={returnTo}/><button className="button small"><UserCheck aria-hidden="true"/><Text message="Claim"/></button></form>:null):<Link className="button secondary small" href={teamConversationHref('support',item.id,returnTo)}><Inbox aria-hidden="true"/><Text message="Open"/></Link>}
      </article>)}
    </section>
    {!result.items.length?<div className="empty-state"><Inbox aria-hidden="true"/><strong>{view==='WAITING'?<Text message="No customers waiting."/>:view==='CLOSED'?<Text message="No closed conversations yet."/>:<Text message="Your inbox is clear."/>}</strong><span>{view==='ASSIGNED'&&available?<Text message="New requests assign automatically when they arrive."/>:<Text message="Choose another queue."/>}</span></div>:null}
    <Pagination path="/support" query={{view}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
