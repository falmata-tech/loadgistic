import Link from 'next/link';
import { CheckCircle2, Clock3, Headphones, Inbox, Plus, Save, ShieldCheck, UserRound } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listSupportAgents, listSupportInbox } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { Pagination } from '@/components/pagination';
import { StatusPill } from '@/components/status-pill';

export default async function AdminSupportPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['ADMIN'],{allowLimited:true});
  const query=await searchParams;
  const agents:any=listSupportAgents(user,{page:query.agentPage,pageSize:10});
  const queue:any=listSupportInbox(user,'ALL',{page:query.queuePage,pageSize:10});

  return <div className="page support-page admin-support-page">
    <PageHeader icon={Headphones} title="Customer Support" subtitle="Queue health and support team."/>
    <Flash error={query.error} success={query.success}/>
    <section className="stats compact-admin-stats">
      <div className="stat"><Clock3 aria-hidden="true"/><span className="meta">Waiting</span><strong>{queue.counts.waiting}</strong></div>
      <div className="stat"><Inbox aria-hidden="true"/><span className="meta">Open</span><strong>{queue.counts.assigned}</strong></div>
      <div className="stat"><CheckCircle2 aria-hidden="true"/><span className="meta">Closed</span><strong>{queue.counts.closed}</strong></div>
      <div className="stat"><UserRound aria-hidden="true"/><span className="meta">Agents</span><strong>{agents.total}</strong></div>
    </section>
    <section className="card admin-support-queue">
      <h2 className="panel-heading"><Inbox aria-hidden="true"/>Conversation queue</h2>
      <div className="support-conversation-list">{queue.items.map((item:any)=><article key={item.id}><Link className="support-conversation-main" href={`/support/${item.id}`}><span className="support-avatar">{item.customer_name.split(' ').slice(0,2).map((part:string)=>part[0]).join('')}</span><span><strong>{item.customer_name}</strong><small>{item.customer_workspace_name} · {item.category.replaceAll('_',' ')}</small><small>{item.assigned_agent_name?`Agent: ${item.assigned_agent_name}`:'Not assigned'}</small></span></Link><StatusPill status={item.status}/><Link className="button secondary small" href={`/support/${item.id}`}><Inbox aria-hidden="true"/>Open</Link></article>)}</div>
      {!queue.items.length?<div className="empty-state compact"><Inbox aria-hidden="true"/>No support conversations.</div>:null}
      <Pagination path="/admin/support" query={{agentPage:query.agentPage}} page={queue.page} pageCount={queue.pageCount} total={queue.total} pageParam="queuePage"/>
    </section>
    <section className="card admin-support-team">
      <div className="admin-support-heading"><div><h2 className="panel-heading"><ShieldCheck aria-hidden="true"/>Support team</h2><p className="meta">Support agents only see conversations assigned to them.</p></div><details><summary className="button"><Plus aria-hidden="true"/>Add agent</summary><form action="/api/admin/support-agents" method="post" className="support-agent-create"><div className="form-group"><label htmlFor="agent-name"><UserRound aria-hidden="true"/>Name</label><input id="agent-name" name="name" required/></div><div className="form-group"><label htmlFor="agent-email">Email</label><input id="agent-email" name="email" type="email" required/></div><div className="form-group"><label htmlFor="agent-password">Temporary password</label><input id="agent-password" name="password" type="password" minLength={10} autoComplete="new-password" required/></div><div className="form-group"><label htmlFor="agent-limit">Max open</label><input id="agent-limit" name="maxOpenConversations" type="number" min="1" max="20" defaultValue="3" required/></div><button className="button"><Plus aria-hidden="true"/>Create agent</button></form></details></div>
      <div className="support-agent-list">{agents.items.map((agent:any)=><details key={agent.user_id}><summary><span className={`live-dot ${agent.available&&agent.active?'':'off'}`}/><span><strong>{agent.name}</strong><small>{agent.email}</small></span><span><strong>{agent.open_count} / {agent.max_open_conversations}</strong><small>open · {agent.closed_count} closed</small></span><StatusPill status={agent.active?'ACTIVE':'SUSPENDED'}/></summary><form action={`/api/admin/support-agents/${agent.user_id}`} method="post" className="support-agent-edit"><label className="checkbox-control"><input name="active" type="checkbox" defaultChecked={Boolean(agent.active)}/><ShieldCheck aria-hidden="true"/>Account active</label><label className="checkbox-control"><input name="available" type="checkbox" defaultChecked={Boolean(agent.available)}/><Headphones aria-hidden="true"/>Available for assignments</label><div className="form-group"><label htmlFor={`limit-${agent.user_id}`}>Max open</label><input id={`limit-${agent.user_id}`} name="maxOpenConversations" type="number" min="1" max="20" defaultValue={agent.max_open_conversations} required/></div><button className="button small"><Save aria-hidden="true"/>Save</button></form></details>)}</div>
      <Pagination path="/admin/support" query={{queuePage:query.queuePage}} page={agents.page} pageCount={agents.pageCount} total={agents.total} pageParam="agentPage"/>
    </section>
    <p className="support-safety-note"><ShieldCheck aria-hidden="true"/>Support agents cannot access admin pages, marketplace operations, tracking secrets, or private account contacts.</p>
  </div>;
}
