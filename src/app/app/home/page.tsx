import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getBillingSummary, getDashboard, getDriverAccess, getWorkspaceAccess, listOwnCapacity, listOwnRecurringCorridors, listOwnVehicles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Flash } from '@/components/flash';
import { DriverCapacityHome } from '@/components/driver-capacity-home';
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CirclePlus,
  CreditCard,
  Eye,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  MapPin,
  Search,
  Truck,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

function limitedAccessTitle(status:string){
  if(status==='PAYMENT_UNDER_REVIEW')return 'Payment is under review';
  if(status==='NO_SUBSCRIPTION')return 'A plan must be assigned';
  return 'Your plan has expired';
}

function actionIcon(href:string):LucideIcon {
  if(href.includes('/shipments/new'))return CirclePlus;
  if(href.includes('/shipments'))return MapPin;
  if(href.includes('/capacity'))return Gauge;
  if(href.includes('/loads'))return Boxes;
  if(href.includes('/fleet'))return Truck;
  if(href.includes('/providers'))return Search;
  if(href.includes('/verification'))return BadgeCheck;
  if(href.includes('/network'))return Users;
  return ListChecks;
}

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(undefined,{allowLimited:true}); const query=await searchParams;
  const access=getWorkspaceAccess(user);
  if(!access.granted){
    const billing:any=getBillingSummary(user);
    const greeting=user.organization_name||user.provider_business_name||user.name;
    return <div className="page billing-limited-home">
      <PageHeader icon={LockKeyhole} title={greeting} subtitle="Restore access to continue managing transport operations."/>
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
  if(user.role==='DRIVER') {
    const plain=(value:any)=>JSON.parse(JSON.stringify(value));
    return <DriverCapacityHome vehicles={plain(listOwnVehicles(user))} capacities={plain(listOwnCapacity(user))} corridors={plain(listOwnRecurringCorridors(user))} access={plain(getDriverAccess(user))} query={query}/>;
  }
  const data:any=getDashboard(user);
  const greeting=user.organization_name||user.provider_business_name||user.name;
  return <div className="page"><PageHeader icon={LayoutDashboard} title={greeting} subtitle="Manage today&apos;s transport operations."/><Flash error={query.error} success={query.success}/>
    <section className="action-grid">{data.actions.map((a:any)=>{const Icon=actionIcon(a.href);return <Link href={a.href} className="action-card" key={a.href}><span className="action-card-icon"><Icon aria-hidden="true"/></span><div><h3>{a.label}</h3><div className="meta">{a.description}</div></div><ArrowRight aria-hidden="true"/></Link>})}</section>
    <section className="stats">{Object.entries(data.counts).map(([label,value])=><div className="stat" key={label}><span className="meta">{label}</span><strong>{String(value)}</strong></div>)}</section>
    <div className="two-col"><section className="card"><div className="page-header" style={{marginBottom:12}}><div><h2 className="panel-heading"><MapPin aria-hidden="true"/>Recent Tracking</h2><p className="page-subtitle">Latest shipment activity.</p></div><Link href="/app/provider-shipments" className="button secondary small"><Eye aria-hidden="true"/>View all</Link></div>{data.recent.length?<div className="list">{data.recent.map((item:any)=><Link href={`/app/provider-shipments/${item.id}`} className="list-row compact" key={item.id}><div><strong>{item.code}</strong><div className="meta">{item.cargo_summary||item.title}</div></div><div className="route">{item.origin}<span>→</span>{item.destination}</div><StatusPill status={item.operational_status}/></Link>)}</div>:<div className="empty-state">No tracking activity yet.</div>}</section>
    <aside className="stack"><section className="card"><h3><ListChecks aria-hidden="true"/>Operating priorities</h3><p className="muted">{user.role==='TRANSPORTER'||user.role==='DRIVER'?'Keep truck availability, your public profile, and active tracking records current.':user.role==='ADMIN'?'Review the queues requiring platform action.':'Review current marketplace activity.'}</p></section>{data.notifications?.length?<section className="card"><h3><BadgeCheck aria-hidden="true"/>Notifications</h3><div className="stack">{data.notifications.slice(0,4).map((n:any)=><div key={n.id}><strong>{n.title}</strong><div className="meta">{n.body}</div></div>)}</div></section>:null}</aside></div>
  </div>;
}
