"use client";

import React from 'react';
import { Check, Circle, CircleCheckBig, LocateFixed, LockKeyhole, Navigation, PackageCheck, PackageOpen, RefreshCw, Route, TriangleAlert, Upload } from 'lucide-react';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { obscureCoordinate,LOCAL_CAPACITY_PRIVACY_RADII_KM } from '@/lib/location-privacy.js';
import {createForegroundLocationRunner,trackingLocationResult,trackingPrivacyRadius,TRACKING_LOCATION_INTERVAL_MS} from '@/lib/tracking-location-controls.js';

const trackingActions=[
  {status:'TO_PICKUP',label:'Going to pickup',hint:'The Driver is travelling to load',Icon:Route,acceptsProof:false},
  {status:'LOADING',label:'Loading',hint:'The truck is being loaded',Icon:PackageCheck,acceptsProof:true},
  {status:'IN_TRANSIT',label:'En route',hint:'The shipment is moving to delivery',Icon:Navigation,acceptsProof:false},
  {status:'UNLOADING',label:'Unloading',hint:'The truck is being unloaded',Icon:PackageOpen,acceptsProof:true},
  {status:'COMPLETED',label:'Complete',hint:'Tracking is finished',Icon:CircleCheckBig,acceptsProof:false},
  {status:'ISSUE',label:'Problem',hint:'Report an issue',Icon:TriangleAlert,acceptsProof:true}
] as const;

const travelStatuses=new Set(['TO_PICKUP','IN_TRANSIT']);
type LocationState='idle'|'requesting'|'saving'|'saved'|'waiting'|'paused'|'error';
type SafeLocation={area:string;lat:number;lng:number;precisionKm:number};

