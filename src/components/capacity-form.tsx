"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Boxes, Gauge, MapPinned, RefreshCw, Repeat2, Route, Save, Shield, Truck } from 'lucide-react';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { capacityPrivacyRadii } from '@/lib/location-privacy.js';
import { relativeTime } from '@/lib/ui';
import { readDriverLocation, saveDriverLocation, type DriverLocation } from '@/lib/capacity-editor-client';
import { CapacityLocationMap } from './capacity-location-map';
import { CapacityMarketPlanning } from './capacity-market-planning';
import { CapacityEditDialog } from './capacity-edit-dialog';
import { CapacitySignalEditor, type CapacitySnapshot, type RegularSignal } from './capacity-signal-editor';

type VehicleOption={id:string;label:string;make:string;model:string;cargoConfiguration:string;plate:string;platformNumber?:string;driver?:{id:string;name:string}|null;current?:CapacitySnapshot|null};
type EditSection='AVAILABILITY'|'ROUTE'|'SHARING'|'LOADS'|'RECURRING'|'LOCATION';
const editorTitles={AVAILABILITY:'Current capacity',ROUTE:'Current coverage',SHARING:'Capacity sharing',LOADS:'Load preferences',RECURRING:'Regular service',LOCATION:'Approximate location'};

function snapshotLocation(current?:CapacitySnapshot|null):DriverLocation|null{
  return current?.location_lat!=null&&current.location_lng!=null?{lat:Number(current.location_lat),lng:Number(current.location_lng),radius:Number(current.location_precision_km)||20,area:current.location_area||'',updatedAt:current.location_updated_at||''}:null;
}

