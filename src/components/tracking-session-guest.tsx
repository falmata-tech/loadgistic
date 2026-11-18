'use client';
import {trackingStatusLabels} from './tracking-progress-panel';
import React from 'react';
import {trackingSessionViewSchema,type TrackingSessionAccess,type TrackingSessionView} from '@/lib/tracking-sessions/contracts';
import {guestTrackingSession,trackingAccessLifetimeMs} from '@/lib/tracking-sessions/client';
import {trackingRefreshAllowed,trackingRefreshDelay} from '@/lib/tracking-refresh-policy.js';
import {locationSourceLabel} from '@/lib/location-source.js';
import {TrackingLocationMap} from './tracking-location-map';
import {Text,useTranslation} from './localization';

export function TrackingSessionGuest({initial,sessionId:resumeId,expiresAt:resumeExpiry,onClosed}:{initial?:TrackingSessionAccess;sessionId?:string;expiresAt?:string;onClosed?:()=>void}){
 const {t}=useTranslation(),id=initial?.session.id||resumeId||'',generation=React.useRef(0),pending=React.useRef(false),failures=React.useRef(0),ending=React.useRef(false);
 const deadline=React.useRef(Math.min(Date.parse(initial?.expiresAt||resumeExpiry||''),Date.now()+trackingAccessLifetimeMs));
 const [session,setSession]:[TrackingSessionView|null,(value:TrackingSessionView|null)=>void]=React.useState(initial?.session||null);
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[closed,setClosed]=React.useState(false),[visible,setVisible]=React.useState(true);
 const close=React.useCallback(async()=>{
  if(ending.current)return;ending.current=true;generation.current++;setClosed(true);setSession(null);
  try{await fetch('/api/tracking/access',{method:'DELETE',headers:{accept:'application/json'},signal:AbortSignal.timeout(5000)});}catch{}
 },[]);
 const load=React.useCallback(async()=>{
  if(pending.current||!id||Date.now()>=deadline.current)return;
  pending.current=true;const version=generation.current;setBusy(true);setError('');
  try{
   const response=await fetch(`/api/tracking/sessions/${encodeURIComponent(id)}`,{cache:'no-store',headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});
   if([401,403,404,410].includes(response.status)){await close();return;}
   const body=await response.json();if(!response.ok||body.ok!==true)throw Error();
   const value=guestTrackingSession(trackingSessionViewSchema.parse(body.data),id);
   if(version===generation.current&&Date.now()<deadline.current){setSession(value);failures.current=0;}
  }catch{if(version===generation.current){failures.current=Math.min(2,failures.current+1);setError('Could not refresh Tracking. Please try again.');}}
  finally{pending.current=false;if(version===generation.current)setBusy(false);}
 },[id,close]);
 React.useEffect(()=>{if(!initial)void load();},[initial,load]);
 React.useEffect(()=>{const changed=()=>{const shown=document.visibilityState!=='hidden';setVisible(shown);if(shown&&Date.now()>=deadline.current)void close();else if(shown)void load();};document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[load,close]);
 React.useEffect(()=>{
  const timer=window.setInterval(()=>{if(!Number.isFinite(deadline.current)||Date.now()>=deadline.current)void close();},1000);
  return()=>{window.clearInterval(timer);generation.current++;};
 },[close]);
 React.useEffect(()=>{
  if(closed)return;
  const active=!session||session.state==='PENDING_PROVIDER'||!['COMPLETED','CANCELLED'].includes(session.tracking?.status||'');
  const timer=window.setTimeout(()=>{if(trackingRefreshAllowed({active,visible:visible&&document.visibilityState!=='hidden',expiresAt:deadline.current,now:Date.now()}))void load();},trackingRefreshDelay(failures.current));
  return()=>window.clearTimeout(timer);
 },[session,busy,error,closed,visible,load]);
 if(closed)return <section className="stack" role="status"><Text message="Tracking access ended. Open the link and enter its code again."/>{onClosed?<button type="button" className="button" onClick={onClosed}><Text message="Enter code again"/></button>:null}</section>;
 const tracking=session?.state==='CONNECTED'?session.tracking:null;
 return <section className="stack" aria-busy={busy}>
  <div className="actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>void load()}><Text message={busy?'Refreshing…':'Refresh updates'}/></button><button type="button" className="text-button" onClick={()=>void close()}><Text message="Close Tracking"/></button></div>
  {error?<p className="alert error" role="alert">{t(error)}</p>:null}
  {!session?<p role="status"><Text message="Loading shipment updates"/></p>:<>
   <h2>{session.reference}</h2><p>{session.cargoSummary}</p>{tracking?<p className="tracking-mode-banner"><Text message={tracking.trackingMode==='LOCATION_AND_STATUS'?'Location and status updates':'Status updates'}/>{tracking.location?<><span aria-hidden="true"> · </span><Text message={locationSourceLabel(tracking.location.source)}/></>:null}</p>:null}
   {session.state==='PENDING_PROVIDER'?<p className="permission-note"><Text message="Waiting for a Transport Provider to connect. No vehicle location is shared yet."/></p>:session.state==='CANCELLED'?<p role="status"><Text message="Tracking cancelled"/></p>:null}
   <TrackingLocationMap showProgress={Boolean(tracking)} shipment={{status:tracking?.status||'CREATED',trackingMode:tracking?.trackingMode||'STATUS_ONLY',route:session.route,location:tracking?.location||null,truck:null,recordedStatuses:tracking?.events.map(event=>event.status)||[]}}/>
   {tracking?<section className="stack"><h3><Text message="Shipment progress"/></h3>{tracking.events.map(event=><div key={event.id}><strong>{t(trackingStatusLabels[event.status]||'Tracking update')}</strong><p>{new Date(event.createdAt).toLocaleString()}</p>{event.note?<p>{event.note}</p>:null}</div>)}</section>:null}
  </>}
 </section>;
}
