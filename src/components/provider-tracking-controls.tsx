"use client";

import React from 'react';
import { Check, Circle, CircleCheckBig, LocateFixed, LockKeyhole, Navigation, PackageCheck, PackageOpen, RefreshCw, Route, TriangleAlert, Upload } from 'lucide-react';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { obscureCoordinate } from '@/lib/location-privacy.js';

const trackingActions=[
  {status:'TO_PICKUP',label:'Going to pickup',hint:'The Driver is travelling to load',Icon:Route,acceptsProof:false},
  {status:'LOADING',label:'Loading',hint:'The truck is being loaded',Icon:PackageCheck,acceptsProof:true},
  {status:'IN_TRANSIT',label:'En route',hint:'The shipment is moving to delivery',Icon:Navigation,acceptsProof:false},
  {status:'UNLOADING',label:'Unloading',hint:'The truck is being unloaded',Icon:PackageOpen,acceptsProof:true},
  {status:'COMPLETED',label:'Complete',hint:'Tracking is finished',Icon:CircleCheckBig,acceptsProof:false},
  {status:'ISSUE',label:'Problem',hint:'Report an issue',Icon:TriangleAlert,acceptsProof:true}
] as const;

const travelStatuses=new Set(['TO_PICKUP','IN_TRANSIT']);
const AUTO_LOCATION_INTERVAL_MS=10*60*1000;
type LocationState='idle'|'requesting'|'saving'|'saved'|'denied'|'error';
type SafeLocation={area:string;lat:number;lng:number;precisionKm:number};

