import Link from 'next/link';
import { BadgeCheck, Check, ClipboardCheck, CreditCard, ExternalLink, HelpCircle, Search, ShieldAlert, Star, X } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listApplications, listPaymentProofs, listRatingModerationQueue, listVerificationRequests } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { Pagination } from '@/components/pagination';
import { formatEtb } from '@/lib/domain.js';

const tabs=[
  {id:'applications',label:'Applications',icon:ClipboardCheck},
  {id:'documents',label:'Documents',icon:BadgeCheck},
  {id:'ratings',label:'Ratings',icon:Star},
  {id:'payments',label:'Payments',icon:CreditCard}
] as const;
const accountTypeLabels:Record<string,string>={ENTERPRISE_SHIPPER:'Business',ENTERPRISE_RECEIVER:'Business',TRANSPORT_COMPANY:'Fleet transporter',INDEPENDENT_PROVIDER:'Self-managed driver'};
const businessApplicationTypes=new Set(['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER']);

export default async function AdminReviewsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN']);
  const query=await searchParams;
  const requested=String(query.tab||'applications').toLowerCase();
  const tab=tabs.some(item=>item.id===requested)?requested:'applications';
  const status=String(query.status||(tab==='ratings'?'PENDING':'ALL')).toUpperCase();
  const options={q:query.q,status,page:query.page,pageSize:12};
  const result:any=tab==='applications'
    ? listApplications(user,options)
    : tab==='documents'
      ? listVerificationRequests(user,options)
      : tab==='payments'
        ? listPaymentProofs(user,options)
        : listRatingModerationQueue(user,['PENDING','PUBLISHED','DISMISSED'].includes(status)?status:'PENDING',{page:query.page,pageSize:12});
  const rows:any[]=result.items;

  return <div className="page admin-review-center">
    <PageHeader title="Review Center" subtitle="Applications, trust documents, ratings, and payments in one focused queue."/>
    <Flash error={query.error} success={query.success}/>
    <nav className="admin-view-tabs" aria-label="Review queue">
      {tabs.map(item=>{const Icon=item.icon;return <Link key={item.id} className={tab===item.id?'active':''} href={`/admin/reviews?tab=${item.id}`}><Icon aria-hidden="true"/>{item.label}</Link>;})}
    </nav>
    <form className="board-filter-bar queue-filter-bar" method="get">
      <input type="hidden" name="tab" value={tab}/>
      {tab!=='ratings'?<div className="form-group"><label htmlFor="review-search"><Search aria-hidden="true"/>Search {tabs.find(item=>item.id===tab)?.label}</label><input id="review-search" name="q" defaultValue={query.q||''} placeholder="Name, account, document, or reference"/></div>:null}
      <div className="form-group"><label htmlFor="review-status">Status</label><select id="review-status" name="status" defaultValue={status}>{tab==='ratings'?<><option value="PENDING">Pending</option><option value="PUBLISHED">Published</option><option value="DISMISSED">Dismissed</option></>:<><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="MORE_INFO">More information</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></>}</select></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Apply</button>
    </form>
    <div className="admin-review-list">
      {tab==='applications'?rows.map(app=><details className="admin-review-row" key={app.id}><summary><span><strong>{app.business_name}</strong><small>{accountTypeLabels[app.application_type]||app.application_type} · {app.name} · {app.email}</small></span><StatusPill status={app.status}/></summary><div className="admin-review-body"><p>{app.notes}</p>{app.sponsored_free?<p className="status green">Sponsored Business access</p>:null}{!['APPROVED','REJECTED'].includes(app.status)?<form action={`/api/admin/applications/${app.id}`} method="post" className="form-grid"><div className="form-group"><label htmlFor={`decision-${app.id}`}>Decision</label><select id={`decision-${app.id}`} name="status" defaultValue="APPROVED"><option value="APPROVED">Approve · 7-day trial</option><option value="MORE_INFO">More information</option><option value="REJECTED">Reject</option></select></div><div className="form-group"><label htmlFor={`review-note-${app.id}`}>Review note</label><input id={`review-note-${app.id}`} name="notes" placeholder="Reason or next step"/></div>{businessApplicationTypes.has(app.application_type)?<label className="rich-toggle full"><input name="sponsoredFree" type="checkbox"/><span className="toggle-track" aria-hidden="true"/><span><strong>Sponsored free access</strong><small>Qualifying starting Business only</small></span></label>:null}<button className="button"><Check aria-hidden="true"/>Save</button></form>:null}</div></details>):null}
      {tab==='documents'?rows.map(request=><details className="admin-review-row" key={request.id}><summary><span><strong>{request.document_name}</strong><small>{request.submitter_name} · {request.subject_type.replaceAll('_',' ')} · {request.verification_type.replaceAll('_',' ')}</small></span><StatusPill status={request.status}/></summary><div className="admin-review-body"><p className="meta">{request.original_name} · {new Date(request.submitted_at).toLocaleString()}</p><a className="button secondary icon-button-label" href={`/api/files/verification/${request.id}`} target="_blank"><ExternalLink aria-hidden="true"/>Open private document</a>{!['APPROVED','REJECTED'].includes(request.status)?<form action={`/api/admin/verifications/${request.id}`} method="post" className="verification-review-actions"><div className="form-group"><label htmlFor={`verification-note-${request.id}`}>Review note</label><input id={`verification-note-${request.id}`} name="note" placeholder="Reason or next step"/></div><button className="button success" name="status" value="APPROVED"><Check aria-hidden="true"/>Approve</button><button className="button secondary" name="status" value="MORE_INFO"><HelpCircle aria-hidden="true"/>More info</button><button className="button danger" name="status" value="REJECTED"><X aria-hidden="true"/>Reject</button></form>:request.review_note?<p>{request.review_note}</p>:null}</div></details>):null}
      {tab==='ratings'?rows.map(review=><details className="admin-review-row" key={review.id}><summary><span><strong>{review.rating} of 5 · {review.subject_name}</strong><small>{review.shipment_code} · reported by {review.reviewer_name}</small></span><StatusPill status={review.status}/></summary><div className="admin-review-body"><div className="rating-investigation-note"><ShieldAlert aria-hidden="true"/><p>{review.note}</p></div><div className="button-row"><Link className="button secondary" href={`/app/shipments/${review.shipment_id}`}>Open load</Link><Link className="button secondary" href={`/admin/operations?view=WORKSPACES&q=${encodeURIComponent(review.subject_name)}`}>Investigate client</Link></div>{review.status==='PENDING'?<form action={`/api/admin/ratings/${review.id}`} method="post" className="verification-review-actions"><div className="form-group"><label htmlFor={`rating-note-${review.id}`}>Investigation note</label><textarea id={`rating-note-${review.id}`} name="reviewNote" required/></div><button className="button success" name="status" value="PUBLISHED"><Check aria-hidden="true"/>Publish</button><button className="button danger" name="status" value="DISMISSED"><X aria-hidden="true"/>Dismiss</button></form>:<p>{review.review_note}</p>}</div></details>):null}
      {tab==='payments'?rows.map(proof=><details className="admin-review-row" key={proof.id}><summary><span><strong>{proof.organization_name||proof.provider_name}</strong><small>{proof.plan_name} · {formatEtb(proof.amount_minor)} · {proof.reference||'No reference'}</small></span><StatusPill status={proof.status}/></summary><div className="admin-review-body"><p className="meta">Current access: {String(proof.subscription_status).replaceAll('_',' ')}{proof.subscription_ends_at?` · through ${new Date(proof.subscription_ends_at).toLocaleDateString()}`:''}</p>{!['APPROVED','REJECTED'].includes(proof.status)?<form action={`/api/admin/payment-proofs/${proof.id}`} method="post" className="button-row"><button className="button success" name="status" value="APPROVED"><Check aria-hidden="true"/>Paid · 30 days</button><button className="button secondary" name="status" value="MORE_INFO"><HelpCircle aria-hidden="true"/>More info</button><button className="button danger" name="status" value="REJECTED"><X aria-hidden="true"/>Reject</button></form>:null}</div></details>):null}
      {!rows.length?<div className="empty-state">No records match this queue.</div>:null}
    </div>
    <Pagination path="/admin/reviews" query={{tab,q:query.q,status}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
