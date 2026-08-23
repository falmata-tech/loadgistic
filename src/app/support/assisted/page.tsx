import Link from 'next/link';
import {Clock3,Headphones,Inbox,UserCheck} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {listGuestSupportInbox} from '@/lib/repository.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {Pagination} from '@/components/pagination';
import {StatusPill} from '@/components/status-pill';
import {SupportRefresh} from '@/components/support-refresh';

export default async function AssistedMatchingInbox({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['SUPPORT','ADMIN'],{allowLimited:true});const query=await searchParams;
  const view=['ASSIGNED','WAITING','CLOSED','ALL'].includes(String(query.view||'').toUpperCase())?String(query.view).toUpperCase():(user.role==='ADMIN'?'ALL':'ASSIGNED');
  const result:any=listGuestSupportInbox(user,view,{page:query.page,pageSize:15});
  return <div className="page support-page"><SupportRefresh/><PageHeader icon={Headphones} title="Assisted matching" subtitle="Private conversations from account-free visitors."/><Flash error={query.error} success={query.success}/><nav className="support-tabs"><Link href="/support/assisted?view=ASSIGNED">Open</Link><Link href="/support/assisted?view=WAITING">Waiting</Link><Link href="/support/assisted?view=CLOSED">Closed</Link>{user.role==='ADMIN'?<Link href="/support/assisted?view=ALL">All</Link>:null}</nav><section className="support-conversation-list">{result.items.map((item:any)=><article key={item.id}><Link className="support-conversation-main" href={item.status==='WAITING'?'#':`/support/assisted/${item.id}`}><span className="support-avatar">AM</span><span><strong>{item.email}</strong><small>{item.phone||'No callback phone'} · Assisted matching</small><small>{item.last_message_preview}</small></span></Link><StatusPill status={item.status}/>{item.status==='WAITING'&&user.role==='SUPPORT'?<form action={`/api/guest-support/${item.id}/claim`} method="post"><button className="button small"><UserCheck aria-hidden="true"/>Claim</button></form>:item.status!=='WAITING'?<Link className="button secondary small" href={`/support/assisted/${item.id}`}><Inbox aria-hidden="true"/>Open</Link>:<Clock3 aria-hidden="true"/>}</article>)}</section>{!result.items.length?<div className="empty-state"><Inbox aria-hidden="true"/><strong>No conversations here.</strong></div>:null}<Pagination path="/support/assisted" query={{view}} page={result.page} pageCount={result.pageCount} total={result.total}/></div>;
}
