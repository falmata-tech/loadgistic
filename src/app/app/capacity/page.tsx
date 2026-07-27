import Link from 'next/link';
import Image from 'next/image';
import { requireUser } from '@/lib/auth';
import { listMarketCapacity } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';

function acceptedLoads(capacity:any) {
  if (capacity.accepts_full_load && capacity.accepts_partial_load) return 'FTL + PTL';
  if (capacity.accepts_partial_load) return 'PTL';
  return 'FTL';
}

export default async function CapacityPage(){
 const user=await requireUser(); const rows:any[]=listMarketCapacity(user); const isProvider=['TRANSPORTER','DRIVER'].includes(user.role);
 return <div className="page"><PageHeader title="Capacity Board" subtitle={isProvider?'A read-only view of current supply signals from other trucks.':'Every card is one fresh Empty or Partial truck available for freight work.'}/>
 {isProvider?<div className="alert">The Capacity Board is read only for transporters and drivers. Use it to understand supply; contact and interest actions are not available here.</div>:<div className="alert">Each truck stands on its own. Public means all logged-in businesses; Partners means only saved business relationships.</div>}
 <section className="capacity-market-grid">{rows.map((cap:any)=><article className="card capacity-market-card" key={cap.id}>
   <div className="market-card-top"><div className="market-truck-heading"><Image className="truck-thumbnail large" src={vehicleConfigurationImage(cap.cargo_configuration||cap.vehicle_category)} alt="" width={120} height={120}/><div><div className="status-row"><StatusPill status={cap.status}/><StatusPill status={cap.freshness}/>{cap.relationshipVisible?<span className="status green">Partners</span>:<span className="status">Public</span>}</div><h2>{cap.vehicle_make} · {cap.vehicle_model}</h2><div className="meta">{cap.cargo_configuration||cap.vehicle_category} · {cap.vehicle_label}<br/>{cap.organization_name||cap.provider_name}</div></div></div><strong className="market-capacity-value">{capacityLabel(cap.status,cap.available_percent)}</strong></div>
   <div className="progress"><span style={{width:`${cap.available_percent}%`}}/></div>
   <div className="market-signal-grid"><div><small>Current area</small><strong>{cap.location_area||cap.origin||'Area not updated'}</strong><span>{cap.location_source === 'DEVICE_OBSCURED' ? `Approximate device area · ${cap.location_precision_km} km privacy zone` : cap.location_updated_at?`Updated ${relativeTime(cap.location_updated_at)}`:'Location time unavailable'}</span></div><div><small>Planned movement</small><strong>{cap.origin||'Origin open'} → {cap.destination||'Destination open'}</strong><span>{cap.corridor||'No preferred corridor'}</span></div><div><small>Accepting</small><strong>{acceptedLoads(cap)}</strong><span>{cap.accepts_multi_stop?'Open to multi-stop':'Direct only'} · {cap.open_to_contract_lanes?'Contract lanes':'Single-trip work'}</span></div><div><small>Proof signal</small><strong>{cap.proof_available?'Photo recorded':'No photo'}</strong><span>{cap.proof_recorded_at?relativeTime(cap.proof_recorded_at):'Not recorded'}</span></div></div>
   <div className="market-card-actions"><Link className="button secondary small" href={`/app/capacity/${cap.id}`}>View truck details</Link></div>
 </article>)}</section>{!rows.length?<div className="empty-state">No fresh capacity is visible right now.</div>:null}</div>;
}
