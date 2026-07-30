"use client";

import React from 'react';
import Image from 'next/image';
import { Boxes, CalendarClock, Camera, ChevronDown, CircleDotDashed, Clock3, Eye, Gauge, LocateFixed, MapPin, MapPinned, Route, Save, Truck } from 'lucide-react';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { obscureCoordinate } from '@/lib/location-privacy.js';
import { EthiopiaPlaceInput } from './ethiopia-place-input';
import { CapacityExpiryNotice } from './capacity-expiry-notice';

type CapacitySnapshot = {
  status?: string;
  available_percent?: number;
  accepts_full_load?: number;
  accepts_partial_load?: number;
  location_area?: string;
  location_lat?: number;
  location_lng?: number;
  location_precision_km?: number;
  location_source?: string;
  origin?: string;
  destination?: string;
  travel_date?: string;
  next_available?: string;
  visibility?: string;
  open_to_contract_lanes?: number;
  accepts_multi_stop?: number;
  accepts_multi_pick?:number;
  accepts_multi_drop?:number;
  current_route_origin?:string;
  current_route_destination?:string;
  current_route_date?:string;
  planned_space_status?:string;
  movement_scope?:string;
  origin_place_ref?:string;
  destination_place_ref?:string;
  current_origin_place_ref?:string;
  current_destination_place_ref?:string;
  location_place_ref?:string;
  local_place_ref?:string;
  local_place_label?:string;
  local_radius_km?:number;
  expires_at?:string;
  proof_available?:boolean;
};

type VehicleOption = {
  id: string;
  label: string;
  make: string;
  model: string;
  cargoConfiguration: string;
  plate: string;
  platformNumber?:string;
  current?: CapacitySnapshot | null;
};

function acceptedLoadValue(current?: CapacitySnapshot | null) {
  if (current?.accepts_full_load && current?.accepts_partial_load) return 'BOTH';
  if (current?.accepts_partial_load) return 'PTL';
  return 'FTL';
}

