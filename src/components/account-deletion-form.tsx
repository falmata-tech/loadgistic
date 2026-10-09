'use client';
import React from 'react';
import {Text,useTranslation} from './localization';
type Receipt={status:string;reviewDueAt:string;retentionReason:string|null};
export function AccountDeletionForm({initialEmail='',showHeading=true}:{initialEmail?:string;showHeading?:boolean}){
 const {t}=useTranslation();
 const [email,setEmail]=React.useState(initialEmail),[code,setCode]=React.useState(''),[handoff,setHandoff]=React.useState(''),[confirmed,setConfirmed]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[status,setStatus]=React.useState(null as Receipt|null),[receipt,setReceipt]=React.useState('');const lock=React.useRef(false);
 React.useEffect(()=>{try{const saved=JSON.parse(window.sessionStorage.getItem('loadgistic.deletion.receipt.v1')||'null');if(saved&&typeof saved.receipt==='string'&&saved.request&&['REQUESTED','HELD','ERASING','COMPLETED'].includes(saved.request.status)){setReceipt(saved.receipt);setStatus(saved.request);}}catch{/* No saved receipt; verification remains available. */}},[]);
 async function send(step:'REQUEST'|'CONFIRM'|'STATUS'){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   const body=step==='STATUS'?{step,receipt}:step==='REQUEST'?{step,email}:{step,email,handoff,code,confirm:'DELETE'};
   const response=await fetch('/api/account/deletion',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await response.json();if(!response.ok)throw Error(data.error?.message||'The request could not be confirmed. Try again.');
   if(step==='REQUEST')setHandoff(data.handoff);else{setStatus(data.request);if(data.receipt)setReceipt(data.receipt);setCode('');try{window.sessionStorage.setItem('loadgistic.deletion.receipt.v1',JSON.stringify({receipt:data.receipt||receipt,request:data.request}));}catch{setError('Your request is recorded, but this browser could not save its receipt.');}}
  }catch(caught){setError(caught instanceof Error?caught.message:'The request could not be confirmed. Try again.');}finally{lock.current=false;setBusy(false);}
 }
 return <section className="card stack" aria-busy={busy}>{showHeading?<h2><Text message="Delete account and data"/></h2>:null}
 <p><Text message="Request deletion of your Loadgistic account, public profile, contacts, uploaded documents and account-linked messages. Deletion is permanent."/></p>
 <p className="meta"><Text message="We review requests within 30 days. Unfinished shipments or a company transfer may need to be resolved first; we explain any delay. Essential shipment and security event records may remain without your account contact details."/></p>
 {status?<div className="stack" role="status"><h3><Text message={status.status==='COMPLETED'?'Deletion completed':status.status==='ERASING'?'Deletion in progress':status.status==='HELD'?'Action needed before deletion':'Deletion request received'}/></h3>{status.retentionReason?<p>{t(status.retentionReason)}</p>:<p><Text message="Your request is recorded. You do not need to submit it again."/></p>}<button className="button secondary" disabled={busy} onClick={()=>void send('STATUS')}><Text message="Check request status"/></button><button className="button secondary" disabled={busy} onClick={()=>{setStatus(null);setReceipt('');setHandoff('');setConfirmed(false);window.sessionStorage.removeItem('loadgistic.deletion.receipt.v1');}}><Text message="Verify another account"/></button></div>:<form className="stack" onSubmit={event=>{event.preventDefault();void send(handoff?'CONFIRM':'REQUEST');}}>
 <label><Text message="Account email"/><input type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy||Boolean(handoff)} onChange={event=>setEmail(event.target.value)}/></label>
 {handoff?<><p><Text message="If this email has a Loadgistic account, its verification code has been sent. Enter it to confirm your deletion request."/></p><label><Text message="Email verification code"/><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={event=>setCode(event.target.value)}/></label><label><input type="checkbox" required checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/><Text message="I understand deletion is permanent and want to delete this account and its data."/></label></>:null}
 <button className="button danger" disabled={busy||(Boolean(handoff)&&!confirmed)}><Text message={busy?'Please wait…':handoff?'Submit deletion request':'Verify email to request deletion'}/></button>
 {handoff?<button type="button" className="button secondary" disabled={busy} onClick={()=>{setHandoff('');setCode('');setConfirmed(false);}}><Text message="Use another email or resend"/></button>:null}
 </form>}
 {error?<p role="alert" className="alert error">{error}</p>:null}
 </section>;
}
