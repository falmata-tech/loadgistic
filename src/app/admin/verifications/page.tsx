import Link from 'next/link';
import { Check, ExternalLink, HelpCircle, Search, X } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listVerificationRequests } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { Pagination } from '@/components/pagination';

export default async function AdminVerificationsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['ADMIN']);
  const query=await searchParams;
  const status=query.status||'ALL';
  const result:any=listVerificationRequests(user,{q:query.q,status,page:query.page,pageSize:20});
  return <div className="page">
    <PageHeader title="Verification requests" subtitle="Review private identity, license, driver, and truck evidence."/>
    <Flash error={query.error} success={query.success}/>
    <form className="board-filter-bar queue-filter-bar" method="get">
      <div className="form-group"><label htmlFor="verification-search"><Search aria-hidden="true"/>Search requests</label><input id="verification-search" name="q" defaultValue={query.q||''} placeholder="Member, document, subject, or type"/></div>
      <div className="form-group"><label htmlFor="verification-status">Status</label><select id="verification-status" name="status" defaultValue={status}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="MORE_INFO">More information</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Filter</button>
      {query.q||status!=='ALL'?<Link href="/admin/verifications" className="button secondary">Clear</Link>:null}
    </form>
    <div className="stack">{result.items.map((request:any)=><article className="card verification-review-card" key={request.id}>
      <div className="split"><div><span className="meta">Submitted by</span><strong>{request.submitter_name}</strong></div><div><span className="meta">Subject</span><strong>{request.subject_type.replaceAll('_',' ')}</strong></div><div><span className="meta">Verification</span><strong>{request.verification_type.replaceAll('_',' ')}</strong></div><StatusPill status={request.status}/></div>
      <h3>{request.document_name}</h3><p className="meta">{request.original_name} · {new Date(request.submitted_at).toLocaleString()}</p>
      <a className="button secondary icon-button-label" href={`/api/files/verification/${request.id}`} target="_blank"><ExternalLink aria-hidden="true"/>Open private document</a>
      {!['APPROVED','REJECTED'].includes(request.status)?<form action={`/api/admin/verifications/${request.id}`} method="post" className="verification-review-actions"><div className="form-group"><label htmlFor={`verification-note-${request.id}`}>Review note</label><input id={`verification-note-${request.id}`} name="note" placeholder="Reason or next step"/></div><button className="button success icon-button-label" name="status" value="APPROVED"><Check aria-hidden="true"/>Approve</button><button className="button secondary icon-button-label" name="status" value="MORE_INFO"><HelpCircle aria-hidden="true"/>More information</button><button className="button danger icon-button-label" name="status" value="REJECTED"><X aria-hidden="true"/>Reject</button></form>:request.review_note?<p>{request.review_note}</p>:null}
    </article>)}{!result.items.length?<div className="empty-state">No verification requests match these filters.</div>:null}</div>
    <Pagination path="/admin/verifications" query={{q:query.q,status}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
