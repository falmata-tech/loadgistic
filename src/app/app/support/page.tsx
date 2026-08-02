import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, CircleHelp, CreditCard, Headphones, History, MessageCircle, PackageSearch, Send, Truck, UserRound } from 'lucide-react';
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
  const result:any=listMemberSupportConversations(user,{page:query.page,pageSize:10});
  const open:any=getOpenMemberSupportConversation(user);
  let conversation:any=null;
  try {
    conversation=query.conversation
      ? getSupportConversation(user,query.conversation)
      : open?getSupportConversation(user,open.id):null;
  } catch(error) {
    if(String((error as Error)?.message).includes('NOT_FOUND'))notFound();
    throw error;
  }
  const viewingHistory=Boolean(query.conversation&&conversation?.status==='CLOSED');

  return <div className="page support-page">
    <PageHeader icon={Headphones} title="Support" subtitle={viewingHistory?'Previous conversation':conversation?'Continue your conversation.':'Choose a topic and send one message.'} action={query.conversation?<Link className="button secondary icon-button-label" href="/app/support">{open?<MessageCircle aria-hidden="true"/>:<ArrowLeft aria-hidden="true"/>}{open?'Open chat':'Back'}</Link>:undefined}/>
    <Flash error={query.error} success={query.success}/>
    {conversation?<SupportThread conversation={conversation} user={user}/>:<form className="form-card support-start-form" action="/api/support/conversations" method="post">
      <fieldset>
        <legend><span className="step-number">1</span>Choose a topic</legend>
        <div className="support-category-grid">{categories.map((category,index)=>{const Icon=category.icon;return <label key={category.value}><input type="radio" name="category" value={category.value} defaultChecked={index===0}/><span><Icon aria-hidden="true"/><strong>{category.label}</strong></span></label>;})}</div>
      </fieldset>
      <div className="form-group"><label htmlFor="support-message"><span className="step-number">2</span><Send aria-hidden="true"/>What do you need?</label><textarea id="support-message" name="body" maxLength={2000} rows={5} required placeholder="Describe the problem"/></div>
      <button className="button icon-button-label"><Send aria-hidden="true"/>Send to support</button>
    </form>}
    {result.items.length?<section className="support-history"><h2 className="panel-heading"><History aria-hidden="true"/>Your conversations</h2><div className="support-conversation-list member-support-list">{result.items.map((item:any)=><article className={conversation?.id===item.id?'selected':''} key={item.id}><Link href={item.id===open?.id?'/app/support':`/app/support?conversation=${item.id}`}><MessageCircle aria-hidden="true"/><span><strong>{item.category.replaceAll('_',' ')}</strong><small>{item.last_message_preview||'No message preview'}</small><small>{new Date(item.updated_at).toLocaleString()} · {item.message_count} {item.message_count===1?'message':'messages'}</small></span><StatusPill status={item.status}/></Link></article>)}</div></section>:null}
    {result.pageCount>1?<Pagination path="/app/support" query={{conversation:query.conversation}} page={result.page} pageCount={result.pageCount} total={result.total}/>:null}
    <p className="support-safety-note"><Headphones aria-hidden="true"/>Support never asks for passwords, PINs, or one-time codes.</p>
  </div>;
}
