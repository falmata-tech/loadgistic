"use client";


import {Text,Localized} from '@/components/localization';
import React from 'react';
import Link from 'next/link';
import { CapacityForm } from './capacity-form';
import { StatusPill } from './status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';
import { LocateFixed, Plus, Power, PowerOff, RefreshCw, ShieldCheck, Truck } from 'lucide-react';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { obscureCoordinate } from '@/lib/location-privacy.js';

function RestrictedAvailability({vehicles,latestByVehicle,renderedAt}:{vehicles:any[];latestByVehicle:Map<string,any>;renderedAt:number}){
  const [locationState,setLocationState]=React.useState('requesting' as 'requesting'|'captured'|'denied'|'error');
  const [location,setLocation]=React.useState(null as {lat:number;lng:number;area:string}|null);
  const [attempt,setAttempt]=React.useState(0);

  React.useEffect(()=>{
    if(!navigator.geolocation){setLocationState('error');return;}
    let active=true;
    setLocation(null);
    setLocationState('requesting');
    const watcher=navigator.geolocation.watchPosition(position=>{
      if(!active)return;
      const approximate=obscureCoordinate(position.coords.latitude,position.coords.longitude,35);
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      setLocation({lat:approximate.lat,lng:approximate.lng,area:nearest?`Around ${nearest.name}, Ethiopia`:'Around current device area'});
      setLocationState('captured');
    },error=>{
      if(!active)return;
      setLocationState(error.code===error.PERMISSION_DENIED?'denied':'error');
    },{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
    return()=>{active=false;navigator.geolocation.clearWatch(watcher);};
  },[attempt]);

  return <section className="restricted-duty-panel">
    <div className="permission-note"><ShieldCheck aria-hidden="true"/><div><strong><Text message="Fleet-managed capacity"/></strong><span><Text message="Your dispatcher manages route, cargo space, visibility, and shipment preferences. Your availability change is visible to the fleet owner."/></span></div></div>
    <div className={`automatic-location ${locationState}`}><LocateFixed aria-hidden="true"/><span><strong>{locationState==='captured'?<Text message="Truck area ready"/>:locationState==='requesting'?<Text message="Finding truck location..."/>:locationState==='denied'?<Text message="Location permission is off"/>:<Text message="Device location unavailable"/>}</strong><small>{location?`${location.area} · approximate location within 40 km`:<Text message="Allow browser location before setting Available."/>}</small></span>{['denied','error'].includes(locationState)?<button type="button" className="button secondary small icon-button-label" onClick={()=>setAttempt((value:number)=>value+1)}><RefreshCw aria-hidden="true"/><Text message="Retry location"/></button>:null}</div>
    <div className="duty-truck-list">{vehicles.map(vehicle=>{
      const latest=latestByVehicle.get(vehicle.id);
      const available=latest&&latest.status!=='OFF_DUTY';
      return <article className="duty-truck" key={vehicle.id}>
        <div><strong>{vehicle.make} · {vehicle.model}</strong><span>{vehicle.platform_number} · {vehicle.cargo_configuration||vehicle.category}</span><small><Text message="Last updated by "/>{latest?.updated_by_name||'fleet owner'} {latest?.updated_at?relativeTime(latest.updated_at,renderedAt):''}</small></div>
        {!latest?<p className="meta"><Text message="Ask your fleet owner to set up capacity before marking this truck Available."/></p>:null}
        <StatusPill status={available?(latest.status||'AVAILABLE'):'OFF_DUTY'}/>
        <form action="/api/capacity/duty" method="post"><input type="hidden" name="vehicleId" value={vehicle.id}/>{!available?<><input type="hidden" name="onDuty" value="on"/><input type="hidden" name="locationArea" value={location?.area||''}/><input type="hidden" name="approximateLat" value={location?.lat??''}/><input type="hidden" name="approximateLng" value={location?.lng??''}/><input type="hidden" name="locationPrecisionKm" value={location?'40':''}/><input type="hidden" name="locationSource" value={location?'DEVICE_OBSCURED':''}/></>:null}<button className={`button icon-button-label ${available?'danger':'success'}`} disabled={!latest||(!available&&!location)}>{available?<><PowerOff aria-hidden="true"/><Text message="Off Duty"/></>:<><Power aria-hidden="true"/><Text message="Available"/></>}</button></form>
      </article>;
    })}</div>
    {!vehicles.length?<div className="empty-state"><Text message="No truck is assigned to your driver account. Ask your fleet owner to assign one."/></div>:null}
  </section>;
}

export function DriverCapacityHome({ vehicles, capacities, corridors, access, query, renderedAt }: { vehicles: any[]; capacities: any[]; corridors:any[]; access:any; query: Record<string,string|undefined>; renderedAt:number }) {
  const latestByVehicle = new Map<string,any>();
  for (const capacity of capacities) if (!latestByVehicle.has(capacity.vehicle_id)) latestByVehicle.set(capacity.vehicle_id,capacity);
  const vehicleOptions = vehicles.map(vehicle => ({ id:String(vehicle.id), label:String(vehicle.label), make:String(vehicle.make||''), model:String(vehicle.model||''), cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''), plate:String(vehicle.plate||''), platformNumber:String(vehicle.platform_number||''), driver:vehicle.assigned_driver||null, current:latestByVehicle.get(vehicle.id) || null }));
const current = capacities[0];
  const restricted=access?.kind==='COMPANY'&&!access.can_manage_capacity;
  if(!vehicles.length&&access?.kind==='SELF_MANAGED')return <div className="page capacity-home-page"><section className="driver-empty-fleet"><Truck aria-hidden="true"/><div><h1><Text message="Add your first truck"/></h1><p><Text message="Register the truck you control, then publish its capacity and approximate location."/></p></div><Link className="button success" href="/app/fleet/new"><Plus aria-hidden="true"/><Text message="Add truck"/></Link></section></div>;
  return <div className="page capacity-home-page">
    <h1 className="sr-only"><Text message="Capacity management"/></h1>
    {query.error?<div className="alert error capacity-home-error" role="alert">{query.error}</div>:null}
    <Localized as="section" copy={["aria-label"]} className="driver-home-section driver-capacity-workspace" aria-label="Capacity management">
    {restricted?<Localized as="section" copy={["aria-label"]} className="capacity-signal-strip" aria-label="Current capacity signal">
      <div><span className={`live-dot ${current?.status === 'OFF_DUTY' || !current ? 'off' : ''}`} aria-hidden="true"/><span><strong>{current ? capacityLabel(current.status) : <Text message="No capacity signal yet"/>}</strong><small>{current?.location_area || 'Add your general area to start'}</small></span></div>
      <div className="signal-facts">
        <span><small><Text message="Capacity updated"/></small><strong>{current ? relativeTime(current.updated_at,renderedAt) : <Text message="Never"/>}</strong></span>
        <span><small><Text message="Location updated"/></small><strong>{current?.location_updated_at ? relativeTime(current.location_updated_at,renderedAt) : <Text message="Never"/>}</strong></span>
        <span><small><Text message="Freshness"/></small>{current ? <StatusPill status={current.freshness}/> : <span className="status expired"><Text message="Not published"/></span>}</span>
      </div>
    </Localized>:null}
    {restricted?<RestrictedAvailability vehicles={vehicles} latestByVehicle={latestByVehicle} renderedAt={renderedAt}/>:<CapacityForm vehicles={vehicleOptions} lockVehicleSelection={vehicleOptions.length===1} corridors={corridors} returnTo="/app/home" allowCorridors={access?.kind==='SELF_MANAGED'} renderedAt={renderedAt}/>}
    </Localized>
  </div>;
}
