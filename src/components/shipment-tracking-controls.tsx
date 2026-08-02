"use client";

import React from 'react';
import {
  Check,
  Circle,
  CircleCheckBig,
  LocateFixed,
  LockKeyhole,
  Navigation,
  PackageCheck,
  PackageOpen,
  PackageSearch,
  TriangleAlert,
  Upload
} from 'lucide-react';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { obscureCoordinate } from '@/lib/location-privacy.js';

type LocationState='idle'|'requesting'|'saving'|'saved'|'denied'|'error';

const trackingActions=[
  {status:'ASSIGNED',label:'Loading',hint:'Truck is being loaded',Icon:PackageCheck,acceptsProof:true},
  {status:'IN_TRANSIT',label:'En route',hint:'Shipment is moving',Icon:Navigation,acceptsProof:true},
  {status:'DELIVERED',label:'Unloading',hint:'Shipment reached delivery',Icon:PackageOpen,acceptsProof:true},
  {status:'COMPLETED',label:'Complete',hint:'Shipment is finished',Icon:CircleCheckBig,acceptsProof:false},
  {status:'ISSUE',label:'Problem',hint:'Report before unloading',Icon:TriangleAlert,acceptsProof:true}
] as const;

const automaticStatuses=new Set(['ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE']);
const AUTO_LOCATION_INTERVAL_MS=10*60*1000;

