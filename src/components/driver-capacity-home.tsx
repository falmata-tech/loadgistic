"use client";


import {Text,Localized} from '@/components/localization';
import React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import { CapacityForm } from './capacity-form';
import { StatusPill } from './status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';
import { LocateFixed, Plus, Power, PowerOff, ShieldCheck, Truck } from 'lucide-react';
import {readDriverLocation,saveDriverLocation,type DriverLocation} from '@/lib/capacity-editor-client';

function RestrictedAvailability({vehicles,latestByVehicle}:{vehicles:any[];latestByVehicle:Map<string,any>}){
  const router=useRouter();
  const truck=vehicles[0];
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  const [captured,setCaptured]=React.useState(null as DriverLocation|null);
  React.useEffect(()=>{setCaptured(null);setError('');},[truck?.id]);
  if(!truck)return <section className="restricted-duty-panel"><div className="empty-state"><Truck aria-hidden="true"/><Text message="No truck is assigned to your driver account. Ask your fleet owner to assign one."/></div></section>;
  const latest=latestByVehicle.get(truck.id),available=Boolean(latest&&latest.status!=='OFF_DUTY');
  const configured=Boolean(truck.duty_configuration_available);
  const location=captured||truck.driver_location;
  async function saveLocation(){
    if(busy)return;setBusy(true);setError('');
    try{setCaptured(await saveDriverLocation(truck.id,await readDriverLocation(40)));router.refresh();}
    catch(reason){setError(reason instanceof Error?reason.message:'Truck location could not be saved.');}
    finally{setBusy(false);}
  }
  return <section className="restricted-duty-panel">
    <div className="permission-note"><ShieldCheck aria-hidden="true"/><div><strong><Text message="Fleet-managed capacity"/></strong><span><Text message="Your owner manages capacity. You can update this truck’s location and go Off Duty."/></span></div></div>
    <article className="duty-truck">
      <div><strong>{truck.make} · {truck.model}</strong><span>{truck.platform_number} · {truck.cargo_configuration||truck.category}</span></div>
      <StatusPill status={available?latest.status:'OFF_DUTY'}/>
      <div className="restricted-location-setup">
        <p><Text message={location?'Your owner can use your saved approximate location to publish capacity.':'Share this truck’s approximate location so your owner can set up capacity.'}/></p>
        {location?<p className="meta" role="status">{location.area} · <Text message="{radius} km radius" values={{radius:location.radius}}/></p>:null}
        <button type="button" className="button secondary" disabled={busy} onClick={saveLocation}><LocateFixed aria-hidden="true"/><Text message={busy?'Updating…':location?'Refresh truck location':'Share truck location'}/></button>
        {error?<p className="alert error" role="alert"><Text message={error}/></p>:null}
      </div>
      {!configured?<p className="meta"><Text message="Ask your fleet owner to set up capacity before marking this truck Available."/></p>:null}
      {!available&&configured&&!captured?<p className="meta"><Text message="Refresh your truck location before marking it Available."/></p>:null}
      <form action="/api/capacity/duty" method="post"><input type="hidden" name="vehicleId" value={truck.id}/>{!available?<><input type="hidden" name="onDuty" value="on"/><input type="hidden" name="locationArea" value={captured?.area||''}/><input type="hidden" name="approximateLat" value={captured?.lat??''}/><input type="hidden" name="approximateLng" value={captured?.lng??''}/><input type="hidden" name="locationPrecisionKm" value={captured?'40':''}/><input type="hidden" name="locationSource" value={captured?'DEVICE_OBSCURED':''}/></>:null}<button className={`button icon-button-label ${available?'danger':'success'}`} disabled={busy||(!available&&(!configured||!captured))}>{available?<><PowerOff aria-hidden="true"/><Text message="Off Duty"/></>:<><Power aria-hidden="true"/><Text message="Available"/></>}</button></form>
    </article>
  </section>;
}

export function DriverCapacityHome({ vehicles, capacities, corridors, access, query, renderedAt }: { vehicles: any[]; capacities: any[]; corridors:any[]; access:any; query: Record<string,string|undefined>; renderedAt:number }) {
  const latestByVehicle = new Map<string,any>();
  for (const capacity of capacities) if (!latestByVehicle.has(capacity.vehicle_id)) latestByVehicle.set(capacity.vehicle_id,capacity);
  const vehicleOptions = vehicles.map(vehicle => ({ id:String(vehicle.id), label:String(vehicle.label), make:String(vehicle.make||''), model:String(vehicle.model||''), cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''), plate:String(vehicle.plate||''), platformNumber:String(vehicle.platform_number||''), driver:vehicle.assigned_driver||null, driverLocation:vehicle.driver_location||null, current:latestByVehicle.get(vehicle.id) || null }));
const current = capacities[0];
  const driverFix=vehicles[0]?.driver_location;
  const locationTime=driverFix&&(!current?.location_updated_at||Date.parse(driverFix.updatedAt)>=Date.parse(current.location_updated_at))?driverFix.updatedAt:current?.location_updated_at;
  const locationArea=locationTime===driverFix?.updatedAt?driverFix?.area:current?.location_area;
  const restricted=access?.kind==='COMPANY'&&!access.can_manage_capacity;
  if(!vehicles.length&&access?.kind==='SELF_MANAGED')return <div className="page capacity-home-page"><section className="driver-empty-fleet"><Truck aria-hidden="true"/><div><h1><Text message="Add your first truck"/></h1><p><Text message="Register the truck you control, then publish its capacity and approximate location."/></p></div><Link className="button success" href="/app/fleet/new"><Plus aria-hidden="true"/><Text message="Add truck"/></Link></section></div>;
  return <div className={`page ${restricted?'capacity-restricted-home-page':'capacity-home-page'}`}>
    <h1 className="sr-only"><Text message="Capacity management"/></h1>
    {query.error?<div className="alert error capacity-home-error" role="alert"><Text message={query.error}/></div>:null}
    <Localized as="section" copy={["aria-label"]} className="driver-home-section driver-capacity-workspace" aria-label="Capacity management">
    {restricted?<Localized as="section" copy={["aria-label"]} className="capacity-signal-strip" aria-label="Current capacity signal">
      <div><span className={`live-dot ${current?.status === 'OFF_DUTY' || !current ? 'off' : ''}`} aria-hidden="true"/><span><strong>{current ? capacityLabel(current.status) : <Text message="No capacity signal yet"/>}</strong><small>{locationArea || 'Add your general area to start'}</small></span></div>
      <div className="signal-facts">
        <span><small><Text message="Capacity updated"/></small><strong>{current ? relativeTime(current.updated_at,renderedAt) : <Text message="Never"/>}</strong></span>
        <span><small><Text message="Location updated"/></small><strong>{locationTime ? relativeTime(locationTime,renderedAt) : <Text message="Never"/>}</strong></span>
        <span><small><Text message="Freshness"/></small>{current ? <StatusPill status={current.freshness}/> : <span className="status expired"><Text message="Not published"/></span>}</span>
      </div>
    </Localized>:null}
    {restricted?<RestrictedAvailability vehicles={vehicles} latestByVehicle={latestByVehicle}/>:<CapacityForm vehicles={vehicleOptions} lockVehicleSelection corridors={corridors} returnTo="/app/home" allowCorridors={access?.kind==='SELF_MANAGED'} renderedAt={renderedAt}/>}
    </Localized>
  </div>;
}
