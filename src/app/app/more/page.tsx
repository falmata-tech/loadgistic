import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getBillingSummary } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { formatEtb } from '@/lib/domain.js';

function planDescription(user:any){
 if(user.role==='TRANSPORTER')return 'For fleet transporters receiving business demand and publishing truck capacity.';
 if(user.role==='DRIVER')return 'For self-managed drivers and owner-operators receiving demand and publishing their own truck capacity.';
 if(user.role==='SHIPPER'||user.role==='RECEIVER')return 'For businesses posting freight loads and finding public or partner truck capacity.';
 return 'For platform administration.';
}

const roleLabels:Record<string,string>={SHIPPER:'Business',RECEIVER:'Business',TRANSPORTER:'Fleet transporter',DRIVER:'Self-managed driver',ADMIN:'Platform administrator'};

function workspaceLinks(role:string){
 if(role==='SHIPPER'||role==='RECEIVER')return [['/app/shipments/new','Create shipment'],['/app/shipments','Shipments'],['/app/providers','Find transporters'],['/app/capacity','View capacity'],['/app/company-page','Business profile']];
 if(role==='TRANSPORTER'||role==='DRIVER')return [['/app/loads','Load Board'],['/app/capacity','Capacity Board'],['/app/shipments','Shipments'],['/app/company-page','Public Profile']];
 return [['/admin/applications','Applications'],['/admin/billing','Billing review'],['/app/shipments','Shipments'],['/companies','Transporter directory']];
}

export default async function MorePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(); const query=await searchParams; const billing:any=getBillingSummary(user); const links=workspaceLinks(user.role);
 return <div className="page"><PageHeader title="Account & plan" subtitle="Manage this workspace, subscription, and profile."/><Flash error={query.error} success={query.success}/><div className="two-col"><div className="stack">
  <section className="card"><h2 style={{fontSize:'1.35rem'}}>Account</h2><p><strong>{user.name}</strong></p><p className="meta">{user.email}<br/>{roleLabels[user.role]||user.role}</p></section>
  <section className="card"><h2 style={{fontSize:'1.35rem'}}>Workspace</h2><p><strong>{user.organization_name||user.provider_business_name||'Platform administration'}</strong></p><div className="account-links">{links.map(([href,label])=><Link key={href} href={href} className="button secondary">{label}</Link>)}</div></section>
  <section className="card"><h2 style={{fontSize:'1.35rem'}}>Support</h2><p className="muted">For account access, billing, or shipment issues, contact your Loadgistic administrator.</p></section>
  <form action="/api/auth/logout" method="post"><button className="button secondary">Log out</button></form>
 </div><aside className="stack"><section className="card"><h2 style={{fontSize:'1.35rem'}}>Plan</h2>{billing.subscription?<><p><strong>{billing.subscription.plan_name}</strong></p><p className="meta">{planDescription(user)}</p><StatusPill status={billing.subscription.status}/><div className="meta" style={{marginTop:8}}>{billing.subscription.billing_model.replaceAll('_',' ')}</div></>:<p className="muted">No plan assigned yet.</p>}</section>{billing.subscription?<section className="form-card"><h2 style={{fontSize:'1.35rem'}}>Submit payment proof</h2><p className="meta">Do not upload bank passwords, PINs, or OTP codes.</p><form action="/api/billing/payment-proof" method="post" encType="multipart/form-data" className="stack"><div className="form-group"><label htmlFor="payment-amount">Amount in ETB</label><input id="payment-amount" name="amountEtb" type="number" min="1" required/></div><div className="form-group"><label htmlFor="payment-reference">Bank or transfer reference</label><input id="payment-reference" name="reference"/></div><div className="form-group"><label htmlFor="payment-file">Payment proof (optional)</label><input id="payment-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/></div><button className="button">Submit for review</button></form></section>:null}{billing.proofs?.length?<section className="card"><h2 style={{fontSize:'1.35rem'}}>Payment history</h2><div className="stack">{billing.proofs.map((p:any)=><div key={p.id}><strong>{formatEtb(p.amount_minor)}</strong> <StatusPill status={p.status}/><div className="meta">{new Date(p.submitted_at).toLocaleString()}</div></div>)}</div></section>:null}</aside></div></div>;
}
