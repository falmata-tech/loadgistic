"use client";

import React from 'react';
import { Check, LocateFixed, MapPin, Navigation, PackageCheck, PackageOpen, PackageSearch, Save, TriangleAlert, Upload } from 'lucide-react';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { obscureCoordinate } from '@/lib/location-privacy.js';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type LocationState='idle'|'requesting'|'captured'|'denied'|'error';
const fieldActionByStatus={
  ASSIGNED:{label:'Loading',hint:'Truck is being loaded',Icon:PackageCheck},
  IN_TRANSIT:{label:'En route',hint:'Shipment is moving',Icon:Navigation},
  DELIVERED:{label:'Unloading',hint:'Shipment reached delivery',Icon:PackageOpen},
  ISSUE:{label:'Problem',hint:'Something needs attention',Icon:TriangleAlert}
} as const;
const otherActionLabels:Record<string,string>={CONTACTED:'Contacted',AGREED:'Agreement reached',ON_HOLD:'Pause shipment',COMPLETED:'Complete shipment',CANCELLED:'Cancel shipment',DECLINED:'Decline',WITHDRAWN:'Withdraw'};

export function ShipmentTrackingControls({shipmentId,trackingMode,nextStatuses,needsReceiverContact,needsShipmentVehicle,operationalStatus,allowDeviceLocation,loadType}:{
  shipmentId:string;trackingMode:string;nextStatuses:string[];needsReceiverContact:boolean;needsShipmentVehicle:boolean;operationalStatus:string;allowDeviceLocation:boolean;loadType:string;
}){
  const requiresLocation=trackingMode==='LOCATION_AND_STATUS';
  const canAddUpdate=['ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE'].includes(operationalStatus);
  const fieldActions=nextStatuses.filter(status=>status in fieldActionByStatus);
  const otherActions=nextStatuses.filter(status=>!(status in fieldActionByStatus));
  const [locationArea,setLocationArea]=React.useState('');
  const [locationState,setLocationState]=React.useState('idle' as LocationState);
  const [approximateLocation,setApproximateLocation]=React.useState(null as {lat:number;lng:number}|null);
  const [selectedStatus,setSelectedStatus]=React.useState(fieldActions[0]||'');
  const privacyRadius=loadType==='FTL'?20:40;
  const lastLocationUpdate=React.useRef(0);

  React.useEffect(()=>{
    if(!requiresLocation||!allowDeviceLocation)return;
    if(!navigator.geolocation){setLocationState('error');return;}
    setLocationState('requesting');
    const watcher=navigator.geolocation.watchPosition(position=>{
      const now=Date.now();
      if(lastLocationUpdate.current&&now-lastLocationUpdate.current<60000)return;
      lastLocationUpdate.current=now;
      setApproximateLocation(obscureCoordinate(position.coords.latitude,position.coords.longitude,privacyRadius));
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      if(nearest)setLocationArea(`Around ${nearest.name}, Ethiopia`);
      setLocationState('captured');
    },error=>{
      setApproximateLocation(null);
      setLocationState(error.code===error.PERMISSION_DENIED?'denied':'error');
    },{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
    return()=>navigator.geolocation.clearWatch(watcher);
  },[allowDeviceLocation,privacyRadius,requiresLocation]);

  const locationFields=<>
    <input type="hidden" name="approximateLat" value={allowDeviceLocation?approximateLocation?.lat??'':''}/>
    <input type="hidden" name="approximateLng" value={allowDeviceLocation?approximateLocation?.lng??'':''}/>
    <input type="hidden" name="locationPrecisionKm" value={allowDeviceLocation&&approximateLocation?String(privacyRadius):''}/>
    <input type="hidden" name="locationSource" value={allowDeviceLocation&&approximateLocation?'DEVICE_OBSCURED':'MANUAL_GENERAL_AREA'}/>
  </>;

  return <section className="card tracking-control-panel">
    <div className="control-panel-title"><div className="panel-title-copy"><PackageSearch aria-hidden="true"/><div><h2>Update tracking</h2><p>{requiresLocation?'Area + one clear status':'Choose what is happening now'}</p></div></div></div>
    {requiresLocation?<div className="stack">
      <div className="form-group"><label htmlFor="tracking-location-area"><MapPin aria-hidden="true"/>Current area</label><EthiopiaPlaceInput id="tracking-location-area" value={locationArea} onChange={event=>setLocationArea(event.target.value)} placeholder="Around Adama, Ethiopia" required/></div>
      {allowDeviceLocation?<div className={`automatic-location ${locationState}`}><LocateFixed aria-hidden="true"/><span><strong>{locationState==='captured'?'Approximate location ready':locationState==='requesting'?'Finding location...':locationState==='denied'?'Location permission denied':'Device location unavailable'}</strong><small>{locationState==='captured'?`${privacyRadius} km privacy area recorded.`:'Enter a general area above.'}</small></span></div>:<p className="meta panel-note">Enter the truck's general area.</p>}
    </div>:null}

    {fieldActions.length?<form action={`/api/shipments/${shipmentId}/status`} method="post" encType="multipart/form-data" className="tracking-action-form">
      {requiresLocation?<input type="hidden" name="locationArea" value={locationArea}/>:null}{locationFields}
      <fieldset className="form-group"><legend><Check aria-hidden="true"/>What is happening?</legend><div className="rich-choice-grid tracking-status-choices">{fieldActions.map(status=>{
        const action=fieldActionByStatus[status as keyof typeof fieldActionByStatus];
        const Icon=action.Icon;
        return <label className="rich-choice" key={status}><input type="radio" name="nextStatus" value={status} checked={selectedStatus===status} onChange={()=>setSelectedStatus(status)}/><Icon aria-hidden="true"/><span><strong>{action.label}</strong><small>{action.hint}</small></span><Check className="choice-check" aria-hidden="true"/></label>;
      })}</div></fieldset>
      <div className="form-group"><label htmlFor="status-proof"><Upload aria-hidden="true"/>Photo or document <span className="meta">(optional)</span></label><input id="status-proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/></div>
      {needsReceiverContact?<div className="alert">Business must add the receiver name and phone first.</div>:null}
      {selectedStatus==='ASSIGNED'&&needsShipmentVehicle?<div className="alert">Choose a truck and Driver first.</div>:null}
      <button className="button" disabled={(selectedStatus==='ASSIGNED'&&(needsReceiverContact||needsShipmentVehicle))||(requiresLocation&&!locationArea.trim())}><Check aria-hidden="true"/>Save update</button>
    </form>:null}

    {canAddUpdate&&requiresLocation?<details className="capacity-options"><summary><MapPin aria-hidden="true"/>Location update</summary><form action={`/api/shipments/${shipmentId}/tracking-update`} method="post" className="tracking-action-form">
      <input type="hidden" name="locationArea" value={locationArea}/>{locationFields}
      <button className="button secondary"><Save aria-hidden="true"/>Save</button>
    </form></details>:null}

    {otherActions.length?<details className="capacity-options"><summary><Check aria-hidden="true"/>More shipment actions</summary><form action={`/api/shipments/${shipmentId}/status`} method="post" className="tracking-action-form">
      {requiresLocation?<input type="hidden" name="locationArea" value={locationArea}/>:null}{locationFields}
      <div className="form-group"><label htmlFor="other-shipment-status"><Check aria-hidden="true"/>Action</label><select id="other-shipment-status" name="nextStatus">{otherActions.map(status=><option value={status} key={status}>{otherActionLabels[status]||status.replaceAll('_',' ')}</option>)}</select></div>
      <button className="button secondary" disabled={requiresLocation&&!locationArea.trim()}><Check aria-hidden="true"/>Continue</button>
    </form></details>:null}
  </section>;
}
