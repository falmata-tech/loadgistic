'use client';

import {Localized,Text} from '@/components/localization';
import React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {accountClosureBlockers} from '@/lib/account-security-copy';

type Operation={action:'EMAIL';email:string}|{action:'DEACTIVATE';confirm:'DEACTIVATE'};
export function AccountSecurityControls({blockers,available,pendingEmail}:{blockers:string[];available:boolean;pendingEmail?:string}){
 const router=useRouter();const lock=React.useRef(false);const [busy,setBusy]=React.useState(false);
 const [operation,setOperation]:[Operation|null,(value:Operation|null)=>void]=React.useState(pendingEmail?{action:'EMAIL',email:pendingEmail}:null);const [stage,setStage]=React.useState(pendingEmail?'EMAIL_PENDING':'REQUEST');
 const [message,setMessage]=React.useState('');const [error,setError]=React.useState('');const [currentBlockers,setBlockers]:[string[],(value:string[])=>void]=React.useState(blockers);
 async function send(step:string,input:Operation,code?:string){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch(`/api/account/security/${step}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,...(code?{code}:{})})});
   const result=await response.json();if(!response.ok||!result.ok){if(Array.isArray(result.blockers))setBlockers(result.blockers);setError(result.error||'The account action could not be confirmed.');return;}
   setOperation(input);setStage(result.stage);setMessage(result.message||'');
   if(result.stage==='DEACTIVATED'){router.replace(result.next);router.refresh();}
   if(result.stage==='COMPLETE'){setOperation(null);router.refresh();}
  }catch{setError('The account action could not be confirmed. Check your connection and account before trying again.');}
  finally{lock.current=false;setBusy(false);}
 }
 function begin(event:React.FormEvent<HTMLFormElement>,action:'EMAIL'|'DEACTIVATE'){
  event.preventDefault();const form=new FormData(event.currentTarget);
  const input:Operation=action==='EMAIL'?{action,email:String(form.get('email')||'')}:{action,confirm:'DEACTIVATE'};
  void send('request',input);
 }
 return <Localized as="section" copy={["aria-label"]} className="card stack" aria-label="Account security" aria-busy={busy}><h2><Text message="Account security"/></h2>
  {!available?<p role="status"><Text message="Account security changes are temporarily unavailable."/></p>:<>
  {stage==='CURRENT_EMAIL'&&operation?<form className="stack" onSubmit={event=>{event.preventDefault();void send('confirm',operation,String(new FormData(event.currentTarget).get('code')||''));}}>
   <p><Text message="Verify your current login email before "/>{operation.action==='EMAIL'?<Text message="changing your email"/>:<Text message="deactivating access"/>}.</p>
   <label><Text message="Current email code"/><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required/></label>
   <button className="button" disabled={busy}>{busy?<Text message="Checking…"/>:<Text message="Verify current email"/>}</button>
   <button type="button" className="button secondary" disabled={busy} onClick={()=>{setStage('REQUEST');setOperation(null);setError('');}}><Text message="Start again"/></button>
  </form>:stage==='EMAIL_PENDING'&&operation?<div className="stack"><p><Text message="Open the confirmation links in your current and new email inboxes. Keep this browser available until the change is complete."/></p><button className="button secondary" disabled={busy} onClick={()=>void send('check',operation)}>{busy?<Text message="Checking…"/>:<Text message="Check email change"/>}</button><button className="button secondary" disabled={busy} onClick={()=>{setStage('REQUEST');setOperation(null);setError('');}}><Text message="Request a fresh verification"/></button></div>:<>
  <details><summary><Text message="Change login email"/></summary><form className="stack" onSubmit={event=>begin(event,'EMAIL')}>
   <label><Text message="New login email"/><input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
   <p className="meta"><Text message="Verify your current email first. Your public business contacts stay separate."/></p><button className="button secondary" disabled={busy}>{busy?<Text message="Sending…"/>:<Text message="Send verification code"/>}</button>
  </form></details>
  <details><summary><Text message="Deactivate account"/></summary><p><Text message="Your access and public business visibility end. Shipment, Support, audit and file history are retained. Contact Support if you later need the account reopened."/></p>
   {currentBlockers.length?<ul>{currentBlockers.map(key=>{const blocker=accountClosureBlockers[key as keyof typeof accountClosureBlockers];return blocker?<li key={key}><Link href={blocker.href}>{blocker.text}</Link></li>:<li key={key}><Text message="Resolve outstanding account work with Support."/></li>;})}</ul>:<form className="stack" onSubmit={event=>begin(event,'DEACTIVATE')}>
    <label><input type="checkbox" required/><Text message="I want to deactivate this account and retain its history."/></label>
    <button className="button danger" disabled={busy}>{busy?<Text message="Sending…"/>:<Text message="Verify email to deactivate"/>}</button>
   </form>}
  </details></>}
  </>}
  {message?<p role="status">{message}</p>:null}{error?<p role="alert" className="alert error">{error}</p>:null}
 </Localized>;
}