export function CapacityForm({ vehicles, initialVehicleId,allowDeviceLocation=true,lockVehicleSelection=false }: { vehicles: VehicleOption[]; initialVehicleId?: string;allowDeviceLocation?:boolean;lockVehicleSelection?:boolean }) {
  const validInitialVehicleId = vehicles.some(vehicle => vehicle.id === initialVehicleId) ? initialVehicleId : vehicles[0]?.id;
  const [vehicleId, setVehicleId] = React.useState(validInitialVehicleId || '');
  const selectedVehicle = vehicles.find(vehicle => vehicle.id === vehicleId);
  const current = selectedVehicle?.current;
  const [status, setStatus] = React.useState(current?.status || 'EMPTY');
  const [lastOnDutyStatus, setLastOnDutyStatus] = React.useState(current?.status === 'PARTIAL' ? 'PARTIAL' : 'EMPTY');
  const [percent, setPercent] = React.useState(current?.available_percent || 50);
  const [locationState, setLocationState] = React.useState(
    (current?.location_source === 'DEVICE_OBSCURED' ? 'captured' : 'idle') as 'idle' | 'requesting' | 'captured' | 'denied' | 'error'
  );
  const [approximateLocation, setApproximateLocation] = React.useState(
    current?.location_source === 'DEVICE_OBSCURED' && current.location_lat != null && current.location_lng != null
      ? { lat: current.location_lat, lng: current.location_lng }
      : null
  );
  const [locationArea,setLocationArea]=React.useState(current?.location_area||'');
  const [movementScope,setMovementScope]=React.useState(current?.movement_scope||'INTERCITY');
  const [acceptedLoads,setAcceptedLoads]=React.useState(acceptedLoadValue(current));
  const [visibility,setVisibility]=React.useState(current?.visibility==='SAVED_PARTNERS'?'SAVED_PARTNERS':'OPEN');
  const [hydrated,setHydrated]=React.useState(false);

  React.useEffect(()=>setHydrated(true),[]);
  React.useEffect(()=>{
    if(movementScope==='LOCAL'&&status==='PARTIAL'){
      setStatus('EMPTY');
      setLastOnDutyStatus('EMPTY');
    }
  },[movementScope,status]);

  function chooseVehicle(nextId: string) {
    const next = vehicles.find(vehicle => vehicle.id === nextId)?.current;
    setVehicleId(nextId);
    setStatus(next?.status || 'EMPTY');
    setLastOnDutyStatus(next?.status === 'PARTIAL' ? 'PARTIAL' : 'EMPTY');
    setPercent(next?.available_percent || 50);
    setLocationState(next?.location_source === 'DEVICE_OBSCURED' ? 'captured' : 'idle');
    setApproximateLocation(next?.location_source === 'DEVICE_OBSCURED' && next.location_lat != null && next.location_lng != null
      ? { lat: next.location_lat, lng: next.location_lng }
      : null);
    setLocationArea(next?.location_area||'');
    setMovementScope(next?.movement_scope||'INTERCITY');
    setAcceptedLoads(acceptedLoadValue(next));
    setVisibility(next?.visibility==='SAVED_PARTNERS'?'SAVED_PARTNERS':'OPEN');
  }

  function setDuty(onDuty: boolean) {
    setStatus(onDuty ? lastOnDutyStatus : 'OFF_DUTY');
  }

  function setSpace(nextStatus: string) {
    setStatus(nextStatus);
    setLastOnDutyStatus(nextStatus);
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationState('error');
      return;
    }
    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition(position => {
      setApproximateLocation(obscureCoordinate(position.coords.latitude,position.coords.longitude,35));
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      if(nearest)setLocationArea(`Around ${nearest.name}, Ethiopia`);
      setLocationState('captured');
    }, error => {
      setApproximateLocation(null);
      setLocationState(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 });
  }

  const onDuty = status !== 'OFF_DUTY';
  if (!vehicles.length) return <div className="empty-state">No active truck is assigned to this account.</div>;

  return <form action="/api/capacity" method="post" encType="multipart/form-data" className="capacity-console" data-testid="capacity-form" data-hydrated={hydrated}>
    <section className="capacity-control-band">
      <div className="capacity-control-heading"><span className={`live-dot ${onDuty ? '' : 'off'}`} aria-hidden="true"/><div><strong>{onDuty ? 'On Duty' : 'Off Duty'}</strong><span>{onDuty ? 'Visible when this update is fresh' : 'Hidden from the capacity market'}</span></div></div>
      <div className="segmented-control duty-control" aria-label="Duty state">
        <label><input type="radio" checked={onDuty} onChange={() => setDuty(true)}/><span>On Duty</span></label>
        <label><input type="radio" checked={!onDuty} onChange={() => setDuty(false)}/><span>Off Duty</span></label>
      </div>
    </section>
    <CapacityExpiryNotice expiresAt={current?.expires_at}/>

    <input type="hidden" name="status" value={status}/>
    <input type="hidden" name="availablePercent" value={status === 'EMPTY' ? 100 : status === 'PARTIAL' ? percent : 0}/>

    <div className="capacity-console-grid" key={vehicleId}>
      <div className="capacity-console-main stack">
        <section className="control-panel">
          <div className="control-panel-title"><div className="panel-title-copy"><Truck aria-hidden="true"/><div><h2>Your truck</h2><p>One update. One truck.</p></div></div></div>
          <div className="vehicle-select-summary"><Image src={vehicleConfigurationImage(selectedVehicle?.cargoConfiguration)} alt={selectedVehicle?.cargoConfiguration || 'Truck'} width={180} height={180}/><div className="form-group"><label htmlFor="capacity-vehicle"><Truck aria-hidden="true"/>Truck</label>{lockVehicleSelection?<input type="hidden" name="vehicleId" value={vehicleId}/>:<select id="capacity-vehicle" name="vehicleId" value={vehicleId} onChange={event => chooseVehicle(event.target.value)} required>{vehicles.map(vehicle => <option value={vehicle.id} key={vehicle.id}>{vehicle.platformNumber} · {vehicle.make} · {vehicle.model} · {vehicle.cargoConfiguration}</option>)}</select>}<div className="meta"><strong>{selectedVehicle?.platformNumber}</strong><br/>{selectedVehicle?.make} · {selectedVehicle?.model}<br/>{selectedVehicle?.cargoConfiguration}{selectedVehicle?.plate?<><br/>Plate: {selectedVehicle.plate}</>:null}</div></div></div>
        </section>

        {onDuty ? <>
          <section className="control-panel capacity-now-panel">
            <div className="control-panel-title"><div className="panel-title-copy"><Gauge aria-hidden="true"/><div><h2>Capacity now</h2><p>Space and current route.</p></div></div><strong className="capacity-number">{status === 'EMPTY' ? '100%' : `${percent}%`}</strong></div>
            <div className="segmented-control space-control">
              <label><input name="spaceChoice" type="radio" checked={status === 'EMPTY'} onChange={() => setSpace('EMPTY')}/><span><strong>Empty</strong><small>Entire cargo space</small></span></label>
              <label><input name="spaceChoice" type="radio" checked={status === 'PARTIAL'} disabled={movementScope==='LOCAL'} onChange={() => setSpace('PARTIAL')}/><span><strong>Partial</strong><small>{movementScope==='LOCAL'?'Needs a current route':'Some space remains'}</small></span></label>
            </div>
            {movementScope==='LOCAL'?<p className="meta panel-note">Local-only availability is published as Empty with 100% of the truck available. Use Between cities or Both to publish Partial on a current route.</p>:null}
            {status === 'PARTIAL' ? <div className="range-control"><div><label htmlFor="capacity-percent"><Gauge aria-hidden="true"/>Available cargo space</label><strong>{percent}%</strong></div><input id="capacity-percent" type="range" min="5" max="95" step="5" value={percent} onChange={event => setPercent(Number(event.target.value))}/><div className="range-labels"><span>5%</span><span>95%</span></div></div> : null}
            {status==='PARTIAL'&&movementScope!=='LOCAL'?<div className="current-capacity-route"><h3><Route aria-hidden="true"/>Current partial-capacity route</h3><div className="route-inputs"><div className="form-group"><label htmlFor="current-route-origin"><MapPin aria-hidden="true"/>City 1</label><EthiopiaPlaceInput id="current-route-origin" name="currentRouteOrigin" placeRefName="currentOriginPlaceRef" defaultPlaceRef={current?.current_origin_place_ref||''} defaultValue={current?.current_route_origin||''} required placeholder="Addis Ababa, Ethiopia"/></div><div className="route-arrow" aria-hidden="true">→</div><div className="form-group"><label htmlFor="current-route-destination"><MapPin aria-hidden="true"/>City 2</label><EthiopiaPlaceInput id="current-route-destination" name="currentRouteDestination" placeRefName="currentDestinationPlaceRef" defaultPlaceRef={current?.current_destination_place_ref||''} defaultValue={current?.current_route_destination||''} required placeholder="Adama, Ethiopia"/></div></div><div className="form-group"><label htmlFor="current-route-date"><CalendarClock aria-hidden="true"/>Route date</label><input id="current-route-date" name="currentRouteDate" type="date" defaultValue={current?.current_route_date||''} required/></div></div>:null}
          </section>

          <details className="control-panel capacity-disclosure">
            <summary><div className="panel-title-copy"><Boxes aria-hidden="true"/><div><h2>Load preferences</h2><p>{acceptedLoads==='BOTH'?'FTL + PTL':acceptedLoads} · Direct{current?.accepts_multi_pick?' · Multi Pick':''}{current?.accepts_multi_drop?' · Multi Drop':''}</p></div></div><ChevronDown aria-hidden="true"/></summary>
            <div className="capacity-disclosure-body"><h3 className="compact-section-title">Loads accepted</h3>
            <div className="segmented-control load-policy-control">
              {['FTL','PTL','BOTH'].map(value => <label key={value}><input name="acceptedLoads" value={value} type="radio" checked={value===acceptedLoads} onChange={()=>setAcceptedLoads(value)}/><span>{value === 'BOTH' ? 'Both' : value}</span></label>)}
            </div>
            <div className="meta terms-line"><span><strong>FTL</strong> Full truckload</span><span><strong>PTL</strong> Partial truckload</span></div>
            <div className="stop-policy"><label><Route aria-hidden="true"/>Stops</label><p className="meta">Direct is always on.</p><div className="multi-stop-toggles"><label className="rich-toggle"><input name="acceptsMultiPick" type="checkbox" defaultChecked={Boolean(current?.accepts_multi_pick)}/><span className="toggle-track" aria-hidden="true"/><span><strong>Multi Pick</strong><small>More than one pickup</small></span></label><label className="rich-toggle"><input name="acceptsMultiDrop" type="checkbox" defaultChecked={Boolean(current?.accepts_multi_drop)}/><span className="toggle-track" aria-hidden="true"/><span><strong>Multi Drop</strong><small>More than one drop-off</small></span></label></div></div>
            <label className="rich-toggle"><input name="openToContractLanes" type="checkbox" defaultChecked={Boolean(current?.open_to_contract_lanes)}/><span className="toggle-track" aria-hidden="true"/><span><strong>Open to contract routes</strong><small>Recurring work on Preferred Routes</small></span></label>
            </div>
          </details>

          <section className="control-panel">
            <div className="control-panel-title"><div className="panel-title-copy"><MapPinned aria-hidden="true"/><div><h2>Work area & location</h2><p>Where this truck is available now.</p></div></div><span className="status fresh">Live</span></div>
            <div className="segmented-control movement-scope-control">
              <label><input name="movementScope" value="LOCAL" type="radio" checked={movementScope==='LOCAL'} onChange={()=>setMovementScope('LOCAL')}/><span>Local</span></label>
              <label><input name="movementScope" value="INTERCITY" type="radio" checked={movementScope==='INTERCITY'} onChange={()=>setMovementScope('INTERCITY')}/><span>Between cities</span></label>
              <label><input name="movementScope" value="BOTH" type="radio" checked={movementScope==='BOTH'} onChange={()=>setMovementScope('BOTH')}/><span>Both</span></label>
            </div>
            {movementScope!=='INTERCITY'?<div className="form-grid local-capacity-area"><div className="form-group"><label htmlFor="capacity-local-place"><MapPin aria-hidden="true"/>Local city or town</label><EthiopiaPlaceInput id="capacity-local-place" name="localPlaceLabel" placeRefName="localPlaceRef" defaultPlaceRef={current?.local_place_ref||''} defaultValue={current?.local_place_label||''} required placeholder="Addis Ababa, Ethiopia" onPlaceSelect={place=>{if(!locationArea)setLocationArea(`Around ${place.display_name}`);}}/></div><div className="form-group"><label htmlFor="capacity-local-radius"><CircleDotDashed aria-hidden="true"/>Operating radius</label><select id="capacity-local-radius" name="localRadiusKm" defaultValue={String(current?.local_radius_km||25)}>{[10,25,40,60,100].map(radius=><option value={radius} key={radius}>{radius} km</option>)}</select></div></div>:null}
            <h3 className="compact-section-title"><LocateFixed aria-hidden="true"/>Current area</h3>
            {movementScope==='LOCAL'?<p className="meta panel-note">Your selected Local city and radius are the current marketplace area. No phone location is needed.</p>:<div className="location-input-wrap"><span aria-hidden="true">◎</span><EthiopiaPlaceInput id="capacity-area" placeRefName="locationPlaceRef" defaultPlaceRef={current?.location_place_ref||''} required value={locationArea} onChange={event=>setLocationArea(event.target.value)} placeholder="Addis Ababa, Ethiopia" aria-label="Current general area"/></div>}
            {movementScope!=='LOCAL'&&allowDeviceLocation?<div className={`device-location-control ${locationState}`}>
              <div>
                <strong>{locationState === 'captured' ? 'Approximate device area ready' : 'Use your phone location'}</strong>
                <span>{locationState === 'captured'
                  ? 'Only an obscured area with a 40 km privacy zone will be shared.'
                  : locationState === 'denied'
                    ? 'Permission was declined. Your general-area label is enough.'
                    : locationState === 'error'
                      ? 'Location is unavailable. Your general-area label is enough.'
                      : 'Your exact position stays on this device and is obscured before submission.'}</span>
              </div>
              <button className="button secondary compact" type="button" onClick={useDeviceLocation} disabled={locationState === 'requesting'}>
                <LocateFixed aria-hidden="true"/>{locationState === 'requesting' ? 'Locating…' : locationState === 'captured' ? 'Refresh' : 'Use phone'}
              </button>
            </div>:<p className="meta panel-note">Use a general Ethiopian city or area. The assigned driver updates device-assisted location from the truck.</p>}
            <input type="hidden" name="locationArea" value={movementScope==='LOCAL'?'':locationArea}/>
            <input type="hidden" name="approximateLat" value={movementScope!=='LOCAL'&&allowDeviceLocation ? approximateLocation?.lat ?? '' : ''}/>
            <input type="hidden" name="approximateLng" value={movementScope!=='LOCAL'&&allowDeviceLocation ? approximateLocation?.lng ?? '' : ''}/>
            <input type="hidden" name="locationPrecisionKm" value={movementScope!=='LOCAL'&&allowDeviceLocation&&approximateLocation ? '40' : ''}/>
            <input type="hidden" name="locationSource" value={movementScope!=='LOCAL'&&allowDeviceLocation&&approximateLocation ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA'}/>
          </section>

          {movementScope!=='LOCAL'?<details className="control-panel capacity-disclosure">
            <summary><div className="panel-title-copy"><Route aria-hidden="true"/><div><h2>Planned trip</h2><p>{current?.origin&&current?.destination?`${current.origin} to ${current.destination}${current.travel_date?` · ${current.travel_date}`:''}`:'Optional future route'}</p></div></div><ChevronDown aria-hidden="true"/></summary>
            <div className="capacity-disclosure-body">
            <div className="route-inputs"><div className="form-group"><label htmlFor="capacity-origin"><MapPin aria-hidden="true"/>City 1</label><EthiopiaPlaceInput id="capacity-origin" name="origin" placeRefName="originPlaceRef" defaultPlaceRef={current?.origin_place_ref||''} defaultValue={current?.origin || ''} placeholder="Addis Ababa, Ethiopia"/></div><div className="route-arrow" aria-hidden="true">→</div><div className="form-group"><label htmlFor="capacity-destination"><MapPin aria-hidden="true"/>City 2</label><EthiopiaPlaceInput id="capacity-destination" name="destination" placeRefName="destinationPlaceRef" defaultPlaceRef={current?.destination_place_ref||''} defaultValue={current?.destination || ''} placeholder="Dire Dawa, Ethiopia"/></div></div>
            <div className="form-grid"><div className="form-group"><label htmlFor="capacity-travel-date"><CalendarClock aria-hidden="true"/>Planned travel date</label><input id="capacity-travel-date" name="travelDate" type="date" defaultValue={current?.travel_date || ''}/></div><div className="form-group"><label htmlFor="capacity-next"><Clock3 aria-hidden="true"/>Next available</label><input id="capacity-next" name="nextAvailable" defaultValue={current?.next_available || ''} placeholder="Tomorrow morning"/></div></div>
            <div className="form-group"><label><Gauge aria-hidden="true"/>Planned cargo space</label><div className="segmented-control"><label><input name="plannedSpaceStatus" value="FULL" type="radio" defaultChecked={(current?.planned_space_status||'FULL')==='FULL'}/><span>Full</span></label><label><input name="plannedSpaceStatus" value="PARTIAL" type="radio" defaultChecked={current?.planned_space_status==='PARTIAL'}/><span>Partial</span></label></div></div>
            </div>
          </details>:null}

          <details className="control-panel capacity-disclosure">
            <summary><div className="panel-title-copy"><Eye aria-hidden="true"/><div><h2>Sharing & proof</h2><p>{visibility==='OPEN'?'Public':'Partners'} · {current?.proof_available?'Photo recorded':'No photo'}</p></div></div><ChevronDown aria-hidden="true"/></summary>
            <div className="capacity-disclosure-body sharing-proof-grid">
              <section>
                <h3><Eye aria-hidden="true"/>Visibility</h3>
                <div className="segmented-control"><label><input name="visibility" value="OPEN" type="radio" checked={visibility==='OPEN'} onChange={()=>setVisibility('OPEN')}/><span>Public</span></label><label><input name="visibility" value="SAVED_PARTNERS" type="radio" checked={visibility==='SAVED_PARTNERS'} onChange={()=>setVisibility('SAVED_PARTNERS')}/><span>Partners</span></label></div>
                <p className="meta panel-note">Public: all signed-in businesses. Partners: connected businesses only.</p>
              </section>
              <section className="proof-panel">
                <h3><Camera aria-hidden="true"/>Photo proof</h3>
                <label className="photo-drop" htmlFor="capacity-photo"><span className="photo-mark" aria-hidden="true"><Camera/></span><strong>Add photo</strong><small>JPG, PNG, or WebP</small><input id="capacity-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label>
                <div className="proof-context"><span>Saved with this update</span><span>General area</span><span>Submission time</span></div>
              </section>
            </div>
          </details>
        </> : <section className="control-panel off-duty-panel"><strong>This truck will not appear in capacity search.</strong><p>Turn On Duty back on whenever you are ready to carry a load.</p></section>}
      </div>

      <aside className="capacity-console-side stack">
        {onDuty ? <section className="control-panel capacity-review">
          <h2><Save aria-hidden="true"/>Ready to publish</h2>
          <dl>
            <div><dt>Capacity</dt><dd>{status==='EMPTY'?'Empty · 100%':`Partial · ${percent}%`}</dd></div>
            <div><dt>Area</dt><dd>{movementScope==='LOCAL'?(current?.local_place_label||'Add local city'):(locationArea||'Add current area')}</dd></div>
            <div><dt>Sharing</dt><dd>{visibility==='OPEN'?'Public':'Partners'}</dd></div>
          </dl>
        </section> : <input type="hidden" name="visibility" value="OPEN"/>}
        <button className={`button capacity-submit ${onDuty ? 'success' : 'danger'}`}><Save aria-hidden="true"/>{onDuty ? 'Publish update' : 'Set Off Duty'}</button>
      </aside>
    </div>
  </form>;
}
