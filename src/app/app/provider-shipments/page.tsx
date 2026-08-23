import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CalendarClock, ClipboardList, CirclePlus, MapPin, PackageCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getDriverAccess, listProviderShipments } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';

export default async function ProviderShipmentsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  if(!['TRANSPORTER','DRIVER'].includes(user.role))redirect('/app/home');
  const query=await searchParams;
  const trackingAllowed=getDriverAccess(user)?.can_manage_tracking!==false;
  if(!trackingAllowed)return <div className="page"><PageHeader icon={ClipboardList} title="Tracking" subtitle="Your fleet owner controls access to assigned Tracking work."/><Flash error={query.error} success={query.success}/><div className="empty-state"><ClipboardList aria-hidden="true"/><strong>Tracking access is off.</strong><span>Ask your fleet owner to enable Tracking updates in Driver access.</span><Link className="button secondary" href="/app/home">Return to capacity</Link></div></div>;
  const shipments=listProviderShipments(user,{limit:100});
  const mayCreate=trackingAllowed;
  return <div className="page"><PageHeader icon={ClipboardList} title="Tracking" subtitle="Start and update Tracking sessions for transport work agreed offline." action={mayCreate?<Link className="button" href="/app/provider-shipments/new"><CirclePlus aria-hidden="true"/>Start Tracking</Link>:undefined}/><Flash error={query.error} success={query.success}/>
    <div className="tracking-list provider-shipment-list">{shipments.map((shipment:any)=><Link href={`/app/provider-shipments/${shipment.id}`} className="tracking-row" key={shipment.id}>
      <div className="tracking-row-icon"><PackageCheck aria-hidden="true"/></div>
      <div><strong>{shipment.code}</strong><div className="meta">{shipment.cargo_summary}</div></div>
      <div><div className="route"><MapPin aria-hidden="true"/>{shipment.origin}<span>→</span>{shipment.destination}</div><div className="meta"><CalendarClock aria-hidden="true"/> Updated {new Date(shipment.updated_at).toLocaleString()}</div></div>
      <div><strong>{shipment.platform_number}</strong><div className="meta">{shipment.driver_name}</div></div>
      <StatusPill status={shipment.operational_status}/><ArrowRight aria-hidden="true"/>
    </Link>)}</div>
    {!shipments.length?<div className="empty-state"><ClipboardList aria-hidden="true"/><strong>No Tracking sessions yet.</strong><span>After agreeing work offline, start Tracking and send the customer owner one private link and code.</span>{mayCreate?<Link className="button" href="/app/provider-shipments/new"><CirclePlus aria-hidden="true"/>Start Tracking</Link>:null}</div>:null}
  </div>;
}
