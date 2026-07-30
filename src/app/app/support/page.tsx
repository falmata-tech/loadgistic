import Link from 'next/link';
import { BadgeCheck, CircleHelp, CreditCard, Headphones, History, PackageSearch, Send, Truck, UserRound } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getSupportConversation, listMemberSupportConversations } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { SupportThread } from '@/components/support-thread';
import { Pagination } from '@/components/pagination';
import { StatusPill } from '@/components/status-pill';

const categories=[
  {value:'ACCOUNT',label:'Account',icon:UserRound},
  {value:'PAYMENT',label:'Payment',icon:CreditCard},
  {value:'VERIFICATION',label:'Verification',icon:BadgeCheck},
  {value:'LOAD_TRACKING',label:'Load & tracking',icon:PackageSearch},
  {value:'CAPACITY',label:'Capacity',icon:Truck},
  {value:'OTHER',label:'Other',icon:CircleHelp}
];

export default async function MemberSupportPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['SHIPPER','RECEIVER','TRANSPORTER','DRIVER'],{allowLimited:true});
  const query=await searchParams;
  const result:any=listMemberSupportConversations(user,{page:query.page,pageSize:10});
  const latest:any=listMemberSupportConversations(user,{page:1,pageSize:1});
  const current=latest.items.find((item:any)=>item.status!=='CLOSED');
  const conversation=current?getSupportConversation(user,current.id):null;
  const closed=result.items.filter((item:any)=>item.status==='CLOSED');

  return <div className="page support-page">
    <PageHeader icon={Headphones} title="Support" subtitle={conversation?'Continue your conversation.':'Choose a topic and send one message.'}/>
    <Flash error={query.error} success={query.success}/>
    {conversation?<SupportThread conversation={conversation} user={user}/>:<form className="form-card support-start-form" action="/api/support/conversations" method="post">
      <fieldset>
        <legend><span className="step-number">1</span>Choose a topic</legend>
        <div className="support-category-grid">{categories.map((category,index)=>{const Icon=category.icon;return <label key={category.value}><input type="radio" name="category" value={category.value} defaultChecked={index===0}/><span><Icon aria-hidden="true"/><strong>{category.label}</strong></span></label>;})}</div>
      </fieldset>
      <div className="form-group"><label htmlFor="support-message"><span className="step-number">2</span><Send aria-hidden="true"/>What do you need?</label><textarea id="support-message" name="body" maxLength={2000} rows={5} required placeholder="Describe the problem"/></div>
      <button className="button icon-button-label"><Send aria-hidden="true"/>Send to support</button>
    </form>}
    {closed.length?<section className="support-history"><h2 className="panel-heading"><History aria-hidden="true"/>Previous conversations</h2><div className="support-conversation-list">{closed.map((item:any)=><article key={item.id}><div><strong>{item.category.replaceAll('_',' ')}</strong><span>{new Date(item.updated_at).toLocaleDateString()} · {item.message_count} messages</span></div><StatusPill status={item.status}/></article>)}</div></section>:null}
    {!conversation&&result.pageCount>1?<Pagination path="/app/support" query={{}} page={result.page} pageCount={result.pageCount} total={result.total}/>:null}
    <p className="support-safety-note"><Headphones aria-hidden="true"/>Support never asks for passwords, PINs, or one-time codes.</p>
  </div>;
}
