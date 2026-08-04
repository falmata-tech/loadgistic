import { requireUser } from '@/lib/auth';
import { getVerificationCenter, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { VerificationBadges } from '@/components/verification-badges';
import { VerificationForm } from '@/components/verification-form';
import { BadgeCheck } from 'lucide-react';
import { Pagination } from '@/components/pagination';

export default async function VerificationPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['SHIPPER','RECEIVER','TRANSPORTER','DRIVER']);
  const query=await searchParams;
  const center:any=getVerificationCenter(user);
  const subjectResult:any=paginateResults(center.subjects,{page:query.subjectPage,pageSize:10});
  const requestResult:any=paginateResults(center.requests,{page:query.requestPage,pageSize:10});
  const formSubjects=center.subjects.map((subject:any)=>({
    subject_type:String(subject.subject_type),
    subject_id:String(subject.subject_id),
    name:String(subject.name),
    type:String(subject.type),
    allowed_types:[...subject.allowed_types].map(String),
    vehicles:(subject.vehicles||[]).map((vehicle:any)=>({id:String(vehicle.id),label:String(vehicle.label)}))
  }));
  return <div className="page">
    <PageHeader icon={BadgeCheck} title="Verification" subtitle="Specific document signals—not a guarantee about a person, company, truck, or shipment."/>
    <Flash error={query.error} success={query.success}/>
    <div className="two-col">
      <div className="stack">
        <section className="card"><div className="section-heading-icon"><BadgeCheck aria-hidden="true"/><div><h2>Badge status</h2><p className="meta">Open any badge for its scope, review date, and expiry details.</p></div></div>
          <div className="verification-subject-list">{subjectResult.items.map((subject:any)=><div key={`${subject.subject_type}:${subject.subject_id}`}><div><strong>{subject.name}</strong><div className="meta">{subject.type}</div></div><VerificationBadges badges={subject.badges}/></div>)}</div>
          <Pagination path="/app/verification" query={{requestPage:query.requestPage}} page={subjectResult.page} pageCount={subjectResult.pageCount} total={subjectResult.total} pageParam="subjectPage"/>
        </section>
        <VerificationForm subjects={formSubjects}/>
      </div>
      <aside className="card verification-history"><h2>Request history</h2><div className="stack">{requestResult.items.map((request:any)=><div className="request-history-row" key={request.id}><div><strong>{request.document_name}</strong><div className="meta">{request.verification_type.replaceAll('_',' ')} · {new Date(request.submitted_at).toLocaleString()}{request.expires_on?` · expires ${request.expires_on}`:''}</div></div><StatusPill status={request.status}/>{request.review_note?<p>{request.review_note}</p>:null}<a href={`/api/files/verification/${request.id}`} target="_blank">Open document</a></div>)}{!requestResult.items.length?<p className="muted">No verification requests submitted yet.</p>:null}</div><Pagination path="/app/verification" query={{subjectPage:query.subjectPage}} page={requestResult.page} pageCount={requestResult.pageCount} total={requestResult.total} pageParam="requestPage"/></aside>
    </div>
  </div>;
}