export function ShipmentTrackingControls({shipmentId,trackingMode,nextStatuses,needsReceiverContact,needsShipmentVehicle,operationalStatus,allowDeviceLocation,loadType}:{
  shipmentId:string;trackingMode:string;nextStatuses:string[];needsReceiverContact:boolean;needsShipmentVehicle:boolean;operationalStatus:string;allowDeviceLocation:boolean;loadType:string;
}){
  const availableStatuses=React.useMemo(()=>new Set(nextStatuses),[nextStatuses]);
  const firstAvailable=trackingActions.find(action=>availableStatuses.has(action.status))?.status||'';
  const [selectedStatus,setSelectedStatus]=React.useState(firstAvailable);
  const [locationState,setLocationState]=React.useState('idle' as LocationState);
  const requiresLocation=trackingMode==='LOCATION_AND_STATUS';
  const privacyRadius=loadType==='FTL'?20:40;
  const canPublishAutomaticLocation=requiresLocation&&allowDeviceLocation&&automaticStatuses.has(operationalStatus);
  const locationFinished=['DELIVERED','COMPLETED','CANCELLED'].includes(operationalStatus);
  const selectedAction=trackingActions.find(action=>action.status===selectedStatus);

  React.useEffect(()=>{
    if(!availableStatuses.has(selectedStatus))setSelectedStatus(firstAvailable);
  },[availableStatuses,firstAvailable,selectedStatus]);

  React.useEffect(()=>{
    if(!canPublishAutomaticLocation)return;
    if(!navigator.geolocation){setLocationState('error');return;}
    let active=true;
    let submitting=false;
    const storageKey=`loadgistic:tracking-location:${shipmentId}`;
    setLocationState('requesting');

    const watcher=navigator.geolocation.watchPosition(async position=>{
      if(!active||submitting)return;
      const now=Date.now();
      const lastSent=Number(window.sessionStorage.getItem(storageKey)||0);
      if(lastSent&&now-lastSent<AUTO_LOCATION_INTERVAL_MS){setLocationState('saved');return;}
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      if(!nearest){setLocationState('error');return;}
      const approximate=obscureCoordinate(position.coords.latitude,position.coords.longitude,privacyRadius);
      const body=new FormData();
      body.set('locationArea',`Around ${nearest.name}, Ethiopia`);
      body.set('approximateLat',String(approximate.lat));
      body.set('approximateLng',String(approximate.lng));
      body.set('locationPrecisionKm',String(privacyRadius));
      body.set('locationSource','DEVICE_OBSCURED');
      submitting=true;
      setLocationState('saving');
      try{
        const response=await fetch(`/api/shipments/${shipmentId}/tracking-update`,{
          method:'POST',
          body,
          headers:{'x-loadgistic-automatic-location':'1'}
        });
        if(!response.ok)throw new Error('LOCATION_UPDATE_FAILED');
        window.sessionStorage.setItem(storageKey,String(now));
        if(active)setLocationState('saved');
      }catch{
        if(active)setLocationState('error');
      }finally{
        submitting=false;
      }
    },error=>{
      if(!active)return;
      setLocationState(error.code===error.PERMISSION_DENIED?'denied':'error');
    },{enableHighAccuracy:false,timeout:12000,maximumAge:300000});

    return()=>{
      active=false;
      navigator.geolocation.clearWatch(watcher);
    };
  },[canPublishAutomaticLocation,privacyRadius,shipmentId]);

  const locationTitle=locationState==='saved'
    ? 'Automatic location on'
    : locationState==='saving'
      ? 'Saving location...'
      : locationState==='requesting'
        ? 'Finding location...'
        : locationState==='denied'
          ? 'Location permission off'
          : locationState==='error'
            ? 'Location unavailable'
            : 'Starts after Loading';

  return <section className="card tracking-control-panel">
    <div className="control-panel-title"><div className="panel-title-copy"><PackageSearch aria-hidden="true"/><div><h2>Shipment update</h2><p>Choose one available action</p></div></div></div>

    {requiresLocation?<div className={`automatic-location ${locationFinished?'saved':allowDeviceLocation?locationState:'driver-managed'}`}><LocateFixed aria-hidden="true"/><span><strong>{locationFinished?'Location finished':allowDeviceLocation?locationTitle:'Driver location'}</strong><small>{locationFinished?'Stopped after Unloading.':allowDeviceLocation?`${privacyRadius} km privacy area · automatic while this screen is open`:'The assigned Driver sends this automatically from their phone.'}</small></span></div>:null}

    <form action={`/api/shipments/${shipmentId}/status`} method="post" encType="multipart/form-data" className="tracking-action-form">
      <fieldset className="form-group tracking-action-fieldset"><legend><Check aria-hidden="true"/>Shipment actions</legend><div className="tracking-action-grid">{trackingActions.map(action=>{
        const enabled=availableStatuses.has(action.status);
        const selected=selectedStatus===action.status;
        const Icon=action.Icon;
        return <label className={`tracking-action-choice ${enabled?'available':'disabled'} ${selected?'selected':''} ${action.status==='ISSUE'?'problem':''}`} key={action.status} aria-disabled={!enabled}>
          <input type="radio" name="nextStatus" value={action.status} checked={selected} onChange={()=>setSelectedStatus(action.status)} disabled={!enabled}/>
          <Icon aria-hidden="true"/>
          <span><strong>{action.label}</strong><small>{action.hint}</small></span>
          {selected?<Check className="choice-state" aria-hidden="true"/>:enabled?<Circle className="choice-state" aria-hidden="true"/>:<LockKeyhole className="choice-state" aria-hidden="true"/>}
        </label>;
      })}</div></fieldset>

      {selectedAction?.acceptsProof?<div className="form-group tracking-proof-input"><label htmlFor="status-proof"><Upload aria-hidden="true"/>Proof <span className="meta">(optional)</span></label><input id="status-proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/></div>:null}
      {selectedStatus==='ASSIGNED'&&needsReceiverContact?<div className="alert">Business must add the receiver name and phone first.</div>:null}
      {selectedStatus==='ASSIGNED'&&needsShipmentVehicle?<div className="alert">Choose a truck and Driver first.</div>:null}
      {firstAvailable?<button className="button" disabled={!selectedStatus||(selectedStatus==='ASSIGNED'&&(needsReceiverContact||needsShipmentVehicle))}><Check aria-hidden="true"/>Save {selectedAction?.label||'update'}</button>:<div className="tracking-finished"><CircleCheckBig aria-hidden="true"/><span><strong>No action needed</strong><small>This shipment has no next tracking action.</small></span></div>}
    </form>
  </section>;
}
