import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, CircleHelp, CreditCard, Headphones, History, MessageCircle, MessagesSquare, PackageSearch, Plus, Send, Truck, UserRound } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getOpenMemberSupportConversation, getSupportConversation, listMemberSupportConversations } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { SupportThread } from '@/components/support-thread';
import { Pagination } from '@/components/pagination';
import { StatusPill } from '@/components/status-pill';

const categories=[
  {value:'ACCOUNT',label:'Account',icon:UserRound},
  {value:'PAYMENT',label:'Payment',icon:CreditCard},
  {value:'VERIFICATION',label:'Verification',icon:BadgeCheck},
  {value:'LOAD_TRACKING',label:'Shipment & tracking',icon:PackageSearch},
  {value:'CAPACITY',label:'Capacity',icon:Truck},
  {value:'OTHER',label:'Other',icon:CircleHelp}
];

export default async function MemberSupportPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['SHIPPER','RECEIVER','TRANSPORTER','DRIVER'],{allowLimited:true});
  const query=await searchParams;
  const result:any=await listMemberSupportConversations(user,{page:query.page,pageSize:10,status:'CLOSED'});
  const open:any=await getOpenMemberSupportConversation(user);
  let conversation:any=null;
  try {
    conversation=query.conversation?await getSupportConversation(user,query.conversation):null;
  } catch(error) {
    if(String((error as Error)?.message).includes('NOT_FOUND'))notFound();
    throw error;
  }
  const viewingHistory=Boolean(query.conversation&&conversation?.status==='CLOSED');
  const wantsNew=query.new==='1';
  const showStart=wantsNew&&!open&&!conversation;
  const action=conversation||showStart
    ? <Link className="button secondary icon-button-label" href="/app/support"><ArrowLeft aria-hidden="true"/>Support home</Link>
    : undefined;

  return <div className="page support-page">
    <PageHeader icon={Headphones} title="Support" subtitle={viewingHistory?'Past chat':conversation?'Your conversation':'Get help from Loadgistic.'} action={action}/>
    <Flash error={query.error} success={query.success}/>
    {conversation?<SupportThread conversation={conversation} user={user} canClose/>:showStart?<form className="form-card support-start-form" action="/api/support/conversations" method="post">
      <fieldset>
        <legend><span className="step-number">1</span>Choose a topic</legend>
        <div className="support-category-grid">{categories.map((category,index)=>{const Icon=category.icon;return <label key={category.value}><input type="radio" name="category" value={category.value} defaultChecked={index===0}/><span><Icon aria-hidden="true"/><strong>{category.label}</strong></span></label>;})}</div>
      </fieldset>
      <div className="form-group"><label htmlFor="support-message"><span className="step-number">2</span><Send aria-hidden="true"/>What do you need?</label><textarea id="support-message" name="body" maxLength={2000} rows={5} required placeholder="Describe the problem"/></div>
      <button className="button icon-button-label"><Send aria-hidden="true"/>Send to support</button>
    </form>:<section className="support-member-home">
      {open?<article className="support-active-chat"><div className="support-active-icon"><MessagesSquare aria-hidden="true"/></div><div><span className="meta">Active chat</span><h2>{open.category.replaceAll('_',' ')}</h2><p>{open.last_message_preview||'Waiting for the conversation to begin.'}</p><small>{open.assigned_agent_name?`${open.assigned_agent_name} is helping`:'Waiting for an available support agent'}</small></div><StatusPill status={open.status}/><Link className="button icon-button-label" href={`/app/support?conversation=${open.id}`}><MessageCircle aria-hidden="true"/>Continue chat</Link></article>:<article className="support-new-chat-card"><div className="support-active-icon"><Headphones aria-hidden="true"/></div><div><h2>How can we help?</h2><p>Choose one topic and send one clear message.</p></div><Link className="button icon-button-label" href="/app/support?new=1"><Plus aria-hidden="true"/>New chat</Link></article>}
      {open?<p className="support-one-chat-note"><MessageCircle aria-hidden="true"/>One active chat at a time. End it when the issue is finished.</p>:null}
    </section>}
    {!conversation&&!showStart&&result.items.length?<section className="support-history"><h2 className="panel-heading"><History aria-hidden="true"/>Past chats</h2><div className="support-conversation-list member-support-list">{result.items.map((item:any)=><article key={item.id}><Link href={`/app/support?conversation=${item.id}`}><MessageCircle aria-hidden="true"/><span><strong>{item.category.replaceAll('_',' ')}</strong><small>{item.last_message_preview||'No message preview'}</small><small>{new Date(item.updated_at).toLocaleString()} · {item.message_count} {item.message_count===1?'message':'messages'}</small></span><StatusPill status={item.status}/></Link></article>)}</div></section>:null}
    {!conversation&&!showStart&&result.pageCount>1?<Pagination path="/app/support" query={{}} page={result.page} pageCount={result.pageCount} total={result.total}/>:null}
    <p className="support-safety-note"><Headphones aria-hidden="true"/>Support never asks for passwords, PINs, or one-time codes.</p>
  </div>;
}
