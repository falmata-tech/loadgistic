"use client";

import React from 'react';
import {Camera,ChevronDown,ImagePlus} from 'lucide-react';
import {Text,useTranslation} from './localization';

type Photo={id:string;vehicleId:string;receivedAt:string;source:'CAMERA'|'UPLOAD';contentPath:string};
type PhotoRequest={id:string;status:string;requestedAt:string};
type ProviderState={photo:Photo|null;requests:{id:string;requestedAt:string}[]};
type BusinessState={photo:Photo|null;request:PhotoRequest|null};

class PhotoRequestError extends Error{
 constructor(readonly status:number){super('Cargo space photo is unavailable.');}
}

async function photoJson<T>(response:Response):Promise<T>{
 if(!response.ok)throw new PhotoRequestError(response.status);
 return response.json() as Promise<T>;
}

function usePhotoSummary<T>(endpoint:string){
 const [state,setState]=React.useState(null as T|null),[loading,setLoading]=React.useState(true),[failed,setFailed]=React.useState(false);
 const refresh=React.useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setFailed(false);
  try{
   const timeout=AbortSignal.timeout(30000);
   const result=await photoJson<T>(await fetch(endpoint,{cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout}));
   if(!signal?.aborted)setState(result);
  }catch{
   if(!signal?.aborted){setState(null);setFailed(true);}
  }finally{if(!signal?.aborted)setLoading(false);}
 },[endpoint]);
 React.useEffect(()=>{
  const controller=new AbortController();
  void refresh(controller.signal);
  return()=>controller.abort();
 },[refresh]);
 return {state,setState,loading,failed,refresh};
}

function PrivatePhoto({photo}:{photo:Photo}){
 const {t,locale}=useTranslation(),region=React.useId();
 const [open,setOpen]=React.useState(false),[loaded,setLoaded]=React.useState(false),[failed,setFailed]=React.useState(false);
 const image=React.useRef(null as HTMLDivElement|null);
 const received=new Date(photo.receivedAt).toLocaleString(locale==='am'?'am-ET':locale==='om'?'om-ET':'en-ET',{dateStyle:'medium',timeStyle:'short'});
 function toggle(){setFailed(false);setLoaded(false);setOpen((value:boolean)=>!value);}
 React.useEffect(()=>{if(open&&(loaded||failed))image.current?.scrollIntoView({block:'nearest'});},[open,loaded,failed]);
 return <div className="cargo-photo-preview">
  <div className="cargo-photo-meta"><span>{t('Photo received {date}',{date:received})}</span><button type="button" className="button secondary" aria-expanded={open} aria-controls={region} onClick={toggle}><Text message={open?'Close photo':'Open photo'}/></button></div>
  {open?<div id={region} ref={image} className="cargo-photo-image" aria-busy={!loaded&&!failed}>
   {failed?<p role="alert" className="meta"><Text message="This photo cannot be opened."/></p>:<>
    {!loaded?<p role="status" className="meta"><Text message="Loading photo"/></p>:null}
    <img hidden={!loaded} src={photo.contentPath} alt={t('Cargo space photo')} referrerPolicy="no-referrer" onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/>
   </>}
  </div>:null}
 </div>;
}

