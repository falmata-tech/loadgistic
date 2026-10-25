"use client";


import {capacityLocationSource,selectedCapacityLocation} from '@/lib/capacity-location-selection.js';
import {Text,FeedbackText,Localized,useTranslation} from '@/components/localization';
import React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import { CapacityForm } from './capacity-form';
import {CapacityEditDialog} from './capacity-edit-dialog';
import {DriverCapacityLocationEditor} from './driver-capacity-location-editor';
import { StatusPill } from './status-pill';
import { LocateFixed, Power, PowerOff, Truck } from 'lucide-react';
import {type DriverLocation} from '@/lib/capacity-editor-client';
import {locationSourceLabel} from '@/lib/location-source.js';
import {relativeTime} from '@/lib/ui';
import {PublicCapacityMap} from './public-capacity-map';
import {CapacityLocationMap} from './capacity-location-map';

function RestrictedAvailability({vehicles,latestByVehicle,corridors,renderedAt}:{vehicles:any[];latestByVehicle:Map<string,any>;corridors:any[];renderedAt:number}){
  const {t}=useTranslation();
  const router=useRouter();
  const truck=vehicles[0];
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[editing,setEditing]=React.useState(false);
  const [captured,setCaptured]=React.useState(null as DriverLocation|null);
  React.useEffect(()=>{setCaptured(null);setError('');},[truck?.id]);
  if(!truck)return <section className="restricted-duty-panel"><div className="empty-state"><Truck aria-hidden="true"/><Text message="No vehicle is assigned to your driver account. Ask your fleet owner to assign one."/></div></section>;
  const latest=latestByVehicle.get(truck.id),available=Boolean(latest&&latest.status!=='OFF_DUTY');
  const configured=Boolean(truck.duty_configuration_available);
  const phoneSelected=capacityLocationSource(truck.location_selection)==='MOBILE';
  const manualSaved=capacityLocationSource(truck.location_selection)==='MANUAL';
  const publishedLocation=(latest?.location_lat!=null&&latest?.location_lng!=null?{lat:Number(latest.location_lat),lng:Number(latest.location_lng),radius:Number(latest.location_precision_km)||20,area:latest.location_area||'',updatedAt:latest.location_updated_at||''}:null);
  const location=selectedCapacityLocation({selection:truck.location_selection,published:publishedLocation,phone:truck.driver_location,captured});
  const regular=corridors.filter(signal=>signal.vehicle_id===truck.id&&signal.driver_user_id===truck.assigned_driver?.id);
  const reportedSource=captured?'Driver’s phone':locationSourceLabel(latest?.location_source)||(!latest&&manualSaved?'Manually entered':!latest&&truck.driver_location?'Driver’s phone':'');
  return <section className="capacity-console capacity-summary-console restricted-duty-panel" data-testid="capacity-summary">
   <section className="capacity-saved-summary driver-map-summary" data-testid="restricted-driver-map">
    <div className="capacity-summary-layout">{location?<CapacityLocationMap center={location} radiusKm={location.radius} availabilityStatus={available?latest.status:'OFF_DUTY'} areaCenter={available&&latest.availability_geometry==='RADIUS'&&latest.capacity_area_center_lat!=null?{lat:Number(latest.capacity_area_center_lat),lng:Number(latest.capacity_area_center_lng)}:null} areaBoundary={available&&latest.availability_geometry==='RADIUS'?latest.capacity_area_boundary||[]:[]} routePoints={available&&latest.availability_geometry==='ROUTE'?latest.current_route_points||[]:[]} regularSignals={regular}/>:<PublicCapacityMap items={[]} viewer={null} selectedId={null} onSelect={()=>{}} onDeselect={()=>{}}/>}</div>
    <header className="capacity-summary-map-header"><div className="card" style={{padding:12,margin:0}}><strong>{truck.make} · {truck.model}</strong><div className="meta">{truck.platform_number} · {truck.cargo_configuration||truck.category}</div><StatusPill status={available?latest.status:'OFF_DUTY'}/><small className="meta"><Text message="Fleet-managed capacity"/></small>
      {location?<div className="meta" role="status">{location.area} · {location.radius}<Text message=" km"/>{reportedSource?<> · <Text message={reportedSource}/></>:null}{location.updatedAt?<> · {relativeTime(location.updatedAt,renderedAt)}</>:null}</div>:<p className="meta"><Text message={manualSaved?'Manual location saved. Your fleet owner can now publish capacity.':'Share this vehicle’s approximate location so your owner can set up capacity.'}/></p>}
      {!configured?<p className="meta"><Text message="Ask your fleet owner to set up capacity before marking this vehicle Available."/></p>:!available&&phoneSelected&&!captured?<p className="meta"><Text message="Refresh your vehicle location before marking it Available."/></p>:null}
      {error?<p className="alert error" role="alert"><FeedbackText message={error} fallback="Changes could not be saved. Please try again."/></p>:null}
    </div></header>
    <Localized as="nav" copy={["aria-label"]} className="capacity-summary-toolrail" aria-label="Vehicle duty and location" tabIndex={0}>
      <Localized as="button" copy={["aria-label","title"]} type="button" disabled={busy} onClick={()=>setEditing(true)} aria-haspopup="dialog" aria-label="Edit capacity location" title="Edit capacity location"><LocateFixed aria-hidden="true"/><span><small><Text message="Location"/></small><strong><Text message={reportedSource||'Choose source'}/></strong></span></Localized>
      <form action="/api/capacity/duty" method="post"><input type="hidden" name="vehicleId" value={truck.id}/>{!available?<><input type="hidden" name="onDuty" value="on"/><input type="hidden" name="locationArea" value={captured?.area||''}/><input type="hidden" name="approximateLat" value={captured?.lat??''}/><input type="hidden" name="approximateLng" value={captured?.lng??''}/><input type="hidden" name="locationPrecisionKm" value={captured?captured.radius:''}/><input type="hidden" name="locationSource" value={captured?'DEVICE_OBSCURED':''}/></>:null}<button disabled={busy||(!available&&(!configured||(phoneSelected?!captured:capacityLocationSource(truck.location_selection)!=='MANUAL'&&!location)))} aria-label={t(available?'Off Duty':'Available')} title={t(available?'Off Duty':'Available')}>{available?<PowerOff aria-hidden="true"/>:<Power aria-hidden="true"/>}<span><small><Text message="Duty status"/></small><strong><Text message={available?'Off Duty':'Available'}/></strong></span></button></form>
    </Localized>
    {editing?<CapacityEditDialog title="Capacity map location" truck={`${truck.make} · ${truck.model}`} busy={busy} onClose={()=>setEditing(false)}><DriverCapacityLocationEditor vehicleId={truck.id} location={location} publishedSource={latest?.location_source} onDuty={available} onBusyChange={setBusy} onCancel={()=>setEditing(false)} onSaved={(_mode,value)=>{setCaptured(value);setEditing(false);router.refresh();}}/></CapacityEditDialog>:null}
   </section>
  </section>;
}

