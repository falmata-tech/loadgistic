"use client";

import React from 'react';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type LocationState = 'idle' | 'requesting' | 'captured' | 'denied' | 'error';

export function ShipmentTrackingControls({
  shipmentId,
  trackingMode,
  nextStatuses,
  needsReceiverContact,
  operationalStatus,
  allowDeviceLocation
}: {
  shipmentId: string;
  trackingMode: string;
  nextStatuses: string[];
  needsReceiverContact: boolean;
  operationalStatus: string;
  allowDeviceLocation:boolean;
}) {
  const requiresLocation = trackingMode === 'LOCATION_AND_STATUS';
  const canAddUpdate = ['ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE'].includes(operationalStatus);
  const [locationArea,setLocationArea] = React.useState('');
  const [locationState,setLocationState] = React.useState('idle' as LocationState);
  const [approximateLocation,setApproximateLocation] = React.useState(null as {lat:number;lng:number} | null);
  const [selectedStatus,setSelectedStatus] = React.useState(nextStatuses[0] || '');

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setLocationState('error');
      return;
    }
    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition(position => {
      setApproximateLocation({
        lat: Math.round(position.coords.latitude * 2) / 2,
        lng: Math.round(position.coords.longitude * 2) / 2
      });
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      if(nearest)setLocationArea(`Around ${nearest.name}`);
      setLocationState('captured');
    }, error => {
      setApproximateLocation(null);
      setLocationState(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
    }, { enableHighAccuracy:true, timeout:12000, maximumAge:300000 });
  }

  const locationFields = <>
    <input type="hidden" name="approximateLat" value={allowDeviceLocation ? approximateLocation?.lat ?? '' : ''}/>
    <input type="hidden" name="approximateLng" value={allowDeviceLocation ? approximateLocation?.lng ?? '' : ''}/>
    <input type="hidden" name="locationPrecisionKm" value={allowDeviceLocation&&approximateLocation ? '40' : ''}/>
    <input type="hidden" name="locationSource" value={allowDeviceLocation&&approximateLocation ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA'}/>
  </>;

  return <section className="card tracking-control-panel">
    <div className="control-panel-title">
      <div><h2>Tracking updates</h2><p>{requiresLocation ? 'This load requires an approximate area with every provider update.' : 'This load requires a clear status timeline.'}</p></div>
      <span className={`status ${requiresLocation ? 'green' : ''}`}>{requiresLocation ? 'Location + status' : 'Status timeline'}</span>
    </div>
    {requiresLocation ? <div className="stack">
      <div className="form-group"><label htmlFor="tracking-location-area">Current general area</label><EthiopiaPlaceInput id="tracking-location-area" value={locationArea} onChange={event=>setLocationArea(event.target.value)} placeholder="Around Adama" required/></div>
      {allowDeviceLocation?<div className={`device-location-control ${locationState}`}>
        <div><strong>{locationState === 'captured' ? 'Approximate device area ready' : 'Use phone location'}</strong><span>{locationState === 'captured' ? 'Only an obscured area with a 40 km privacy zone will be recorded.' : locationState === 'denied' ? 'Permission declined. Entering a general area is enough.' : locationState === 'error' ? 'Location unavailable. Entering a general area is enough.' : 'The exact point stays on this device.'}</span></div>
        <button type="button" className="button secondary compact" onClick={useDeviceLocation} disabled={locationState === 'requesting'}>{locationState === 'requesting' ? 'Locating…' : locationState === 'captured' ? 'Refresh area' : 'Use device location'}</button>
      </div>:<p className="meta panel-note">Enter a general area manually. Device location is available only to the driver with the truck.</p>}
    </div> : null}

    {canAddUpdate ? <form action={`/api/shipments/${shipmentId}/tracking-update`} method="post" className="tracking-action-form">
      {requiresLocation ? <input type="hidden" name="locationArea" value={locationArea}/> : null}
      {locationFields}
      <div className="form-group"><label htmlFor="tracking-note">Update note {requiresLocation ? '(optional)' : ''}</label><input id="tracking-note" name="note" required={!requiresLocation} placeholder={requiresLocation ? 'Example: Departed after loading' : 'Example: Loading completed'}/></div>
      <button className="button secondary">Record tracking update</button>
    </form> : null}

    {nextStatuses.length ? <form action={`/api/shipments/${shipmentId}/status`} method="post" className="tracking-action-form">
      {requiresLocation ? <input type="hidden" name="locationArea" value={locationArea}/> : null}
      {locationFields}
      <div className="form-group"><label htmlFor="next-shipment-status">Next shipment status</label><select id="next-shipment-status" name="nextStatus" value={selectedStatus} onChange={event=>setSelectedStatus(event.target.value)}>{nextStatuses.map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></div>
      <div className="form-group"><label htmlFor="status-note">Status note (optional)</label><input id="status-note" name="note" placeholder="What changed?"/></div>
      {needsReceiverContact?<div className="alert">The Business must add the receiver first name and phone before assignment.</div>:null}
      <button className="button" disabled={(selectedStatus === 'ASSIGNED' && needsReceiverContact) || (requiresLocation && !locationArea.trim())}>Update shipment status</button>
    </form> : null}
  </section>;
}
