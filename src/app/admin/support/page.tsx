
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import { CheckCircle2, Clock3, Headphones, Inbox, ListFilter, Plus, Save, ShieldCheck, UserRound } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listSupportAgents, listSupportInbox } from '@/lib/support.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { Pagination } from '@/components/pagination';
import { StatusPill } from '@/components/status-pill';

export default async function AdminSupportPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['ADMIN'],{allowLimited:true});
  const query=await searchParams;
  const requested=String(query.view||'ASSIGNED').toUpperCase();
  const view=['ASSIGNED','WAITING','CLOSED','ALL'].includes(requested)?requested:'ASSIGNED';
  const agents:any=await listSupportAgents(user,{page:query.agentPage,pageSize:10});
  const queue:any=await listSupportInbox(user,view,{page:query.queuePage,pageSize:10});
  const queueViews=[
    {id:'ASSIGNED',label:'Open',count:queue.counts.assigned,icon:Inbox},
    {id:'WAITING',label:'Waiting',count:queue.counts.waiting,icon:Clock3},
    {id:'CLOSED',label:'Closed',count:queue.counts.closed,icon:CheckCircle2},
    {id:'ALL',label:'All',count:queue.counts.assigned+queue.counts.waiting+queue.counts.closed,icon:ListFilter}
  ];

  return <div className="page support-page admin-support-page">
    <PageHeader icon={Headphones} title={<Text message="Customer Support"/>} subtitle={<Text message="Queue health and support team."/>}/>
    <Flash error={query.error} success={query.success}/>
    <Link className="button secondary assisted-matching-link" href="/support/assisted?view=ALL"><Headphones aria-hidden="true"/><Text message="Assisted matching"/></Link>
    <section className="stats compact-admin-stats">
      <div className="stat"><Clock3 aria-hidden="true"/><span className="meta"><Text message="Waiting"/></span><strong>{queue.counts.waiting}</strong></div>
      <div className="stat"><Inbox aria-hidden="true"/><span className="meta"><Text message="Open"/></span><strong>{queue.counts.assigned}</strong></div>
      <div className="stat"><CheckCircle2 aria-hidden="true"/><span className="meta"><Text message="Closed"/></span><strong>{queue.counts.closed}</strong></div>
      <div className="stat"><UserRound aria-hidden="true"/><span className="meta"><Text message="Team"/></span><strong>{agents.total}</strong></div>
    </section>
    <Localized as="nav" copy={["aria-label"]} className="support-tabs admin-support-tabs" aria-label="Conversation queue filter">{queueViews.map(item=>{const Icon=item.icon;return <Link className={view===item.id?'active':''} href={`/admin/support?view=${item.id}`} key={item.id}><Icon aria-hidden="true"/><span>{item.label}</span><strong>{item.count}</strong></Link>;})}</Localized>
    <section className="card admin-support-queue">
      <h2 className="panel-heading"><Inbox aria-hidden="true"/><Text message="Conversation queue"/></h2>
      <div className="support-conversation-list">{queue.items.map((item:any)=><article key={item.id}><Link className="support-conversation-main" href={`/support/${item.id}`}><span className="support-avatar">{item.customer_name.split(' ').slice(0,2).map((part:string)=>part[0]).join('')}</span><span><strong>{item.customer_name}</strong><small>{item.customer_workspace_name} · {item.category.replaceAll('_',' ')}</small><small className="support-queue-preview">{item.last_message_preview||'No message yet'}</small><small>{new Date(item.updated_at).toLocaleString()} · {item.assigned_agent_name?`Agent: ${item.assigned_agent_name}`:<Text message="Not assigned"/>}</small></span></Link><StatusPill status={item.status}/><Link className="button secondary small" href={`/support/${item.id}`}><Inbox aria-hidden="true"/><Text message="Open"/></Link></article>)}</div>
      {!queue.items.length?<div className="empty-state compact"><Inbox aria-hidden="true"/><Text message="No support conversations."/></div>:null}
      <Pagination path="/admin/support" query={{view,agentPage:query.agentPage}} page={queue.page} pageCount={queue.pageCount} total={queue.total} pageParam="queuePage"/>
    </section>
    <section className="card admin-support-team">
      <div className="admin-support-heading"><div><h2 className="panel-heading"><ShieldCheck aria-hidden="true"/><Text message="Platform team"/></h2><p className="meta"><Text message="Give each person only the work they are responsible for."/></p></div><details><summary className="button"><Plus aria-hidden="true"/><Text message="Add member"/></summary><form action="/api/admin/support-agents" method="post" className="support-agent-create"><section className="support-create-step"><div className="workflow-step-heading"><span>1</span><UserRound aria-hidden="true"/><div><h3><Text message="Account"/></h3><p><Text message="They will sign in with an email code or Google. No password is created here."/></p></div></div><div className="form-grid"><div className="form-group"><label htmlFor="agent-name"><UserRound aria-hidden="true"/><Text message="Name"/></label><input id="agent-name" name="name" required/></div><div className="form-group"><label htmlFor="agent-email"><Text message="Sign-in email"/></label><input id="agent-email" name="email" type="email" required/></div></div></section><section className="support-create-step"><div className="workflow-step-heading"><span>2</span><ShieldCheck aria-hidden="true"/><div><h3><Text message="Responsibilities"/></h3><p><Text message="Only the work this person manages."/></p></div></div><div className="team-permission-grid"><label className="checkbox-control"><input name="canManageCustomers" type="checkbox"/><Text message="Customers"/></label><label className="checkbox-control"><input name="canManageOperations" type="checkbox"/><Text message="Operations"/></label><label className="checkbox-control"><input name="canManageTrust" type="checkbox"/><Text message="Trust"/></label><label className="checkbox-control"><input name="canManageBilling" type="checkbox"/><Text message="Billing"/></label><label className="checkbox-control"><input name="canManageSupport" type="checkbox" defaultChecked/><Text message="Support"/></label></div></section><section className="support-create-step"><div className="workflow-step-heading"><span>3</span><Headphones aria-hidden="true"/><div><h3><Text message="Chat workload"/></h3><p><Text message="Limit simultaneous conversations."/></p></div></div><div className="form-group"><label htmlFor="agent-limit"><Text message="Max open chats"/></label><input id="agent-limit" name="maxOpenConversations" type="number" min="1" max="20" defaultValue="3" required/></div></section><button className="button"><Plus aria-hidden="true"/><Text message="Create member"/></button></form></details></div>
      <div className="support-agent-list">{agents.items.map((agent:any)=><details key={agent.user_id}><summary><span className={`live-dot ${agent.available&&agent.active?'':'off'}`}/><span><strong>{agent.name}</strong><small>{agent.email}</small></span><span><strong>{agent.open_count} / {agent.max_open_conversations}</strong><small><Text message="open · "/>{agent.closed_count}<Text message=" closed"/></small></span><StatusPill status={agent.active?'ACTIVE':'SUSPENDED'}/></summary><form action={`/api/admin/support-agents/${agent.user_id}`} method="post" className="support-agent-edit"><label className="checkbox-control"><input name="active" type="checkbox" defaultChecked={Boolean(agent.active)}/><ShieldCheck aria-hidden="true"/><Text message="Account active"/></label><label className="checkbox-control"><input name="available" type="checkbox" defaultChecked={Boolean(agent.available)}/><Headphones aria-hidden="true"/><Text message="Available for chats"/></label><div className="form-group"><label htmlFor={`limit-${agent.user_id}`}><Text message="Max open chats"/></label><input id={`limit-${agent.user_id}`} name="maxOpenConversations" type="number" min="1" max="20" defaultValue={agent.max_open_conversations} required/></div><div className="team-permission-grid"><label className="checkbox-control"><input name="canManageCustomers" type="checkbox" defaultChecked={Boolean(agent.can_manage_customers)}/><Text message="Customers"/></label><label className="checkbox-control"><input name="canManageOperations" type="checkbox" defaultChecked={Boolean(agent.can_manage_operations)}/><Text message="Operations"/></label><label className="checkbox-control"><input name="canManageTrust" type="checkbox" defaultChecked={Boolean(agent.can_manage_trust)}/><Text message="Trust"/></label><label className="checkbox-control"><input name="canManageBilling" type="checkbox" defaultChecked={Boolean(agent.can_manage_billing)}/><Text message="Billing"/></label><label className="checkbox-control"><input name="canManageSupport" type="checkbox" defaultChecked={Boolean(agent.can_manage_support)}/><Text message="Support"/></label></div><button className="button small"><Save aria-hidden="true"/><Text message="Save permissions"/></button></form></details>)}</div>
      <Pagination path="/admin/support" query={{view,queuePage:query.queuePage}} page={agents.page} pageCount={agents.pageCount} total={agents.total} pageParam="agentPage"/>
    </section>
    <p className="support-safety-note"><ShieldCheck aria-hidden="true"/><Text message="Team members see only assigned management areas. Tracking secrets, passwords, and private files stay protected."/></p>
  </div>;
}
