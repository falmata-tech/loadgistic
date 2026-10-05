"use client";


import {browserRequest} from '@/lib/browser-request';
import {Text,useTranslation} from '@/components/localization';
import React from 'react';
import {ArrowLeft,KeyRound,LoaderCircle,Mail,PackageSearch} from 'lucide-react';

type Stage='DETAILS'|'CODE';

export function TrackingUnlockForm({localInbox=null}:{localInbox?:string|null}) {
  const [ready,setReady]=React.useState(false);React.useEffect(()=>setReady(true),[]);
  const {t}=useTranslation();const pending=React.useRef(false);
  const [stage,setStage]=React.useState('DETAILS' as Stage);
  const [email,setEmail]=React.useState('');
  const [challengeId,setChallengeId]=React.useState('');
  const [code,setCode]=React.useState('');
  const [message,setMessage]=React.useState('');
  const [localTestCode,setLocalTestCode]=React.useState('');
  const [error,setError]=React.useState('');
  const [submitting,setSubmitting]=React.useState(false);

  async function requestCode(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending.current)return;pending.current=true;setSubmitting(true);setError('');setMessage('');setLocalTestCode('');
    const form=new FormData();form.set('email',email);
    try{
      const {response,data:result}=await browserRequest<{error?:string;challengeId?:string;message?:string;localTestCode?:string;verificationRequired?:boolean;path:string}>('/api/tracking/otp',{method:'POST',body:form,headers:{accept:'application/json'}});
      if(!response.ok)throw new Error(result.error||'The code could not be sent.');
      setChallengeId(result.challengeId||'');setMessage(result.message||'Check your email for a one-time code.');
      setLocalTestCode(result.localTestCode||'');setCode(result.localTestCode||'');setStage('CODE');
    }catch(problem){setError(problem instanceof Error&&problem.name==='Error'&&problem.message!=='REQUEST_TIMEOUT'?problem.message:'The connection took too long. Try again.');}
    finally{pending.current=false;setSubmitting(false);}
  }

  async function verifyCode(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending.current)return;pending.current=true;setSubmitting(true);setError('');
    const form=new FormData();
    form.set('email',email);
    form.set('challengeId',challengeId);form.set('code',code);
    try{
      const {response,data:result}=await browserRequest<{error?:string;challengeId?:string;message?:string;localTestCode?:string;verificationRequired?:boolean;path:string}>('/api/tracking/unlock',{method:'POST',body:form,headers:{accept:'application/json'}});
      if(!response.ok)throw new Error(result.error||'The code could not be verified.');
      window.location.assign(result.path);
    }catch(problem){setError(problem instanceof Error&&problem.name==='Error'&&problem.message!=='REQUEST_TIMEOUT'?problem.message:'The connection took too long. Try again.');setSubmitting(false);}
    finally{pending.current=false;}
  }

  function changeDetails(){
    setStage('DETAILS');setCode('');setChallengeId('');setMessage('');setLocalTestCode('');setError('');
  }

  return <div className="stack" style={{width:'min(100%, 420px)',textAlign:'left'}}>
    {stage==='DETAILS'?<form className="stack auth-primary-form" onSubmit={requestCode}>
      <div className="form-group"><label htmlFor="tracking-email"><Mail aria-hidden="true"/><Text message="Email"/></label><input id="tracking-email" name="email" type="email" autoComplete="email" value={email} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>setEmail(event.target.value)} required readOnly={submitting}/></div>

      <button className="button auth-primary-action icon-button-label" disabled={!ready||submitting} aria-live="polite">{submitting?<LoaderCircle className="tracking-submit-spinner" aria-hidden="true"/>:<Mail aria-hidden="true"/>}{submitting?<Text message="Sending code…"/>:<Text message="Email me a code"/>}</button>
    </form>:<form className="stack auth-primary-form" onSubmit={verifyCode}>
      <div className="permission-note"><Mail aria-hidden="true"/><div><strong>{email}</strong></div></div>
      {localTestCode?<p className="shared-capacity-local-code" role="status"><small><Text message="Local test code"/></small><strong>{localTestCode}</strong><span><Text message="This appears only because email delivery is not configured locally."/></span></p>:null}
      <div className="form-group"><label htmlFor="tracking-otp"><KeyRound aria-hidden="true"/><Text message="6-digit email code"/></label><input id="tracking-otp" name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} value={code} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} required readOnly={submitting}/></div>
      <button className="button auth-primary-action icon-button-label" disabled={!ready||submitting}>{submitting?<LoaderCircle className="tracking-submit-spinner" aria-hidden="true"/>:<PackageSearch aria-hidden="true"/>}{submitting?<Text message="Opening tracking…"/>:<Text message="Open tracking"/>}</button>
      <button type="button" className="text-button" onClick={changeDetails} disabled={!ready||submitting}><ArrowLeft aria-hidden="true"/><Text message="Change email"/></button>
    </form>}
    {stage==='CODE'?<form onSubmit={requestCode}><button className="text-button" disabled={!ready||submitting}><Text message="Send a new code"/></button></form>:null}
    {message?<p className="form-success" role="status">{t(message)}</p>:null}
    {error?<p className="form-error" role="alert">{t(error)}</p>:null}
    {localInbox?<a className="auth-inline-link" href={localInbox} target="_blank" rel="noreferrer"><Text message="Local testing: open the email inbox "/><span aria-hidden="true">↗</span></a>:null}
  </div>;
}
