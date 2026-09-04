"use client";

import React from 'react';
import {ArrowLeft,KeyRound,LoaderCircle,Mail,PackageSearch} from 'lucide-react';

type Stage='DETAILS'|'CODE';

export function TrackingUnlockForm({localInbox=null}:{localInbox?:string|null}) {
  const [stage,setStage]=React.useState('DETAILS' as Stage);
  const [email,setEmail]=React.useState('');
  const [trackingCode,setTrackingCode]=React.useState('');
  const [challengeId,setChallengeId]=React.useState('');
  const [code,setCode]=React.useState('');
  const [message,setMessage]=React.useState('');
  const [localTestCode,setLocalTestCode]=React.useState('');
  const [error,setError]=React.useState('');
  const [submitting,setSubmitting]=React.useState(false);

  async function requestCode(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setSubmitting(true);setError('');setMessage('');setLocalTestCode('');
    const form=new FormData();form.set('email',email);form.set('trackingCode',trackingCode);
    try{
      const response=await fetch('/api/tracking/otp',{method:'POST',body:form,headers:{accept:'application/json'}});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'The code could not be sent.');
      setChallengeId(result.challengeId||'');setMessage(result.message||'Check your email for a one-time code.');
      setLocalTestCode(result.localTestCode||'');setCode(result.localTestCode||'');setStage('CODE');
    }catch(problem){setError(problem instanceof Error?problem.message:'The code could not be sent.');}
    finally{setSubmitting(false);}
  }

  async function verifyCode(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setSubmitting(true);setError('');
    const form=new FormData();
    form.set('email',email);form.set('trackingCode',trackingCode);
    form.set('challengeId',challengeId);form.set('code',code);
    try{
      const response=await fetch('/api/tracking/unlock',{method:'POST',body:form,headers:{accept:'application/json'}});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'The code could not be verified.');
      window.location.assign(result.path);
    }catch(problem){setError(problem instanceof Error?problem.message:'The code could not be verified.');setSubmitting(false);}
  }

  function changeDetails(){
    setStage('DETAILS');setCode('');setChallengeId('');setMessage('');setLocalTestCode('');setError('');
  }

  return <div className="stack" style={{width:'min(100%, 420px)',textAlign:'left'}}>
    {stage==='DETAILS'?<form className="stack auth-primary-form" onSubmit={requestCode}>
      <div className="form-group"><label htmlFor="tracking-email"><Mail aria-hidden="true"/>Approved email</label><input id="tracking-email" name="email" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required readOnly={submitting}/></div>
      <div className="form-group"><label htmlFor="tracking-code"><KeyRound aria-hidden="true"/>Tracking code</label><input id="tracking-code" name="trackingCode" autoComplete="off" autoCapitalize="characters" inputMode="text" placeholder="LG-XXXX-XXXX-XXXX-XXXX" maxLength={22} spellCheck={false} value={trackingCode} onChange={event=>setTrackingCode(event.target.value.toUpperCase())} required readOnly={submitting}/></div>
      <button className="button auth-primary-action icon-button-label" disabled={submitting} aria-live="polite">{submitting?<LoaderCircle className="tracking-submit-spinner" aria-hidden="true"/>:<Mail aria-hidden="true"/>}{submitting?'Sending code…':'Email me a code'}</button>
    </form>:<form className="stack auth-primary-form" onSubmit={verifyCode}>
      <div className="permission-note"><Mail aria-hidden="true"/><div><strong>{email}</strong><span>{trackingCode}</span></div></div>
      {localTestCode?<p className="shared-capacity-local-code" role="status"><small>Local test code</small><strong>{localTestCode}</strong><span>This appears only because email delivery is not configured locally.</span></p>:null}
      <div className="form-group"><label htmlFor="tracking-otp"><KeyRound aria-hidden="true"/>One-time code</label><input id="tracking-otp" name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} required readOnly={submitting}/></div>
      <button className="button auth-primary-action icon-button-label" disabled={submitting}>{submitting?<LoaderCircle className="tracking-submit-spinner" aria-hidden="true"/>:<PackageSearch aria-hidden="true"/>}{submitting?'Opening tracking…':'Open tracking'}</button>
      <button type="button" className="text-button" onClick={changeDetails} disabled={submitting}><ArrowLeft aria-hidden="true"/>Change email or Tracking code</button>
    </form>}
    {message?<p className="form-success" role="status">{message}</p>:null}
    {error?<p className="form-error" role="alert">{error}</p>:null}
    {localInbox?<a className="auth-inline-link" href={localInbox} target="_blank" rel="noreferrer">Local testing: open the email inbox <span aria-hidden="true">↗</span></a>:null}
  </div>;
}
