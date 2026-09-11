import { requireUser } from '@/lib/auth';
import { getBillingSummary, getWorkspaceAccess } from '@/lib/workspace.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { formatEtb } from '@/lib/domain.js';
import { BadgeCheck, CalendarClock, CreditCard, ShieldCheck, UserRound } from 'lucide-react';
import { Pagination } from '@/components/pagination';

function planDescription(user:any){
  if(user.role==='TRANSPORTER')return 'Fleet workspace access for publishing capacity and managing Tracking.';
  if(user.provider_operating_model==='OWNER_OPERATOR')return 'Owner-operator workspace access for publishing capacity and managing Tracking.';
  if(user.provider_operating_model==='COMPANY_DRIVER')return `Company Driver access managed by ${user.organization_name}.`;
  if(user.role==='DRIVER')return 'Self-managed Driver access for publishing capacity and managing Tracking.';
  return 'Platform administration access.';
}

const roleLabels:Record<string,string>={TRANSPORTER:'Fleet transporter',DRIVER:'Self-managed driver',ADMIN:'Platform administrator'};

function accountRoleLabel(user:any){
  if(user.provider_operating_model==='COMPANY_DRIVER')return `Company driver · ${user.organization_name}`;
  if(user.provider_operating_model==='OWNER_OPERATOR')return 'Owner-operator';
  if(user.provider_operating_model==='SELF_MANAGED_DRIVER')return 'Self-managed driver';
  return roleLabels[user.role]||user.role;
}

function accessLabel(status:string){
  if(status==='TRIAL')return '7-day trial';
  if(status==='ACTIVE')return 'Paid access';
  if(status==='SPONSORED')return 'Sponsored access';
  if(status==='PAYMENT_UNDER_REVIEW')return 'Payment under review';
  if(status==='EXPIRED_UNPAID')return 'Expired · unpaid';
  return status.replaceAll('_',' ');
}

export default async function AccountPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(undefined,{allowLimited:true});
  const query=await searchParams;
  const billing:any=await getBillingSummary(user,{page:query.paymentPage,pageSize:10});
  const access=await getWorkspaceAccess(user);
  const proofResult:any=billing.proofPage;

  return <div className="page account-page"><PageHeader icon={CreditCard} title="Account & plan" subtitle="Private account details and workspace access."/><Flash error={query.error} success={query.success}/><div className="two-col account-layout"><div className="stack account-primary-stack">
    <section className="card account-private-card"><h2 className="panel-heading"><UserRound aria-hidden="true"/>Private account</h2><p><strong>{user.name}</strong></p><p className="meta">{user.email}<br/>{user.phone||'No account phone'}<br/>{accountRoleLabel(user)}</p><p className="meta">Login contacts stay private.</p></section>
    {billing.subscription&&access.status!=='SPONSORED'?<section className="form-card account-payment-card"><h2 className="panel-heading"><CreditCard aria-hidden="true"/>Submit payment</h2><p className="meta">Add payment details. Never upload passwords, PINs, or one-time codes.</p><form action="/api/billing/payment-proof" method="post" encType="multipart/form-data" className="stack"><div className="form-group"><label htmlFor="payment-amount"><CreditCard aria-hidden="true"/>Amount paid (ETB)</label><input id="payment-amount" name="amountEtb" type="number" min="1" required/></div><div className="form-group"><label htmlFor="payment-reference"><ShieldCheck aria-hidden="true"/>Transfer reference</label><input id="payment-reference" name="reference"/></div><div className="form-group"><label htmlFor="payment-file"><BadgeCheck aria-hidden="true"/>Proof <span className="meta">(optional)</span></label><input id="payment-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/></div><button className="button icon-button-label"><CreditCard aria-hidden="true"/>Submit for review</button></form></section>:null}
  </div><aside className="stack account-plan-stack"><section className={`card plan-status-card ${access.granted?'':'limited'}`}><div className="section-heading-icon">{access.status==='SPONSORED'?<ShieldCheck aria-hidden="true"/>:<CalendarClock aria-hidden="true"/>}<div><h2>Plan</h2><p className="meta">{billing.subscription?.plan_name||'No plan assigned'}</p></div></div>{billing.subscription?<><p className="meta">{planDescription(user)}</p><StatusPill status={access.status}/><p className="plan-access-label">{accessLabel(access.status)}</p>{access.ends_at?<div className="plan-deadline"><span>{access.granted?'Access through':'Access ended'}</span><strong>{new Date(access.ends_at).toLocaleDateString()}</strong></div>:null}</>:<p className="muted">Contact support for a plan.</p>}</section>{proofResult.total?<section className="card account-proof-history"><h2 className="panel-heading"><CalendarClock aria-hidden="true"/>Payment history</h2><div className="stack">{proofResult.items.map((proof:any)=><div key={proof.id}><strong>{formatEtb(proof.amount_minor)}</strong> <StatusPill status={proof.status}/><div className="meta">{new Date(proof.submitted_at).toLocaleString()}{proof.has_file?<><br/><a href={`/api/files/payment-proof/${proof.id}`} target="_blank">Open proof</a></>:null}</div></div>)}</div><Pagination path="/app/more" query={{}} page={proofResult.page} pageCount={proofResult.pageCount} total={proofResult.total} pageParam="paymentPage"/></section>:null}</aside></div></div>;
}
