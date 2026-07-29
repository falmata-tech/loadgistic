import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listPaymentProofs } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { Pagination } from '@/components/pagination';
import { formatEtb } from '@/lib/domain.js';

export default async function AdminBilling({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN']);
  const query=await searchParams;
  const status=query.status||'ALL';
  const result:any=listPaymentProofs(user,{q:query.q,status,page:query.page,pageSize:20});
  return <div className="page">
    <PageHeader title="Payment review" subtitle="Mark a submitted payment paid to open 30 days of workspace access."/>
    <Flash error={query.error} success={query.success}/>
    <form className="board-filter-bar queue-filter-bar" method="get">
      <div className="form-group"><label htmlFor="payment-search"><Search aria-hidden="true"/>Search payments</label><input id="payment-search" name="q" defaultValue={query.q||''} placeholder="Workspace, reference, or plan"/></div>
      <div className="form-group"><label htmlFor="payment-status">Status</label><select id="payment-status" name="status" defaultValue={status}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="MORE_INFO">More information</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Filter</button>
      {query.q||status!=='ALL'?<Link href="/admin/billing" className="button secondary">Clear</Link>:null}
    </form>
    <div className="stack">{result.items.map((proof:any)=><article className="card" key={proof.id}><div className="split"><div><h3>{proof.organization_name||proof.provider_name}</h3><div className="meta">{proof.plan_name} · {formatEtb(proof.amount_minor)} · reference {proof.reference||'not entered'}</div><div className="meta">Current access: {String(proof.subscription_status).replaceAll('_',' ')}{proof.subscription_ends_at?` · through ${new Date(proof.subscription_ends_at).toLocaleDateString()}`:''}</div></div><StatusPill status={proof.status}/></div>{!['APPROVED','REJECTED'].includes(proof.status)?<form action={`/api/admin/payment-proofs/${proof.id}`} method="post" className="hero-actions"><button className="button success" name="status" value="APPROVED">Mark paid · 30 days</button><button className="button secondary" name="status" value="MORE_INFO">Request information</button><button className="button danger" name="status" value="REJECTED">Reject</button></form>:null}</article>)}{!result.items.length?<div className="empty-state">No payment proofs match these filters.</div>:null}</div>
    <Pagination path="/admin/billing" query={{q:query.q,status}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
