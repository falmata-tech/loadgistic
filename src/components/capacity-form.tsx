"use client";

import React from 'react';
import Image from 'next/image';
import { Boxes, CalendarClock, Camera, CircleDotDashed, Clock3, Eye, Gauge, LocateFixed, MapPin, MapPinned, PowerOff, Route, Save, Truck } from 'lucide-react';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { obscureCoordinate } from '@/lib/location-privacy.js';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type CapacitySnapshot = {
  status?:string; available_percent?:number; accepts_full_load?:number; accepts_partial_load?:number;
  location_area?:string; location_lat?:number; location_lng?:number; location_source?:string;
  origin?:string; destination?:string; travel_date?:string; next_available?:string; visibility?:string;
  open_to_contract_lanes?:number; accepts_multi_pick?:number; accepts_multi_drop?:number;
  current_route_origin?:string; current_route_destination?:string;
  planned_space_status?:string; movement_scope?:string; origin_place_ref?:string; destination_place_ref?:string;
  current_origin_place_ref?:string; current_destination_place_ref?:string; location_place_ref?:string;
  local_place_ref?:string; local_place_label?:string; local_radius_km?:number; available_again_date?:string;
  proof_available?:boolean;
};

type VehicleOption={id:string;label:string;make:string;model:string;cargoConfiguration:string;plate:string;platformNumber?:string;current?:CapacitySnapshot|null};
type LocationState='idle'|'requesting'|'captured'|'denied'|'error';

function acceptedLoadValue(current?:CapacitySnapshot|null){
  if(current?.accepts_full_load&&current?.accepts_partial_load)return 'BOTH';
  if(current?.accepts_partial_load)return 'PTL';
  return 'FTL';
}

function acceptedLoadLabel(value:string){
  if(value==='FTL')return 'Full Truckload';
  if(value==='PTL')return 'Partial Truckload';
  return 'Both';
}

