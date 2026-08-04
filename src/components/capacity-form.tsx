"use client";

import React from 'react';
import Image from 'next/image';
import {
  Boxes,
  CalendarClock,
  Camera,
  CircleDotDashed,
  Clock3,
  Eye,
  Gauge,
  LocateFixed,
  MapPin,
  MapPinned,
  PowerOff,
  RefreshCw,
  Route,
  Save,
  Truck
} from 'lucide-react';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { capacityPrivacyRadii, obscureCoordinate } from '@/lib/location-privacy.js';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type CapacitySnapshot = {
  status?:string; available_percent?:number; accepts_full_load?:number; accepts_partial_load?:number;
  location_area?:string; location_lat?:number; location_lng?:number; location_precision_km?:number; location_source?:string; location_updated_at?:string;
  origin?:string; destination?:string; travel_date?:string; visibility?:string;
  open_to_contract_lanes?:number; accepts_multi_pick?:number; accepts_multi_drop?:number;
  current_route_origin?:string; current_route_destination?:string;
  movement_scope?:string; origin_place_ref?:string; destination_place_ref?:string;
  current_origin_place_ref?:string; current_destination_place_ref?:string;
  local_radius_km?:number; available_again_date?:string;
  available_again_place_ref?:string; available_again_place_label?:string;
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
  const [movementScope,setMovementScope]=React.useState(current?.movement_scope||'INTERCITY');
  const [locationPrivacyKm,setLocationPrivacyKm]=React.useState(()=>{
    const currentRadius=Number(current?.location_precision_km);
    return capacityPrivacyRadii(current?.movement_scope||'INTERCITY').includes(currentRadius)?currentRadius:40;
  });
  const [acceptedLoads,setAcceptedLoads]=React.useState(acceptedLoadValue(current));
  const [routeIntent,setRouteIntent]=React.useState(current?.origin&&current?.destination?'SPECIFIC':'ANYWHERE');
  const [availableAgainDate,setAvailableAgainDate]=React.useState(current?.available_again_date||'');
  const [visibility,setVisibility]=React.useState(current?.visibility==='SAVED_PARTNERS'?'SAVED_PARTNERS':'OPEN');
  const [locationState,setLocationState]=React.useState('idle' as LocationState);
  const [approximateLocation,setApproximateLocation]=React.useState(null as {lat:number;lng:number}|null);
  const [locationArea,setLocationArea]=React.useState('');
  const [locationAttempt,setLocationAttempt]=React.useState(0);
  const [interactive,setInteractive]=React.useState(false);
  const lastLocationUpdate=React.useRef(0);
  const onDuty=status!=='OFF_DUTY';

  React.useEffect(()=>setInteractive(true),[]);

  React.useEffect(()=>{
    if(!allowDeviceLocation)return;
    if(!navigator.geolocation){setLocationState('error');return;}
    setApproximateLocation(null);
    setLocationState('requesting');
    let active=true;
    const watcher=navigator.geolocation.watchPosition(position=>{
      if(!active)return;
      const now=Date.now();
      if(lastLocationUpdate.current&&now-lastLocationUpdate.current<60000)return;
      lastLocationUpdate.current=now;
      setApproximateLocation(obscureCoordinate(position.coords.latitude,position.coords.longitude,locationPrivacyKm));
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      setLocationArea(nearest?`Around ${nearest.name}, Ethiopia`:'Around current device area');
      setLocationState('captured');
    },error=>{
      if(!active)return;
      setApproximateLocation(null);
      setLocationState(error.code===error.PERMISSION_DENIED?'denied':'error');
    },{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
    return()=>{active=false;navigator.geolocation.clearWatch(watcher);};
  },[allowDeviceLocation,locationAttempt,vehicleId,locationPrivacyKm]);

  function retryLocation(){
    lastLocationUpdate.current=0;
    setLocationState('requesting');
    setLocationAttempt((value:number)=>value+1);
  }

  function chooseVehicle(nextId:string){
    const next=vehicles.find(vehicle=>vehicle.id===nextId)?.current;
    setVehicleId(nextId);
    setStatus(next?.status||'EMPTY');
    setPercent(next?.available_percent||50);
    setMovementScope(next?.movement_scope||'INTERCITY');
    const nextRadius=Number(next?.location_precision_km);
    setLocationPrivacyKm(capacityPrivacyRadii(next?.movement_scope||'INTERCITY').includes(nextRadius)?nextRadius:40);
    setAcceptedLoads(acceptedLoadValue(next));
    setRouteIntent(next?.origin&&next?.destination?'SPECIFIC':'ANYWHERE');
    setAvailableAgainDate(next?.available_again_date||'');
    setVisibility(next?.visibility==='SAVED_PARTNERS'?'SAVED_PARTNERS':'OPEN');
  }

  if(!vehicles.length)return <div className="empty-state">No active truck is assigned to this account.</div>;

  const locationMessage=locationState==='captured'?'Current truck area ready':locationState==='requesting'?'Finding truck location...':locationState==='denied'?'Location permission is off':locationState==='error'?'Device location unavailable':'Waiting for location';
  const locationActionLabel=locationState==='captured'?'Refresh location':locationState==='requesting'?'Requesting location...':'Request location';
  const submitDisabled=!interactive||(allowDeviceLocation&&onDuty&&!approximateLocation);
  const sizeStep=status==='EMPTY'?3:null;
  const stopStep=status==='EMPTY'?4:status==='PARTIAL'?3:null;
  const futureStep=status==='EMPTY'?5:status==='PARTIAL'?4:3;
  const shareStep=status==='EMPTY'?6:status==='PARTIAL'?5:4;

  return <form action="/api/capacity" method="post" encType="multipart/form-data" className="capacity-console simple-capacity-console" data-testid="capacity-form" data-interactive={interactive?'true':'false'} aria-busy={!interactive}>
    <input type="hidden" name="status" value={status}/>
    <input type="hidden" name="availablePercent" value={status==='EMPTY'?100:status==='PARTIAL'?percent:0}/>
    <input type="hidden" name="acceptedLoads" value={status==='PARTIAL'?'PTL':status==='EMPTY'?acceptedLoads:''}/>
    <input type="hidden" name="locationArea" value={locationArea}/>
    <input type="hidden" name="approximateLat" value={allowDeviceLocation?approximateLocation?.lat??'':''}/>
    <input type="hidden" name="approximateLng" value={allowDeviceLocation?approximateLocation?.lng??'':''}/>
    <input type="hidden" name="locationPrecisionKm" value={allowDeviceLocation&&approximateLocation?locationPrivacyKm:''}/>
    <input type="hidden" name="locationSource" value={allowDeviceLocation&&approximateLocation?'DEVICE_OBSCURED':'PRESERVE_DRIVER'}/>

    <section className="capacity-truck-bar">
      <Image src={vehicleConfigurationImage(selectedVehicle?.cargoConfiguration)} alt={selectedVehicle?.cargoConfiguration||'Truck'} width={112} height={88}/>
      <div className="capacity-truck-copy"><small>Updating</small><strong>{selectedVehicle?.make} {selectedVehicle?.model}</strong><span>{selectedVehicle?.platformNumber} · {selectedVehicle?.cargoConfiguration}</span></div>
      {lockVehicleSelection?<input type="hidden" name="vehicleId" value={vehicleId}/>:<div className="form-group compact-truck-select"><label htmlFor="capacity-vehicle"><Truck aria-hidden="true"/>Truck</label><select id="capacity-vehicle" name="vehicleId" value={vehicleId} onChange={event=>chooseVehicle(event.target.value)} required>{vehicles.map(vehicle=><option value={vehicle.id} key={vehicle.id}>{vehicle.platformNumber} · {vehicle.make} · {vehicle.model}</option>)}</select></div>}
    </section>

    <section className="control-panel capacity-decision">
      <div className="capacity-step-title"><span>1</span><Gauge aria-hidden="true"/><div><h2>Truck status</h2><p>What can this truck do now?</p></div><strong>{status==='OFF_DUTY'?'Hidden':status==='PARTIAL'?`${percent}%`:status==='BUSY'?'Busy':'Empty'}</strong></div>
      <div className="segmented-control space-control capacity-status-choices compact-status-choices" role="group" aria-label="Truck availability">
        <button type="button" aria-pressed={status==='EMPTY'} disabled={!interactive} onClick={()=>setStatus('EMPTY')}><Truck aria-hidden="true"/><strong>Empty</strong></button>
        <button type="button" aria-pressed={status==='PARTIAL'} disabled={!interactive} onClick={()=>setStatus('PARTIAL')}><Boxes aria-hidden="true"/><strong>Partial</strong></button>
        <button type="button" aria-pressed={status==='BUSY'} disabled={!interactive} onClick={()=>setStatus('BUSY')}><Clock3 aria-hidden="true"/><strong>Busy</strong></button>
        <button type="button" aria-pressed={status==='OFF_DUTY'} disabled={!interactive} onClick={()=>setStatus('OFF_DUTY')}><PowerOff aria-hidden="true"/><strong>Off Duty</strong></button>
      </div>

      {status==='PARTIAL'?<div className="capacity-linked-fields capacity-status-inline">
        <div className="range-control"><div><label htmlFor="capacity-percent"><Gauge aria-hidden="true"/>Space available</label><strong>{percent}%</strong></div><input id="capacity-percent" type="range" min="5" max="95" step="5" value={percent} onChange={event=>setPercent(Number(event.target.value))}/></div>
        <div><h3><Route aria-hidden="true"/>Live route</h3><p className="meta">Required for Partial Truckload space.</p><div className="route-inputs"><div className="form-group"><label htmlFor="current-route-origin"><MapPin aria-hidden="true"/>From</label><EthiopiaPlaceInput id="current-route-origin" name="currentRouteOrigin" placeRefName="currentOriginPlaceRef" defaultPlaceRef={current?.current_origin_place_ref||''} defaultValue={current?.current_route_origin||''} required placeholder="Addis Ababa, Ethiopia"/></div><div className="route-arrow" aria-hidden="true">→</div><div className="form-group"><label htmlFor="current-route-destination"><MapPin aria-hidden="true"/>To</label><EthiopiaPlaceInput id="current-route-destination" name="currentRouteDestination" placeRefName="currentDestinationPlaceRef" defaultPlaceRef={current?.current_destination_place_ref||''} defaultValue={current?.current_route_destination||''} required placeholder="Adama, Ethiopia"/></div></div></div>
        <div className="capacity-term-hint"><Boxes aria-hidden="true"/><span><strong>Partial Truckload (PTL)</strong> is selected automatically.</span></div>
      </div>:null}

      {status==='EMPTY'?<div className="capacity-linked-fields capacity-status-inline">
        <div><h3><Route aria-hidden="true"/>Where next?</h3><div className="segmented-control"><label><input type="radio" name="routeIntent" value="ANYWHERE" checked={routeIntent==='ANYWHERE'} onChange={()=>setRouteIntent('ANYWHERE')}/><span>Anywhere</span></label><label><input type="radio" name="routeIntent" value="SPECIFIC" checked={routeIntent==='SPECIFIC'} onChange={()=>setRouteIntent('SPECIFIC')}/><span>Specific route</span></label></div></div>
        {routeIntent==='SPECIFIC'?<div className="future-trip-fields"><div className="route-inputs"><div className="form-group"><label htmlFor="capacity-origin"><MapPin aria-hidden="true"/>From</label><EthiopiaPlaceInput id="capacity-origin" name="origin" placeRefName="originPlaceRef" defaultPlaceRef={current?.origin_place_ref||''} defaultValue={current?.origin||''} required placeholder="Addis Ababa, Ethiopia"/></div><div className="route-arrow" aria-hidden="true">→</div><div className="form-group"><label htmlFor="capacity-destination"><MapPin aria-hidden="true"/>To</label><EthiopiaPlaceInput id="capacity-destination" name="destination" placeRefName="destinationPlaceRef" defaultPlaceRef={current?.destination_place_ref||''} defaultValue={current?.destination||''} required placeholder="Dire Dawa, Ethiopia"/></div></div><div className="form-group"><label htmlFor="capacity-travel-date"><CalendarClock aria-hidden="true"/>Travel date</label><input id="capacity-travel-date" name="travelDate" type="date" min={new Date().toISOString().slice(0,10)} defaultValue={current?.travel_date||''} required/></div></div>:null}
      </div>:null}

      {status==='BUSY'?<div className="busy-availability-fields capacity-status-inline" key={`busy-${vehicleId}`}>
        <div className="form-group"><label htmlFor="available-again-date"><CalendarClock aria-hidden="true"/>Ready date</label><input id="available-again-date" name="availableAgainDate" type="date" min={new Date().toISOString().slice(0,10)} value={availableAgainDate} onChange={event=>setAvailableAgainDate(event.target.value)} required/></div>
        <div className="form-group"><label htmlFor="available-again-place"><MapPin aria-hidden="true"/>Available near</label><EthiopiaPlaceInput id="available-again-place" name="availableAgainPlaceLabel" placeRefName="availableAgainPlaceRef" defaultPlaceRef={current?.available_again_place_ref||''} defaultValue={current?.available_again_place_label||''} required placeholder="Adama, Ethiopia"/></div>
      </div>:null}
    </section>

    {onDuty?<div className="capacity-primary-flow" key={vehicleId}>
      <section className="control-panel capacity-decision">
        <div className="capacity-step-title"><span>2</span><MapPinned aria-hidden="true"/><div><h2>Work area</h2><p>Device location sets the current area.</p></div></div>
        <input type="hidden" name="movementScope" value={movementScope}/>
        <div className="segmented-control movement-scope-control visual-scope-control" role="group" aria-label="Work area">
          <button type="button" aria-pressed={movementScope==='LOCAL'} disabled={!interactive} onClick={()=>{setMovementScope('LOCAL');setLocationPrivacyKm((currentRadius:number)=>capacityPrivacyRadii('LOCAL').includes(currentRadius)?currentRadius:20);}}><MapPin aria-hidden="true"/>Local</button>
          <button type="button" aria-pressed={movementScope==='INTERCITY'} disabled={!interactive} onClick={()=>setMovementScope('INTERCITY')}><Route aria-hidden="true"/>Long-distance</button>
          <button type="button" aria-pressed={movementScope==='BOTH'} disabled={!interactive} onClick={()=>setMovementScope('BOTH')}><MapPinned aria-hidden="true"/>Both</button>
        </div>
        {allowDeviceLocation?<><div className={`automatic-location ${locationState}`}><LocateFixed aria-hidden="true"/><span><strong>{locationMessage}</strong><small>{locationState==='captured'?`${locationArea} · published as a ${locationPrivacyKm} km privacy area`:'Grant browser location permission. Loadgistic does not receive the exact device point.'}</small></span><button type="button" className="button secondary small icon-button-label" onClick={retryLocation} disabled={locationState==='requesting'}><RefreshCw aria-hidden="true"/>{locationActionLabel}</button></div><div className="form-group location-privacy-control"><label htmlFor="capacity-location-privacy"><Eye aria-hidden="true"/>Location privacy</label><select id="capacity-location-privacy" value={locationPrivacyKm} onChange={event=>setLocationPrivacyKm(Number(event.target.value))}>{capacityPrivacyRadii(movementScope).map(radius=><option value={radius} key={radius}>{radius} km area</option>)}</select><small>{locationPrivacyKm<20&&movementScope!=='LOCAL'&&status==='PARTIAL'?'Safety warning: this setting reveals a more precise area during a long-distance Partial trip. Increase it whenever greater privacy is appropriate.':locationPrivacyKm<20?'A smaller area improves nearby matching but reveals a more precise operating area. You can increase it at any time.':'Your exact position is never published. You can change the privacy area at any time.'}</small></div></>:<div className={`automatic-location ${current?.location_source==='DEVICE_OBSCURED'?'saved':'driver-managed'}`}><LocateFixed aria-hidden="true"/><span><strong>{current?.location_source==='DEVICE_OBSCURED'?'Driver location recorded':'Waiting for Driver location'}</strong><small>{current?.location_area||'The assigned Driver must open capacity on their phone first.'}</small></span></div>}
        {movementScope!=='INTERCITY'?<div className="form-group local-radius-only"><label htmlFor="capacity-local-radius"><CircleDotDashed aria-hidden="true"/>Local radius</label><select id="capacity-local-radius" name="localRadiusKm" defaultValue={String(current?.local_radius_km&&current.local_radius_km>=10&&current.local_radius_km<=50?current.local_radius_km:25)}>{[10,20,30,40,50].map(radius=><option value={radius} key={radius}>{radius} km</option>)}</select></div>:null}
      </section>

      {status==='EMPTY'?<section className="control-panel capacity-decision"><div className="capacity-step-title"><span>{sizeStep}</span><Boxes aria-hidden="true"/><div><h2>Shipment size</h2><p>What can this empty truck accept?</p></div><strong>{acceptedLoadLabel(acceptedLoads)}</strong></div><div className="segmented-control load-policy-control">{['FTL','PTL','BOTH'].map(value=><label key={value}><input value={value} type="radio" checked={value===acceptedLoads} onChange={()=>setAcceptedLoads(value)}/><span>{value==='FTL'?'Full Truckload':value==='PTL'?'Partial Truckload':'Both'}</span></label>)}</div><div className="capacity-term-hint"><Truck aria-hidden="true"/><span><strong>Full Truckload</strong> uses the whole truck · <strong>Partial Truckload</strong> shares space.</span></div></section>:null}

      {stopStep?<section className="control-panel capacity-decision"><div className="capacity-step-title"><span>{stopStep}</span><Route aria-hidden="true"/><div><h2>Stops accepted</h2><p>Direct is always included.</p></div></div><div className="multi-stop-toggles"><div className="direct-route-choice"><Route aria-hidden="true"/><span><strong>Direct <em>Included</em></strong><small>One pickup and one drop-off</small></span></div><label className="rich-toggle"><input name="acceptsMultiPick" type="checkbox" defaultChecked={Boolean(current?.accepts_multi_pick)}/><span className="toggle-track" aria-hidden="true"/><span><strong>Multi Pick</strong><small>More than one pickup</small></span></label><label className="rich-toggle"><input name="acceptsMultiDrop" type="checkbox" defaultChecked={Boolean(current?.accepts_multi_drop)}/><span className="toggle-track" aria-hidden="true"/><span><strong>Multi Drop</strong><small>More than one drop-off</small></span></label></div></section>:null}

      <section className="control-panel capacity-decision"><div className="capacity-step-title"><span>{futureStep}</span><Route aria-hidden="true"/><div><h2>Regular work</h2><p>Open to recurring routes?</p></div></div><label className="rich-toggle"><input name="openToContractLanes" type="checkbox" defaultChecked={Boolean(current?.open_to_contract_lanes)}/><span className="toggle-track" aria-hidden="true"/><span><strong>Contract routes</strong><small>Open to regular work</small></span></label></section>

      <section className="control-panel capacity-decision"><div className="capacity-step-title"><span>{shareStep}</span><Eye aria-hidden="true"/><div><h2>Share update</h2><p>Choose who can see this truck.</p></div><strong>{visibility==='OPEN'?'Public':'Partners'}</strong></div><div className="sharing-proof-grid"><div><div className="segmented-control"><label><input name="visibility" value="OPEN" type="radio" checked={visibility==='OPEN'} onChange={()=>setVisibility('OPEN')}/><span>Public</span></label><label><input name="visibility" value="SAVED_PARTNERS" type="radio" checked={visibility==='SAVED_PARTNERS'} onChange={()=>setVisibility('SAVED_PARTNERS')}/><span>Partners</span></label></div><p className="meta">Public reaches the Board. Partners reaches connected Businesses only.</p></div>{status!=='BUSY'?<div><h3><Camera aria-hidden="true"/>Cargo photo <span className="meta">(optional)</span></h3><label className="photo-drop" htmlFor="capacity-photo"><Camera aria-hidden="true"/><strong>Add photo</strong><input id="capacity-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label></div>:null}</div></section>
    </div>:<section className="control-panel off-duty-panel"><strong>Truck hidden from the Truck Board.</strong><p>Choose Empty, Partial, or Busy when it is ready for work.</p></section>}

    <div className="capacity-publish-bar"><span><strong>{onDuty?status.replace('_',' '):'Off Duty'}</strong><small>{onDuty?(movementScope==='LOCAL'?'Local':movementScope==='BOTH'?'Local + long-distance':'Long-distance routes'):'Not visible'}</small></span><button className={`button capacity-submit ${onDuty?'success':'danger'}`} disabled={submitDisabled}><Save aria-hidden="true"/>{onDuty?'Publish update':'Set Off Duty'}</button></div>
  </form>;
}
