import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listVisibleShipments } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Flash } from '@/components/flash';
import { priceDisplay } from '@/lib/ui';

export default async function ShipmentsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(); const query=await searchParams; const shipments:any[]=listVisibleShipments(user);
 const canCreate=['SHIPPER','RECEIVER'].includes(user.role);
 return <div className="page"><PageHeader title="Shipments" subtitle="One canonical freight record from agreement through completion." action={canCreate?<Link href="/app/shipments/new" className="button">New shipment</Link>:undefined}/><Flash error={query.error} success={query.success}/>
 <div className="list">{shipments.filter(s=>!query.code||String(s.code).toLowerCase().includes(String(query.code).toLowerCase())).map((s:any)=><Link href={`/app/shipments/${s.id}`} className="list-row" key={s.id}><div><strong>{s.code}</strong><div className="meta">{s.title}</div></div><div><div className="route">{s.origin}<span>→</span>{s.destination}</div><div className="meta">{s.shipper_name}{s.receiver_name?` → ${s.receiver_name}`:''}</div></div><div><strong>{priceDisplay(s)}</strong><div className="meta">{s.service_mode}</div></div><StatusPill status={s.operational_status}/></Link>)}</div>
 {!shipments.length?<div className="empty-state">No shipments are visible to this workspace.</div>:null}</div>;
}
