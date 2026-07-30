import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getBillingSummary, getWorkspaceAccess, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { formatEtb } from '@/lib/domain.js';
import { LogoutButton } from '@/components/logout-button';
import {
  BadgeCheck,
  Boxes,
  Building2,
  CalendarClock,
  CreditCard,
  Headphones,
  LayoutList,
  MapPin,
  Search,
  ShieldCheck,
  Truck,
  UserRound
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
 if(role==='SHIPPER'||role==='RECEIVER'||role==='TRANSPORTER'||role==='DRIVER')return [['/app/company-page','Public Profile'],['/app/verification','Verification']];
 return [['/admin/operations','Operations'],['/admin/reviews','Review Center'],['/app/shipments','Tracking'],['/app/providers','Directory']];
}

function workspaceLinkIcon(href:string):LucideIcon {
 if(href.includes('/shipments'))return Boxes;
 if(href.includes('/loads'))return LayoutList;
 if(href.includes('/capacity'))return Truck;
 if(href.includes('/providers'))return Search;
 if(href.includes('/company-page'))return Building2;
 if(href.includes('/verification'))return BadgeCheck;
 if(href.includes('/admin'))return ShieldCheck;
 return MapPin;
}

export default async function MorePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(undefined,{allowLimited:true}); const query=await searchParams; const billing:any=getBillingSummary(user); const access=getWorkspaceAccess(user); const links=access.granted?workspaceLinks(user.role):[]; const proofResult:any=paginateResults(billing.proofs||[],{page:query.paymentPage,pageSize:10});
 return <div className="page"><PageHeader icon={CreditCard} title="Account & plan" subtitle="Account, access, and payment."/><Flash error={query.error} success={query.success}/><div className="two-col"><div className="stack">
	  <section className="card"><h2 className="panel-heading"><UserRound aria-hidden="true"/>Private account</h2><p><strong>{user.name}</strong></p><p className="meta">{user.email}<br/>{user.phone||'No account phone'}<br/>{roleLabels[user.role]||user.role}</p><p className="meta">Login contacts stay private.</p></section>
  <section className="card"><h2 className="panel-heading"><Building2 aria-hidden="true"/>{user.role==='ADMIN'?'Admin tools':'Account tools'}</h2><p><strong>{user.organization_name||user.provider_business_name||'Platform administration'}</strong></p>{access.granted?<div className="account-links">{links.map(([href,label])=>{const Icon=workspaceLinkIcon(href);return <Link key={href} href={href} className="button secondary"><Icon aria-hidden="true"/>{label}</Link>})}</div>:<div className="billing-inline-notice"><CreditCard aria-hidden="true"/><span>Links return after payment approval.</span></div>}</section>
  <section className="card"><h2 className="panel-heading"><Headphones aria-hidden="true"/>Support</h2><p className="muted">Account, billing, or load help.</p></section>
  <LogoutButton compact/>
 </div><aside className="stack"><section className={`card plan-status-card ${access.granted?'':'limited'}`}><div className="section-heading-icon">{access.status==='SPONSORED'?<ShieldCheck aria-hidden="true"/>:<CalendarClock aria-hidden="true"/>}<div><h2>Plan</h2><p className="meta">{billing.subscription?.plan_name||'No plan assigned'}</p></div></div>{billing.subscription?<><p className="meta">{planDescription(user)}</p><StatusPill status={access.status}/><p className="plan-access-label">{accessLabel(access.status)}</p>{access.ends_at?<div className="plan-deadline"><span>{access.granted?'Access through':'Access ended'}</span><strong>{new Date(access.ends_at).toLocaleDateString()}</strong></div>:null}</>:<p className="muted">Contact support for a plan.</p>}</section>{billing.subscription&&access.status!=='SPONSORED'?<section className="form-card"><h2 className="panel-heading"><CreditCard aria-hidden="true"/>Submit payment</h2><p className="meta">Add payment details. Never upload passwords, PINs, or OTP codes.</p><form action="/api/billing/payment-proof" method="post" encType="multipart/form-data" className="stack"><div className="form-group"><label htmlFor="payment-amount"><CreditCard aria-hidden="true"/>Amount paid (ETB)</label><input id="payment-amount" name="amountEtb" type="number" min="1" required/></div><div className="form-group"><label htmlFor="payment-reference"><ShieldCheck aria-hidden="true"/>Transfer reference</label><input id="payment-reference" name="reference"/></div><div className="form-group"><label htmlFor="payment-file"><BadgeCheck aria-hidden="true"/>Proof <span className="meta">(optional)</span></label><input id="payment-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/></div><button className="button icon-button-label"><CreditCard aria-hidden="true"/>Submit for review</button></form></section>:null}{proofResult.total?<section className="card"><h2 className="panel-heading"><CalendarClock aria-hidden="true"/>Payment history</h2><div className="stack">{proofResult.items.map((p:any)=><div key={p.id}><strong>{formatEtb(p.amount_minor)}</strong> <StatusPill status={p.status}/><div className="meta">{new Date(p.submitted_at).toLocaleString()}</div></div>)}</div><Pagination path="/app/more" query={{}} page={proofResult.page} pageCount={proofResult.pageCount} total={proofResult.total} pageParam="paymentPage"/></section>:null}</aside></div></div>;
}
