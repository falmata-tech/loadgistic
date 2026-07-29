import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getCapacityForUser } from '@/lib/repository.js';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';

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

export default async function CapacityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const capacity: any = getCapacityForUser(user,id);
  if (!capacity) notFound();
  const ownerName = capacity.organization_name || capacity.provider_name;
  const ownerHandle = capacity.organization_handle || capacity.provider_handle;

  return <div className="page">
    <PageHeader title={`${capacity.vehicle_make} · ${capacity.vehicle_model}`} subtitle={`${capacity.platform_number} · ${capacity.cargo_configuration || capacity.vehicle_category}`} action={<StatusPill status={capacity.status}/>} />
    <div className="two-col">
      <div className="stack">
        <section className="card capacity-detail-hero">
          <Image src={vehicleConfigurationImage(capacity.cargo_configuration || capacity.vehicle_category)} alt="" width={360} height={360}/>
          <div><span className="meta">Current cargo space</span><h2>{capacityLabel(capacity.status,capacity.available_percent)}</h2><div className="progress"><span style={{width:`${capacity.available_percent}%`}}/></div><p className="muted">This capacity signal belongs to this specific truck, not to the transporter's fleet as a whole.</p></div>
        </section>
        <section className="card"><h2 className="panel-heading">Movement and availability</h2><div className="detail-facts"><div><span>Current area</span><strong>{capacity.location_area || 'Area not updated'}</strong><small>{capacity.location_source === 'DEVICE_OBSCURED' ? `Approximate device area · ${capacity.location_precision_km} km privacy zone` : 'Driver-declared general area'}</small></div>{capacity.status==='PARTIAL'?<div><span>Current partial-capacity route</span><strong>{capacity.current_route_origin||'Not recorded'} → {capacity.current_route_destination||'Not recorded'}</strong><small>{capacity.current_route_date||'Date not recorded'}</small></div>:null}<div><span>Planned route</span><strong>{capacity.origin || 'Not recorded'} → {capacity.destination || 'Not recorded'}</strong><small>{capacity.travel_date ? `${capacity.travel_date} · ${capacity.planned_space_status==='PARTIAL'?'Partial':'Full'} cargo space` : 'Not scheduled'}</small></div><div><span>Next available</span><strong>{capacity.next_available || 'Confirm directly'}</strong></div></div></section>
        <section className="card"><h2 className="panel-heading">Work accepted</h2><div className="detail-facts"><div><span>Load size</span><strong>{acceptedLoads(capacity)}</strong></div><div><span>Route flexibility</span><strong>{stopPolicy(capacity)}</strong></div><div><span>Contract routes</span><strong>{capacity.open_to_contract_lanes ? 'Open to recurring routes' : 'Single-trip work'}</strong></div><div><span>Capacity proof</span><strong>{capacity.proof_available ? 'Photo recorded' : 'No current photo'}</strong></div></div></section>
      </div>
      <aside className="stack">
        <section className="card"><h3>Transporter</h3><p><strong>{ownerName}</strong></p><div className="meta">{capacity.organization_name ? 'Fleet transporter' : 'Self-managed driver'}</div>{ownerHandle?<Link className="button secondary" href={`/app/providers/${ownerHandle}`}>View Profile</Link>:null}</section>
        <section className="card"><h3>Preferred Routes</h3>{capacity.preferred_routes?.length?<div className="stack">{capacity.preferred_routes.map((route:any)=><div key={route.id}><strong>{route.origin} ↔ {route.destination}</strong></div>)}</div>:<p className="muted">No Preferred Routes declared.</p>}<p className="meta">Preferred Routes are stable profile declarations. The dated routes above belong only to this truck's current capacity signal.</p></section>
        <section className="card"><h3>Signal freshness</h3><StatusPill status={capacity.freshness}/><p className="meta">Capacity updated {relativeTime(capacity.updated_at)}<br/>Location updated {capacity.location_updated_at ? relativeTime(capacity.location_updated_at) : 'not recorded'}<br/>Expires {new Date(capacity.expires_at).toLocaleString()}</p></section>
        <section className="card"><h3>Visibility</h3><StatusPill status={capacity.relationshipVisible ? 'Partners' : capacity.visibility === 'SAVED_PARTNERS' ? 'Partners' : 'Public'}/><p className="meta">Public capacity is visible to logged-in businesses. Partners capacity is limited to Connected network Businesses.</p></section>
      </aside>
    </div>
  </div>;
}
