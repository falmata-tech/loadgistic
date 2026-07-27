import { requireUser } from '@/lib/auth';
import { getVerificationCenter } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { VerificationBadges } from '@/components/verification-badges';
import { VerificationForm } from '@/components/verification-form';
import { BadgeCheck } from 'lucide-react';

export default async function VerificationPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['SHIPPER','RECEIVER','TRANSPORTER','DRIVER']);
  const query=await searchParams;
  const center:any=getVerificationCenter(user);
  return <div className="page">
    <PageHeader title="Verification Center" subtitle="Verify your Business, driver identity, and trucks with private documents."/>
    <Flash error={query.error} success={query.success}/>
    <div className="two-col">
      <div className="stack">
        <section className="card"><div className="section-heading-icon"><BadgeCheck aria-hidden="true"/><div><h2>Verification status</h2><p className="meta">Blue means approved by an administrator. Gray means it is not yet verified.</p></div></div>
          <div className="verification-subject-list">{center.subjects.map((subject:any)=><div key={`${subject.subject_type}:${subject.subject_id}`}><div><strong>{subject.name}</strong><div className="meta">{subject.type}</div></div><VerificationBadges badges={subject.badges}/></div>)}</div>
        </section>
        <VerificationForm subjects={center.subjects}/>
      </div>
      <aside className="card verification-history"><h2>Request history</h2><div className="stack">{center.requests.map((request:any)=><div className="request-history-row" key={request.id}><div><strong>{request.document_name}</strong><div className="meta">{request.verification_type.replaceAll('_',' ')} · {new Date(request.submitted_at).toLocaleString()}</div></div><StatusPill status={request.status}/>{request.review_note?<p>{request.review_note}</p>:null}<a href={`/api/files/verification/${request.id}`} target="_blank">Open document</a></div>)}{!center.requests.length?<p className="muted">No verification requests submitted yet.</p>:null}</div></aside>
    </div>
  </div>;
}
