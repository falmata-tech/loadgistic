import styles from '@/app/admin/admin-presentation.module.css';
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {CheckCircle2,Clock3,Headphones,Inbox,ListFilter,Plus,Save,ShieldCheck,UserRound} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {listSupportAgents,listSupportInbox} from '@/lib/support.js';
import {teamQueuePath,teamConversationHref} from '@/lib/team-navigation.js';
import {supportRevisionTag} from '@/lib/support-polling.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {Pagination} from '@/components/pagination';
import {StatusPill} from '@/components/status-pill';
import {SupportRefresh} from '@/components/support-refresh';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';

export default async function AdminSupportPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN'],{allowLimited:true}),query=await searchParams;
  const tab=query.tab==='team'?'team':'chats';
  const requested=String(query.view||'ASSIGNED').toUpperCase();
  const view=['ASSIGNED','WAITING','CLOSED','ALL'].includes(requested)?requested:'ASSIGNED';
  // Team editing never mounts queue polling or reads a hidden conversation list.
  const agents:any=tab==='team'?await listSupportAgents(user,{page:query.agentPage,pageSize:10}):null;
  const queue:any=tab==='chats'?await listSupportInbox(user,view,{page:query.queuePage,pageSize:10}):null;
  const returnTo=teamQueuePath('support',user.role,{view,page:queue?.page||query.queuePage});
  const queueViews=queue?[
    {id:'ASSIGNED',label:'Open',count:queue.counts.assigned,icon:Inbox},
    {id:'WAITING',label:'Waiting',count:queue.counts.waiting,icon:Clock3},
    {id:'CLOSED',label:'Closed',count:queue.counts.closed,icon:CheckCircle2},
    {id:'ALL',label:'All',count:queue.counts.assigned+queue.counts.waiting+queue.counts.closed,icon:ListFilter}
  ]:[];
  return <div className={"page support-page admin-support-page "+styles.workspace}>
    <PageHeader icon={Headphones} title={<Text message={tab==='team'?'Platform team':'Provider support'}/>}/>
    <Flash error={query.error} success={query.success}/>
    <Localized as="nav" copy={["aria-label"]} className="admin-view-tabs" aria-label="Support workspace">
      <Link href={returnTo} className={tab==='chats'?'active':''} aria-current={tab==='chats'?'page':undefined}><Inbox aria-hidden="true"/><Text message="Chats"/></Link>
      <Link href="/admin/support?tab=team" className={tab==='team'?'active':''} aria-current={tab==='team'?'page':undefined}><ShieldCheck aria-hidden="true"/><Text message="Team"/></Link>
    </Localized>
    {tab==='chats'?<>
      <SupportRefresh endpoint={`/api/support/updates?view=${view}&page=${queue.page}&pageSize=10`} initialRevision={supportRevisionTag(queue)}/>
      <Localized as="nav" copy={["aria-label"]} className="support-tabs admin-support-tabs" aria-label="Conversation queue filter">{queueViews.map(item=>{const Icon=item.icon;return <Link className={view===item.id?'active':''} href={teamQueuePath('support',user.role,{view:item.id})} key={item.id} aria-current={view===item.id?'page':undefined}><Icon aria-hidden="true"/><Text message={item.label}/><strong>{item.count}</strong></Link>;})}</Localized>
      <section className="card admin-support-queue">
        <div className="support-conversation-list">{queue.items.map((item:any)=><article key={item.id}><Link className="support-conversation-main" href={teamConversationHref('support',item.id,returnTo)}><span className="support-avatar">{item.customer_name.split(' ').slice(0,2).map((part:string)=>part[0]).join('')}</span><span><strong>{item.customer_name}</strong><small>{item.customer_workspace_name} · {item.category.replaceAll('_',' ')}</small><small className="support-queue-preview">{item.last_message_preview||'No message yet'}</small><small>{new Date(item.updated_at).toLocaleString()} · {item.assigned_agent_name?<><Text message="Assigned to"/> {item.assigned_agent_name}</>:<Text message="Not assigned"/>}</small></span></Link><StatusPill status={item.status}/><Link className="button secondary small" href={teamConversationHref('support',item.id,returnTo)}><Inbox aria-hidden="true"/><Text message="Open"/></Link></article>)}</div>
        {!queue.items.length?<div className="empty-state compact"><Inbox aria-hidden="true"/><Text message="No support conversations."/></div>:null}
        <Pagination path="/admin/support" query={{tab:'chats',view}} page={queue.page} pageCount={queue.pageCount} total={queue.total} pageParam="queuePage"/>
      </section>
    </>:null}
    {tab==='team'?<section className={`card admin-support-team ${styles.teamSection}`}>
      <div className="admin-support-heading"><div><h2 className="panel-heading"><ShieldCheck aria-hidden="true"/><Text message="Members"/></h2></div><WorkspaceTaskDialog title="Add member" triggerLabel="Add member" description="Members sign in with an email code." triggerClassName="button" icon={<Plus aria-hidden="true"/>}><TeamMemberForm/></WorkspaceTaskDialog></div>
      <div className={styles.teamRows}>{agents.items.map((agent:TeamMember)=><article className={styles.teamRow} key={agent.user_id} data-member-id={agent.user_id}>
        <div className={styles.teamIdentity}><span className={`live-dot ${agent.available&&agent.active?'':'off'}`}/><div><strong>{agent.name}</strong><small>{agent.email}</small></div></div>
        <div className={styles.teamResponsibilities}>{responsibilities.filter(([key])=>agent[key]).map(([,label])=><span key={label}><Text message={label}/></span>)}</div>
        <div className={styles.teamWorkload}><strong>{agent.open_count} / {agent.max_open_conversations}</strong><small><Text message="Open chats"/></small></div>
        <StatusPill status={agent.active?'ACTIVE':'SUSPENDED'}/>
        <WorkspaceTaskDialog title="Edit member" triggerLabel="Edit member" description={agent.name}><TeamMemberForm agent={agent}/></WorkspaceTaskDialog>
      </article>)}</div>
      <Pagination path="/admin/support" query={{tab:'team'}} page={agents.page} pageCount={agents.pageCount} total={agents.total} pageParam="agentPage"/>
    </section>:null}
  </div>;
}