export function ProviderTrackingControls({trackingId,trackingMode,operationalStatus,nextStatuses,allowDeviceLocation,defaultPrecisionKm=20,returnTo}:{trackingId:string;trackingMode:string;operationalStatus:string;nextStatuses:string[];allowDeviceLocation:boolean;defaultPrecisionKm?:number;returnTo?:string}){
  const available=React.useMemo(()=>new Set(nextStatuses),[nextStatuses]);
  const sharesLocation=trackingMode==='LOCATION_AND_STATUS';
  const first=trackingActions.find(action=>available.has(action.status)&&!(sharesLocation&&travelStatuses.has(action.status)&&!allowDeviceLocation))?.status||'';
  const [selected,setSelected]=React.useState(first);
  const [locationState,setLocationState]=React.useState('idle' as LocationState);
  const [error,setError]=React.useState('');
  const [submitting,setSubmitting]=React.useState(false);
  const action=trackingActions.find(item=>item.status===selected);
  const precisionKm=[1,3,5,10,20,40].includes(Number(defaultPrecisionKm))?Number(defaultPrecisionKm):20;
  const autoLocationActive=sharesLocation&&allowDeviceLocation&&travelStatuses.has(operationalStatus);

  React.useEffect(()=>{if(!available.has(selected))setSelected(first);},[available,first,selected]);

  const readSafeLocation=React.useCallback(()=>new Promise<SafeLocation>((resolve,reject)=>{
    if(!window.isSecureContext||!navigator.geolocation){reject(new Error('Device location is unavailable in this browser.'));return;}
    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition(position=>{
      const nearest=nearestEthiopiaPlace(position.coords.latitude,position.coords.longitude);
      if(!nearest){setLocationState('error');reject(new Error('The device location is outside the supported Ethiopia map.'));return;}
      const point=obscureCoordinate(position.coords.latitude,position.coords.longitude,precisionKm);
      resolve({area:`Around ${nearest.name}, Ethiopia`,lat:point.lat,lng:point.lng,precisionKm});
    },problem=>{setLocationState(problem.code===problem.PERMISSION_DENIED?'denied':'error');reject(new Error(problem.code===problem.PERMISSION_DENIED?'Allow location for this site, then try again.':'The device could not provide a location. Try again.'));},{enableHighAccuracy:false,timeout:15000,maximumAge:120000});
  }),[precisionKm]);

  const sendLocation=React.useCallback(async(force=false)=>{
    const storageKey=`loadgistic:provider-tracking-location:${trackingId}`;
    const last=Number(window.sessionStorage.getItem(storageKey)||0);
    if(!force&&last&&Date.now()-last<AUTO_LOCATION_INTERVAL_MS){setLocationState('saved');return;}
    const location=await readSafeLocation();setLocationState('saving');
    const body={locationArea:location.area,approximateLat:location.lat,approximateLng:location.lng,locationPrecisionKm:location.precisionKm,locationSource:'DEVICE_OBSCURED'};
    const response=await fetch(`/api/provider-shipments/${trackingId}/location`,{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json','x-loadgistic-automatic-location':'1'}});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Approximate location could not be saved.');
    window.sessionStorage.setItem(storageKey,String(Date.now()));setLocationState('saved');setError('');
  },[readSafeLocation,trackingId]);

  React.useEffect(()=>{
    if(!autoLocationActive)return;
    let active=true;
    const refresh=()=>{if(active&&document.visibilityState==='visible')sendLocation(false).catch((problem:unknown)=>{if(active){setLocationState('error');setError(problem instanceof Error?problem.message:'Approximate location could not be saved.');}});};
    refresh();const interval=window.setInterval(refresh,AUTO_LOCATION_INTERVAL_MS);document.addEventListener('visibilitychange',refresh);
    return()=>{active=false;window.clearInterval(interval);document.removeEventListener('visibilitychange',refresh);};
  },[autoLocationActive,sendLocation]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    if(!sharesLocation||!travelStatuses.has(selected))return;
    event.preventDefault();setError('');setSubmitting(true);
    const form=event.currentTarget;
    try{
      if(!allowDeviceLocation)throw new Error('The assigned Driver must make this travel update from their workspace.');
      const location=await readSafeLocation();const body=new URLSearchParams();for(const [key,value] of new FormData(form).entries())if(typeof value==='string')body.append(key,value);body.set('locationArea',location.area);body.set('approximateLat',String(location.lat));body.set('approximateLng',String(location.lng));body.set('locationPrecisionKm',String(location.precisionKm));body.set('locationSource','DEVICE_OBSCURED');setLocationState('saving');
      const response=await fetch(form.action,{method:'POST',body});
      if(!response.ok)throw new Error('The Tracking update could not be saved.');
      window.sessionStorage.setItem(`loadgistic:provider-tracking-location:${trackingId}`,String(Date.now()));
      window.location.assign(response.url);
    }catch(problem){setSubmitting(false);setLocationState('error');setError(problem instanceof Error?problem.message:'The Tracking update could not be saved.');}
  }

  return <section className="card tracking-control-panel">
    <div className="control-panel-title"><div className="panel-title-copy"><Route aria-hidden="true"/><div><h2>Tracking update</h2><p>Choose the next available action.</p></div></div></div>
    {sharesLocation?<div className={`automatic-location ${locationState}`}><LocateFixed aria-hidden="true"/><span><strong>{autoLocationActive?locationState==='saved'?'Approximate location shared':locationState==='saving'?'Saving approximate location…':'Finding Driver location…':'Location sharing ready'}</strong><small>{allowDeviceLocation?`Shared within ${precisionKm} km only while going to pickup or en route.`:'The assigned Driver shares location during the two travel phases.'}</small></span>{autoLocationActive&&allowDeviceLocation&&['denied','error'].includes(locationState)?<button type="button" className="button secondary small" onClick={()=>sendLocation(true).catch((problem:unknown)=>setError(problem instanceof Error?problem.message:'Location retry failed.'))}><RefreshCw aria-hidden="true"/>Retry</button>:null}</div>:null}
    {error?<div className="flash error" role="alert">{error}</div>:null}
    <form action={`/api/provider-shipments/${trackingId}/status`} method="post" encType="multipart/form-data" className="tracking-action-form" onSubmit={submit}>
      {returnTo?<input type="hidden" name="returnTo" value={returnTo}/>:null}
      <fieldset className="form-group tracking-action-fieldset"><legend><Check aria-hidden="true"/>Tracking status</legend><div className="tracking-action-grid">{trackingActions.map(item=>{
        const driverRequired=sharesLocation&&travelStatuses.has(item.status)&&!allowDeviceLocation;
        const enabled=available.has(item.status)&&!driverRequired,isSelected=selected===item.status,Icon=item.Icon;
        return <label className={`tracking-action-choice ${enabled?'available':'disabled'} ${isSelected?'selected':''} ${item.status==='ISSUE'?'problem':''}`} key={item.status} aria-disabled={!enabled} title={driverRequired?'The assigned Driver makes this update.':undefined}>
          <input type="radio" name="nextStatus" value={item.status} checked={isSelected} onChange={()=>setSelected(item.status)} disabled={!enabled}/><Icon aria-hidden="true"/><span><strong>{item.label}</strong><small>{driverRequired?'Assigned Driver only':item.hint}</small></span>{isSelected?<Check className="choice-state" aria-hidden="true"/>:enabled?<Circle className="choice-state" aria-hidden="true"/>:<LockKeyhole className="choice-state" aria-hidden="true"/>}
        </label>;
      })}</div></fieldset>
      {selected==='ISSUE'?<div className="form-group tracking-proof-input"><label htmlFor={`tracking-issue-${trackingId}`}><TriangleAlert aria-hidden="true"/>What happened?</label><textarea id={`tracking-issue-${trackingId}`} name="note" required maxLength={1000}/></div>:<input type="hidden" name="note" value={action?.label||''}/>}
      {action?.acceptsProof?<div className="form-group tracking-proof-input"><label htmlFor={`tracking-photo-${trackingId}`}><Upload aria-hidden="true"/>Photo <span className="meta">(optional)</span></label><input id={`tracking-photo-${trackingId}`} name="proof" type="file" accept="image/jpeg,image/png,image/webp"/></div>:null}
      {first?<button className="button" disabled={submitting||!selected}>{submitting?'Saving…':<><Check aria-hidden="true"/>Save {action?.label||'update'}</>}</button>:<div className="tracking-finished"><CircleCheckBig aria-hidden="true"/><span><strong>Tracking complete</strong><small>No further status update is needed.</small></span></div>}
    </form>
  </section>;
}
