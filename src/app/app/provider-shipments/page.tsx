import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CalendarClock, ClipboardList, CirclePlus, MapPin, PackageCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listProviderShipments } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';

export default async function ProviderShipmentsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  if(!['TRANSPORTER','DRIVER'].includes(user.role))redirect('/app/home');
  const query=await searchParams;
  const shipments=listProviderShipments(user,{limit:100});
  const mayCreate=user.driver_kind!=='COMPANY';
  return <div className="page"><PageHeader icon={ClipboardList} title="Customer shipments" subtitle="Provider-owned tracking records for work agreed offline." action={mayCreate?<Link className="button" href="/app/provider-shipments/new"><CirclePlus aria-hidden="true"/>Start tracking</Link>:undefined}/><Flash error={query.error} success={query.success}/>
    <div className="tracking-list provider-shipment-list">{shipments.map((shipment:any)=><Link href={`/app/provider-shipments/${shipment.id}`} className="tracking-row" key={shipment.id}>
      <div className="tracking-row-icon"><PackageCheck aria-hidden="true"/></div>
      <div><strong>{shipment.code}</strong><div className="meta">{shipment.cargo_summary}</div></div>
      <div><div className="route"><MapPin aria-hidden="true"/>{shipment.origin}<span>→</span>{shipment.destination}</div><div className="meta"><CalendarClock aria-hidden="true"/> Updated {new Date(shipment.updated_at).toLocaleString()}</div></div>
      <div><strong>{shipment.platform_number}</strong><div className="meta">{shipment.driver_name}</div></div>
      <StatusPill status={shipment.operational_status}/><ArrowRight aria-hidden="true"/>
    </Link>)}</div>
    {!shipments.length?<div className="empty-state"><ClipboardList aria-hidden="true"/><strong>No customer shipment records yet.</strong><span>After agreeing work offline, start tracking and give each party their private code.</span>{mayCreate?<Link className="button" href="/app/provider-shipments/new"><CirclePlus aria-hidden="true"/>Start the first record</Link>:null}</div>:null}
  </div>;
}
