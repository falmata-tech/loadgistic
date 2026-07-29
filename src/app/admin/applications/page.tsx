import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listApplications, listAudit } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { Pagination } from '@/components/pagination';

const accountTypeLabels:Record<string,string>={ENTERPRISE_SHIPPER:'Business',ENTERPRISE_RECEIVER:'Business',TRANSPORT_COMPANY:'Fleet transporter',INDEPENDENT_PROVIDER:'Self-managed driver / owner-operator'};
const businessApplicationTypes=new Set(['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER']);

export default async function ApplicationsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN']);
  const query=await searchParams;
  const status=query.status||'ALL';
  const result:any=listApplications(user,{q:query.q,status,page:query.page,pageSize:20});
  const audit:any[]=listAudit(user);
  return <div className="page">
    <PageHeader title="Workspace applications" subtitle="Review businesses looking for capacity and transporters looking for demand."/>
    <Flash error={query.error} success={query.success}/>
    <form className="board-filter-bar queue-filter-bar" method="get">
      <div className="form-group"><label htmlFor="application-search"><Search aria-hidden="true"/>Search applications</label><input id="application-search" name="q" defaultValue={query.q||''} placeholder="Business, applicant, or email"/></div>
      <div className="form-group"><label htmlFor="application-status">Status</label><select id="application-status" name="status" defaultValue={status}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="MORE_INFO">More information</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Filter</button>
      {query.q||status!=='ALL'?<Link href="/admin/applications" className="button secondary">Clear</Link>:null}
    </form>
    <div className="two-col"><section className="stack">{result.items.map((app:any)=><article className="card" key={app.id}><div className="split"><div><h3>{app.business_name}</h3><div className="meta">{accountTypeLabels[app.application_type]||app.application_type} · {app.email}</div></div><StatusPill status={app.status}/></div><p>{app.notes}</p>{app.sponsored_free?<p className="status green">Sponsored Business access</p>:null}{!['APPROVED','REJECTED'].includes(app.status)?<form action={`/api/admin/applications/${app.id}`} method="post" className="form-grid"><div className="form-group"><label htmlFor={`decision-${app.id}`}>Decision</label><select id={`decision-${app.id}`} name="status" defaultValue="APPROVED"><option value="APPROVED">Approve with 7-day trial</option><option value="MORE_INFO">Request more information</option><option value="REJECTED">Reject</option></select></div><div className="form-group"><label htmlFor={`review-note-${app.id}`}>Review note</label><input id={`review-note-${app.id}`} name="notes" placeholder="Reason or next step"/></div>{businessApplicationTypes.has(app.application_type)?<label className="rich-toggle full"><input name="sponsoredFree" type="checkbox"/><span className="toggle-track" aria-hidden="true"/><span><strong>Sponsored free access</strong><small>Use only for a qualifying small Business starting out. This has no payment deadline.</small></span></label>:null}<button className="button" type="submit">Save decision</button></form>:null}</article>)}{!result.items.length?<div className="empty-state">No applications match these filters.</div>:null}<Pagination path="/admin/applications" query={{q:query.q,status}} page={result.page} pageCount={result.pageCount} total={result.total}/></section>
      <aside className="card"><h3>Recent audit activity</h3>{audit.length?<div className="stack">{audit.slice(0,12).map(row=><div key={row.id}><strong>{row.action.replaceAll('_',' ')}</strong><div className="meta">{row.actor_name||'System'} · {row.entity_type} · {new Date(row.created_at).toLocaleString()}</div></div>)}</div>:<p className="muted">Review activity will appear here.</p>}</aside>
    </div>
  </div>;
}
