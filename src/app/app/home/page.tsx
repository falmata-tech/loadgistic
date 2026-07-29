import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getBillingSummary, getDashboard, getDriverAccess, getFleetNetworkCoverage, getWorkspaceAccess, listOwnCapacity, listOwnVehicles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Flash } from '@/components/flash';
import { DriverCapacityHome } from '@/components/driver-capacity-home';
import { NetworkCoverage } from '@/components/network-coverage';
import { CreditCard, LockKeyhole } from 'lucide-react';

function limitedAccessTitle(status:string){
  if(status==='PAYMENT_UNDER_REVIEW')return 'Payment is under review';
  if(status==='NO_SUBSCRIPTION')return 'A plan must be assigned';
  return 'Your plan has expired';
}

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(undefined,{allowLimited:true}); const query=await searchParams;
  const access=getWorkspaceAccess(user);
  if(!access.granted){
    const billing:any=getBillingSummary(user);
    const greeting=user.organization_name||user.provider_business_name||user.name;
    return <div className="page billing-limited-home">
      <PageHeader title={`Welcome, ${greeting}`} subtitle="Your account is available, but operating access needs payment."/>
      <Flash error={query.error} success={query.success}/>
      <section className="billing-access-panel">
        <div className="billing-access-icon"><LockKeyhole aria-hidden="true"/></div>
        <div><span className="status expired">ACCESS LIMITED</span><h2>{limitedAccessTitle(access.status)}</h2><p>{access.status==='PAYMENT_UNDER_REVIEW'?'Loadgistic is reviewing your payment. Operating screens will reopen after approval.':'Submit your payment information to restore Loadgistic operating access.'}</p></div>
        <Link href="/app/more" className="button icon-button-label"><CreditCard aria-hidden="true"/>Open plan & billing</Link>
      </section>
      <div className="billing-limited-facts">
        <section><span>Plan</span><strong>{billing.subscription?.plan_name||'Not assigned'}</strong></section>
        <section><span>Access ended</span><strong>{access.ends_at?new Date(access.ends_at).toLocaleDateString():'Payment required'}</strong></section>
        <section><span>Still available</span><strong>Home · Plan & billing · Log out</strong></section>
      </div>
    </div>;
  }
  if(user.role==='DRIVER') return <DriverCapacityHome vehicles={listOwnVehicles(user)} capacities={listOwnCapacity(user)} access={getDriverAccess(user)} query={query}/>;
  const data:any=getDashboard(user);
  const coverage=user.role==='TRANSPORTER'?getFleetNetworkCoverage(user):null;
  const greeting=user.organization_name||user.provider_business_name||user.name;
  return <div className="page"><PageHeader title={`Welcome, ${greeting}`} subtitle="Your next useful logistics actions are shown first."/><Flash error={query.error} success={query.success}/>
    <section className="action-grid">{data.actions.map((a:any)=><Link href={a.href} className="action-card" key={a.href}><div><h3>{a.label}</h3><div className="meta">{a.description}</div></div><strong>→</strong></Link>)}</section>
    <section className="stats">{Object.entries(data.counts).map(([label,value])=><div className="stat" key={label}><span className="meta">{label}</span><strong>{String(value)}</strong></div>)}</section>
    {coverage?<NetworkCoverage coverage={coverage}/>:null}
    <div className="two-col"><section className="card"><div className="page-header" style={{marginBottom:12}}><div><h2 style={{fontSize:'1.4rem'}}>Recent tracking</h2><p className="page-subtitle">Only loads assigned to or directly involving this workspace.</p></div><Link href="/app/shipments" className="button secondary small">View all</Link></div>{data.recent.length?<div className="list">{data.recent.map((item:any)=><Link href={`/app/shipments/${item.id||item.code}`} className="list-row compact" key={item.id||item.code}><div><strong>{item.code}</strong><div className="meta">{item.title}</div></div><div className="route">{item.origin}<span>→</span>{item.destination}</div><StatusPill status={item.operational_status}/></Link>)}</div>:<div className="empty-state">No tracking activity yet.</div>}</section>
    <aside className="stack"><section className="card"><h3>Workspace focus</h3><p className="muted">{user.role==='TRANSPORTER'||user.role==='DRIVER'?'Find business demand and keep Empty or Partial truck capacity fresh.':user.role==='ADMIN'?'Review applications and system activity.':'Create B2B freight demand and discover transport capacity.'}</p></section>{data.notifications?.length?<section className="card"><h3>Notifications</h3><div className="stack">{data.notifications.slice(0,4).map((n:any)=><div key={n.id}><strong>{n.title}</strong><div className="meta">{n.body}</div></div>)}</div></section>:null}</aside></div>
  </div>;
}
