'use client';


import {browserRequest} from '@/lib/browser-request';
import {Text,Localized,useTranslation} from '@/components/localization';
import {KeyRound,Mail} from 'lucide-react';
import React from 'react';
import {useRouter} from 'next/navigation';

export function SharedCapacityAccessForm({localInbox=null}:{localInbox?:string|null}){
  const {t}=useTranslation();const pending=React.useRef(false);
  const router=useRouter();
  const [email,setEmail]=React.useState('');
  const [code,setCode]=React.useState('');
  const [stage,setStage]=React.useState('EMAIL' as 'EMAIL'|'VERIFY');
  const [message,setMessage]=React.useState('');
  const [notice,setNotice]=React.useState('');
  const [localTestCode,setLocalTestCode]=React.useState('');
  const [error,setError]=React.useState('');
  const [busy,setBusy]=React.useState(false);

  async function requestCode(event:React.FormEvent){
    event.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');setMessage('');setNotice('');setLocalTestCode('');
    const form=new FormData();form.set('email',email);
    try{
      const {response,data:result}=await browserRequest<{error?:string;challengeId?:string;message?:string;localTestCode?:string;verificationRequired?:boolean;path:string}>('/api/shared-capacity/otp',{method:'POST',body:form,headers:{accept:'application/json'}});
      if(!response.ok)throw new Error(result.error||'The code could not be sent.');
      if(!result.verificationRequired){
        setStage('EMAIL');setCode('');setNotice(result.message||'No transporter has shared capacity with this email yet.');return;
      }
      setStage('VERIFY');setMessage(result.message||'Check your email for a one-time code.');setLocalTestCode(result.localTestCode||'');if(result.localTestCode)setCode(result.localTestCode);
    }catch(caught){setError(caught instanceof Error&&caught.name==='Error'&&caught.message!=='REQUEST_TIMEOUT'?caught.message:'The connection took too long. Try again.');}
    finally{pending.current=false;setBusy(false);}
  }

  async function verifyCode(event:React.FormEvent){
    event.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');
    const form=new FormData();form.set('email',email);form.set('code',code);
    try{
      const {response,data:result}=await browserRequest<{error?:string;challengeId?:string;message?:string;localTestCode?:string;verificationRequired?:boolean;path:string}>('/api/shared-capacity/access',{method:'POST',body:form,headers:{accept:'application/json'}});
      if(!response.ok)throw new Error(result.error||'The code could not be verified.');
      router.refresh();
    }catch(caught){setError(caught instanceof Error&&caught.name==='Error'&&caught.message!=='REQUEST_TIMEOUT'?caught.message:'The connection took too long. Try again.');}
    finally{pending.current=false;setBusy(false);}
  }

  return <div className="card shared-capacity-access-card"><Mail aria-hidden="true"/><div><h2><Text message="Trucks shared with you"/></h2><p><Text message="Enter the email a transporter shared with. Verify it with a code to see their capacity, routes and availability. No account needed."/></p></div>
    {stage==='EMAIL'?<form onSubmit={requestCode}><label><Text message="Email"/><input name="email" type="email" autoComplete="email" value={email} readOnly={busy} onChange={event=>{setEmail(event.target.value);setNotice('');}} required/></label><button className="button" disabled={busy}><Mail aria-hidden="true"/>{busy?<Text message="Checking…"/>:<Text message="Continue with email"/>}</button></form>
      :<form onSubmit={verifyCode}><label><Text message="Email"/><input name="email" type="email" autoComplete="email" value={email} readOnly={busy} onChange={event=>setEmail(event.target.value)} required/></label>{localTestCode?<p className="shared-capacity-local-code" role="status"><small><Text message="Local test code"/></small><strong>{localTestCode}</strong><span><Text message="This appears only because email delivery is not configured locally."/></span></p>:null}<label><Text message="6-digit email code"/><input name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} value={code} readOnly={busy} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} required/></label><button className="button" disabled={busy}><KeyRound aria-hidden="true"/>{busy?<Text message="Checking…"/>:<Text message="View shared signals"/>}</button><button type="button" className="text-button" disabled={busy} onClick={()=>{setStage('EMAIL');setCode('');setMessage('');setLocalTestCode('');}}><Text message="Use another email"/></button>{localInbox?<LocalInboxLink url={localInbox}/>:null}</form>}
    {message?<p className="form-success" role="status">{t(message)}</p>:null}{notice?<p className="form-notice" role="status">{t(notice)}</p>:null}{error?<p className="form-error" role="alert">{t(error)}</p>:null}
  </div>;
}

function LocalInboxLink({url}:{url:string}){
  return <Localized as="a" copy={["aria-label"]} className="auth-inline-link" href={url} target="_blank" rel="noreferrer" aria-label="Open the local inbox in a new tab"><Text message="Local testing: open the local inbox "/><span aria-hidden="true">↗</span></Localized>;
}