export function ProviderCargoSpacePhoto({vehicleId,canUpload,canRemove}:{vehicleId:string;canUpload:boolean;canRemove:boolean}){
 const {t}=useTranslation();
 const {state,loading,failed,refresh}=usePhotoSummary<ProviderState>(`/api/capacity/cargo-space-photos?vehicleId=${encodeURIComponent(vehicleId)}`);
 const [error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[busy,setBusy]=React.useState(false);
 const [file,setFile]=React.useState(null as File|null),[preview,setPreview]=React.useState('');
 const input=React.useRef(null as HTMLInputElement|null),locked=React.useRef(false);
 React.useEffect(()=>{
  if(!file){setPreview('');return;}
  const url=URL.createObjectURL(file);setPreview(url);
  return()=>URL.revokeObjectURL(url);
 },[file]);

 function clearFile(){setFile(null);if(input.current)input.current.value='';}
 function choose(selected:File|null){
  setError('');setNotice('');
  if(selected&&(selected.size<1||selected.size>4*1024*1024||!['image/jpeg','image/png','image/webp'].includes(selected.type))){
   clearFile();setError('Choose a JPG, PNG or WebP photo under 4 MB.');return;
  }
  if(selected)setFile(selected);
 }
 async function upload(){
  if(!file||!canUpload||locked.current)return;
  locked.current=true;setBusy(true);setError('');setNotice('');
  try{
   const body=new FormData();body.append('command',JSON.stringify({vehicleId,source:'UPLOAD'}));body.append('file',file);
   await photoJson(await fetch('/api/capacity/cargo-space-photos',{method:'POST',body,signal:AbortSignal.timeout(60000)}));
   clearFile();setNotice('Photo saved.');await refresh();
  }catch{setError('Could not save the photo. Please try again.');}
  finally{locked.current=false;setBusy(false);}
 }
 async function remove(){
  if(!canRemove||!state?.photo||locked.current)return;
  locked.current=true;setBusy(true);setError('');setNotice('');
  try{
   await photoJson(await fetch(state.photo.contentPath,{method:'DELETE',signal:AbortSignal.timeout(20000)}));
   setNotice('Photo removed.');await refresh();
  }catch{setError('Could not remove the photo. Please try again.');}
  finally{locked.current=false;setBusy(false);}
 }
 return <details className="cargo-photo-panel">
  <summary><Camera aria-hidden="true"/><strong><Text message="Cargo space photo"/></strong>{state?.requests.length?<span className="status yellow"><Text message="New photo requested"/></span>:null}<ChevronDown className="cargo-photo-chevron" aria-hidden="true"/></summary>
  <div className="cargo-photo-panel-body" aria-busy={loading||busy}>
   {!state&&loading?<p role="status" className="meta"><Text message="Loading photo"/></p>:null}
   {failed?<div className="cargo-photo-retry"><p role="alert" className="meta"><Text message="Cargo space photo is unavailable."/></p><button type="button" className="button secondary" onClick={()=>void refresh()}><Text message="Try again"/></button></div>:null}
   {!file&&(state?.photo?<PrivatePhoto key={state.photo.id} photo={state.photo}/>:state?<p className="meta"><Text message="No photo yet"/></p>:null)}
   {canUpload&&state?<div className="cargo-photo-upload">
    {file?<div className="cargo-photo-actions">
     <button type="button" className="button" disabled={busy} onClick={()=>void upload()}><Text message={busy?'Saving…':'Save photo'}/></button>
     <button type="button" className="button secondary" disabled={busy} onClick={()=>{clearFile();setError('');}}><Text message="Cancel"/></button>
    </div>:null}
    {file&&preview?<img className="cargo-photo-draft" src={preview} alt={t('Selected cargo space photo')}/>:null}
    <div className="cargo-photo-actions">
     <label className="button secondary"><ImagePlus aria-hidden="true"/><Text message={file?'Choose another photo':'Choose photo'}/><input ref={input} type="file" aria-label={t(file?'Choose another photo':'Choose photo')} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>choose(event.target.files?.[0]||null)}/></label>
    </div>
   </div>:null}
   {canRemove&&state?.photo&&!file?<div><button type="button" className="button secondary" disabled={busy} onClick={()=>void remove()}><Text message="Remove photo"/></button></div>:null}
   {notice?<p role="status" className="meta">{t(notice)}</p>:null}
   {error?<p role="alert" className="alert error">{t(error)}</p>:null}
  </div>
 </details>;
}

export function BusinessCargoSpacePhoto({workspaceId,vehicleId}:{workspaceId:string;vehicleId:string}){
 const {t}=useTranslation();
 const {state,setState,loading,failed,refresh}=usePhotoSummary<BusinessState>(`/api/business-workspaces/${encodeURIComponent(workspaceId)}/capacity/photos?vehicleId=${encodeURIComponent(vehicleId)}`);
 const [error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
 const idempotencyKey=React.useRef(null as string|null),locked=React.useRef(false);
 const pending=state?.request?.status==='PENDING';
 async function requestPhoto(){
  if(!state||pending||locked.current)return;
  locked.current=true;setBusy(true);setError('');
  idempotencyKey.current??=crypto.randomUUID();
  try{
   const request=await photoJson<PhotoRequest>(await fetch(`/api/business-workspaces/${encodeURIComponent(workspaceId)}/capacity/photo-requests`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vehicleId,idempotencyKey:idempotencyKey.current}),signal:AbortSignal.timeout(20000)
   }));
   idempotencyKey.current=null;
   setState({...state,request});
  }catch(error){
   const status=error instanceof PhotoRequestError?error.status:0;
   if([401,403,404].includes(status))await refresh();
   setError(status===429?'A new photo was requested recently.':'Could not request a photo. Please try again.');
  }finally{locked.current=false;setBusy(false);}
 }
 return <section className="cargo-photo-panel cargo-photo-inline" aria-label={t('Cargo space photo')}>
  <h4><Camera aria-hidden="true"/><Text message="Cargo space photo"/></h4>
  <div className="cargo-photo-panel-body" aria-busy={loading||busy}>
   {!state&&loading?<p role="status" className="meta"><Text message="Loading photo"/></p>:null}
   {failed?<div className="cargo-photo-retry"><p role="alert" className="meta"><Text message="Cargo space photo is unavailable."/></p><button type="button" className="button secondary" onClick={()=>void refresh()}><Text message="Try again"/></button></div>:null}
   {state?.photo?<PrivatePhoto key={state.photo.id} photo={state.photo}/>:state?<p className="meta"><Text message="No photo yet"/></p>:null}
   {state?<div className="cargo-photo-actions">{pending?<><span className="status yellow" role="status"><Text message="Photo requested"/></span><button type="button" className="button secondary" disabled={loading} onClick={()=>void refresh()}><Text message="Refresh"/></button></>:<button type="button" className="button secondary" disabled={busy||loading} onClick={()=>void requestPhoto()}><Text message={state.photo?'Request new photo':'Request photo'}/></button>}</div>:null}
   {error?<p role="alert" className="alert error">{t(error)}</p>:null}
  </div>
 </section>;
}