export function DriverCapacityHome({ vehicles, capacities, corridors, access, ownsFleet=false, query, renderedAt }: { vehicles: any[]; capacities: any[]; corridors:any[]; access:any; ownsFleet?:boolean; query: Record<string,string|undefined>; renderedAt:number }) {
  const latestByVehicle = new Map<string,any>();
  for (const capacity of capacities) if (!latestByVehicle.has(capacity.vehicle_id)) latestByVehicle.set(capacity.vehicle_id,capacity);
  const vehicleOptions = vehicles.map(vehicle => ({ id:String(vehicle.id), label:String(vehicle.label), make:String(vehicle.make||''), model:String(vehicle.model||''), cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''), plate:String(vehicle.plate||''), platformNumber:String(vehicle.platform_number||''), driver:vehicle.assigned_driver||null, driverLocation:vehicle.driver_location||null, locationSelection:vehicle.location_selection, current:latestByVehicle.get(vehicle.id) || null }));
  const restricted=access?.kind==='COMPANY'&&!access.can_manage_capacity;
  if(!vehicles.length)return <div className="page capacity-home-page"><section className="capacity-saved-summary driver-map-summary" style={{position:'relative'}}><PublicCapacityMap items={[]} viewer={null} selectedId={null} onSelect={()=>{}} onDeselect={()=>{}}/><section className="driver-empty-fleet" style={{position:'absolute',bottom:20,left:16,right:16,zIndex:450}}><Truck aria-hidden="true"/><div><h1><Text message="No vehicle assigned"/></h1><p><Text message={ownsFleet?'Choose the vehicle you drive under Manage vehicles.':'Ask your fleet owner to assign your vehicle.'}/></p></div>{ownsFleet?<Link className="button success" href="/app/home/vehicles?view=drivers"><Truck aria-hidden="true"/><Text message="Manage vehicles"/></Link>:null}</section></section></div>;
  return <div className="page capacity-home-page">
    <h1 className="sr-only"><Text message="Capacity management"/></h1>
    {query.error?<div className="alert error capacity-home-error" role="alert"><FeedbackText message={query.error} fallback="Could not load this page. Please try again."/></div>:null}
    <Localized as="section" copy={["aria-label"]} className="driver-home-section driver-capacity-workspace" aria-label="Capacity management">
    {restricted?<RestrictedAvailability vehicles={vehicles} latestByVehicle={latestByVehicle} corridors={corridors} renderedAt={renderedAt}/>:<CapacityForm vehicles={vehicleOptions} lockVehicleSelection corridors={corridors} returnTo="/app/home" allowCorridors={ownsFleet||access?.kind==='SELF_MANAGED'} renderedAt={renderedAt}/>}
    </Localized>
  </div>;
}
