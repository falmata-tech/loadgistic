import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listVisibleShipments } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Flash } from '@/components/flash';
import { priceDisplay } from '@/lib/ui';
import { CalendarClock, CirclePlus, MapPin, PackageSearch } from 'lucide-react';

export default async function ShipmentsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(); const query=await searchParams; const shipments:any[]=listVisibleShipments(user);
 const canCreate=['SHIPPER','RECEIVER'].includes(user.role);
 return <div className="page"><PageHeader title="Tracking" subtitle="Loads this workspace is sending, receiving, or transporting." action={canCreate?<Link href="/app/shipments/new" className="button icon-button-label"><CirclePlus aria-hidden="true"/>Post load</Link>:undefined}/><Flash error={query.error} success={query.success}/>
 <div className="tracking-list">{shipments.filter(s=>!query.code||String(s.code).toLowerCase().includes(String(query.code).toLowerCase())).map((s:any)=><Link href={`/app/shipments/${s.id}`} className="tracking-row" key={s.id}><div className="tracking-row-icon"><PackageSearch aria-hidden="true"/></div><div><strong>{s.title}</strong><div className="meta">{s.code} · {s.shipper_name}{s.receiver_name?` to ${s.receiver_name}`:''}</div></div><div><div className="route"><MapPin aria-hidden="true"/>{s.origin}<span>→</span>{s.destination}</div><div className="meta icon-meta"><CalendarClock aria-hidden="true"/>Pick up before {s.pickup_date}{s.delivery_date?` · Drop off before ${s.delivery_date}`:''}</div></div><div><strong>{priceDisplay(s)}</strong><div className="meta">{s.load_type}</div></div><StatusPill status={s.operational_status}/></Link>)}</div>
 {!shipments.length?<div className="empty-state"><PackageSearch aria-hidden="true"/><strong>No loads to track yet.</strong><span>Loads appear here after this workspace sends, receives, accepts, or transports them.</span></div>:null}</div>;
}
