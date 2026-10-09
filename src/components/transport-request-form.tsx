'use client';
import React from 'react';
import {ArrowRight,MapPin,Phone,UserRound} from 'lucide-react';
import {Text,Localized,useTranslation} from './localization';

import {TransportConversation} from './transport-conversation';
import type {TransportChatSnapshot} from '@/lib/transport-chat-contract';

export function TransportRequestForm({active=true}:{active?:boolean}){
  const {t}=useTranslation();const [busy,setBusy]=React.useState(false),[saved,setSaved]=React.useState(false),[error,setError]=React.useState('');
  const restored=React.useRef(false);
  const pending=React.useRef(false),attempt=React.useRef({signature:'',id:'',secret:''});
  const [restoring,setRestoring]=React.useState(true),[restoreError,setRestoreError]=React.useState(false),[expired,setExpired]=React.useState(false),[initial,setInitial]=React.useState(undefined as TransportChatSnapshot|undefined);
  React.useEffect(()=>{
    if(!active||saved||restored.current)return;let disposed=false;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    setRestoring(true);setRestoreError(false);
    fetch('/api/transport-requests/conversation',{cache:'no-store',signal:controller.signal}).then(async response=>{if(response.status===403){if(!disposed){restored.current=true;setExpired(true);}return;}if(!response.ok)throw new Error();const data=await response.json();if(!disposed){restored.current=true;if(data){setInitial(data);setSaved(true);}}}).catch(()=>{if(!disposed)setRestoreError(true);}).finally(()=>{clearTimeout(timeout);if(!disposed)setRestoring(false);});
    return()=>{disposed=true;controller.abort();clearTimeout(timeout);};
  },[active,saved]);
  async function newRequest(){
    try{const response=await fetch('/api/transport-requests/conversation',{method:'DELETE',signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error();setInitial(undefined);setSaved(false);setRestoreError(false);setExpired(false);attempt.current={signature:'',id:'',secret:''};}
    catch{setError('We could not confirm your request. Please try again.');}
  }
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending.current)return;
    const form=new FormData(event.currentTarget);
    const input={origin:String(form.get('origin')||''),destination:String(form.get('destination')||''),name:String(form.get('name')||''),phone:String(form.get('phone')||'')};
    const signature=JSON.stringify(input);
    if(attempt.current.signature!==signature)attempt.current={signature,id:crypto.randomUUID(),secret:Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')};
    pending.current=true;setBusy(true);setError('');
    try{
      const response=await fetch('/api/transport-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,requestId:attempt.current.id,chatSecret:attempt.current.secret}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();if(!response.ok||result.ok!==true)throw new Error(typeof result.error==='string'?result.error:'We could not confirm your request. Please try again.');
      setSaved(true);
    }catch(caught){setError(caught instanceof Error&&caught.name==='Error'?caught.message:'We could not confirm your request. Please try again.');}
    finally{pending.current=false;setBusy(false);}
  }
  if(saved)return <>{error?<p className="form-error" role="alert">{t(error)}</p>:null}<TransportConversation endpoint="/api/transport-requests/conversation" active={active} initial={initial} onNewRequest={newRequest}/></>;
  if(restoring)return <p role="status"><Text message="Opening conversation…"/></p>;
  if(expired)return <section className="transport-chat-recovery"><p><Text message="This conversation is no longer available in this browser."/></p><p><Text message="Our team still has your request and phone number for follow-up."/></p><button className="button secondary" onClick={newRequest}><Text message="Request another route"/></button>{error?<p role="alert">{t(error)}</p>:null}</section>;
  if(restoreError)return <section role="status"><p><Text message="We could not reopen your conversation. Close this window and try again."/></p></section>;
  return <form className="transport-request-form" aria-label={t('Arrange transport')} onSubmit={submit}>
    <div className="transport-request-intro"><p><Text message="Tell us what you need to move and where. Our team will help find a truck and arrange the trip."/></p></div>
    <div className="transport-request-fields">
      <label><span><MapPin aria-hidden="true"/><Text message="From"/></span><Localized as="input" copy={['placeholder']} name="origin" placeholder="Pickup city or area" maxLength={160} required disabled={busy}/></label>
      <label><span><MapPin aria-hidden="true"/><Text message="To"/></span><Localized as="input" copy={['placeholder']} name="destination" placeholder="Destination city or area" maxLength={160} required disabled={busy}/></label>
      <label><span><UserRound aria-hidden="true"/><Text message="Name"/></span><input name="name" autoComplete="name" maxLength={100} required disabled={busy}/></label>
      <label><span><Phone aria-hidden="true"/><Text message="Phone"/></span><input name="phone" type="tel" autoComplete="tel" maxLength={30} required disabled={busy} aria-describedby="transport-phone-help"/></label>
    </div>
    <p id="transport-phone-help" className="transport-request-privacy"><Text message="We’ll reply here, or call if you leave the chat."/></p>
    {error?<p className="form-error" role="alert">{t(error)}</p>:null}
    <button className="button transport-request-submit" disabled={busy}><Text message={busy?'Opening chat…':'Start chat'}/><ArrowRight aria-hidden="true"/></button>
    <p className="transport-request-reassurance"><Text message="No account needed. We’ll agree the service and fee with you first."/></p>
  </form>;
}
