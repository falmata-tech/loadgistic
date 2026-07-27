import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDashboard, listOwnCapacity, listOwnVehicles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Flash } from '@/components/flash';
import { DriverCapacityHome } from '@/components/driver-capacity-home';

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(); const query=await searchParams;
  if(user.role==='DRIVER'||user.role==='TRANSPORTER') return <DriverCapacityHome user={user} vehicles={listOwnVehicles(user)} capacities={listOwnCapacity(user)} query={query}/>;
  const data:any=getDashboard(user);
  const greeting=user.organization_name||user.provider_business_name||user.name;
  return <div className="page"><PageHeader title={`Welcome, ${greeting}`} subtitle="Your next useful logistics actions are shown first."/><Flash error={query.error} success={query.success}/>
    <section className="action-grid">{data.actions.map((a:any)=><Link href={a.href} className="action-card" key={a.href}><div><h3>{a.label}</h3><div className="meta">{a.description}</div></div><strong>→</strong></Link>)}</section>
    <section className="stats">{Object.entries(data.counts).map(([label,value])=><div className="stat" key={label}><span className="meta">{label}</span><strong>{String(value)}</strong></div>)}</section>
    <div className="two-col"><section className="card"><div className="page-header" style={{marginBottom:12}}><div><h2 style={{fontSize:'1.4rem'}}>Recent shipments</h2><p className="page-subtitle">Only records visible to this workspace.</p></div><Link href="/app/shipments" className="button secondary small">View all</Link></div>{data.recent.length?<div className="list">{data.recent.map((item:any)=><Link href={`/app/shipments/${item.id||item.code}`} className="list-row compact" key={item.id||item.code}><div><strong>{item.code}</strong><div className="meta">{item.title}</div></div><div className="route">{item.origin}<span>→</span>{item.destination}</div><StatusPill status={item.operational_status}/></Link>)}</div>:<div className="empty-state">No shipment activity yet.</div>}</section>
    <aside className="stack"><section className="card"><h3>Workspace focus</h3><p className="muted">{user.role==='TRANSPORTER'||user.role==='DRIVER'?'Find business demand and keep Empty or Partial truck capacity fresh.':user.role==='ADMIN'?'Review applications and system activity.':'Create B2B freight demand and discover transport capacity.'}</p></section>{data.notifications?.length?<section className="card"><h3>Notifications</h3><div className="stack">{data.notifications.slice(0,4).map((n:any)=><div key={n.id}><strong>{n.title}</strong><div className="meta">{n.body}</div></div>)}</div></section>:null}</aside></div>
  </div>;
}
