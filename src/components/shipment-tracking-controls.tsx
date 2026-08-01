"use client";

import React from 'react';
import { Check, LocateFixed, MapPin, MessageSquare, PackageSearch, Save } from 'lucide-react';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { obscureCoordinate } from '@/lib/location-privacy.js';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type LocationState = 'idle' | 'requesting' | 'captured' | 'denied' | 'error';

export function ShipmentTrackingControls({
  shipmentId,
  trackingMode,
  nextStatuses,
  needsReceiverContact,
  operationalStatus,
  allowDeviceLocation,
  loadType
}: {
  shipmentId: string;
  trackingMode: string;
  nextStatuses: string[];
  needsReceiverContact: boolean;
  operationalStatus: string;
  allowDeviceLocation:boolean;
  loadType:string;
}) {
  const requiresLocation = trackingMode === 'LOCATION_AND_STATUS';
  const canAddUpdate = ['ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE'].includes(operationalStatus);
  const [locationArea,setLocationArea] = React.useState('');
  const [locationState,setLocationState] = React.useState('idle' as LocationState);
  const [approximateLocation,setApproximateLocation] = React.useState(null as {lat:number;lng:number} | null);
  const [selectedStatus,setSelectedStatus] = React.useState(nextStatuses[0] || '');
  const privacyRadius=loadType==='FTL'?20:40;
  const lastLocationUpdate=React.useRef(0);

  React.useEffect(()=>{
    if(!requiresLocation||!allowDeviceLocation)return;
    if(!navigator.geolocation){
      setLocationState('error');
      return;
    }
    setLocationState('requesting');
    const watcher=navigator.geolocation.watchPosition(position => {
      const now=Date.now();
      if(lastLocationUpdate.current&&now-lastLocationUpdate.current<60000)return;
      lastLocationUpdate.current=now;
      setApproximateLocation(obscureCoordinate(position.coords.latitude,position.coords.longitude,privacyRadius));
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      if(nearest)setLocationArea(`Around ${nearest.name}, Ethiopia`);
      setLocationState('captured');
    }, error => {
      setApproximateLocation(null);
      setLocationState(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
    }, {enableHighAccuracy:false,timeout:12000,maximumAge:300000});
    return()=>navigator.geolocation.clearWatch(watcher);
  },[allowDeviceLocation,privacyRadius,requiresLocation]);

  const locationFields = <>
    <input type="hidden" name="approximateLat" value={allowDeviceLocation ? approximateLocation?.lat ?? '' : ''}/>
    <input type="hidden" name="approximateLng" value={allowDeviceLocation ? approximateLocation?.lng ?? '' : ''}/>
    <input type="hidden" name="locationPrecisionKm" value={allowDeviceLocation&&approximateLocation ? String(privacyRadius) : ''}/>
    <input type="hidden" name="locationSource" value={allowDeviceLocation&&approximateLocation ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA'}/>
  </>;

  return <section className="card tracking-control-panel">
    <div className="control-panel-title">
      <div className="panel-title-copy"><PackageSearch aria-hidden="true"/><div><h2>Tracking updates</h2><p>{requiresLocation ? 'General area + status.' : 'Status timeline.'}</p></div></div>
      <span className={`status ${requiresLocation ? 'green' : ''}`}>{requiresLocation ? 'Location + status' : 'Status timeline'}</span>
    </div>
    {requiresLocation ? <div className="stack">
      <div className="form-group"><label htmlFor="tracking-location-area"><MapPin aria-hidden="true"/>Current area</label><EthiopiaPlaceInput id="tracking-location-area" value={locationArea} onChange={event=>setLocationArea(event.target.value)} placeholder="Around Adama, Ethiopia" required/></div>
      {allowDeviceLocation?<div className={`automatic-location ${locationState}`}><LocateFixed aria-hidden="true"/><span><strong>{locationState==='captured'?'Approximate location ready':locationState==='requesting'?'Finding location...':locationState==='denied'?'Location permission denied':'Device location unavailable'}</strong><small>{locationState==='captured'?`Only an obscured ${privacyRadius} km area is recorded.`:'Enter a general area above.'}</small></span></div>:<p className="meta panel-note">Enter a general area manually. Device location is available only to the driver with the truck.</p>}
    </div> : null}

    {canAddUpdate ? <form action={`/api/shipments/${shipmentId}/tracking-update`} method="post" className="tracking-action-form">
      {requiresLocation ? <input type="hidden" name="locationArea" value={locationArea}/> : null}
      {locationFields}
      <div className="form-group"><label htmlFor="tracking-note"><MessageSquare aria-hidden="true"/>Update note {requiresLocation ? '(optional)' : ''}</label><input id="tracking-note" name="note" required={!requiresLocation} placeholder={requiresLocation ? 'Example: Departed after loading' : 'Example: Loading completed'}/></div>
      <button className="button secondary"><Save aria-hidden="true"/>Record tracking update</button>
    </form> : null}

    {nextStatuses.length ? <form action={`/api/shipments/${shipmentId}/status`} method="post" className="tracking-action-form">
      {requiresLocation ? <input type="hidden" name="locationArea" value={locationArea}/> : null}
      {locationFields}
      <div className="form-group"><label htmlFor="next-shipment-status"><Check aria-hidden="true"/>Next status</label><select id="next-shipment-status" name="nextStatus" value={selectedStatus} onChange={event=>setSelectedStatus(event.target.value)}>{nextStatuses.map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></div>
      <div className="form-group"><label htmlFor="status-note"><MessageSquare aria-hidden="true"/>Note <span className="meta">(optional)</span></label><input id="status-note" name="note" placeholder="What changed?"/></div>
      {needsReceiverContact?<div className="alert">The Business must add the receiver first name and phone before assignment.</div>:null}
      <button className="button" disabled={(selectedStatus === 'ASSIGNED' && needsReceiverContact) || (requiresLocation && !locationArea.trim())}><Check aria-hidden="true"/>Update status</button>
    </form> : null}
  </section>;
}