export function ProviderTrackingControls({trackingId,trackingMode,operationalStatus,nextStatuses,allowDeviceLocation,defaultPrecisionKm,returnTo}:{trackingId:string;trackingMode:string;operationalStatus:string;nextStatuses:string[];allowDeviceLocation:boolean;defaultPrecisionKm?:number;returnTo?:string}){
  const available=React.useMemo(()=>new Set(nextStatuses),[nextStatuses]);
  const sharesLocation=trackingMode==='LOCATION_AND_STATUS';
  const first=trackingActions.find(action=>available.has(action.status)&&!(sharesLocation&&travelStatuses.has(action.status)&&!allowDeviceLocation))?.status||'';
  const [selected,setSelected]=React.useState(first);
  const [locationState,setLocationState]=React.useState('idle' as LocationState);
  const [error,setError]=React.useState('');
  const [submitting,setSubmitting]=React.useState(false);
  const [ready,setReady]=React.useState(false);
  React.useEffect(()=>{setReady(true);},[]);
  const action=trackingActions.find(item=>item.status===selected);
  const [precisionKm,setPrecisionKm]=React.useState(trackingPrivacyRadius(defaultPrecisionKm));
  const [savedPrecision,setSavedPrecision]=React.useState(defaultPrecisionKm===undefined?null:trackingPrivacyRadius(defaultPrecisionKm));
  const runner=React.useRef(createForegroundLocationRunner(()=>document.visibilityState==='visible'));
  const lastSaved=React.useRef(0);
  const busy=locationState==='requesting'||locationState==='saving';
  const autoLocationActive=sharesLocation&&allowDeviceLocation&&travelStatuses.has(operationalStatus);

  React.useEffect(()=>{if(!available.has(selected))setSelected(first);},[available,first,selected]);

  const readSafeLocation=React.useCallback((signal:AbortSignal)=>new Promise<SafeLocation>((resolve,reject)=>{
    if(!window.isSecureContext||!navigator.geolocation){reject(new Error('Device location is unavailable in this browser.'));return;}
    const abort=()=>reject(new DOMException('Location request cancelled.','AbortError'));
    signal.addEventListener('abort',abort,{once:true});
    navigator.geolocation.getCurrentPosition(position=>{
      signal.removeEventListener('abort',abort);if(signal.aborted)return;
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      if(!nearest){reject(new Error('The device location is outside the supported Ethiopia map.'));return;}
      const point=obscureCoordinate(position.coords.latitude,position.coords.longitude,precisionKm);
      resolve({area:`Around ${nearest.name}, Ethiopia`,lat:point.lat,lng:point.lng,precisionKm});
    },problem=>{signal.removeEventListener('abort',abort);if(signal.aborted)return;reject(new Error(problem.code===problem.PERMISSION_DENIED?'Allow location for this site, then try again.':'The device could not provide a location. Try again.'));},{enableHighAccuracy:false,timeout:15000,maximumAge:120000});
  }),[precisionKm]);

  function locationError(problem:unknown){setSubmitting(false);setLocationState('error');setError(problem instanceof Error?problem.message:'Approximate location could not be saved.');}
  const sendLocation=React.useCallback(async()=>{
    if(!autoLocationActive||runner.current.busy||document.visibilityState!=='visible')return;
    if(lastSaved.current&&Date.now()-lastSaved.current<TRACKING_LOCATION_INTERVAL_MS){setLocationState('waiting');return;}
    setError('');
    await runner.current.run({read:readSafeLocation,onState:setLocationState,
      save:async(location:SafeLocation,signal:AbortSignal)=>{
        const body={locationArea:location.area,approximateLat:location.lat,approximateLng:location.lng,locationPrecisionKm:location.precisionKm,locationSource:'DEVICE_OBSCURED'};
        const response=await fetch(`/api/provider-shipments/${trackingId}/location`,{method:'POST',signal,body:JSON.stringify(body),headers:{'content-type':'application/json','x-loadgistic-automatic-location':'1'}});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Approximate location could not be saved.');return result;
      },
      onResult:(result:unknown,location:SafeLocation)=>{
        const state=trackingLocationResult(result);setLocationState(state);
        if(state==='saved'){lastSaved.current=Date.now();setSavedPrecision(location.precisionKm);}
      },onError:locationError
    });
  },[autoLocationActive,readSafeLocation,trackingId]);

  React.useEffect(()=>{
    setSubmitting(false);
    const refresh=()=>{
      if(document.visibilityState!=='visible'){runner.current.cancel();setSubmitting(false);setLocationState('paused');return;}
      if(autoLocationActive)void sendLocation();else setLocationState('idle');
    };
    refresh();const interval=window.setInterval(()=>{if(autoLocationActive)void sendLocation();},TRACKING_LOCATION_INTERVAL_MS);
    document.addEventListener('visibilitychange',refresh);
    return()=>{runner.current.cancel();window.clearInterval(interval);document.removeEventListener('visibilitychange',refresh);};
  },[autoLocationActive,sendLocation]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    if(!sharesLocation||!travelStatuses.has(selected))return;
    event.preventDefault();if(!ready||runner.current.busy||document.visibilityState!=='visible')return;
    if(!allowDeviceLocation){locationError(new Error('The assigned Driver must make this travel update from their workspace.'));return;}
    const form=event.currentTarget;const fields=new FormData(form);setError('');setSubmitting(true);
    await runner.current.run({read:readSafeLocation,onState:setLocationState,
      save:async(location:SafeLocation,signal:AbortSignal)=>{
        if(!allowDeviceLocation)throw new Error('The assigned Driver must make this travel update from their workspace.');
        const body=new URLSearchParams();for(const [key,value] of fields.entries())if(typeof value==='string')body.append(key,value);
        body.set('locationArea',location.area);body.set('approximateLat',String(location.lat));body.set('approximateLng',String(location.lng));body.set('locationPrecisionKm',String(location.precisionKm));body.set('locationSource','DEVICE_OBSCURED');
        const response=await fetch(form.action,{method:'POST',body,signal});
        if(!response.ok)throw new Error('The Tracking update could not be saved.');
        return response.url;
      },onResult:(url:string)=>window.location.assign(url),onError:locationError
    });
  }

  if(['CANCELLED','COMPLETED'].includes(operationalStatus))return <section className="card tracking-control-panel">
    <h2>{operationalStatus==='CANCELLED'?'Tracking cancelled':'Tracking complete'}</h2>
    <p>{operationalStatus==='CANCELLED'?'Guest access has ended. Earlier Tracking events are retained.':'No further status update is needed.'}</p>
  </section>;

  return <section className="card tracking-control-panel">
    <div className="control-panel-title"><div className="panel-title-copy"><Route aria-hidden="true"/><div><h2>Tracking update</h2><p>Choose the next available action.</p></div></div></div>
    {sharesLocation?<>
      <div className={`automatic-location ${locationState}`} role="status"><LocateFixed aria-hidden="true"/><span><strong>{!allowDeviceLocation?'Assigned Driver location':locationState==='paused'?'Location updates paused':locationState==='error'?'Location update failed':locationState==='requesting'?'Finding Driver location…':locationState==='saving'?'Saving approximate location…':locationState==='saved'?`Approximate location shared · ${savedPrecision} km`:locationState==='waiting'?'Waiting for the next location update':autoLocationActive?'Location update ready':'Location starts during travel'}</strong><small>{allowDeviceLocation?'Updates about every 10 minutes during travel. Keep this screen open and visible; updates pause when the phone locks or you leave this screen.':'Updates require the assigned Driver’s open, visible Tracking screen. They pause when the phone locks or that screen closes.'}</small></span></div>
      {allowDeviceLocation?<div className="form-group tracking-location-controls"><label htmlFor={`tracking-radius-${trackingId}`}>Location privacy radius</label><select id={`tracking-radius-${trackingId}`} value={precisionKm} disabled={!ready||busy||submitting} onChange={event=>setPrecisionKm(Number(event.target.value))}>{LOCAL_CAPACITY_PRIVACY_RADII_KM.map(radius=><option key={radius} value={radius}>{radius} km</option>)}</select>{savedPrecision!==null?<small>Last saved radius: {savedPrecision} km.</small>:<small>No location has been saved yet.</small>}<small>The selected radius applies to the next saved location. A larger radius shares a broader area. Changing it does not alter earlier updates.</small>{autoLocationActive?<button type="button" className="button secondary small" disabled={busy||submitting} onClick={()=>void sendLocation()}><RefreshCw aria-hidden="true"/>{locationState==='error'?'Retry location':'Update location'}</button>:null}{locationState==='waiting'?<small>No new location was saved. Updates are limited to once every 10 minutes.</small>:null}</div>:null}
    </>:null}
    {error?<div className="flash error" role="alert">{error}</div>:null}
    <form action={`/api/provider-shipments/${trackingId}/status`} method="post" encType="multipart/form-data" className="tracking-action-form" onSubmit={submit}>
      {returnTo?<input type="hidden" name="returnTo" value={returnTo}/>:null}
      <fieldset className="form-group tracking-action-fieldset" disabled={busy||submitting}><legend><Check aria-hidden="true"/>Tracking status</legend><div className="tracking-action-grid">{trackingActions.map(item=>{
        const driverRequired=sharesLocation&&travelStatuses.has(item.status)&&!allowDeviceLocation;
        const enabled=available.has(item.status)&&!driverRequired,isSelected=selected===item.status,Icon=item.Icon;
        return <label className={`tracking-action-choice ${enabled?'available':'disabled'} ${isSelected?'selected':''} ${item.status==='ISSUE'?'problem':''}`} key={item.status} aria-disabled={!enabled} title={driverRequired?'The assigned Driver makes this update.':undefined}>
          <input type="radio" name="nextStatus" value={item.status} checked={isSelected} onChange={()=>setSelected(item.status)} disabled={!enabled}/><Icon aria-hidden="true"/><span><strong>{item.label}</strong><small>{driverRequired?'Assigned Driver only':item.hint}</small></span>{isSelected?<Check className="choice-state" aria-hidden="true"/>:enabled?<Circle className="choice-state" aria-hidden="true"/>:<LockKeyhole className="choice-state" aria-hidden="true"/>}
        </label>;
      })}</div></fieldset>
      {selected==='ISSUE'?<div className="form-group tracking-proof-input"><label htmlFor={`tracking-issue-${trackingId}`}><TriangleAlert aria-hidden="true"/>What happened?</label><textarea id={`tracking-issue-${trackingId}`} name="note" required maxLength={1000}/></div>:<input type="hidden" name="note" value={action?.label||''}/>}
      {action?.acceptsProof?<div className="form-group tracking-proof-input"><label htmlFor={`tracking-photo-${trackingId}`}><Upload aria-hidden="true"/>Photo <span className="meta">(optional)</span></label><input id={`tracking-photo-${trackingId}`} name="proof" type="file" accept="image/jpeg,image/png,image/webp"/></div>:null}
      {first?<button className="button" disabled={submitting||busy||!selected}>{submitting?'Saving…':<><Check aria-hidden="true"/>Save {action?.label||'update'}</>}</button>:<div className="tracking-finished"><CircleCheckBig aria-hidden="true"/><span><strong>No status update available</strong><small>Check the current assignment and Tracking state.</small></span></div>}
    </form>
  </section>;
}
