import { PageHeader } from './page-header';
import { Flash } from './flash';
import { CapacityForm } from './capacity-form';
import { StatusPill } from './status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';
import { Gauge, Power, PowerOff, ShieldCheck } from 'lucide-react';

function RestrictedAvailability({vehicles,latestByVehicle}:{vehicles:any[];latestByVehicle:Map<string,any>}){
  return <section className="restricted-duty-panel">
    <div className="permission-note"><ShieldCheck aria-hidden="true"/><div><strong>Fleet-managed capacity</strong><span>Your dispatcher manages route, cargo space, visibility, and shipment preferences. Your availability change is visible to the fleet owner.</span></div></div>
    <div className="duty-truck-list">{vehicles.map(vehicle=>{
      const latest=latestByVehicle.get(vehicle.id);
      const available=latest&&latest.status!=='OFF_DUTY';
      return <article className="duty-truck" key={vehicle.id}>
        <div><strong>{vehicle.make} · {vehicle.model}</strong><span>{vehicle.platform_number} · {vehicle.cargo_configuration||vehicle.category}</span><small>Last updated by {latest?.updated_by_name||'fleet owner'} {latest?.updated_at?relativeTime(latest.updated_at):''}</small></div>
        <StatusPill status={available?(latest.status||'AVAILABLE'):'OFF_DUTY'}/>
        <form action="/api/capacity/duty" method="post"><input type="hidden" name="vehicleId" value={vehicle.id}/>{!available?<input type="hidden" name="onDuty" value="on"/>:null}<button className={`button icon-button-label ${available?'danger':'success'}`}>{available?<><PowerOff aria-hidden="true"/>Off Duty</>:<><Power aria-hidden="true"/>Available</>}</button></form>
      </article>;
    })}</div>
    {!vehicles.length?<div className="empty-state">No truck is assigned to your driver account. Ask your fleet owner to assign one.</div>:null}
  </section>;
}

export function DriverCapacityHome({ vehicles, capacities, access, query }: { vehicles: any[]; capacities: any[]; access:any; query: Record<string,string|undefined> }) {
  const latestByVehicle = new Map<string,any>();
  for (const capacity of capacities) if (!latestByVehicle.has(capacity.vehicle_id)) latestByVehicle.set(capacity.vehicle_id,capacity);
  const vehicleOptions = vehicles.map(vehicle => ({ id:String(vehicle.id), label:String(vehicle.label), make:String(vehicle.make||''), model:String(vehicle.model||''), cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''), plate:String(vehicle.plate||''), platformNumber:String(vehicle.platform_number||''), current:latestByVehicle.get(vehicle.id) || null }));
  const current = capacities[0];
  const restricted=access?.kind==='COMPANY'&&!access.can_manage_capacity;
  return <div className="page capacity-home-page">
    <PageHeader icon={restricted?Power:Gauge} title={restricted?'Availability':'My capacity'} subtitle={restricted?'Available or Off Duty.':'Keep your truck signal current.'}/>
    <Flash error={query.error} success={query.success}/>
    <section className="capacity-signal-strip" aria-label="Current capacity signal">
      <div><span className={`live-dot ${current?.status === 'OFF_DUTY' || !current ? 'off' : ''}`} aria-hidden="true"/><span><strong>{current ? capacityLabel(current.status,current.available_percent) : 'No capacity signal yet'}</strong><small>{current?.location_area || 'Add your general area to start'}</small></span></div>
      <div className="signal-facts">
        <span><small>Capacity updated</small><strong>{current ? relativeTime(current.updated_at) : 'Never'}</strong></span>
        <span><small>Location updated</small><strong>{current?.location_updated_at ? relativeTime(current.location_updated_at) : 'Never'}</strong></span>
        <span><small>Freshness</small>{current ? <StatusPill status={current.freshness}/> : <span className="status expired">Not published</span>}</span>
      </div>
    </section>
    {restricted?<RestrictedAvailability vehicles={vehicles} latestByVehicle={latestByVehicle}/>:<CapacityForm vehicles={vehicleOptions}/>}
  </div>;
}
