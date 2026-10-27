"use client";
import {capacityLocationSource,selectedCapacityLocation} from '@/lib/capacity-location-selection.js';
import {capacitySharingMode,capacitySharingLabel} from '@/lib/capacity-sharing';



import {Text,FeedbackText,Localized,useTranslation} from '@/components/localization';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gauge, MapPinned, RefreshCw, Repeat2, Shield, Truck } from 'lucide-react';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { nextCapacityPrivacyRadius } from '@/lib/location-privacy.js';
import { relativeTime } from '@/lib/ui';
import { readDriverLocation, saveDriverLocation, type DriverLocation } from '@/lib/capacity-editor-client';
import { CapacityLocationMap } from './capacity-location-map';
import { CapacityMarketPlanning } from './capacity-market-planning';
import { CapacityEditDialog } from './capacity-edit-dialog';
import { CapacitySignalEditor, type CapacitySnapshot, type RegularSignal } from './capacity-signal-editor';
import {DriverCapacityLocationEditor} from './driver-capacity-location-editor';
import {ProviderCargoSpacePhoto} from './cargo-space-photo-panel';
import {locationSourceLabel} from '@/lib/location-source.js';

type VehicleOption={id:string;label:string;make:string;model:string;cargoConfiguration:string;plate:string;platformNumber?:string;driver?:{id:string;name:string}|null;driverLocation?:DriverLocation|null;locationSelection?:{source:string;selectedAt:string};current?:CapacitySnapshot|null};
type EditSection='CAPACITY'|'SHARING'|'RECURRING'|'LOCATION';
const editorTitles={CAPACITY:'Planned capacity',SHARING:'Capacity sharing',RECURRING:'Preferred corridor',LOCATION:'Approximate location'};

function snapshotLocation(current?:CapacitySnapshot|null):DriverLocation|null{
  return current?.location_lat!=null&&current.location_lng!=null?{lat:Number(current.location_lat),lng:Number(current.location_lng),radius:Number(current.location_precision_km)||20,area:current.location_area||'',updatedAt:current.location_updated_at||''}:null;
}