function LocationEditor({vehicleId,location,canUpdate,onBusyChange,onSaved,onCancel}:{vehicleId:string;location:DriverLocation|null;canUpdate:boolean;onBusyChange:(busy:boolean)=>void;onSaved:(location:DriverLocation)=>void;onCancel:()=>void}){
  const [radius,setRadius]=React.useState(location?.radius||20);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const active=React.useRef(false);
  async function save(event:React.FormEvent){
    event.preventDefault();if(active.current||!canUpdate)return;
    active.current=true;setBusy(true);onBusyChange(true);setError('');
    try{onSaved(await saveDriverLocation(vehicleId,await readDriverLocation(radius)));}
    catch(reason){setError(reason instanceof Error?reason.message:'Truck location could not be saved.');}
    finally{active.current=false;setBusy(false);onBusyChange(false);}
  }
  return <form className="capacity-signal-form" onSubmit={save}>
    <div className="capacity-signal-dialog-body"><p className="meta">{location?.area||'No location recorded yet.'}</p>
      {canUpdate?<><label htmlFor="location-editor-radius">Approximate location radius<select id="location-editor-radius" value={radius} onChange={event=>setRadius(Number(event.target.value))} disabled={busy}>{capacityPrivacyRadii('BOTH').map(value=><option value={value} key={value}>{value} km</option>)}</select></label><p className="meta">A larger radius shares less detail. Save reads your device location and updates only this truck's approximate location.</p></>:<p className="meta">The assigned Driver updates this location while the truck is Empty or Partial.</p>}
      {error?<p className="alert error" role="alert">{error}</p>:null}
    </div>
    <footer className="capacity-signal-dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>{canUpdate?'Cancel':'Close'}</button>{canUpdate?<button className="button" disabled={busy}><Save aria-hidden="true"/>{busy?'Updating…':'Save location'}</button>:null}</footer>
  </form>;
}

export function CapacityForm({vehicles,initialVehicleId,allowDeviceLocation=true,lockVehicleSelection=false,showTruckIdentity=true,corridors=[],returnTo='/app/home',allowCorridors=false,renderedAt}:{vehicles:VehicleOption[];initialVehicleId?:string;allowDeviceLocation?:boolean;lockVehicleSelection?:boolean;showTruckIdentity?:boolean;corridors?:RegularSignal[];returnTo?:string;allowCorridors?:boolean;renderedAt:number}){
  const router=useRouter();
  const [controlsReady,setControlsReady]=React.useState(false);
  React.useEffect(()=>{setControlsReady(true);},[]);
  const [syncing,startSync]=React.useTransition();
  const [vehicleId,setVehicleId]=React.useState(initialVehicleId||vehicles[0]?.id||'');
  const selectedVehicle=vehicles.find(vehicle=>vehicle.id===vehicleId)||vehicles[0];
  const selectedId=selectedVehicle?.id||'';
  const current=selectedVehicle?.current;
  const [editSection,setEditSection]=React.useState(null as EditSection|null);
  const [busy,setBusy]=React.useState(false);
  const [refreshing,setRefreshing]=React.useState(false);
  const [notice,setNotice]=React.useState(null as {text:string;error?:boolean}|null);
  const [localLocation,setLocalLocation]=React.useState(null as {vehicleId:string;value:DriverLocation}|null);
  const requestActive=React.useRef(false);
  const activeVehicle=React.useRef(selectedId);activeVehicle.current=selectedId;
  const lastAutomaticRefresh=React.useRef({vehicleId:'',at:0});
  const location=React.useMemo(()=>{
    const saved=snapshotLocation(current);
    const refreshed=localLocation?.vehicleId===selectedId?localLocation.value:null;
    return refreshed&&(!saved?.updatedAt||Date.parse(refreshed.updatedAt)>=Date.parse(saved.updatedAt))?refreshed:saved;
  },[current,localLocation,selectedId]);
  const regularSignals=React.useMemo(()=>corridors.slice(0,1).filter(signal=>signal.geometry==='RADIUS'?signal.area_boundary?.length>=3:signal.route_points?.length>=2),[corridors]);
  // Opening or typing in a dialog must not refit the saved map's bounds.
  const savedMap=React.useMemo(()=>location?<CapacityLocationMap key={selectedId} center={location} radiusKm={location.radius} areaCenter={current?.availability_geometry==='RADIUS'&&current.capacity_area_center_lat!=null?{lat:Number(current.capacity_area_center_lat),lng:Number(current.capacity_area_center_lng)}:null} areaBoundary={current?.availability_geometry==='RADIUS'?current.capacity_area_boundary||[]:[]} routePoints={current?.availability_geometry==='ROUTE'?current.current_route_points||[]:[]} regularSignals={regularSignals} availabilityStatus={current?.status}/>:null,[location,current,regularSignals,selectedId]);
  const onDuty=Boolean(current&&current.status!=='OFF_DUTY');

  async function refreshLocation(radius=location?.radius||20,automatic=false){
    if(requestActive.current||!allowDeviceLocation||!onDuty)return;
    requestActive.current=true;setRefreshing(true);if(!automatic)setNotice(null);
    const target=selectedId;
    try{
      const saved=await saveDriverLocation(target,await readDriverLocation(radius));
      if(activeVehicle.current===target){setLocalLocation({vehicleId:target,value:saved});if(!automatic)setNotice({text:'Approximate truck location saved.'});}
    }catch(reason){if(!automatic&&activeVehicle.current===target)setNotice({text:reason instanceof Error?reason.message:'Truck location could not be saved.',error:true});}
    finally{requestActive.current=false;setRefreshing(false);}
  }
  React.useEffect(()=>{
    if(!allowDeviceLocation||!onDuty||editSection)return;
    const refreshWhenDue=()=>{
      if(document.visibilityState!=='visible'||requestActive.current)return;
      const last=lastAutomaticRefresh.current;
      if(last.vehicleId===selectedId&&Date.now()-last.at<600_000)return;
      lastAutomaticRefresh.current={vehicleId:selectedId,at:Date.now()};
      void refreshLocation(location?.radius||20,true);
    };
    refreshWhenDue();
    const interval=window.setInterval(refreshWhenDue,60_000);
    document.addEventListener('visibilitychange',refreshWhenDue);
    return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',refreshWhenDue);};
  },[allowDeviceLocation,onDuty,selectedId,editSection,location?.radius]);
  React.useEffect(()=>{if(!notice)return;const timeout=window.setTimeout(()=>setNotice(null),4500);return()=>window.clearTimeout(timeout);},[notice]);

  function close(){if(!busy)setEditSection(null);}
  function saved(message='Capacity saved.'){
    setBusy(false);setEditSection(null);setNotice({text:message});startSync(()=>router.refresh());
  }
  if(!selectedVehicle)return <div className="empty-state">No active truck is assigned to this account.</div>;
  const availabilityValue=!current?'Not set':current.status==='OFF_DUTY'?'Off Duty':current.status==='EMPTY'?'Empty':'Partial';
  const coverageValue=current?.availability_geometry==='ROUTE'?'Route':current?.availability_geometry==='RADIUS'?'Area':'Not set';
  const regularValue=regularSignals[0]?(regularSignals[0].geometry==='RADIUS'?'Area':'Route'):'None';
  const sharingValue=current?.visibility==='PRIVATE'?'Private':'Open';
  const loadsValue=current?.status==='PARTIAL'||!current?.accepts_full_load?'Partial':current?.accepts_partial_load?'Either':'Full';
  const truckLabel=`${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.platformNumber||selectedVehicle.label}`;
  return <div className="capacity-console capacity-summary-console" data-testid="capacity-summary">
    <section className={`capacity-saved-summary driver-map-summary${savedMap?'':' has-no-map'}`}>
      <div className="capacity-summary-layout">{savedMap||<div className="capacity-map-empty">
        <MapPinned aria-hidden="true"/>
        <strong>{current?'No Driver location':'No capacity published yet'}</strong>
        <span>{!current?'Set availability, coverage and approximate location for this truck.':onDuty?allowDeviceLocation?'Add an approximate location to show this truck’s map.':'The assigned Driver can add an approximate location for this truck.':'Set capacity when this truck is ready to work.'}</span>
        {!current||!onDuty||allowDeviceLocation?<button type="button" className="button" disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" onClick={()=>setEditSection(current&&onDuty?'LOCATION':'AVAILABILITY')}>
          {!current||!onDuty?<Gauge aria-hidden="true"/>:<MapPinned aria-hidden="true"/>}{current&&onDuty?'Set location':'Set capacity'}
        </button>:null}
      </div>}</div>
      {showTruckIdentity?<header className="capacity-summary-map-header"><section className="capacity-truck-bar"><Image src={vehicleConfigurationImage(selectedVehicle.cargoConfiguration)} alt={selectedVehicle.cargoConfiguration||'Truck'} width={112} height={88}/><div className="capacity-truck-copy"><small>Current truck</small><strong>{selectedVehicle.make} {selectedVehicle.model}</strong><span>{selectedVehicle.platformNumber} · {selectedVehicle.cargoConfiguration} · {!current?'Not published':current.visibility==='PRIVATE'?'Private capacity':'Open capacity'}</span><span className="capacity-assigned-driver">{selectedVehicle.driver?`Driver: ${selectedVehicle.driver.name}`:<Link href="/app/fleet#driver-access">No driver assigned · Assign driver</Link>}</span></div>{lockVehicleSelection?null:<div className="form-group compact-truck-select"><label htmlFor="capacity-vehicle"><Truck aria-hidden="true"/>Truck</label><select id="capacity-vehicle" value={selectedId} disabled={!controlsReady||refreshing||syncing} onChange={event=>{setVehicleId(event.target.value);setNotice(null);}}>{vehicles.map(vehicle=><option value={vehicle.id} key={vehicle.id}>{vehicle.platformNumber} · {vehicle.make} {vehicle.model}</option>)}</select></div>}</section></header>:null}
      <nav className="capacity-summary-toolrail" aria-label="Edit capacity signals">
        <button type="button" onClick={()=>setEditSection('AVAILABILITY')} disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label={`Edit current capacity: ${availabilityValue}`} title={`Current capacity · ${availabilityValue}`}><Gauge aria-hidden="true"/><span><small>Capacity</small><strong>{availabilityValue}</strong></span></button>
        {onDuty?<button type="button" onClick={()=>setEditSection('ROUTE')} disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label={`Edit current coverage: ${coverageValue}`} title={`Current coverage · ${coverageValue}`}><Route aria-hidden="true"/><span><small>Coverage</small><strong>{coverageValue}</strong></span></button>:null}
        {onDuty?<button type="button" onClick={()=>setEditSection('SHARING')} disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label={`Edit capacity sharing: ${sharingValue}`} title={`Capacity sharing · ${sharingValue}`}><Shield aria-hidden="true"/><span><small>Sharing</small><strong>{sharingValue}</strong></span></button>:null}
        {onDuty?<button type="button" onClick={()=>setEditSection('LOADS')} disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label={`Edit load preferences: ${loadsValue}`} title={`Load preferences · ${loadsValue}`}><Boxes aria-hidden="true"/><span><small>Loads</small><strong>{loadsValue}</strong></span></button>:null}
        {allowCorridors?<button type="button" onClick={()=>setEditSection('RECURRING')} disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label={`Edit regular service: ${regularValue}`} title={`Regular service · ${regularValue}`}><Repeat2 aria-hidden="true"/><span><small>Regular</small><strong>{regularValue}</strong></span></button>:null}
        {current?<button type="button" onClick={()=>setEditSection('LOCATION')} disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label="Edit approximate location" title="Approximate location"><MapPinned aria-hidden="true"/><span><small>Location</small><strong>{location?`${location.radius} km`:'Not set'}</strong></span></button>:null}
      </nav>
      {allowDeviceLocation&&onDuty&&location?<section className="capacity-location-dock" aria-label="Approximate truck location controls"><MapPinned aria-hidden="true"/><span className="capacity-location-dock-copy"><strong>{location?.area||'Location not refreshed'}</strong><small>{location?.updatedAt?`${location.radius} km radius · updated ${relativeTime(location.updatedAt,renderedAt)}`:'Refresh to update'}</small></span><button type="button" className="capacity-radius-action" aria-haspopup="dialog" aria-label="Edit approximate location radius" title="Edit approximate location radius" onClick={()=>setEditSection('LOCATION')} disabled={!controlsReady||refreshing||syncing}>{location?.radius||20} km</button><button type="button" className="button secondary" onClick={()=>void refreshLocation()} disabled={!controlsReady||refreshing||syncing} aria-label="Refresh truck location" title="Refresh truck location"><RefreshCw aria-hidden="true"/><span>{refreshing?'Updating…':'Refresh'}</span></button></section>:null}
      {notice?<div className={`capacity-location-toast ${notice.error?'warning':'success'}`} role={notice.error?'alert':'status'} data-testid="capacity-location-state">{notice.text}</div>:null}
    </section>
    {editSection?<CapacityEditDialog title={editorTitles[editSection as EditSection]} truck={truckLabel} busy={busy} onClose={close}>
      {editSection==='RECURRING'?<CapacityMarketPlanning corridors={corridors} returnTo={returnTo} onBusyChange={setBusy} onSaved={()=>saved('Regular service saved.')} onRemoved={()=>router.refresh()} onCancel={close}/>:editSection==='LOCATION'?<LocationEditor vehicleId={selectedId} location={location} canUpdate={allowDeviceLocation&&onDuty} onBusyChange={setBusy} onCancel={close} onSaved={value=>{setLocalLocation({vehicleId:selectedId,value});saved('Approximate truck location saved.');}}/>:<CapacitySignalEditor section={editSection} hasAssignedDriver={Boolean(selectedVehicle.driver)} vehicleId={selectedId} current={current} location={location} allowDeviceLocation={allowDeviceLocation} onBusyChange={setBusy} onSaved={()=>saved()} onCancel={close}/>}
    </CapacityEditDialog>:null}
  </div>;
}
