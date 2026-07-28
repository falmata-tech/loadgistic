import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listOwnedLoads, listVisibleShipments } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Flash } from '@/components/flash';
import { priceDisplay } from '@/lib/ui';
import { CalendarClock, CirclePlus, ClipboardList, MapPin, PackageSearch } from 'lucide-react';

export default async function ShipmentsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  const query=await searchParams;
  const isBusiness=['SHIPPER','RECEIVER'].includes(user.role);
  const view=isBusiness&&query.view==='MY_LOADS'?'MY_LOADS':'TRACKING';
  const shipments:any[]=view==='MY_LOADS'?listOwnedLoads(user):listVisibleShipments(user);
  const filtered=shipments.filter(shipment=>!query.code||String(shipment.code).toLowerCase().includes(String(query.code).toLowerCase()));
  return <div className="page">
    <PageHeader title={view==='MY_LOADS'?'My loads':'Tracking'} subtitle={view==='MY_LOADS'?'Posted, negotiating, agreed, and completed demand owned by this Business.':'Agreed, assigned, active, and completed loads involving this workspace.'} action={isBusiness?<Link href="/app/shipments/new" className="button icon-button-label"><CirclePlus aria-hidden="true"/>Post load</Link>:undefined}/>
    <Flash error={query.error} success={query.success}/>
    {isBusiness?<nav className="board-view-tabs" aria-label="Shipment workspace tabs"><Link className={`button icon-button-label ${view==='MY_LOADS'?'':'secondary'}`} href="/app/shipments?view=MY_LOADS"><ClipboardList aria-hidden="true"/>My loads</Link><Link className={`button icon-button-label ${view==='TRACKING'?'':'secondary'}`} href="/app/shipments"><PackageSearch aria-hidden="true"/>Tracking</Link></nav>:null}
    <div className="tracking-list">{filtered.map((shipment:any)=><Link href={`/app/shipments/${shipment.id}`} className="tracking-row" key={shipment.id}><div className="tracking-row-icon">{view==='MY_LOADS'?<ClipboardList aria-hidden="true"/>:<PackageSearch aria-hidden="true"/>}</div><div><strong>{shipment.title}</strong><div className="meta">{shipment.code} · {shipment.shipper_name}{shipment.receiver_name?` to ${shipment.receiver_name}`:''}{view==='MY_LOADS'?` · ${shipment.interest_count||0} interested`:''}</div></div><div><div className="route"><MapPin aria-hidden="true"/>{shipment.origin}<span>→</span>{shipment.destination}</div><div className="meta icon-meta"><CalendarClock aria-hidden="true"/>Pick up before {shipment.pickup_date}{shipment.delivery_date?` · Drop off before ${shipment.delivery_date}`:''}</div></div><div><strong>{priceDisplay(shipment)}</strong><div className="meta">{shipment.load_type}</div></div><StatusPill status={shipment.operational_status}/></Link>)}</div>
    {!filtered.length?<div className="empty-state">{view==='MY_LOADS'?<ClipboardList aria-hidden="true"/>:<PackageSearch aria-hidden="true"/>}<strong>{view==='MY_LOADS'?'No owned loads yet.':'No execution loads yet.'}</strong><span>{view==='MY_LOADS'?'Post a load to reach permitted transport providers.':'Posted and negotiating loads stay in My loads or on the Load Board. They appear here after agreement.'}</span></div>:null}
  </div>;
}