type TeamMember={
 user_id:string;name:string;email:string;active:boolean;available:boolean;open_count:number;closed_count:number;max_open_conversations:number;
 can_manage_customers:boolean;can_manage_operations:boolean;can_manage_trust:boolean;can_manage_billing:boolean;can_manage_support:boolean;can_manage_brokerage:boolean;can_manage_featured:boolean;
};
const responsibilities=[['can_manage_customers','Customers','canManageCustomers'],['can_manage_operations','Operations','canManageOperations'],['can_manage_trust','Trust','canManageTrust'],['can_manage_support','Support','canManageSupport'],['can_manage_featured','Featured','canManageFeatured']] as const;
function TeamMemberForm({agent}:{agent?:TeamMember}){
 const key=agent?.user_id||'new';
 return <form action={agent?`/api/admin/support-agents/${agent.user_id}`:'/api/admin/support-agents'} method="post" className={`stack ${styles.memberForm}`}>
  {!agent?<section><h3><Text message="Account"/></h3><div className="form-grid"><label htmlFor={`member-name-${key}`}><Text message="Name"/><input id={`member-name-${key}`} name="name" required/></label><label htmlFor={`member-email-${key}`}><Text message="Sign-in email"/><input id={`member-email-${key}`} name="email" type="email" required/></label></div></section>:<section><h3><Text message="Account"/></h3><p className="meta">{agent.email}</p><label className="checkbox-control"><input name="active" type="checkbox" defaultChecked={Boolean(agent.active)}/><Text message="Account active"/></label><label className="checkbox-control"><input name="available" type="checkbox" defaultChecked={Boolean(agent.available)}/><Text message="Available for chats"/></label><input type="hidden" name="canManageBilling" value={agent.can_manage_billing?'on':''}/></section>}
  <section><h3><Text message="Responsibilities"/></h3><div className="team-permission-grid">{responsibilities.map(([field,label,name])=><label className="checkbox-control" key={name}><input name={name} type="checkbox" defaultChecked={agent?Boolean(agent[field]):name==='canManageSupport'}/><Text message={label}/></label>)}</div></section>
  <section><h3><Text message="Chat workload"/></h3><label htmlFor={`limit-${key}`}><Text message="Max open chats"/><input id={`limit-${key}`} name="maxOpenConversations" type="number" min="1" max="20" defaultValue={agent?.max_open_conversations||3} required/></label></section>
  <button className="button"><Save aria-hidden="true"/><Text message={agent?'Save permissions':'Create member'}/></button>
 </form>;
}
