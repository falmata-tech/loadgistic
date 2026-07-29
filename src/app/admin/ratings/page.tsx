import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listRatingModerationQueue } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { Check, PackageSearch, Search, ShieldAlert, Star, X } from 'lucide-react';
import { Pagination } from '@/components/pagination';

const statuses=['PENDING','PUBLISHED','DISMISSED'] as const;

export default async function AdminRatingsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['ADMIN']);
  const query=await searchParams;
  const selected=statuses.includes(String(query.status||'PENDING').toUpperCase() as typeof statuses[number])
    ? String(query.status||'PENDING').toUpperCase()
    : 'PENDING';
  const result:any=listRatingModerationQueue(user,selected,{page:query.page,pageSize:12});
  const reviews:any[]=result.items;
  return <div className="page">
    <PageHeader title="Rating Reviews" subtitle="Investigate private one- to three-star Business ratings before they affect public reputation."/>
    <Flash error={query.error} success={query.success}/>
    <nav className="segmented-control rating-status-tabs" aria-label="Rating review status">
      {statuses.map(status=><Link key={status} href={`/admin/ratings?status=${status}`} className={selected===status?'active':''}>{status.charAt(0)+status.slice(1).toLowerCase()}</Link>)}
    </nav>
    <div className="stack">
      {reviews.map(review=><article className="card verification-review-card" key={review.id}>
        <div className="split">
          <div><span className="meta">Rating</span><strong className="icon-button-label"><Star aria-hidden="true"/>{review.rating} of 5</strong></div>
          <div><span className="meta">Reviewer</span><strong>{review.reviewer_name}</strong></div>
          <div><span className="meta">Business reviewed</span><strong>{review.subject_name}</strong></div>
          <StatusPill status={review.status}/>
        </div>
        <h3>{review.shipment_code} · {review.shipment_title}</h3>
        <p className="meta">{review.origin} → {review.destination} · Submitted by {review.submitted_by_name} · {new Date(review.created_at).toLocaleString()}</p>
        <div className="rating-investigation-note"><ShieldAlert aria-hidden="true"/><p>{review.note}</p></div>
        <div className="button-row">
          <Link className="button secondary icon-button-label" href={`/app/shipments/${review.shipment_id}`}><PackageSearch aria-hidden="true"/>Open load</Link>
          <Link className="button secondary icon-button-label" href={`/admin/operations?q=${encodeURIComponent(review.subject_name)}`}><Search aria-hidden="true"/>Investigate account</Link>
        </div>
        {review.status==='PENDING'?<form action={`/api/admin/ratings/${review.id}`} method="post" className="verification-review-actions">
          <div className="form-group"><label htmlFor={`rating-review-note-${review.id}`}>Investigation note</label><textarea id={`rating-review-note-${review.id}`} name="reviewNote" required placeholder="Record the evidence checked and outcome"/></div>
          <button className="button success icon-button-label" name="status" value="PUBLISHED"><Check aria-hidden="true"/>Publish rating</button>
          <button className="button danger icon-button-label" name="status" value="DISMISSED"><X aria-hidden="true"/>Dismiss rating</button>
        </form>:<div className="rating-decision"><strong>{review.reviewed_by_name||'Administrator'}</strong><p>{review.review_note}</p><span className="meta">{review.reviewed_at?new Date(review.reviewed_at).toLocaleString():''}</span></div>}
      </article>)}
      {!reviews.length?<div className="empty-state">No {selected.toLowerCase()} rating reviews.</div>:null}
    </div>
    <Pagination path="/admin/ratings" query={{status:selected}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
