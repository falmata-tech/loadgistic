import Link from 'next/link';
import { CheckCircle2, Clock3, Headphones, Inbox, PauseCircle, PlayCircle, UserCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listSupportInbox } from '@/lib/support.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { Pagination } from '@/components/pagination';
import { StatusPill } from '@/components/status-pill';
import { SupportRefresh } from '@/components/support-refresh';

const views=[
  {id:'ASSIGNED',label:'Mine',icon:UserCheck,count:'assigned'},
  {id:'WAITING',label:'Waiting',icon:Clock3,count:'waiting'},
  {id:'CLOSED',label:'Closed',icon:CheckCircle2,count:'closed'}
] as const;

export default async function SupportInboxPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['SUPPORT'],{allowLimited:true});
  const query=await searchParams;
  const requested=String(query.view||'ASSIGNED').toUpperCase();
  const view=views.some(item=>item.id===requested)?requested:'ASSIGNED';
  const result:any=await listSupportInbox(user,view,{page:query.page,pageSize:15});
  const available=Boolean(result.agent?.available);

  return <div className="page support-page">
    <SupportRefresh/>
    <PageHeader icon={Headphones} title="Support Inbox" subtitle="Help one customer at a time." action={<form action="/api/support/availability" method="post">{!available?<input type="hidden" name="available" value="on"/>:null}<button className={`button ${available?'secondary':''}`} title={available?'Pause new assignments':'Take new conversations'}>{available?<><PauseCircle aria-hidden="true"/>Pause</>:<><PlayCircle aria-hidden="true"/>Go available</>}</button></form>}/>
    <Flash error={query.error} success={query.success}/>
    <Link className="button secondary assisted-matching-link" href="/support/assisted"><Headphones aria-hidden="true"/>Assisted matching</Link>
    <section className="support-agent-strip">
      <span className={`live-dot ${available?'':'off'}`} aria-hidden="true"/>
      <div><strong>{available?'Available':'Paused'}</strong><small>{result.agent.open_count} of {result.agent.max_open_conversations} assigned</small></div>
    </section>
    <nav className="support-tabs" aria-label="Support queue">
      {views.map(item=>{const Icon=item.icon;return <Link className={view===item.id?'active':''} href={`/support?view=${item.id}`} key={item.id}><Icon aria-hidden="true"/><span>{item.label}</span><strong>{result.counts[item.count]}</strong></Link>;})}
    </nav>
    <section className="support-conversation-list">
      {result.items.map((item:any)=><article key={item.id}>
        <Link className="support-conversation-main" href={item.status==='WAITING'?'#':`/support/${item.id}`}>
          <span className="support-avatar">{item.customer_name.split(' ').slice(0,2).map((part:string)=>part[0]).join('')}</span>
          <span><strong>{item.customer_name}</strong><small>{item.customer_workspace_name} · {item.customer_role.replaceAll('_',' ')}</small><small>{item.category.replaceAll('_',' ')} · {new Date(item.last_message_at).toLocaleString()}</small></span>
        </Link>
        <StatusPill status={item.status}/>
        {item.status==='WAITING'?<form action={`/api/support/conversations/${item.id}/claim`} method="post"><button className="button small"><UserCheck aria-hidden="true"/>Claim</button></form>:<Link className="button secondary small" href={`/support/${item.id}`}><Inbox aria-hidden="true"/>Open</Link>}
      </article>)}
    </section>
    {!result.items.length?<div className="empty-state"><Inbox aria-hidden="true"/><strong>{view==='WAITING'?'No customers waiting.':view==='CLOSED'?'No closed conversations yet.':'Your inbox is clear.'}</strong><span>{view==='ASSIGNED'&&available?'New requests assign automatically when they arrive.':'Choose another queue.'}</span></div>:null}
    <Pagination path="/support" query={{view}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