export function CapacityForm({vehicles,initialVehicleId,allowDeviceLocation=true,lockVehicleSelection=false,showTruckIdentity=true,corridors=[],returnTo='/app/home',allowCorridors=false,canRemovePhoto=false,renderedAt}:{vehicles:VehicleOption[];initialVehicleId?:string;allowDeviceLocation?:boolean;lockVehicleSelection?:boolean;showTruckIdentity?:boolean;corridors?:RegularSignal[];returnTo?:string;allowCorridors?:boolean;canRemovePhoto?:boolean;renderedAt:number}){
  const {t}=useTranslation();
  const router=useRouter();
  const [controlsReady,setControlsReady]=React.useState(false);
  React.useEffect(()=>{setControlsReady(true);},[]);
  const [syncing,startSync]=React.useTransition();
  const [vehicleId,setVehicleId]=React.useState(initialVehicleId||vehicles[0]?.id||'');
  const selectedVehicle=vehicles.find(vehicle=>vehicle.id===vehicleId)||vehicles[0];
  const selectedId=selectedVehicle?.id||'';
  const expectedDriverId=selectedVehicle?.driver?.id||'';
  const current=selectedVehicle?.current;
  const [editSection,setEditSection]=React.useState(null as EditSection|null);
  const [busy,setBusy]=React.useState(false);
  const [refreshing,setRefreshing]=React.useState(false);
  const [notice,setNotice]=React.useState(null as {text:string;error?:boolean}|null);
  const [localLocation,setLocalLocation]=React.useState(null as {vehicleId:string;value:DriverLocation}|null);
  const requestActive=React.useRef(false);
  const activeVehicle=React.useRef(selectedId);activeVehicle.current=selectedId;
  const lastAutomaticRefresh=React.useRef({vehicleId:'',at:0});
  const phoneSelected=capacityLocationSource(selectedVehicle?.locationSelection)==='MOBILE';
  const manualSaved=capacityLocationSource(selectedVehicle?.locationSelection)==='MANUAL';
  const canReadPhone=allowDeviceLocation&&phoneSelected;
  const location=React.useMemo(()=>selectedCapacityLocation({selection:selectedVehicle?.locationSelection,
    published:snapshotLocation(current),phone:selectedVehicle?.driverLocation,
    captured:localLocation?.vehicleId===selectedId?localLocation.value:null}),
    [current,localLocation,selectedId,selectedVehicle?.driverLocation,selectedVehicle?.locationSelection]);
  const scopedCorridors:RegularSignal[]=React.useMemo(()=>selectedId&&expectedDriverId?corridors.filter(signal=>signal.vehicle_id===selectedId&&signal.driver_user_id===expectedDriverId).slice(0,1):[],[corridors,selectedId,expectedDriverId]);
  const regularSignals=React.useMemo(()=>scopedCorridors.filter(signal=>signal.geometry==='RADIUS'?signal.area_boundary?.length>=3:signal.route_points?.length>=2),[scopedCorridors]);
  // Opening or typing in a dialog must not refit the saved map's bounds.
  const hasCoverage=Boolean(current?.availability_geometry==='ROUTE'&&(current.current_route_points?.length||0)>=2||current?.availability_geometry==='RADIUS'&&(current.capacity_area_boundary?.length||0)>=3||regularSignals.length);
  const savedMap=React.useMemo(()=>location||hasCoverage?<CapacityLocationMap key={selectedId} center={location} radiusKm={location?.radius||0} areaCenter={current?.availability_geometry==='RADIUS'&&current.capacity_area_center_lat!=null?{lat:Number(current.capacity_area_center_lat),lng:Number(current.capacity_area_center_lng)}:null} areaBoundary={current?.availability_geometry==='RADIUS'?current.capacity_area_boundary||[]:[]} routePoints={current?.availability_geometry==='ROUTE'?current.current_route_points||[]:[]} regularSignals={regularSignals} availabilityStatus={current?.status}/>:null,[location,hasCoverage,current,regularSignals,selectedId]);
  const onDuty=Boolean(current&&current.status!=='OFF_DUTY');
  const reportedSource=localLocation?.vehicleId===selectedId?'Driver’s phone':locationSourceLabel(current?.location_source)||(!current&&capacityLocationSource(selectedVehicle?.locationSelection)==='MANUAL'?'Manually entered':!current&&selectedVehicle?.driverLocation?'Driver’s phone':'');

  async function refreshLocation(radius=nextCapacityPrivacyRadius(location?.radius),automatic=false){
    if(requestActive.current||!canReadPhone||!onDuty)return;
    requestActive.current=true;setRefreshing(true);if(!automatic)setNotice(null);
    const target=selectedId;
    try{
      const saved=await saveDriverLocation(target,await readDriverLocation(radius));
      if(activeVehicle.current===target){setLocalLocation({vehicleId:target,value:saved});if(!automatic)setNotice({text:'Approximate vehicle location saved.'});}
    }catch(reason){if(!automatic&&activeVehicle.current===target)setNotice({text:reason instanceof Error?reason.message:'Vehicle location could not be saved.',error:true});}
    finally{requestActive.current=false;setRefreshing(false);}
  }
  React.useEffect(()=>{
    if(!canReadPhone||!onDuty||editSection)return;
    const refreshWhenDue=()=>{
      if(document.visibilityState!=='visible'||requestActive.current)return;
      const last=lastAutomaticRefresh.current;
      if(last.vehicleId===selectedId&&Date.now()-last.at<600_000)return;
      lastAutomaticRefresh.current={vehicleId:selectedId,at:Date.now()};
      void refreshLocation(nextCapacityPrivacyRadius(location?.radius),true);
    };
    refreshWhenDue();
    const interval=window.setInterval(refreshWhenDue,60_000);
    document.addEventListener('visibilitychange',refreshWhenDue);
    return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',refreshWhenDue);};
  },[canReadPhone,onDuty,selectedId,editSection,location?.radius]);
  React.useEffect(()=>{if(!notice)return;const timeout=window.setTimeout(()=>setNotice(null),4500);return()=>window.clearTimeout(timeout);},[notice]);

  function close(){if(!busy)setEditSection(null);}
  function saved(message='Planned capacity saved.'){
    setBusy(false);setEditSection(null);setNotice({text:message});startSync(()=>router.refresh());
  }
  if(!selectedVehicle)return <div className="empty-state"><Text message="No active vehicle is assigned to this account."/></div>;
  const availabilityValue=!current?'Not set':current.status==='OFF_DUTY'?'Off Duty':current.status==='EMPTY'?'Empty':'Partial';
  const regularArea=regularSignals[0]?.geometry==='RADIUS';
  const regularTitle=regularArea?'Preferred area':'Preferred corridor';
  const regularValue=regularSignals[0]?(regularArea?'Area':'Route'):'None';
  const sharingValue=capacitySharingLabel(capacitySharingMode(current?.sharing_mode,current?.visibility));
  const availabilityDisplay=t(availabilityValue),sharingDisplay=t(sharingValue),regularDisplay=t(regularValue);
  const truckLabel=`${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.platformNumber||selectedVehicle.label}`;
  return <div className="capacity-console capacity-summary-console" data-testid="capacity-summary">
    <section className={`capacity-saved-summary driver-map-summary${savedMap?'':' has-no-map'}`}>
      <div className="capacity-summary-layout">{savedMap||<div className="capacity-map-empty">
        <MapPinned aria-hidden="true"/>
        <strong>{current?<Text message="No Driver location"/>:<Text message="No planned capacity published yet"/>}</strong>
        <span>{!current&&manualSaved?<Text message="Manual location saved. Set capacity to show it on the map."/>:!current?<Text message="Set availability, coverage and approximate location for this vehicle."/>:onDuty?allowDeviceLocation?<Text message="Add an approximate location to show this vehicle’s map."/>:<Text message="The assigned Driver can add an approximate location for this vehicle."/>:<Text message="Set capacity when this vehicle is ready to work."/>}</span>
        {!current||!onDuty||allowDeviceLocation?<button type="button" className="button" disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" onClick={()=>setEditSection('CAPACITY')}>
          <Gauge aria-hidden="true"/><Text message="Plan capacity"/>
        </button>:null}
      </div>}</div>
      {showTruckIdentity?<header className="capacity-summary-map-header"><section className="capacity-truck-bar"><Image src={vehicleConfigurationImage(selectedVehicle.cargoConfiguration)} alt={t(selectedVehicle.cargoConfiguration||'Vehicle')} width={112} height={88}/><div className="capacity-truck-copy"><small><Text message="Current vehicle"/></small><strong>{selectedVehicle.make} {selectedVehicle.model}</strong><span>{selectedVehicle.platformNumber} · {t(selectedVehicle.cargoConfiguration||'Vehicle')} · {!current?<Text message="Not published"/>:<Text message={capacitySharingLabel(capacitySharingMode(current.sharing_mode,current.visibility))}/>}</span><span className="capacity-assigned-driver">{selectedVehicle.driver?t('Driver: {name}',{name:selectedVehicle.driver.name}):<Link href={`/app/fleet?vehicle=${selectedId}#driver-access`}><Text message="No driver assigned · Assign driver"/></Link>}</span></div>{lockVehicleSelection?null:<div className="form-group compact-truck-select"><label htmlFor="capacity-vehicle"><Truck aria-hidden="true"/><Text message="Vehicle"/></label><select id="capacity-vehicle" value={selectedId} disabled={!controlsReady||refreshing||syncing} onChange={event=>{setVehicleId(event.target.value);setNotice(null);}}>{vehicles.map(vehicle=><option value={vehicle.id} key={vehicle.id}>{vehicle.platformNumber} · {vehicle.make} {vehicle.model}</option>)}</select></div>}</section></header>:null}
      <Localized as="nav" copy={["aria-label"]} className="capacity-summary-toolrail" aria-label="Edit capacity signals" tabIndex={0}>
        <button type="button" onClick={()=>setEditSection('CAPACITY')} disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label={t('Edit planned capacity: {value}',{value:availabilityDisplay})} title={t('Planned capacity · {value}',{value:availabilityDisplay})}><Gauge aria-hidden="true"/><span><small><Text message="Planned capacity"/></small><strong>{availabilityDisplay}</strong></span></button>
        {onDuty?<button type="button" onClick={()=>setEditSection('SHARING')} disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label={t('Edit capacity sharing: {value}',{value:sharingDisplay})} title={t('Capacity sharing · {value}',{value:sharingDisplay})}><Shield aria-hidden="true"/><span><small><Text message="Sharing"/></small><strong>{sharingDisplay}</strong></span></button>:null}
        {allowCorridors?<button type="button" onClick={()=>{if(expectedDriverId)setEditSection('RECURRING');}} disabled={!expectedDriverId||!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label={t(regularArea?'Edit preferred area: {value}':'Edit preferred corridor: {value}',{value:regularDisplay})} title={t(regularArea?'Preferred area · {value}':'Preferred corridor · {value}',{value:regularDisplay})}><Repeat2 aria-hidden="true"/><span><small><Text message={regularTitle}/></small><strong>{regularDisplay}</strong></span></button>:null}
        {allowDeviceLocation?<Localized as="button" copy={["aria-label","title"]} type="button" onClick={()=>setEditSection('LOCATION')} disabled={!controlsReady||refreshing||syncing} aria-haspopup="dialog" aria-label="Edit approximate location" title="Approximate location"><MapPinned aria-hidden="true"/><span><small><Text message="Location"/></small><strong>{location?`${location.radius} km`:reportedSource?<Text message={reportedSource}/>:<Text message="Not set"/>}</strong></span></Localized>:<Link href={`${returnTo}?view=location`} aria-label="Manage location source" title="Manage location source"><MapPinned aria-hidden="true"/><span><small><Text message="Location"/></small><strong>{location?`${location.radius} km`:<Text message="Not set"/>}</strong></span></Link>}
      </Localized>
      {location?<Localized as="section" copy={["aria-label"]} className={`capacity-location-dock${canReadPhone&&onDuty?'':' capacity-location-dock--source'}`} aria-label="Approximate vehicle location controls"><MapPinned aria-hidden="true"/><span className="capacity-location-dock-copy"><strong>{location.area||'Approximate location'}</strong><small>{reportedSource?<><Text message={reportedSource}/> · </>:null}{location.updatedAt?relativeTime(location.updatedAt,renderedAt):<Text message="Not reported yet"/>} · {location.radius}<Text message=" km"/></small></span>{allowDeviceLocation?<Localized as="button" copy={["aria-label","title"]} type="button" className="capacity-radius-action" aria-haspopup="dialog" aria-label="Edit approximate location" title="Edit approximate location" onClick={()=>setEditSection('LOCATION')} disabled={!controlsReady||refreshing||syncing}>{location.radius}<Text message=" km"/></Localized>:<Link className="capacity-radius-action" href={`${returnTo}?view=location`} aria-label="Manage location source" title="Manage location source">{location.radius}<Text message=" km"/></Link>}{canReadPhone&&onDuty?<Localized as="button" copy={["aria-label","title"]} type="button" className="button secondary" onClick={()=>void refreshLocation()} disabled={!controlsReady||refreshing||syncing} aria-label="Refresh vehicle location" title="Refresh vehicle location"><RefreshCw aria-hidden="true"/><span>{refreshing?<Text message="Updating…"/>:<Text message="Refresh"/>}</span></Localized>:null}</Localized>:null}
      {notice?<div className={`capacity-location-toast ${notice.error?'warning':'success'}`} role={notice.error?'alert':'status'} data-testid="capacity-location-state"><FeedbackText message={notice.text} fallback={notice.error?"Vehicle location could not be saved.":"Your request was completed."}/></div>:null}
    </section>
    {expectedDriverId?<ProviderCargoSpacePhoto key={selectedId} vehicleId={selectedId} canUpload={allowDeviceLocation} canRemove={canRemovePhoto}/>:null}
    {editSection&&(editSection!=='RECURRING'||expectedDriverId)?<CapacityEditDialog title={editSection==='RECURRING'?regularTitle:editorTitles[editSection as EditSection]} truck={editSection==='RECURRING'?`${truckLabel} · ${selectedVehicle.driver?.name}`:truckLabel} busy={busy} onClose={close}>
      {editSection==='RECURRING'?<CapacityMarketPlanning key={`${selectedId}:${expectedDriverId}`} vehicleId={selectedId} expectedDriverId={expectedDriverId} corridors={scopedCorridors} returnTo={returnTo} onBusyChange={setBusy} onSaved={geometry=>saved(geometry==='RADIUS'?'Preferred area saved.':'Preferred corridor saved.')} onRemoved={()=>router.refresh()} onCancel={close}/>:editSection==='LOCATION'?<>
<DriverCapacityLocationEditor key={selectedId} vehicleId={selectedId} location={location} publishedSource={current?.location_source} onDuty={onDuty} onBusyChange={setBusy} onCancel={close} onSaved={(mode,value)=>{if(value)setLocalLocation({vehicleId:selectedId,value});else setLocalLocation(null);saved(mode==='MANUAL'?'Manual capacity location saved.':'Phone location selected.');}}/></>:<CapacitySignalEditor section={editSection} hasAssignedDriver={Boolean(selectedVehicle.driver)} vehicleId={selectedId} current={current} location={location} allowDeviceLocation={canReadPhone} savedManualSource={capacityLocationSource(selectedVehicle.locationSelection)==='MANUAL'} onBusyChange={setBusy} onSaved={()=>saved()} onCancel={close}/>}
    </CapacityEditDialog>:null}
  </div>;
}
