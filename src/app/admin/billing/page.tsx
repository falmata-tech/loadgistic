import { requireUser } from '@/lib/auth';
import { listPaymentProofs } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { formatEtb } from '@/lib/domain.js';

export default async function AdminBilling({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const user=await requireUser(['ADMIN']);const query=await searchParams;const proofs:any[]=listPaymentProofs(user);return <div className="page"><PageHeader title="Payment proof review" subtitle="Manual subscription payment review for the MVP."/><Flash error={query.error} success={query.success}/><div className="stack">{proofs.map(p=><article className="card" key={p.id}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><div><h3>{p.organization_name||p.provider_name}</h3><div className="meta">{p.plan_name} · {formatEtb(p.amount_minor)} · reference {p.reference||'not entered'}</div></div><StatusPill status={p.status}/></div><form action={`/api/admin/payment-proofs/${p.id}`} method="post" className="hero-actions"><button className="button success" name="status" value="APPROVED">Approve</button><button className="button secondary" name="status" value="MORE_INFO">Request information</button><button className="button danger" name="status" value="REJECTED">Reject</button></form></article>)}{!proofs.length?<div className="empty">No payment proof submitted.</div>:null}</div></div>}
