import { PageHeader } from './page-header';
import { Flash } from './flash';
import { CapacityForm } from './capacity-form';
import { StatusPill } from './status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';

export function DriverCapacityHome({ vehicles, capacities, query }: { vehicles: any[]; capacities: any[]; query: Record<string,string|undefined> }) {
  const latestByVehicle = new Map();
  for (const capacity of capacities) if (!latestByVehicle.has(capacity.vehicle_id)) latestByVehicle.set(capacity.vehicle_id,capacity);
  const vehicleOptions = vehicles.map(vehicle => ({ id:String(vehicle.id), label:String(vehicle.label), make:String(vehicle.make||''), model:String(vehicle.model||''), cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''), plate:String(vehicle.plate||''), current:latestByVehicle.get(vehicle.id) || null }));
  const current = capacities[0];
  return <div className="page capacity-home-page">
    <PageHeader title="My capacity" subtitle="Keep your truck's live market signal accurate, useful, and current."/>
    <Flash error={query.error} success={query.success}/>
    <section className="capacity-signal-strip" aria-label="Current capacity signal">
      <div><span className={`live-dot ${current?.status === 'OFF_DUTY' || !current ? 'off' : ''}`} aria-hidden="true"/><span><strong>{current ? capacityLabel(current.status,current.available_percent) : 'No capacity signal yet'}</strong><small>{current?.location_area || 'Add your general area to start'}</small></span></div>
      <div className="signal-facts">
        <span><small>Capacity updated</small><strong>{current ? relativeTime(current.updated_at) : 'Never'}</strong></span>
        <span><small>Location updated</small><strong>{current?.location_updated_at ? relativeTime(current.location_updated_at) : 'Never'}</strong></span>
        <span><small>Freshness</small>{current ? <StatusPill status={current.freshness}/> : <span className="status expired">Not published</span>}</span>
      </div>
    </section>
    <CapacityForm vehicles={vehicleOptions}/>
  </div>;
}
