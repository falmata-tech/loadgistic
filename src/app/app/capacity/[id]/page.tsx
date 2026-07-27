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

export default async function CapacityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const capacity: any = getCapacityForUser(user,id);
  if (!capacity) notFound();
  const ownerName = capacity.organization_name || capacity.provider_name;
  const ownerHandle = capacity.organization_handle || capacity.provider_handle;

  return <div className="page">
    <PageHeader title={`${capacity.vehicle_make} · ${capacity.vehicle_model}`} subtitle={`${capacity.cargo_configuration || capacity.vehicle_category} · ${capacity.vehicle_label}`} action={<StatusPill status={capacity.status}/>} />
    <div className="two-col">
      <div className="stack">
        <section className="card capacity-detail-hero">
          <Image src={vehicleConfigurationImage(capacity.cargo_configuration || capacity.vehicle_category)} alt="" width={360} height={360}/>
          <div><span className="meta">Current cargo space</span><h2>{capacityLabel(capacity.status,capacity.available_percent)}</h2><div className="progress"><span style={{width:`${capacity.available_percent}%`}}/></div><p className="muted">This capacity signal belongs to this specific truck, not to the transporter's fleet as a whole.</p></div>
        </section>
        <section className="card"><h2 className="panel-heading">Movement and availability</h2><div className="detail-facts"><div><span>Current area</span><strong>{capacity.location_area || 'Area not updated'}</strong><small>{capacity.location_source === 'DEVICE_OBSCURED' ? `Approximate device area · ${capacity.location_precision_km} km privacy zone` : 'Driver-declared general area'}</small></div><div><span>Corridor</span><strong>{capacity.origin || 'City 1 open'} ↔ {capacity.destination || 'City 2 open'}</strong></div><div><span>Travel date</span><strong>{capacity.travel_date || 'Not scheduled'}</strong></div><div><span>Next available</span><strong>{capacity.next_available || 'Confirm directly'}</strong></div></div></section>
        <section className="card"><h2 className="panel-heading">Work accepted</h2><div className="detail-facts"><div><span>Load size</span><strong>{acceptedLoads(capacity)}</strong></div><div><span>Stops</span><strong>{capacity.accepts_multi_stop ? 'Open to multi-stop' : 'Direct only'}</strong></div><div><span>Contract lanes</span><strong>{capacity.open_to_contract_lanes ? 'Open to recurring lanes' : 'Single-trip work'}</strong></div><div><span>Capacity proof</span><strong>{capacity.proof_available ? 'Photo recorded' : 'No current photo'}</strong></div></div></section>
      </div>
      <aside className="stack">
        <section className="card"><h3>Transporter</h3><p><strong>{ownerName}</strong></p><div className="meta">{capacity.organization_name ? 'Fleet transporter' : 'Self-managed driver'}</div>{ownerHandle?<Link className="button secondary" href={`/companies/${ownerHandle}`}>View Profile</Link>:null}</section>
        <section className="card"><h3>Signal freshness</h3><StatusPill status={capacity.freshness}/><p className="meta">Capacity updated {relativeTime(capacity.updated_at)}<br/>Location updated {capacity.location_updated_at ? relativeTime(capacity.location_updated_at) : 'not recorded'}<br/>Expires {new Date(capacity.expires_at).toLocaleString()}</p></section>
        <section className="card"><h3>Visibility</h3><StatusPill status={capacity.relationshipVisible ? 'Partners' : capacity.visibility === 'SAVED_PARTNERS' ? 'Partners' : 'Public'}/><p className="meta">Public capacity is visible to logged-in businesses. Partners capacity is limited to saved relationships.</p></section>
      </aside>
    </div>
  </div>;
}
