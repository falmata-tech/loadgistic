
import {Text,Localized} from '@/components/localization';
import {reviewQueuePath,reviewQueueStatus} from '@/lib/review-navigation.js';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgeCheck, Check, CreditCard, ExternalLink, HelpCircle, Search, ShieldAlert, Star, X } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { hasPlatformPermission, PLATFORM_PERMISSIONS } from '@/lib/workspace.js';
import { listPaymentProofs } from '@/lib/billing.js';
import { listVerificationRequests } from '@/lib/verification.js';
import { listProviderReviewModeration } from '@/lib/provider-tracking.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { Pagination } from '@/components/pagination';
import { formatEtb } from '@/lib/domain.js';

const tabs=[
  {id:'documents',label:'Documents',icon:BadgeCheck,permission:'TRUST'},
  {id:'ratings',label:'Ratings',icon:Star,permission:'TRUST'},
  {id:'payments',label:'Payments',icon:CreditCard,permission:'BILLING'}
] as const;
export default async function AdminReviewsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});
  const query=await searchParams;
  const allowedTabs=tabs.filter(item=>hasPlatformPermission(user,PLATFORM_PERMISSIONS[item.permission]));
  if(!allowedTabs.length)redirect('/support');
  const requested=String(query.tab||'documents').toLowerCase();
  const tab=allowedTabs.some(item=>item.id===requested)?requested:allowedTabs[0].id;
  const status=reviewQueueStatus(tab,query.status);
  const options={q:query.q,status,page:query.page,pageSize:12};
  const result:any=tab==='documents'
      ? await listVerificationRequests(user,options)
      : tab==='payments'
        ? await listPaymentProofs(user,options)
        : await listProviderReviewModeration(user,['PENDING','UPHELD','REMOVED'].includes(status)?status:'PENDING',{page:query.page,pageSize:12});
  const rows:any[]=result.items;
  const returnTo=reviewQueuePath(tab,{q:query.q,status,page:result.page});

  return <div className="page admin-review-center">
    <PageHeader title={<Text message="Review Center"/>} subtitle={<Text message="Trust documents, ratings, and payments in one focused queue."/>}/>
    <Flash error={query.error} success={query.success}/>
    <Localized as="nav" copy={["aria-label"]} className="admin-view-tabs" aria-label="Review queue">
      {allowedTabs.map(item=>{const Icon=item.icon;return <Link key={item.id} className={tab===item.id?'active':''} href={`/admin/reviews?tab=${item.id}`}><Icon aria-hidden="true"/>{item.label}</Link>;})}
    </Localized>
    <form className="board-filter-bar queue-filter-bar" method="get">
      <input type="hidden" name="tab" value={tab}/>
      {tab!=='ratings'?<div className="form-group"><label htmlFor="review-search"><Search aria-hidden="true"/><Text message="Search "/>{tabs.find(item=>item.id===tab)?.label}</label><Localized as="input" copy={["placeholder"]} id="review-search" name="q" maxLength={120} defaultValue={query.q||''} placeholder="Name, account, document, or reference"/></div>:null}
      <div className="form-group"><label htmlFor="review-status"><Text message="Status"/></label><select id="review-status" name="status" defaultValue={status}>{tab==='ratings'?<><option value="PENDING"><Text message="Pending disputes"/></option><option value="UPHELD"><Text message="Upheld"/></option><option value="REMOVED"><Text message="Removed"/></option></>:<><option value="ALL"><Text message="All statuses"/></option><option value="PENDING"><Text message="Pending"/></option><option value="MORE_INFO"><Text message="More information"/></option><option value="APPROVED"><Text message="Approved"/></option><option value="REJECTED"><Text message="Rejected"/></option></>}</select></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/><Text message="Apply"/></button>
    </form>
    <div className="admin-review-list">
      {tab==='documents'?rows.map(request=><details className="admin-review-row" key={request.id}><summary><span><strong>{request.document_name}</strong><small>{request.submitter_name} · {request.subject_type.replaceAll('_',' ')} · {request.verification_type.replaceAll('_',' ')}</small></span><StatusPill status={request.status}/></summary><div className="admin-review-body"><p className="meta">{request.original_name} · {new Date(request.submitted_at).toLocaleString()}{request.related_vehicle_id?` · truck ${request.related_vehicle_id}`:''}{request.expires_on?` · expires ${request.expires_on}`:''}</p><a className="button secondary icon-button-label" href={`/api/files/verification/${request.id}`} target="_blank"><ExternalLink aria-hidden="true"/><Text message="Open private document"/></a>{!['APPROVED','REJECTED'].includes(request.status)?<form action={`/api/admin/verifications/${request.id}`} method="post" className="verification-review-actions"><input type="hidden" name="returnTo" value={returnTo}/><div className="form-group"><label htmlFor={`verification-note-${request.id}`}><Text message="Review note"/></label><Localized as="input" copy={["placeholder"]} id={`verification-note-${request.id}`} name="note" placeholder="Reason or next step"/></div><button className="button success" name="status" value="APPROVED"><Check aria-hidden="true"/><Text message="Approve"/></button><button className="button secondary" name="status" value="MORE_INFO"><HelpCircle aria-hidden="true"/><Text message="More info"/></button><button className="button danger" name="status" value="REJECTED"><X aria-hidden="true"/><Text message="Reject"/></button></form>:request.review_note?<p>{request.review_note}</p>:null}</div></details>):null}
      {tab==='ratings'?rows.map(review=><details className="admin-review-row" key={review.id}><summary><span><strong>{review.rating}<Text message=" of 5 · "/>{review.subject_name}</strong><small>{review.shipment_code} · {review.reviewer_name}</small></span><StatusPill status={review.status}/></summary><div className="admin-review-body"><div className="rating-investigation-note"><ShieldAlert aria-hidden="true"/><div><p><strong><Text message="Customer review"/></strong></p><p>{review.note||'No written comment.'}</p><p><strong><Text message="Transporter dispute"/></strong></p><p>{review.dispute_reason}</p></div></div><div className="button-row"><Link className="button secondary" href={`/admin/operations?view=TRACKING&q=${encodeURIComponent(review.shipment_code)}`}><Text message="Find Tracking session"/></Link><Link className="button secondary" href={`/admin/operations?view=WORKSPACES&q=${encodeURIComponent(review.subject_name)}`}><Text message="Investigate transporter"/></Link></div>{review.status==='PENDING'?<form action={`/api/admin/ratings/${review.id}`} method="post" className="verification-review-actions"><input type="hidden" name="returnTo" value={returnTo}/><div className="form-group"><label htmlFor={`rating-note-${review.id}`}><Text message="Decision note"/></label><textarea id={`rating-note-${review.id}`} name="reviewNote" required/></div><button className="button success" name="status" value="UPHELD"><Check aria-hidden="true"/><Text message="Uphold review"/></button><button className="button danger" name="status" value="REMOVED"><X aria-hidden="true"/><Text message="Remove review"/></button></form>:<p>{review.review_note}</p>}</div></details>):null}
      {tab==='payments'?rows.map(proof=><details className="admin-review-row" key={proof.id}><summary><span><strong>{proof.organization_name||proof.provider_name}</strong><small>{proof.plan_name} · {formatEtb(proof.amount_minor)} · {proof.reference||'No reference'}</small></span><StatusPill status={proof.status}/></summary><div className="admin-review-body"><p className="meta"><Text message="Current access: "/>{String(proof.subscription_status).replaceAll('_',' ')}{proof.subscription_ends_at?` · through ${new Date(proof.subscription_ends_at).toLocaleDateString()}`:''}</p>{proof.has_file?<a className="button secondary icon-button-label" href={`/api/files/payment-proof/${proof.id}`} target="_blank"><ExternalLink aria-hidden="true"/><Text message="Open private proof"/></a>:<p className="meta"><Text message="No file attached."/></p>}{!['APPROVED','REJECTED'].includes(proof.status)?<form action={`/api/admin/payment-proofs/${proof.id}`} method="post" className="button-row"><input type="hidden" name="returnTo" value={returnTo}/><button className="button success" name="status" value="APPROVED"><Check aria-hidden="true"/><Text message="Paid · 30 days"/></button><button className="button secondary" name="status" value="MORE_INFO"><HelpCircle aria-hidden="true"/><Text message="More info"/></button><button className="button danger" name="status" value="REJECTED"><X aria-hidden="true"/><Text message="Reject"/></button></form>:null}</div></details>):null}
      {!rows.length?<div className="empty-state"><Text message="No records match this queue."/></div>:null}
    </div>
    <Pagination path="/admin/reviews" query={{tab,q:query.q,status}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
