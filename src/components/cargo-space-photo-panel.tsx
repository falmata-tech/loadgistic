"use client";

import React from 'react';
import {Camera,ImagePlus} from 'lucide-react';
import {Text,useTranslation} from './localization';

type Photo={id:string;vehicleId:string;receivedAt:string;source:'CAMERA'|'UPLOAD';contentPath:string};
type ProviderState={photo:Photo|null;requests:{id:string;requestedAt:string}[]};
type BusinessState={photo:Photo|null;request:{id:string;status:string;requestedAt:string}|null};

async function responseJson<T>(response:Response):Promise<T>{
 if(!response.ok)throw new Error('Cargo space photo is unavailable.');
 return response.json() as Promise<T>;
}
function receivedAt(value:string,locale:string){
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toLocaleString(locale==='am'?'am-ET':locale==='om'?'om-ET':'en-ET',{dateStyle:'medium',timeStyle:'short'}):'';
}
function PrivatePhoto({photo}:{photo:Photo}){
 const {t,locale}=useTranslation();
 const [open,setOpen]=React.useState(false);
 return <div className="cargo-photo-preview">
  <div className="cargo-photo-meta"><span><Text message="Photo received"/> · <time dateTime={photo.receivedAt}>{receivedAt(photo.receivedAt,locale)}</time></span><button type="button" className="button secondary" onClick={()=>setOpen((value:boolean)=>!value)}>{open?t('Close photo'):t('Open photo')}</button></div>
  {open?<img src={photo.contentPath} alt={t('Cargo space photo')} referrerPolicy="no-referrer"/>:null}
 </div>;
}

export function ProviderCargoSpacePhoto({vehicleId,canUpload,canRemove}:{vehicleId:string;canUpload:boolean;canRemove:boolean}){
 const {t}=useTranslation();
 const [state,setState]=React.useState(null as ProviderState|null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[file,setFile]=React.useState(null as File|null);
 const input=React.useRef(null as HTMLInputElement|null);
 const endpoint=`/api/capacity/cargo-space-photos?vehicleId=${encodeURIComponent(vehicleId)}`;
 const refresh=React.useCallback(async(signal?:AbortSignal)=>{
  const result=await responseJson<ProviderState>(await fetch(endpoint,{cache:'no-store',signal}));
  if(!signal?.aborted)setState(result);
 },[endpoint]);
 React.useEffect(()=>{
  const controller=new AbortController();setState(null);setFile(null);setError('');
  void refresh(controller.signal).catch(()=>{if(!controller.signal.aborted)setError('Cargo space photo is unavailable.');});
  return()=>controller.abort();
 },[refresh]);
 async function upload(){
  if(!file||busy)return;
  if(file.size<1||file.size>4*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Choose a JPG, PNG or WebP photo under 4 MB.');return;}
  setBusy(true);setError('');
  try{
   const body=new FormData();body.append('command',JSON.stringify({vehicleId,source:'UPLOAD'}));body.append('file',file);
   await responseJson(await fetch('/api/capacity/cargo-space-photos',{method:'POST',body}));
   setFile(null);if(input.current)input.current.value='';await refresh();
  }catch{setError('Could not save the photo. Please try again.');}
  finally{setBusy(false);}
 }
 async function remove(){
  if(!state?.photo||busy)return;
  setBusy(true);setError('');
  try{await responseJson(await fetch(state.photo.contentPath,{method:'DELETE'}));await refresh();}
  catch{setError('Could not remove the photo. Please try again.');}
  finally{setBusy(false);}
 }
 return <details className="cargo-photo-panel" key={vehicleId}>
  <summary><Camera aria-hidden="true"/><strong><Text message="Cargo space photo"/></strong>{state?.requests.length?<span className="status yellow"><Text message="New photo requested"/></span>:null}</summary>
  <div className="cargo-photo-panel-body">
   {state?.photo?<PrivatePhoto key={state.photo.id} photo={state.photo}/>:<p className="meta"><Text message="No photo yet"/></p>}
   {canUpload?<div className="cargo-photo-actions"><label className="button secondary"><ImagePlus aria-hidden="true"/><Text message="Choose photo"/><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setFile(event.target.files?.[0]||null)} disabled={busy}/></label>{file?<><span className="cargo-photo-file">{file.name}</span><button type="button" className="button" disabled={busy} onClick={()=>void upload()}><Text message="Save photo"/></button><button type="button" className="button secondary" disabled={busy} onClick={()=>{setFile(null);if(input.current)input.current.value='';}}><Text message="Cancel"/></button></>:null}</div>:null}
   {canRemove&&state?.photo?<button type="button" className="button secondary" disabled={busy} onClick={()=>void remove()}><Text message="Remove photo"/></button>:null}
   {error?<p role="alert" className="alert error">{t(error)}</p>:null}
  </div>
 </details>;
}

export function BusinessCargoSpacePhoto({workspaceId,vehicleId}:{workspaceId:string;vehicleId:string}){
 const {t}=useTranslation();
 const [state,setState]=React.useState(null as BusinessState|null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
 const endpoint=`/api/business-workspaces/${encodeURIComponent(workspaceId)}/capacity/photos?vehicleId=${encodeURIComponent(vehicleId)}`;
 const refresh=React.useCallback(async(signal?:AbortSignal)=>{
  const result=await responseJson<BusinessState>(await fetch(endpoint,{cache:'no-store',signal}));
  if(!signal?.aborted)setState(result);
 },[endpoint]);
 React.useEffect(()=>{
  const controller=new AbortController();setState(null);setError('');
  void refresh(controller.signal).catch(()=>{if(!controller.signal.aborted)setError('Cargo space photo is unavailable.');});
  return()=>controller.abort();
 },[refresh]);
 async function requestPhoto(){
  if(busy)return;setBusy(true);setError('');
  try{
   await responseJson(await fetch(`/api/business-workspaces/${encodeURIComponent(workspaceId)}/capacity/photo-requests`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vehicleId,idempotencyKey:crypto.randomUUID()})
   }));await refresh();
  }catch{setError('Could not request a photo. Please try again.');}
  finally{setBusy(false);}
 }
 return <details className="cargo-photo-panel" key={`${workspaceId}:${vehicleId}`}>
  <summary><Camera aria-hidden="true"/><strong><Text message="Cargo space photo"/></strong></summary>
  <div className="cargo-photo-panel-body">
   {state?.photo?<PrivatePhoto key={state.photo.id} photo={state.photo}/>:<p className="meta"><Text message="No photo yet"/></p>}
   {state?.request?.status==='PENDING'?<span className="status yellow"><Text message="Photo requested"/></span>:<button type="button" className="button secondary" disabled={busy||!state} onClick={()=>void requestPhoto()}><Text message={state?.photo?'Request new photo':'Request photo'}/></button>}
   {error?<p role="alert" className="alert error">{t(error)}</p>:null}
  </div>
 </details>;
}
