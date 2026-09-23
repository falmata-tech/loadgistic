'use client';

import React from 'react';
import {useRouter} from 'next/navigation';
import {MailPlus} from 'lucide-react';

export function TrackingPartyForm({shipmentId}:{shipmentId:string}){
  const router=useRouter();
  const busy=React.useRef(false);
  const [saving,setSaving]=React.useState(false);
  const [result,setResult]=React.useState({} as {error?:string;success?:string});
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy.current)return;
    const form=event.currentTarget,fields=new FormData(form);
    busy.current=true;setSaving(true);setResult({});
    try{
      // The hidden command is named "action", which shadows form.action in browsers.
      const response=await fetch(`/api/provider-shipments/${shipmentId}/recipients`,{method:'POST',body:fields,headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});
      const data=await response.json();
      if(!response.ok||!data.ok){setResult({error:data.error||'Tracking access could not be saved.'});return;}
      form.reset();setResult({success:'Tracking party added. Access email is queued.'});
      router.refresh();
    }catch{
      setResult({error:'We could not confirm the save. Refresh Tracking and check the party list before trying again.'});
    }finally{busy.current=false;setSaving(false);}
  }
  return <form action={`/api/provider-shipments/${shipmentId}/recipients`} method="post" onSubmit={submit} className="stack" aria-label="Add tracking party" aria-busy={saving}>
    <input type="hidden" name="action" value="ADD"/>
    <div className="form-group"><label htmlFor="tracking-party-email"><MailPlus aria-hidden="true"/>Add tracking party</label><input id="tracking-party-email" name="email" type="email" autoComplete="email" maxLength={254} required readOnly={saving}/></div>
    {result.error?<p role="alert" className="alert error">{result.error}</p>:null}
    {result.success?<p role="status" className="alert success">{result.success}</p>:null}
    <button className="button secondary" disabled={saving}><MailPlus aria-hidden="true"/>{saving?'Adding party…':'Add and email access'}</button>
  </form>;
}
