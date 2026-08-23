import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgeCheck, Check, CreditCard, ExternalLink, HelpCircle, Search, ShieldAlert, Star, X } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { hasPlatformPermission, listPaymentProofs, listRatingModerationQueue, listVerificationRequests, PLATFORM_PERMISSIONS } from '@/lib/repository.js';
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
  const status=String(query.status||(tab==='ratings'?'PENDING':'ALL')).toUpperCase();
  const options={q:query.q,status,page:query.page,pageSize:12};
  const result:any=tab==='documents'
      ? listVerificationRequests(user,options)
      : tab==='payments'
        ? listPaymentProofs(user,options)
        : listRatingModerationQueue(user,['PENDING','PUBLISHED','DISMISSED'].includes(status)?status:'PENDING',{page:query.page,pageSize:12});
  const rows:any[]=result.items;

  return <div className="page admin-review-center">
    <PageHeader title="Review Center" subtitle="Trust documents, ratings, and payments in one focused queue."/>
    <Flash error={query.error} success={query.success}/>
    <nav className="admin-view-tabs" aria-label="Review queue">
      {allowedTabs.map(item=>{const Icon=item.icon;return <Link key={item.id} className={tab===item.id?'active':''} href={`/admin/reviews?tab=${item.id}`}><Icon aria-hidden="true"/>{item.label}</Link>;})}
    </nav>
    <form className="board-filter-bar queue-filter-bar" method="get">
      <input type="hidden" name="tab" value={tab}/>
      {tab!=='ratings'?<div className="form-group"><label htmlFor="review-search"><Search aria-hidden="true"/>Search {tabs.find(item=>item.id===tab)?.label}</label><input id="review-search" name="q" defaultValue={query.q||''} placeholder="Name, account, document, or reference"/></div>:null}
      <div className="form-group"><label htmlFor="review-status">Status</label><select id="review-status" name="status" defaultValue={status}>{tab==='ratings'?<><option value="PENDING">Pending</option><option value="PUBLISHED">Published</option><option value="DISMISSED">Dismissed</option></>:<><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="MORE_INFO">More information</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></>}</select></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Apply</button>
    </form>
    <div className="admin-review-list">
      {tab==='documents'?rows.map(request=><details className="admin-review-row" key={request.id}><summary><span><strong>{request.document_name}</strong><small>{request.submitter_name} · {request.subject_type.replaceAll('_',' ')} · {request.verification_type.replaceAll('_',' ')}</small></span><StatusPill status={request.status}/></summary><div className="admin-review-body"><p className="meta">{request.original_name} · {new Date(request.submitted_at).toLocaleString()}{request.related_vehicle_id?` · truck ${request.related_vehicle_id}`:''}{request.expires_on?` · expires ${request.expires_on}`:''}</p><a className="button secondary icon-button-label" href={`/api/files/verification/${request.id}`} target="_blank"><ExternalLink aria-hidden="true"/>Open private document</a>{!['APPROVED','REJECTED'].includes(request.status)?<form action={`/api/admin/verifications/${request.id}`} method="post" className="verification-review-actions"><div className="form-group"><label htmlFor={`verification-note-${request.id}`}>Review note</label><input id={`verification-note-${request.id}`} name="note" placeholder="Reason or next step"/></div><button className="button success" name="status" value="APPROVED"><Check aria-hidden="true"/>Approve</button><button className="button secondary" name="status" value="MORE_INFO"><HelpCircle aria-hidden="true"/>More info</button><button className="button danger" name="status" value="REJECTED"><X aria-hidden="true"/>Reject</button></form>:request.review_note?<p>{request.review_note}</p>:null}</div></details>):null}
      {tab==='ratings'?rows.map(review=><details className="admin-review-row" key={review.id}><summary><span><strong>{review.rating} of 5 · {review.subject_name}</strong><small>{review.shipment_code} · reported by {review.reviewer_name}</small></span><StatusPill status={review.status}/></summary><div className="admin-review-body"><div className="rating-investigation-note"><ShieldAlert aria-hidden="true"/><p>{review.note}</p></div><div className="button-row"><Link className="button secondary" href={`/admin/operations?view=TRACKING&q=${encodeURIComponent(review.shipment_code)}`}>Find Tracking session</Link><Link className="button secondary" href={`/admin/operations?view=WORKSPACES&q=${encodeURIComponent(review.subject_name)}`}>Investigate transporter</Link></div>{review.status==='PENDING'?<form action={`/api/admin/ratings/${review.id}`} method="post" className="verification-review-actions"><div className="form-group"><label htmlFor={`rating-note-${review.id}`}>Investigation note</label><textarea id={`rating-note-${review.id}`} name="reviewNote" required/></div><button className="button success" name="status" value="PUBLISHED"><Check aria-hidden="true"/>Publish</button><button className="button danger" name="status" value="DISMISSED"><X aria-hidden="true"/>Dismiss</button></form>:<p>{review.review_note}</p>}</div></details>):null}
      {tab==='payments'?rows.map(proof=><details className="admin-review-row" key={proof.id}><summary><span><strong>{proof.organization_name||proof.provider_name}</strong><small>{proof.plan_name} · {formatEtb(proof.amount_minor)} · {proof.reference||'No reference'}</small></span><StatusPill status={proof.status}/></summary><div className="admin-review-body"><p className="meta">Current access: {String(proof.subscription_status).replaceAll('_',' ')}{proof.subscription_ends_at?` · through ${new Date(proof.subscription_ends_at).toLocaleDateString()}`:''}</p>{proof.file_path?<a className="button secondary icon-button-label" href={`/api/files/payment-proof/${proof.id}`} target="_blank"><ExternalLink aria-hidden="true"/>Open private proof</a>:<p className="meta">No file attached.</p>}{!['APPROVED','REJECTED'].includes(proof.status)?<form action={`/api/admin/payment-proofs/${proof.id}`} method="post" className="button-row"><button className="button success" name="status" value="APPROVED"><Check aria-hidden="true"/>Paid · 30 days</button><button className="button secondary" name="status" value="MORE_INFO"><HelpCircle aria-hidden="true"/>More info</button><button className="button danger" name="status" value="REJECTED"><X aria-hidden="true"/>Reject</button></form>:null}</div></details>):null}
      {!rows.length?<div className="empty-state">No records match this queue.</div>:null}
    </div>
    <Pagination path="/admin/reviews" query={{tab,q:query.q,status}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
