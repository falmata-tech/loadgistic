import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getBillingSummary, getWorkspaceAccess, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { formatEtb } from '@/lib/domain.js';
import { LogoutButton } from '@/components/logout-button';
import { CalendarClock, CreditCard, ShieldCheck } from 'lucide-react';
import { Pagination } from '@/components/pagination';

function planDescription(user:any){
 if(user.role==='TRANSPORTER')return 'For fleet transporters receiving business demand and publishing truck capacity.';
 if(user.role==='DRIVER')return 'For self-managed drivers and owner-operators receiving demand and publishing their own truck capacity.';
 if(user.role==='SHIPPER'||user.role==='RECEIVER')return 'For businesses posting freight loads and finding public or partner truck capacity.';
 return 'For platform administration.';
}

const roleLabels:Record<string,string>={SHIPPER:'Business',RECEIVER:'Business',TRANSPORTER:'Fleet transporter',DRIVER:'Self-managed driver',ADMIN:'Platform administrator'};

function accessLabel(status:string){
 if(status==='TRIAL')return '7-day trial';
 if(status==='ACTIVE')return 'Paid access';
 if(status==='SPONSORED')return 'Sponsored Business access';
 if(status==='PAYMENT_UNDER_REVIEW')return 'Payment under review';
 if(status==='EXPIRED_UNPAID')return 'Expired · unpaid';
 return status.replaceAll('_',' ');
}

function workspaceLinks(role:string){
 if(role==='SHIPPER'||role==='RECEIVER')return [['/app/shipments','My Loads'],['/app/providers','Directory'],['/app/capacity','Capacity Board'],['/app/company-page','Public Profile'],['/app/verification','Verification']];
 if(role==='TRANSPORTER'||role==='DRIVER')return [['/app/loads','Load Board'],['/app/capacity','Capacity Board'],['/app/shipments','Tracking'],['/app/providers','Directory'],['/app/company-page','Public Profile'],['/app/verification','Verification']];
 return [['/admin/operations','Operations'],['/admin/applications','Applications'],['/admin/verifications','Verification requests'],['/admin/ratings','Rating Reviews'],['/admin/billing','Billing review'],['/app/shipments','Tracking'],['/app/providers','Directory']];
}

export default async function MorePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(undefined,{allowLimited:true}); const query=await searchParams; const billing:any=getBillingSummary(user); const access=getWorkspaceAccess(user); const links=access.granted?workspaceLinks(user.role):[]; const proofResult:any=paginateResults(billing.proofs||[],{page:query.paymentPage,pageSize:10});
 return <div className="page"><PageHeader title="Account & plan" subtitle="Manage this workspace, subscription, and profile."/><Flash error={query.error} success={query.success}/><div className="two-col"><div className="stack">
	  <section className="card"><h2 style={{fontSize:'1.35rem'}}>Private account</h2><p><strong>{user.name}</strong></p><p className="meta">{user.email}<br/>{user.phone||'No account phone'}<br/>{roleLabels[user.role]||user.role}</p><p className="meta">These login and account contacts are not shown on your Public Profile.</p></section>
  <section className="card"><h2 style={{fontSize:'1.35rem'}}>Workspace</h2><p><strong>{user.organization_name||user.provider_business_name||'Platform administration'}</strong></p>{access.granted?<div className="account-links">{links.map(([href,label])=><Link key={href} href={href} className="button secondary">{label}</Link>)}</div>:<div className="billing-inline-notice"><CreditCard aria-hidden="true"/><span>Operating links return after payment approval.</span></div>}</section>
  <section className="card"><h2 style={{fontSize:'1.35rem'}}>Support</h2><p className="muted">For account access, billing, or shipment issues, contact your Loadgistic administrator.</p></section>
  <LogoutButton compact/>
 </div><aside className="stack"><section className={`card plan-status-card ${access.granted?'':'limited'}`}><div className="section-heading-icon">{access.status==='SPONSORED'?<ShieldCheck aria-hidden="true"/>:<CalendarClock aria-hidden="true"/>}<div><h2>Plan</h2><p className="meta">{billing.subscription?.plan_name||'No plan assigned'}</p></div></div>{billing.subscription?<><p className="meta">{planDescription(user)}</p><StatusPill status={access.status}/><p className="plan-access-label">{accessLabel(access.status)}</p>{access.ends_at?<div className="plan-deadline"><span>{access.granted?'Access through':'Access ended'}</span><strong>{new Date(access.ends_at).toLocaleDateString()}</strong></div>:null}</>:<p className="muted">Contact Loadgistic support to assign this workspace plan.</p>}</section>{billing.subscription&&access.status!=='SPONSORED'?<section className="form-card"><h2 style={{fontSize:'1.35rem'}}>Submit payment</h2><p className="meta">Enter the amount you paid. Standard plan prices are not displayed yet. Never upload bank passwords, PINs, or OTP codes.</p><form action="/api/billing/payment-proof" method="post" encType="multipart/form-data" className="stack"><div className="form-group"><label htmlFor="payment-amount">Amount paid in ETB</label><input id="payment-amount" name="amountEtb" type="number" min="1" required/></div><div className="form-group"><label htmlFor="payment-reference">Bank or transfer reference</label><input id="payment-reference" name="reference"/></div><div className="form-group"><label htmlFor="payment-file">Payment proof (optional)</label><input id="payment-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/></div><button className="button icon-button-label"><CreditCard aria-hidden="true"/>Submit for review</button></form></section>:null}{proofResult.total?<section className="card"><h2 style={{fontSize:'1.35rem'}}>Payment history</h2><div className="stack">{proofResult.items.map((p:any)=><div key={p.id}><strong>{formatEtb(p.amount_minor)}</strong> <StatusPill status={p.status}/><div className="meta">{new Date(p.submitted_at).toLocaleString()}</div></div>)}</div><Pagination path="/app/more" query={{}} page={proofResult.page} pageCount={proofResult.pageCount} total={proofResult.total} pageParam="paymentPage"/></section>:null}</aside></div></div>;
}
