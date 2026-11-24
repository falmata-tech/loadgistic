'use client';
import React from 'react';
import {KeyRound,LoaderCircle} from 'lucide-react';
import Link from 'next/link';
import {browserRequest} from '@/lib/browser-request';
import {trackingSessionAccessSchema,type TrackingSessionAccess} from '@/lib/tracking-sessions/contracts';
import {guestTrackingSession,trackingAccessCode,trackingLinkToken} from '@/lib/tracking-sessions/client';
import {Text,useTranslation} from './localization';
import {TrackingSessionGuest} from './tracking-session-guest';
import {TrackingEntryMap} from './tracking-entry-map';

export function TrackingUnlockForm({linkToken,resumeSessionId,resumeExpiresAt}:{linkToken?:string;resumeSessionId?:string;resumeExpiresAt?:string}){
 const {t}=useTranslation(),lock=React.useRef(false);
 const [access,setAccess]:[TrackingSessionAccess|null,(value:TrackingSessionAccess|null)=>void]=React.useState(null);
 const [resume,setResume]=React.useState(Boolean(resumeSessionId));
 const [ready,setReady]=React.useState(false);
 React.useEffect(()=>setReady(true),[]);
 const [id,setId]=React.useState(''),[code,setCode]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 async function open(event:React.FormEvent){
  event.preventDefault();if(!ready||lock.current)return;
  const token=trackingLinkToken(linkToken||id,process.env.NODE_ENV==='development'||process.env.NODE_ENV==='test'),secret=trackingAccessCode(code);
  if(!token){setError('Enter the tracking ID you received.');return;}
  if(!secret){setError('Enter the 8-character tracking code.');return;}
  lock.current=true;setBusy(true);setError('');
  try{
   const {response,data}=await browserRequest<{ok?:boolean;data?:unknown}>('/api/tracking/access',{method:'POST',headers:{'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify({linkToken:token,code:secret})});
   if(!response.ok||data.ok!==true)throw Error('This Tracking link or code is unavailable. Check both and try again.');
   const opened=trackingSessionAccessSchema.parse(data.data);guestTrackingSession(opened.session);
   if(!linkToken)window.history.replaceState(null,'',`/track/${token}`);
   setId('');setCode('');setAccess(opened);setBusy(false);
  }catch{setError(linkToken?'This Tracking link or code is unavailable. Check both and try again.':'This tracking ID or code is unavailable. Check both and try again.');setBusy(false);}
  finally{lock.current=false;}
 }
 if(access||resume)return <main className="public-app-page tracking-public-workspace"><div className="container tracking-public-container"><TrackingSessionGuest initial={access||undefined} sessionId={resumeSessionId} expiresAt={resumeExpiresAt} onClosed={()=>{setAccess(null);setResume(false);}}/></div></main>;
 return <main className="public-app-page tracking-entry-workspace"><div className="tracking-entry-stage"><TrackingEntryMap/><div className="container tracking-unlock-shell public-form-container"><section className="tracking-unlock-panel">
  <div className="tracking-unlock-icon"><KeyRound aria-hidden="true"/></div>
  <div><h1 className="page-title"><Text message="Follow your shipment"/></h1><p className="page-subtitle"><Text message={linkToken?'Enter the code you received with this link.':'Enter the tracking ID and code you received.'}/></p></div>
  <form method="post" action="/api/tracking/access" className="stack auth-primary-form" onSubmit={open} aria-busy={busy}>
  {!linkToken?<label className="form-group"><Text message="Tracking ID"/><input name="trackingId" autoComplete="off" autoCapitalize="none" spellCheck={false} value={id} onChange={event=>setId(event.target.value)} maxLength={2048} required disabled={!ready} readOnly={busy}/></label>:null}
  <label className="form-group"><Text message="Tracking code"/><input name="trackingCode" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={code} onChange={event=>setCode(event.target.value.toUpperCase())} maxLength={9} placeholder="XXXX-XXXX" required disabled={!ready} readOnly={busy} aria-describedby="tracking-code-help"/></label>
  <p id="tracking-code-help" className="meta"><Text message={linkToken?'The link and code open this shipment only.':'Tracking access is for one shipment.'}/></p>
  <button className="button auth-primary-action icon-button-label" disabled={!ready||busy}>{busy?<LoaderCircle className="tracking-submit-spinner" aria-hidden="true"/>:<KeyRound aria-hidden="true"/>}<Text message={busy?'Opening tracking…':'Open tracking'}/></button>
  {error?<p className="form-error" role="alert">{t(error)}</p>:null}
  </form>
  {!linkToken?<Link href="/login?from=tracking" className="tracking-account-link"><Text message="Sign in to view your shipments"/></Link>:null}
 </section></div></div></main>;
}