export function CapacityForm({vehicles,initialVehicleId,allowDeviceLocation=true,lockVehicleSelection=false}:{vehicles:VehicleOption[];initialVehicleId?:string;allowDeviceLocation?:boolean;lockVehicleSelection?:boolean}){
  const validInitialVehicleId=vehicles.some(vehicle=>vehicle.id===initialVehicleId)?initialVehicleId:vehicles[0]?.id;
  const [vehicleId,setVehicleId]=React.useState(validInitialVehicleId||'');
  const selectedVehicle=vehicles.find(vehicle=>vehicle.id===vehicleId);
  const current=selectedVehicle?.current;
  const [status,setStatus]=React.useState(current?.status||'EMPTY');
  const [percent,setPercent]=React.useState(current?.available_percent||50);
  const [locationState,setLocationState]=React.useState((current?.location_source==='DEVICE_OBSCURED'?'captured':'idle') as LocationState);
  const [approximateLocation,setApproximateLocation]=React.useState(current?.location_source==='DEVICE_OBSCURED'&&current.location_lat!=null&&current.location_lng!=null?{lat:current.location_lat,lng:current.location_lng}:null as {lat:number;lng:number}|null);
  const [locationArea,setLocationArea]=React.useState(current?.location_area||'');
  const [localPlaceLabel,setLocalPlaceLabel]=React.useState(current?.local_place_label||'');
  const [deviceLocalPlaceRef,setDeviceLocalPlaceRef]=React.useState('');
  const [availableAgainDate,setAvailableAgainDate]=React.useState(current?.available_again_date||'');
  const [movementScope,setMovementScope]=React.useState(current?.movement_scope||'INTERCITY');
  const [acceptedLoads,setAcceptedLoads]=React.useState(acceptedLoadValue(current));
  const [visibility,setVisibility]=React.useState(current?.visibility==='SAVED_PARTNERS'?'SAVED_PARTNERS':'OPEN');
  const [interactive,setInteractive]=React.useState(false);
  const lastLocationUpdate=React.useRef(0);
  const onDuty=status!=='OFF_DUTY';

  React.useEffect(()=>{
    setInteractive(true);
  },[]);

  React.useEffect(()=>{
    if(movementScope==='LOCAL'&&status==='PARTIAL'){
      setStatus('EMPTY');
    }
  },[movementScope,status]);

  React.useEffect(()=>{
    if(!allowDeviceLocation||!navigator.geolocation)return;
    setLocationState('requesting');
    const watcher=navigator.geolocation.watchPosition(position=>{
      const now=Date.now();
      if(lastLocationUpdate.current&&now-lastLocationUpdate.current<60000)return;
      lastLocationUpdate.current=now;
      setApproximateLocation(obscureCoordinate(position.coords.latitude,position.coords.longitude,35));
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      if(nearest){
        const label=`${nearest.name}, Ethiopia`;
        setLocationArea(label);
        setLocalPlaceLabel(label);
        setDeviceLocalPlaceRef(`builtin:${nearest.name.toLowerCase()}`);
      }
      setLocationState('captured');
    },error=>{
      setApproximateLocation(null);
      setLocationState(error.code===error.PERMISSION_DENIED?'denied':'error');
    },{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
    return()=>navigator.geolocation.clearWatch(watcher);
  },[allowDeviceLocation]);

  function chooseVehicle(nextId:string){
    const next=vehicles.find(vehicle=>vehicle.id===nextId)?.current;
    setVehicleId(nextId); setStatus(next?.status||'EMPTY');
    setPercent(next?.available_percent||50); setLocationArea(next?.location_area||''); setLocalPlaceLabel(next?.local_place_label||'');
    setDeviceLocalPlaceRef(''); setAvailableAgainDate(next?.available_again_date||''); setMovementScope(next?.movement_scope||'INTERCITY');
    setAcceptedLoads(acceptedLoadValue(next)); setVisibility(next?.visibility==='SAVED_PARTNERS'?'SAVED_PARTNERS':'OPEN');
    setApproximateLocation(next?.location_source==='DEVICE_OBSCURED'&&next.location_lat!=null&&next.location_lng!=null?{lat:next.location_lat,lng:next.location_lng}:null);
    setLocationState(next?.location_source==='DEVICE_OBSCURED'?'captured':'requesting');
  }

  function setSpace(nextStatus:string){setStatus(nextStatus);}
  function chooseMovementScope(nextScope:string){
    setMovementScope(nextScope);
    if(nextScope==='LOCAL'&&status==='PARTIAL'){
      setStatus('EMPTY');
    }
  }
  if(!vehicles.length)return <div className="empty-state">No active truck is assigned to this account.</div>;

  const locationMessage=locationState==='captured'?'Approximate location ready':locationState==='requesting'?'Finding truck location...':locationState==='denied'?'Location permission denied':locationState==='error'?'Device location unavailable':'Waiting for location';

  return <form action="/api/capacity" method="post" encType="multipart/form-data" className="capacity-console simple-capacity-console" data-testid="capacity-form" data-interactive={interactive?'true':'false'} aria-busy={!interactive}>
    <input type="hidden" name="status" value={status}/>
    <input type="hidden" name="availablePercent" value={status==='EMPTY'?100:status==='PARTIAL'?percent:0}/>
    <input type="hidden" name="deviceLocalPlaceRef" value={deviceLocalPlaceRef}/>
    <input type="hidden" name="locationArea" value={movementScope==='INTERCITY'?locationArea:localPlaceLabel}/>
    <input type="hidden" name="approximateLat" value={allowDeviceLocation?approximateLocation?.lat??'':''}/>
    <input type="hidden" name="approximateLng" value={allowDeviceLocation?approximateLocation?.lng??'':''}/>
    <input type="hidden" name="locationPrecisionKm" value={allowDeviceLocation&&approximateLocation?'40':''}/>
    <input type="hidden" name="locationSource" value={allowDeviceLocation&&approximateLocation?'DEVICE_OBSCURED':'MANUAL_GENERAL_AREA'}/>

    <section className="capacity-truck-bar">
      <Image src={vehicleConfigurationImage(selectedVehicle?.cargoConfiguration)} alt={selectedVehicle?.cargoConfiguration||'Truck'} width={112} height={88}/>
      <div className="capacity-truck-copy"><small>Updating</small><strong>{selectedVehicle?.make} {selectedVehicle?.model}</strong><span>{selectedVehicle?.platformNumber} · {selectedVehicle?.cargoConfiguration}</span></div>
      {lockVehicleSelection?<input type="hidden" name="vehicleId" value={vehicleId}/>:<div className="form-group compact-truck-select"><label htmlFor="capacity-vehicle"><Truck aria-hidden="true"/>Truck</label><select id="capacity-vehicle" name="vehicleId" value={vehicleId} onChange={event=>chooseVehicle(event.target.value)} required>{vehicles.map(vehicle=><option value={vehicle.id} key={vehicle.id}>{vehicle.platformNumber} · {vehicle.make} · {vehicle.model}</option>)}</select></div>}
    </section>

    <section className="control-panel capacity-decision">
      <div className="capacity-step-title"><span>1</span><Gauge aria-hidden="true"/><div><h2>Truck status</h2><p>What can this truck do now?</p></div><strong>{status==='OFF_DUTY'?'Hidden':status==='PARTIAL'?`${percent}%`:status==='BUSY'?'Busy':'Empty'}</strong></div>
      <div className="segmented-control space-control capacity-status-choices compact-status-choices" role="group" aria-label="Truck availability">
        <button type="button" aria-pressed={status==='EMPTY'} disabled={!interactive} onClick={()=>setSpace('EMPTY')}><Truck aria-hidden="true"/><strong>Empty</strong></button>
        <button type="button" aria-pressed={status==='PARTIAL'} disabled={!interactive} onClick={()=>{if(movementScope==='LOCAL')setMovementScope('INTERCITY');setSpace('PARTIAL');}}><Boxes aria-hidden="true"/><strong>Partial</strong></button>
        <button type="button" aria-pressed={status==='BUSY'} disabled={!interactive} onClick={()=>setSpace('BUSY')}><Clock3 aria-hidden="true"/><strong>Busy</strong></button>
        <button type="button" aria-pressed={status==='OFF_DUTY'} disabled={!interactive} onClick={()=>setSpace('OFF_DUTY')}><PowerOff aria-hidden="true"/><strong>Off Duty</strong></button>
      </div>
    </section>

    {onDuty?<div className="capacity-primary-flow" key={vehicleId}>
      <section className="control-panel capacity-decision">
        <div className="capacity-step-title"><span>2</span><MapPinned aria-hidden="true"/><div><h2>Work area</h2><p>Where can this truck work?</p></div></div>
        <input type="hidden" name="movementScope" value={movementScope}/>
        <div className="segmented-control movement-scope-control visual-scope-control" role="group" aria-label="Work area">
          <button type="button" aria-pressed={movementScope==='LOCAL'} disabled={!interactive} onClick={()=>chooseMovementScope('LOCAL')}><MapPin aria-hidden="true"/>Local</button>
          <button type="button" aria-pressed={movementScope==='INTERCITY'} disabled={!interactive} onClick={()=>chooseMovementScope('INTERCITY')}><Route aria-hidden="true"/>Long-distance routes</button>
          <button type="button" aria-pressed={movementScope==='BOTH'} disabled={!interactive} onClick={()=>chooseMovementScope('BOTH')}><MapPinned aria-hidden="true"/>Both</button>
        </div>
        {allowDeviceLocation?<div className={`automatic-location ${locationState}`}><LocateFixed aria-hidden="true"/><span><strong>{locationMessage}</strong><small>{locationState==='captured'?'Shared only as an obscured 40 km area.':'You can enter the general area below.'}</small></span></div>:null}
        {movementScope!=='INTERCITY'?<div className="form-grid local-capacity-area"><div className="form-group"><label htmlFor="capacity-local-place"><MapPin aria-hidden="true"/>{status==='BUSY'?'Ready near':'City or town'}</label><EthiopiaPlaceInput id="capacity-local-place" name="localPlaceLabel" placeRefName="localPlaceRef" defaultPlaceRef={current?.local_place_ref||''} value={localPlaceLabel} onChange={event=>{setLocalPlaceLabel(event.target.value);setDeviceLocalPlaceRef('');}} required placeholder="Addis Ababa, Ethiopia" onPlaceSelect={place=>{setLocalPlaceLabel(place.display_name);setLocationArea(place.display_name);}}/></div><div className="form-group"><label htmlFor="capacity-local-radius"><CircleDotDashed aria-hidden="true"/>Radius</label><select id="capacity-local-radius" name="localRadiusKm" defaultValue={String(current?.local_radius_km||25)}>{[10,25,40,60,100].map(radius=><option value={radius} key={radius}>{radius} km</option>)}</select></div></div>:<div className="form-group"><label htmlFor="capacity-area"><MapPin aria-hidden="true"/>{status==='BUSY'?'Ready near':'Current general area'}</label><EthiopiaPlaceInput id="capacity-area" placeRefName="locationPlaceRef" defaultPlaceRef={current?.location_place_ref||''} required value={locationArea} onChange={event=>setLocationArea(event.target.value)} placeholder="Adama, Ethiopia"/></div>}
      </section>

      <section className="control-panel capacity-decision capacity-status-detail">
        <div className="capacity-step-title"><span>3</span>{status==='PARTIAL'?<Boxes aria-hidden="true"/>:status==='BUSY'?<CalendarClock aria-hidden="true"/>:<Truck aria-hidden="true"/>}<div><h2>{status==='PARTIAL'?'Partial space':status==='BUSY'?'Available again':'Empty truck'}</h2><p>{status==='PARTIAL'?'Space and live route stay together.':status==='BUSY'?'Say when the truck can work next.':'The whole truck is available.'}</p></div><strong>{status==='PARTIAL'?`${percent}%`:status==='BUSY'?'Soon':'100%'}</strong></div>
        {status==='PARTIAL'?<div className="capacity-linked-fields">
          <div className="range-control"><div><label htmlFor="capacity-percent"><Gauge aria-hidden="true"/>Space available</label><strong>{percent}%</strong></div><input id="capacity-percent" type="range" min="5" max="95" step="5" value={percent} onChange={event=>setPercent(Number(event.target.value))}/></div>
          <div><h3><Route aria-hidden="true"/>Live route</h3><p className="meta">Where this partial space is moving now.</p><div className="route-inputs"><div className="form-group"><label htmlFor="current-route-origin"><MapPin aria-hidden="true"/>From</label><EthiopiaPlaceInput id="current-route-origin" name="currentRouteOrigin" placeRefName="currentOriginPlaceRef" defaultPlaceRef={current?.current_origin_place_ref||''} defaultValue={current?.current_route_origin||''} required placeholder="Addis Ababa, Ethiopia"/></div><div className="route-arrow" aria-hidden="true">→</div><div className="form-group"><label htmlFor="current-route-destination"><MapPin aria-hidden="true"/>To</label><EthiopiaPlaceInput id="current-route-destination" name="currentRouteDestination" placeRefName="currentDestinationPlaceRef" defaultPlaceRef={current?.current_destination_place_ref||''} defaultValue={current?.current_route_destination||''} required placeholder="Adama, Ethiopia"/></div></div></div>
        </div>:null}
        {status==='BUSY'?<div className="busy-availability-fields"><div className="form-group"><label htmlFor="available-again-date"><CalendarClock aria-hidden="true"/>Ready date</label><input id="available-again-date" name="availableAgainDate" type="date" min={new Date().toISOString().slice(0,10)} value={availableAgainDate} onChange={event=>setAvailableAgainDate(event.target.value)} required/></div></div>:null}
        {status==='EMPTY'?<div className="capacity-ready-note"><Truck aria-hidden="true"/><span><strong>100% cargo space</strong><small>Ready for a shipment that fits this truck.</small></span></div>:null}
      </section>

      {status!=='BUSY'?<section className="control-panel capacity-decision"><div className="capacity-step-title"><span>4</span><Boxes aria-hidden="true"/><div><h2>Shipment size</h2><p>What can this truck accept?</p></div><strong>{acceptedLoadLabel(acceptedLoads)}</strong></div><div className="segmented-control load-policy-control">{['FTL','PTL','BOTH'].map(value=><label key={value}><input name="acceptedLoads" value={value} type="radio" checked={value===acceptedLoads} onChange={()=>setAcceptedLoads(value)}/><span>{value==='FTL'?'Full Truckload':value==='PTL'?'Partial Truckload':'Both'}</span></label>)}</div><div className="capacity-term-hint"><Truck aria-hidden="true"/><span><strong>Full Truckload (FTL)</strong> full truck · <strong>Partial Truckload (PTL)</strong> shared space</span></div></section>:null}

      {status!=='BUSY'?<section className="control-panel capacity-decision"><div className="capacity-step-title"><span>5</span><Route aria-hidden="true"/><div><h2>Stops accepted</h2><p>Direct is always included.</p></div></div><div className="multi-stop-toggles"><div className="direct-route-choice"><Route aria-hidden="true"/><span><strong>Direct</strong><small>One pickup and one drop-off</small></span></div><label className="rich-toggle"><input name="acceptsMultiPick" type="checkbox" defaultChecked={Boolean(current?.accepts_multi_pick)}/><span className="toggle-track" aria-hidden="true"/><span><strong>Multi Pick</strong><small>More than one pickup</small></span></label><label className="rich-toggle"><input name="acceptsMultiDrop" type="checkbox" defaultChecked={Boolean(current?.accepts_multi_drop)}/><span className="toggle-track" aria-hidden="true"/><span><strong>Multi Drop</strong><small>More than one drop-off</small></span></label></div></section>:null}

      <section className="control-panel capacity-decision"><div className="capacity-step-title"><span>{status==='BUSY'?'4':'6'}</span><Route aria-hidden="true"/><div><h2>Future work</h2><p>Recurring work or a planned trip.</p></div></div><label className="rich-toggle"><input name="openToContractLanes" type="checkbox" defaultChecked={Boolean(current?.open_to_contract_lanes)}/><span className="toggle-track" aria-hidden="true"/><span><strong>Contract routes</strong><small>Open to recurring work</small></span></label>{status!=='BUSY'&&movementScope!=='LOCAL'?<div className="future-trip-fields"><h3><CalendarClock aria-hidden="true"/>Planned trip <span className="meta">(optional)</span></h3><div className="route-inputs"><div className="form-group"><label htmlFor="capacity-origin"><MapPin aria-hidden="true"/>From</label><EthiopiaPlaceInput id="capacity-origin" name="origin" placeRefName="originPlaceRef" defaultPlaceRef={current?.origin_place_ref||''} defaultValue={current?.origin||''} placeholder="Addis Ababa, Ethiopia"/></div><div className="route-arrow" aria-hidden="true">→</div><div className="form-group"><label htmlFor="capacity-destination"><MapPin aria-hidden="true"/>To</label><EthiopiaPlaceInput id="capacity-destination" name="destination" placeRefName="destinationPlaceRef" defaultPlaceRef={current?.destination_place_ref||''} defaultValue={current?.destination||''} placeholder="Dire Dawa, Ethiopia"/></div></div><div className="form-grid"><div className="form-group"><label htmlFor="capacity-travel-date"><CalendarClock aria-hidden="true"/>Travel date</label><input id="capacity-travel-date" name="travelDate" type="date" defaultValue={current?.travel_date||''}/></div><div className="form-group"><label htmlFor="capacity-next"><Clock3 aria-hidden="true"/>Ready time</label><input id="capacity-next" name="nextAvailable" defaultValue={current?.next_available||''} placeholder="Tomorrow morning"/></div></div><div className="segmented-control"><label><input name="plannedSpaceStatus" value="FULL" type="radio" defaultChecked={(current?.planned_space_status||'FULL')==='FULL'}/><span>Full</span></label><label><input name="plannedSpaceStatus" value="PARTIAL" type="radio" defaultChecked={current?.planned_space_status==='PARTIAL'}/><span>Partial</span></label></div></div>:null}</section>

      <section className="control-panel capacity-decision"><div className="capacity-step-title"><span>{status==='BUSY'?'5':'7'}</span><Eye aria-hidden="true"/><div><h2>Share update</h2><p>Choose who can see this truck.</p></div><strong>{visibility==='OPEN'?'Public':'Partners'}</strong></div><div className="sharing-proof-grid"><div><div className="segmented-control"><label><input name="visibility" value="OPEN" type="radio" checked={visibility==='OPEN'} onChange={()=>setVisibility('OPEN')}/><span>Public</span></label><label><input name="visibility" value="SAVED_PARTNERS" type="radio" checked={visibility==='SAVED_PARTNERS'} onChange={()=>setVisibility('SAVED_PARTNERS')}/><span>Partners</span></label></div><p className="meta">Public reaches the Board. Partners reaches connected Businesses only.</p></div>{status!=='BUSY'?<div><h3><Camera aria-hidden="true"/>Cargo photo <span className="meta">(optional)</span></h3><label className="photo-drop" htmlFor="capacity-photo"><Camera aria-hidden="true"/><strong>Add photo</strong><input id="capacity-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label></div>:null}</div></section>
    </div>:<section className="control-panel off-duty-panel"><strong>Truck hidden from the Truck Board.</strong><p>Choose Empty, Partial, or Busy above when it is ready for work.</p></section>}

    <div className="capacity-publish-bar"><span><strong>{onDuty?status.replace('_',' '):'Off Duty'}</strong><small>{onDuty?(movementScope==='LOCAL'?'Local':movementScope==='BOTH'?'Local + long-distance':'Long-distance routes'):'Not visible'}</small></span><button className={`button capacity-submit ${onDuty?'success':'danger'}`} disabled={!interactive}><Save aria-hidden="true"/>{onDuty?'Publish update':'Set Off Duty'}</button></div>
  </form>;
}
