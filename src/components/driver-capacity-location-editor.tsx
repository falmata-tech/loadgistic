'use client';

import React from 'react';
import {MapPinned,Save,Smartphone} from 'lucide-react';
import {capacityPrivacyRadii,nextCapacityPrivacyRadius} from '@/lib/location-privacy.js';
import {readDriverLocation,saveDriverLocation,type DriverLocation} from '@/lib/capacity-editor-client';
import {locationSourceLabel} from '@/lib/location-source.js';
import {Text,useTranslation} from './localization';
import {ManualTruckLocation} from './manual-truck-location';

type Point={lat:number;lng:number};
type Source='GPS'|'MOBILE'|'MANUAL';
type SourceSnapshot={vehicleId:string;source:Source;precisionKm:number;revision:string;manualPoint:{latitude:number;longitude:number}|null};
type Choice='MOBILE'|'MANUAL';

async function responseBody(response:Response):Promise<Record<string,unknown>>{
 const value=await response.json().catch(()=>null);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Could not read the location response. Refresh and try again.');
 return value as Record<string,unknown>;
}
function serverError(body:Record<string,unknown>,fallback:string){
 const error=body.error;
 return typeof error==='string'?error:error&&typeof error==='object'&&typeof (error as {message?:unknown}).message==='string'?(error as {message:string}).message:fallback;
}
function parseSnapshot(value:Record<string,unknown>,vehicleId:string):SourceSnapshot{
 const source=value.source,point=value.manualPoint;
 if(value.vehicleId!==vehicleId||!['GPS','MOBILE','MANUAL'].includes(String(source))||![...capacityPrivacyRadii('BOTH'),40].includes(Number(value.precisionKm))||typeof value.revision!=='string'||!Number.isFinite(Date.parse(value.revision)))throw Error('Location details changed. Close and reopen this editor.');
 if(point!==null&&point!==undefined){
  if(!point||typeof point!=='object'||Array.isArray(point))throw Error('Location details changed. Close and reopen this editor.');
  const {latitude,longitude}=point as Record<string,unknown>;
  if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw Error('Location details changed. Close and reopen this editor.');
 }
 return value as SourceSnapshot;
}
async function switchSource(snapshot:SourceSnapshot,mode:Choice,radius:number,point:Point|null){
 const response=await fetch('/api/fleet/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'SOURCE',input:{vehicleId:snapshot.vehicleId,source:mode,precisionKm:radius,expectedRevision:snapshot.revision,...(mode==='MANUAL'&&point?{manualLatitude:point.lat,manualLongitude:point.lng}:{})}}),signal:AbortSignal.timeout(15000)});
 const body=await responseBody(response);
 if(!response.ok||body.ok!==true)throw Error(serverError(body,'Could not save this location choice. Refresh before retrying.'));
 const result=body.result;
 if(!result||typeof result!=='object'||typeof (result as {revision?:unknown}).revision!=='string')throw Error('Location choice saved, but the confirmation was incomplete. Close and reopen this editor.');
 return (result as {revision:string}).revision;
}

export function DriverCapacityLocationEditor({vehicleId,location,publishedSource,onDuty,onBusyChange,onSaved,onCancel}:{vehicleId:string;location:DriverLocation|null;publishedSource?:string|null;onDuty:boolean;onBusyChange:(busy:boolean)=>void;onSaved:(mode:Choice,location:DriverLocation|null)=>void;onCancel:()=>void}){
 const {t}=useTranslation();
 const [snapshot,setSnapshot]=React.useState(null as SourceSnapshot|null);
 const [mode,setMode]=React.useState('MOBILE' as Source);
 const [radius,setRadius]=React.useState(nextCapacityPrivacyRadius(location?.radius));
 const [point,setPoint]=React.useState(null as Point|null);
 const [loading,setLoading]=React.useState(true),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const submitting=React.useRef(false);
 React.useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setSnapshot(null);
  void (async()=>{try{
   const response=await fetch(`/api/capacity/manual-location?vehicleId=${encodeURIComponent(vehicleId)}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
   const body=await responseBody(response);
   if(!response.ok)throw Error(serverError(body,'Could not load this vehicle’s location choice.'));
   const saved=parseSnapshot(body,vehicleId);if(controller.signal.aborted)return;
   setSnapshot(saved);setMode(saved.source);setRadius(nextCapacityPrivacyRadius(saved.precisionKm));setPoint(saved.manualPoint?{lat:saved.manualPoint.latitude,lng:saved.manualPoint.longitude}:null);
  }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Could not load this vehicle’s location choice.');}
  finally{if(!controller.signal.aborted)setLoading(false);}})();
  return()=>controller.abort();
 },[vehicleId]);
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(submitting.current||!snapshot||mode==='GPS'||mode==='MANUAL'&&!point)return;
  submitting.current=true;setBusy(true);onBusyChange(true);setError('');
  try{
   // An explicit phone capture is needed before an Off Duty driver can become Available.
   // Only Available capacity reports are sent to the server; the Off Duty capture
   // stays in this editor's parent until the driver submits the duty change.
   const captured=mode==='MOBILE'?await readDriverLocation(radius):null;
   if(mode==='MANUAL'||snapshot.source!=='MOBILE'||radius!==snapshot.precisionKm){
    const revision=await switchSource(snapshot,mode,radius,point);
    setSnapshot({...snapshot,source:mode,precisionKm:radius,revision,manualPoint:mode==='MANUAL'&&point?{latitude:point.lat,longitude:point.lng}:null});
   }
   const saved=mode==='MOBILE'&&captured?(onDuty?await saveDriverLocation(vehicleId,captured):captured):null;
   onSaved(mode,saved);
  }catch(reason){setError(reason instanceof Error?reason.message:'Could not save this vehicle’s location. Refresh before retrying.');}
  finally{submitting.current=false;setBusy(false);onBusyChange(false);}
 }
 const current=snapshot?.source==='GPS'?'GPS device':snapshot?.source==='MOBILE'?'Driver’s phone':'Manually entered';
 const mapSource=locationSourceLabel(publishedSource);
 return <form className="capacity-signal-form" onSubmit={save} data-testid="driver-location-editor">
  <div className="capacity-signal-dialog-body">
   {loading?<p role="status" className="meta"><Text message="Loading location choice…"/></p>:null}
   {snapshot?<>
    <p className="meta"><Text message="Selected source"/>: <strong><Text message={current}/></strong></p>
    <p className="meta"><Text message="Last map report"/>: {location?<>{mapSource?<><Text message={mapSource}/> · </>:null}{location.updatedAt?new Date(location.updatedAt).toLocaleString():t('Not reported yet')}</>:<Text message="Not reported yet"/>}</p>
    <fieldset disabled={busy} className="capacity-signal-group"><legend><Text message="Capacity map location"/></legend>
     <div className="segmented-control capacity-visibility-choices">
      <button type="button" aria-pressed={mode==='MOBILE'} onClick={()=>setMode('MOBILE')}><Smartphone aria-hidden="true"/><strong><Text message="Use my phone"/></strong></button>
      <button type="button" aria-pressed={mode==='MANUAL'} onClick={()=>setMode('MANUAL')}><MapPinned aria-hidden="true"/><strong><Text message="Choose on map"/></strong></button>
     </div>
     {mode==='MANUAL'?<><ManualTruckLocation point={point} initialCenter={location?{lat:location.lat,lng:location.lng}:null} onChange={setPoint} disabled={busy}/><p className="meta"><Text message="A manual point stays until you update it. Update it when the vehicle moves."/></p></>:mode==='MOBILE'?<p className="meta"><Text message={onDuty?'Phone location updates while Home is open.':'Phone location can be shared when this vehicle is Available.'}/></p>:<p className="meta"><Text message="Choose source"/></p>}
     <label htmlFor="driver-capacity-location-radius"><Text message="Shared location accuracy"/><select id="driver-capacity-location-radius" value={radius} onChange={event=>setRadius(Number(event.target.value))}>{capacityPrivacyRadii('BOTH').map(value=><option value={value} key={value}>{value} km</option>)}</select></label>
    </fieldset>
    <p className="meta"><Text message="Capacity shows an approximate area. Active shipment Tracking and the provider’s GPS can continue separately."/></p>
   </>:null}
   {error?<p className="alert error" role="alert">{t(error)}</p>:null}
  </div>
  <footer className="capacity-signal-dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}><Text message="Cancel"/></button><button className="button" disabled={busy||loading||!snapshot||mode==='GPS'||mode==='MANUAL'&&!point}><Save aria-hidden="true"/>{busy?<Text message="Saving…"/>:<Text message="Save location"/>}</button></footer>
 </form>;
}
