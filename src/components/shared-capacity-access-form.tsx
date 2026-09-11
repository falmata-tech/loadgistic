'use client';

import {KeyRound,Mail} from 'lucide-react';
import React from 'react';
import {useRouter} from 'next/navigation';

export function SharedCapacityAccessForm({localInbox=null}:{localInbox?:string|null}){
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
    event.preventDefault();setBusy(true);setError('');setMessage('');setNotice('');setLocalTestCode('');
    const form=new FormData();form.set('email',email);
    try{
      const response=await fetch('/api/shared-capacity/otp',{method:'POST',body:form,headers:{accept:'application/json'}});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'The code could not be sent.');
      if(!result.verificationRequired){
        setStage('EMAIL');setCode('');setNotice(result.message||'No transporter has shared capacity with this email yet.');return;
      }
      setStage('VERIFY');setMessage(result.message);setLocalTestCode(result.localTestCode||'');if(result.localTestCode)setCode(result.localTestCode);
    }catch(caught){setError(caught instanceof Error?caught.message:'The code could not be sent.');}
    finally{setBusy(false);}
  }

  async function verifyCode(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError('');
    const form=new FormData();form.set('email',email);form.set('code',code);
    try{
      const response=await fetch('/api/shared-capacity/access',{method:'POST',body:form,headers:{accept:'application/json'}});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'The code could not be verified.');
      router.refresh();
    }catch(caught){setError(caught instanceof Error?caught.message:'The code could not be verified.');}
    finally{setBusy(false);}
  }

  return <div className="card shared-capacity-access-card"><Mail aria-hidden="true"/><div><h2>Open your private capacity map</h2><p>Use an email a transporter approved. One code opens every active truck shared with that email—no account or dashboard.</p></div>
    {stage==='EMAIL'?<form onSubmit={requestCode}><label>Email<input name="email" type="email" autoComplete="email" value={email} onChange={event=>{setEmail(event.target.value);setNotice('');}} required/></label><button className="button" disabled={busy}><Mail aria-hidden="true"/>{busy?'Checking…':'Continue with email'}</button></form>
      :<form onSubmit={verifyCode}><label>Email<input name="email" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required/></label>{localTestCode?<p className="shared-capacity-local-code" role="status"><small>Local test code</small><strong>{localTestCode}</strong><span>This appears only because email delivery is not configured locally.</span></p>:null}<label>One-time code<input name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} required/></label><button className="button" disabled={busy}><KeyRound aria-hidden="true"/>{busy?'Checking…':'Open private capacity'}</button><button type="button" className="text-button" onClick={()=>{setStage('EMAIL');setCode('');setMessage('');setLocalTestCode('');}}>Use another email</button>{localInbox?<LocalInboxLink url={localInbox}/>:null}</form>}
    {message?<p className="form-success" role="status">{message}</p>:null}{notice?<p className="form-notice" role="status">{notice}</p>:null}{error?<p className="form-error" role="alert">{error}</p>:null}
  </div>;
}

function LocalInboxLink({url}:{url:string}){
  return <a className="auth-inline-link" href={url} target="_blank" rel="noreferrer" aria-label="Open the local inbox in a new tab">Local testing: open the local inbox <span aria-hidden="true">↗</span></a>;
}
