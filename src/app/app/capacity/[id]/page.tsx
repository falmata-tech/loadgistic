import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getCapacityForUser, paginateResults } from '@/lib/repository.js';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { StatusPill } from '@/components/status-pill';
import { Clock3, Eye, Gauge, Route, Truck } from 'lucide-react';

function acceptedLoads(capacity: any) {
  if (capacity.accepts_full_load && capacity.accepts_partial_load) return 'FTL and PTL';
  if (capacity.accepts_partial_load) return 'PTL only';
  return 'FTL only';
}

function stopPolicy(capacity:any){
  const options=['Direct'];
  if(capacity.accepts_multi_pick)options.push('Multi Pick');
  if(capacity.accepts_multi_drop)options.push('Multi Drop');
  return options.join(' + ');
}

export default async function CapacityDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string,string|undefined>> }) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const capacity: any = getCapacityForUser(user,id);
  if (!capacity) notFound();
  const routeResult: any = paginateResults(capacity.preferred_routes || [], { page: query.routePage, pageSize: 10 });
  const ownerName = capacity.organization_name || capacity.provider_name;
  const ownerHandle = capacity.organization_handle || capacity.provider_handle;

  return <div className="page">
    <PageHeader icon={Truck} title={`${capacity.vehicle_make} · ${capacity.vehicle_model}`} subtitle={`${capacity.platform_number} · ${capacity.cargo_configuration || capacity.vehicle_category}`} action={<StatusPill status={capacity.status}/>} />
    <div className="two-col">
      <div className="stack">
        <section className="card capacity-detail-hero">
          <Image src={vehicleConfigurationImage(capacity.cargo_configuration || capacity.vehicle_category)} alt="" width={360} height={360}/>
          <div><span className="meta">Current cargo space</span><h2>{capacityLabel(capacity.status,capacity.available_percent)}</h2><div className="progress"><span style={{width:`${capacity.available_percent}%`}}/></div><p className="muted">This capacity signal belongs to this specific truck, not to the transporter's fleet as a whole.</p></div>
        </section>
        <section className="card"><h2 className="panel-heading"><Route aria-hidden="true"/>Movement</h2><div className="detail-facts"><div><span>Current area</span><strong>{capacity.location_area || 'Area not updated'}</strong><small>{capacity.location_source === 'DEVICE_OBSCURED' ? `Approximate device area · ${capacity.location_precision_km} km privacy zone` : 'Driver-declared general area'}</small></div>{capacity.status==='PARTIAL'?<div><span>Current partial route</span><strong>{capacity.current_route_origin||'Not recorded'} → {capacity.current_route_destination||'Not recorded'}</strong><small>{capacity.current_route_date||'Date not recorded'}</small></div>:null}<div><span>Planned route</span><strong>{capacity.origin || 'Not recorded'} → {capacity.destination || 'Not recorded'}</strong><small>{capacity.travel_date ? `${capacity.travel_date} · ${capacity.planned_space_status==='PARTIAL'?'Partial':'Full'} space` : 'Not scheduled'}</small></div><div><span>Next available</span><strong>{capacity.next_available || 'Confirm directly'}</strong></div></div></section>
        <section className="card"><h2 className="panel-heading"><Gauge aria-hidden="true"/>Accepted work</h2><div className="detail-facts"><div><span>Load size</span><strong>{acceptedLoads(capacity)}</strong></div><div><span>Stops</span><strong>{stopPolicy(capacity)}</strong></div><div><span>Contract routes</span><strong>{capacity.open_to_contract_lanes ? 'Recurring routes' : 'Single trip'}</strong></div><div><span>Photo proof</span><strong>{capacity.proof_available ? 'Recorded' : 'Not added'}</strong></div></div></section>
      </div>
      <aside className="stack">
        <section className="card"><h3><Truck aria-hidden="true"/>Transporter</h3><p><strong>{ownerName}</strong></p><div className="meta">{capacity.organization_name ? 'Fleet transporter' : 'Self-managed driver'}</div>{ownerHandle?<Link className="button secondary" href={`/app/providers/${ownerHandle}`}><Eye aria-hidden="true"/>Profile</Link>:null}</section>
        <section className="card"><h3><Route aria-hidden="true"/>Preferred Routes</h3>{routeResult.total?<><div className="stack">{routeResult.items.map((route:any)=><div key={route.id}><strong>{route.origin} ↔ {route.destination}</strong></div>)}</div><Pagination path={`/app/capacity/${id}`} query={{}} page={routeResult.page} pageCount={routeResult.pageCount} total={routeResult.total} pageParam="routePage"/></>:<p className="muted">No routes declared.</p>}<p className="meta">Profile routes are long-term. Dated routes above belong to this truck.</p></section>
        <section className="card"><h3><Clock3 aria-hidden="true"/>Freshness</h3><StatusPill status={capacity.freshness}/><p className="meta">Capacity {relativeTime(capacity.updated_at)}<br/>Location {capacity.location_updated_at ? relativeTime(capacity.location_updated_at) : 'not recorded'}<br/>Expires {new Date(capacity.expires_at).toLocaleString()}</p></section>
        <section className="card"><h3><Eye aria-hidden="true"/>Visibility</h3><StatusPill status={capacity.relationshipVisible ? 'Partners' : capacity.visibility === 'SAVED_PARTNERS' ? 'Partners' : 'Public'}/><p className="meta">Public: signed-in businesses. Partners: connected businesses only.</p></section>
      </aside>
    </div>
  </div>;
}
