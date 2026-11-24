'use client';
import {TrackingRequests} from './connect-tracking';
import {trackingStatusLabels} from './tracking-progress-panel';
import React from 'react';
import {trackingSessionViewSchema,trackingSessionIssueSchema,trackingSessionListSchema,trackingSessionCreate,type TrackingSessionView,type TrackingSessionIssue} from '@/lib/tracking-sessions/contracts';
import {trackingLinkToken} from '@/lib/tracking-sessions/client';
import {browserRequest} from '@/lib/browser-request';
import {DatePicker} from './date-picker';
import {EthiopiaPlaceInput} from './ethiopia-place-input';
import {Text,useTranslation} from './localization';
import {TrackingProofLink} from './tracking-proof-link';
import {TrackingLocationMap} from './tracking-location-map';
import {TrackingSharing} from './tracking-sharing';
import {SurfaceSkeleton} from './loading-state';
import {trackingRefreshDelay,trackingShipmentActiveStatus} from '@/lib/tracking-refresh-policy.js';
type Business={id:string;name:string;handle:string};

type Reply={ok?:boolean;data?:unknown};
export function TrackingSessionManager({sessionId,workspaceId,businesses=[]}:{sessionId:string;workspaceId?:string;businesses?:Business[]}){
 const expirySelectId=React.useId(),ratingSelectId=React.useId();
 const {t}=useTranslation(),lock=React.useRef(false);
 const [saved,setSaved]:[TrackingSessionView|null,(value:TrackingSessionView|null)=>void]=React.useState(null),[issued,setIssued]:[TrackingSessionIssue|null,(value:TrackingSessionIssue|null)=>void]=React.useState(null);
 const [days,setDays]=React.useState(7),[allowLocation,setAllowLocation]=React.useState(false),[busy,setBusy]=React.useState(false),[refreshing,setRefreshing]=React.useState(false),[uncertain,setUncertain]=React.useState(false),[error,setError]=React.useState(''),[copied,setCopied]=React.useState(''),[loadedScope,setLoadedScope]=React.useState('');
 const [rating,setRating]=React.useState(5),[reviewNote,setReviewNote]=React.useState(''),[reviewTerms,setReviewTerms]=React.useState(false);
 const scopeKey=`${sessionId}:${workspaceId||''}`,scopeRef=React.useRef(scopeKey),loadSequence=React.useRef(0);scopeRef.current=scopeKey;
 const data:TrackingSessionView|null=loadedScope===scopeKey&&saved?.id===sessionId?saved:null,path=`/api/tracking/sessions/${encodeURIComponent(sessionId)}`;
 const load=React.useCallback(async(signal?:AbortSignal)=>{
  const version=++loadSequence.current;setRefreshing(true);
  const current=()=>!signal?.aborted&&version===loadSequence.current&&scopeRef.current===scopeKey;
  try{const {response,data:body}=await browserRequest<Reply>(path+`?view=manager${workspaceId?`&workspaceId=${encodeURIComponent(workspaceId)}`:''}`,{headers:{accept:'application/json'},cache:'no-store',signal});if(!response.ok||body.ok!==true){if(current()&&[401,403,404,410].includes(response.status)){setIssued(null);setSaved(null);setLoadedScope('');}throw Error();}const result=trackingSessionViewSchema.parse(body.data);if(result.id!==sessionId)throw Error();if(!current())return false;setLoadedScope(scopeKey);setSaved(result);setError('');setUncertain(false);return true;}
  catch{if(current()){setUncertain(true);setError('Could not load Tracking. Please refresh and try again.');}return false;}
  finally{if(current())setRefreshing(false);}
 },[path,workspaceId,sessionId,scopeKey]);
 React.useEffect(()=>{const abort=new AbortController();setSaved(null);setIssued(null);setReviewNote('');setReviewTerms(false);setRating(5);setDays(7);setAllowLocation(false);setCopied('');setBusy(false);setUncertain(false);lock.current=false;void load(abort.signal);return()=>{abort.abort();loadSequence.current++;};},[load]);
 const active=data?.state==='PENDING_PROVIDER'||data?.state==='CONNECTED'&&trackingShipmentActiveStatus(data.tracking?.status);
 React.useEffect(()=>{
  if(!data)return;const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,reading=false,failures=0;
  const schedule=()=>{if(timer)clearTimeout(timer);timer=undefined;if(!abort.signal.aborted&&active&&document.visibilityState==='visible')timer=setTimeout(()=>void refresh(),trackingRefreshDelay(failures));};
  const refresh=async()=>{if(abort.signal.aborted||document.visibilityState!=='visible')return;if(reading||lock.current){schedule();return;}reading=true;const success=await load(abort.signal);reading=false;failures=success?0:Math.min(2,failures+1);schedule();};
  const visible=()=>{if(timer)clearTimeout(timer);if(document.visibilityState==='visible')void refresh();};
  schedule();document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
  return()=>{abort.abort();if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);};
 },[load,Boolean(data),active]);
 async function change(action:'ISSUE'|'REVOKE'|'APPROVE'|'REVIEW',linkId?:string){
  if(lock.current||uncertain||!data||action==='REVIEW'&&(!reviewTerms||!Number.isInteger(rating)||rating<1||rating>5))return;const operationScope=scopeKey;lock.current=true;setBusy(true);setError('');if(action==='REVOKE'&&issued?.link.id===linkId)setIssued(null);
  try{
   const suffix=action==='APPROVE'?'/approve':action==='REVIEW'?'/review':`/links${action==='REVOKE'?`?linkId=${encodeURIComponent(linkId||'')}`:''}`;
   const bodyInput=action==='REVIEW'?{rating,note:reviewNote.trim(),termsAccepted:true}:{...workspaceId?{workspaceId}:{},...action==='ISSUE'?{expiresInDays:days,allowLocation}:{}};
   const {response,data:body}=await browserRequest<Reply>(path+suffix,{method:action==='REVOKE'?'DELETE':'POST',headers:{'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify(bodyInput)});
   if(!response.ok||body.ok!==true){if(scopeRef.current===operationScope&&[401,403,404,410].includes(response.status)){setSaved(null);setIssued(null);setLoadedScope('');}throw Error();}
   if(scopeRef.current!==operationScope)return;
   if(action==='ISSUE'){const value=trackingSessionIssueSchema.parse(body.data);if(!trackingLinkToken(value.link.url,process.env.NODE_ENV==='development'||process.env.NODE_ENV==='test'))throw Error();setIssued(value);}
   await load();
  }catch{if(scopeRef.current===operationScope){setUncertain(true);setError('The result could not be confirmed. Refresh to check saved links before making another change.');}}
  finally{if(scopeRef.current===operationScope){lock.current=false;setBusy(false);}}
 }
 async function copy(value:string){try{await navigator.clipboard.writeText(value);setCopied('Copied');}catch{setCopied('Copy is unavailable. Select the link or code to copy it.');}}
 return <section className="stack" style={{minHeight:240}} aria-busy={busy||refreshing}>
  <div className="actions"><button type="button" className="button secondary" disabled={busy||refreshing} onClick={()=>void load()}><Text message="Refresh Tracking"/></button>{refreshing&&data?<p role="status"><Text message="Refreshing…"/></p>:null}</div>
  {error?<p role="alert" className="alert error">{t(error)}</p>:null}
  {!data&&!error?<SurfaceSkeleton kind="map" label="Loading Tracking"/>:null}
  {data?<><h3>{data.reference}</h3>{data.brokerReference?<p><Text message="Your shipment reference"/> · {data.brokerReference}</p>:null}<p>{data.cargoSummary}</p><p><Text message={data.requestExpired?'This tracking request has expired.':data.state==='PENDING_PROVIDER'?'Waiting for a Transport Provider to connect. No vehicle location is shared yet.':data.state==='CANCELLED'?'Tracking cancelled':'Provider connected'}/></p>{data.state==='PENDING_PROVIDER'&&data.capabilities.canIssueLink?<TrackingRequests key={data.id} sessionId={data.id}/>:null}<TrackingLocationMap showProgress={Boolean(data.tracking)} shipment={{route:data.route,location:data.tracking?.location||null,truck:null,status:data.tracking?.status||'CREATED',trackingMode:data.tracking?.trackingMode||'STATUS_ONLY',recordedStatuses:data.tracking?.events.map(event=>event.status)||[]}}/>{data.tracking?<section className="stack"><h4><Text message="Shipment progress"/></h4>{data.tracking.events.map(event=><div key={event.id}><strong><Text message={trackingStatusLabels[event.status]||'Tracking update'}/></strong><p>{new Date(event.createdAt).toLocaleString()}</p>{event.note?<p>{event.note}</p>:null}{data.capabilities.canReadProof&&event.hasProof?<TrackingProofLink shipmentId={data.shipmentId||data.id} eventId={event.id} endpoint={`${path}/proof/${event.id}`}/>:null}</div>)}</section>:null}
   {issued?<section className="stack permission-note"><h4><Text message="Save this link and code"/></h4><p><Text message="They are shown once. Share both privately with the intended person."/></p><label><Text message="Tracking link"/><input readOnly value={issued.link.url}/></label><button type="button" className="button secondary" onClick={()=>void copy(issued.link.url)}><Text message="Copy link"/></button><button type="button" className="button secondary" onClick={()=>{const id=trackingLinkToken(issued.link.url,process.env.NODE_ENV==='development'||process.env.NODE_ENV==='test');if(id)void copy(id);}}><Text message="Copy tracking ID"/></button><label><Text message="Tracking code"/><input readOnly value={issued.link.code}/></label><button type="button" className="button secondary" onClick={()=>void copy(issued.link.code)}><Text message="Copy code"/></button><p><Text message="Expires"/>: {new Date(issued.link.expiresAt).toLocaleString()}</p>{copied?<p role="status">{t(copied)}</p>:null}</section>:null}
   {data.capabilities.canIssueLink?<form method="post" action={`${path}/links`} className="stack" onSubmit={event=>{event.preventDefault();void change('ISSUE');}}><label htmlFor={expirySelectId}><Text message="Link expiry"/></label><select id={expirySelectId} value={days} disabled={busy||uncertain} onChange={event=>setDays(Number(event.target.value))}>{[1,7,14,30].map(day=><option key={day} value={day}>{day} {t('days')}</option>)}</select><label><input type="checkbox" checked={allowLocation} disabled={busy||uncertain} onChange={event=>setAllowLocation(event.target.checked)}/><Text message="Include approximate location when the provider has enabled it."/></label><button className="button" disabled={busy||uncertain}><Text message="Create Tracking link"/></button></form>:null}
   <section className="stack"><h4><Text message="Saved links"/></h4>{!data.links.length?<p className="meta"><Text message="No links created yet."/></p>:data.links.map(link=><div key={link.id}><p><Text message={link.revokedAt?'Revoked':'Expires'}/>: {new Date(link.revokedAt||link.expiresAt).toLocaleString()}</p>{data.capabilities.canRevokeLink&&!link.revokedAt?<button type="button" className="button secondary" disabled={busy||uncertain} onClick={()=>void change('REVOKE',link.id)}><Text message="Revoke link"/></button>:null}</div>)}</section>

   {data.workspaceId===null&&data.shipmentId&&data.capabilities.canManageTeam===true&&businesses.length?<TrackingSharing shipmentId={data.shipmentId} businesses={businesses} endpoint={`${path}/sharing`}/>:null}
   {data.capabilities.canApprove?<section className="stack"><p><Text message="Check the unloading proof before approving. Your approval completes the shipment."/></p><button className="button" disabled={busy||uncertain} onClick={()=>void change('APPROVE')}><Text message="Approve unloading"/></button></section>:null}
   {data.tracking?.review?<section className="stack"><h4><Text message="Your review"/></h4><p>{data.tracking.review.rating} / 5</p>{data.tracking.review.note?<p>{data.tracking.review.note}</p>:null}</section>:data.capabilities.canReview?<form method="post" action={`${path}/review`} className="stack" onSubmit={event=>{event.preventDefault();void change('REVIEW');}}><label htmlFor={ratingSelectId}><Text message="Rating"/></label><select id={ratingSelectId} value={rating} disabled={busy||uncertain} onChange={event=>setRating(Number(event.target.value))}>{[5,4,3,2,1].map(value=><option key={value} value={value}>{value}</option>)}</select><label><Text message="Comment (optional)"/><textarea maxLength={1000} value={reviewNote} disabled={busy||uncertain} onChange={event=>setReviewNote(event.target.value)}/></label><label><input type="checkbox" required checked={reviewTerms} disabled={busy||uncertain} onChange={event=>setReviewTerms(event.target.checked)}/><Text message="I agree to the Terms and content rules."/></label><button className="button" disabled={busy||uncertain||!reviewTerms}><Text message="Publish review"/></button></form>:null}
  </>:null}
 </section>;
}
export function CreateTrackingSession({workspaceId,onCreated,onCancel}:{workspaceId:string;onCreated?:(session:TrackingSessionView)=>void;onCancel?:()=>void}){
 const {t}=useTranslation(),lock=React.useRef(false);const [busy,setBusy]=React.useState(false),[uncertain,setUncertain]=React.useState(false),[error,setError]=React.useState('');
 async function create(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(lock.current||uncertain)return;
  const fields=new FormData(event.currentTarget);
  const placeRef=(name:string)=>String(fields.get(name)||'');
  const stop=placeRef('passingPlace');
  if(!stop&&placeRef('passingText').trim()){
   setError('Choose the stop from the search results or clear it.');
   return;
  }
  const route=[placeRef('pickupPlace'),...(stop?[stop]:[]),placeRef('deliveryPlace')].map(ref=>({placeRef:ref}));
  const parsed=trackingSessionCreate.safeParse({
   workspaceId,route,brokerReference:String(fields.get('brokerReference')||''),
   cargoDescription:fields.get('cargo'),pickupDate:fields.get('pickup')||'',deliveryDate:fields.get('delivery')||''
  });
  if(!parsed.success){setError('Check the cities, cargo and delivery date.');return;}
  lock.current=true;setBusy(true);setError('');
  try{
   const {response,data}=await browserRequest<Reply>('/api/tracking/sessions',{method:'POST',headers:{'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify(parsed.data)});
   if(!response.ok||data.ok!==true)throw Error();
   onCreated?.(trackingSessionViewSchema.parse(data.data));
  }catch{
   setUncertain(true);setError('We could not confirm the result. Check saved Tracking sessions before creating another.');
  }finally{lock.current=false;setBusy(false);}
 }
 return <form method="post" action="/api/tracking/sessions" className="stack" onSubmit={create} aria-busy={busy}>
  <h3><Text message="Create Tracking session"/></h3>
  <p className="meta"><Text message="Save the route, then choose a truck to invite."/></p>
  <fieldset disabled={busy||uncertain} className="stack">
   <label><Text message="Pickup city"/><EthiopiaPlaceInput id="session-pickup" placeRefName="pickupPlace" required/></label>
   <label><Text message="Passing through city"/><span className="meta"> <Text message="(optional)"/></span><EthiopiaPlaceInput id="session-passing" name="passingText" placeRefName="passingPlace"/></label>
   <label><Text message="Delivery city"/><EthiopiaPlaceInput id="session-delivery" placeRefName="deliveryPlace" required/></label>
   <label><Text message="Your shipment reference (optional)"/><input name="brokerReference" maxLength={80}/></label>
   <label><Text message="Cargo"/><input name="cargo" required minLength={3} maxLength={500}/></label>
   <DatePicker name="pickup" label="Expected pickup"/><DatePicker name="delivery" label="Expected delivery" required/>
   <button className="button"><Text message="Create Tracking session"/></button>
  </fieldset>
  {error?<p role="alert" className="alert error">{t(error)}</p>:null}
  {onCancel?<button type="button" className="button secondary" disabled={busy} onClick={onCancel}><Text message={uncertain?'Check saved Tracking':'Cancel'}/></button>:null}
 </form>;
}

export function TrackingShipmentLinks({shipmentId,workspaceId,businesses=[]}:{shipmentId:string;workspaceId?:string;businesses?:Business[]}){
 const [session,setSession]:[TrackingSessionView|null,(value:TrackingSessionView|null)=>void]=React.useState(null);
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[uncertain,setUncertain]=React.useState(false),lock=React.useRef(false);
 async function open(){if(lock.current||uncertain)return;lock.current=true;setBusy(true);setError('');try{const {response,data}=await browserRequest<Reply>('/api/tracking/sessions/from-shipment',{method:'POST',headers:{'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify({shipmentId,...workspaceId?{workspaceId}:{}})});if(!response.ok||data.ok!==true)throw Error();setSession(trackingSessionViewSchema.parse(data.data));}catch{setUncertain(true);setError('Could not confirm sharing setup. Refresh the shipment before trying again.');}finally{lock.current=false;setBusy(false);}}
 return session?<TrackingSessionManager key={session.id} sessionId={session.id} workspaceId={workspaceId} businesses={businesses}/>:<section className="stack"><button type="button" className="button secondary" disabled={busy||uncertain} onClick={()=>void open()}><Text message={busy?'Loading sharing…':'Share Tracking link'}/></button>{error?<p role="alert"><Text message={error}/></p>:null}</section>;
}
type SessionListProps={workspaceId?:string;canCreate?:boolean;businesses?:Business[]};

export function BusinessTrackingSessions(props:SessionListProps){
 return <SessionList key={props.workspaceId||'personal'} {...props}/>;
}

export function SessionList({workspaceId,canCreate=false,businesses=[]}:SessionListProps){
 const [sessions,setSessions]:[TrackingSessionView[]|null,(rows:TrackingSessionView[]|null)=>void]=React.useState(null);
 const [selected,setSelected]=React.useState(''),[creating,setCreating]=React.useState(false);
 const [error,setError]=React.useState(''),[loading,setLoading]=React.useState(true);
 const [page,setPage]=React.useState(1),[pageCount,setPageCount]=React.useState(1);
 const [draftReference,setDraftReference]=React.useState(''),[reference,setReference]=React.useState('');
 const requestSequence=React.useRef(0);
 const load=React.useCallback(async()=>{
  const sequence=++requestSequence.current;
  setLoading(true);
  try{
   const params=new URLSearchParams({page:String(page)});
   if(workspaceId)params.set('workspaceId',workspaceId);
   const {response,data}=reference&&workspaceId
    ?await browserRequest<Reply>('/api/tracking/sessions/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId,page,reference})})
    :await browserRequest<Reply>(`/api/tracking/sessions?${params}`,{cache:'no-store'});
   if(sequence!==requestSequence.current)return;
   if(!response.ok||data.ok!==true){
    if([401,403,404,410].includes(response.status)){setSessions(null);setSelected('');setPageCount(1);}
    throw Error();
   }
   const value=trackingSessionListSchema.parse(data.data);
   if(value.workspaceId!==(workspaceId||null))throw Error();
   setSessions(value.sessions);setPageCount(value.pageCount);setError('');
  }catch{
   if(sequence===requestSequence.current)setError('Could not load Tracking sessions. Please try again.');
  }finally{
   if(sequence===requestSequence.current)setLoading(false);
  }
 },[workspaceId,page,reference]);
 React.useEffect(()=>{void load();return()=>{requestSequence.current++;};},[load]);
 function changePage(next:number){
  requestSequence.current++;setSessions(null);setSelected('');setError('');setLoading(true);setPage(next);
 }
 function search(next:string){
  const value=next.trim();
  if(value===reference&&page===1){void load();return;}
  requestSequence.current++;setSessions(null);setSelected('');setError('');setLoading(true);setPage(1);setReference(value);
 }
 return <section className="stack">
  <h2><Text message="Tracking sessions"/></h2>
  {error?<p role="alert"><Text message={error}/></p>:null}
  {creating&&workspaceId&&canCreate?<CreateTrackingSession workspaceId={workspaceId}
   onCancel={()=>{setCreating(false);void load();}}
   onCreated={session=>{setCreating(false);setSelected(session.id);void load();}}/>:<>
   {workspaceId&&canCreate?<button className="button" onClick={()=>setCreating(true)}><Text message="Create Tracking session"/></button>:null}
   {workspaceId?<form className="stack" onSubmit={event=>{event.preventDefault();search(draftReference);}}>
    <label><Text message="Search by your shipment reference"/><input type="search" maxLength={80} value={draftReference} onChange={event=>setDraftReference(event.target.value)}/></label>
    <div className="actions"><button className="button secondary"><Text message="Search"/></button>
    {reference?<button type="button" className="button secondary" onClick={()=>{setDraftReference('');search('');}}><Text message="Clear"/></button>:null}</div>
   </form>:null}
   <button className="button secondary" disabled={loading} onClick={()=>void load()}><Text message="Refresh Tracking"/></button>
   {sessions===null&&loading?<SurfaceSkeleton label="Loading Tracking"/>:null}
   {sessions?.length===0&&!error?<p><Text message={reference?"No shipments match that reference.":"No Tracking sessions yet."}/></p>:null}
   {sessions?.map(session=><button key={session.id} type="button" className="card text-left" onClick={()=>setSelected(session.id)}>
    <strong>{session.reference}</strong>{session.brokerReference?<span>{session.brokerReference}</span>:null}<span>{session.cargoSummary}</span><Text message={session.requestExpired?'This tracking request has expired.':session.state==='PENDING_PROVIDER'?'Waiting for provider':session.state==='CANCELLED'?'Tracking cancelled':'Provider connected'}/>
   </button>)}
  </>}
  {selected?<TrackingSessionManager key={selected} sessionId={selected} workspaceId={workspaceId} businesses={businesses}/>:null}
  {pageCount>1?<div className="actions">
   <button className="button secondary" disabled={loading||page===1} onClick={()=>changePage(page-1)}><Text message="Previous"/></button>
   <button className="button secondary" disabled={loading||page>=pageCount} onClick={()=>changePage(page+1)}><Text message="Next"/></button>
  </div>:null}
 </section>;
}
