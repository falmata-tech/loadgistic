'use client';
import React from 'react';
import {useRouter} from 'next/navigation';
import {browserRequest} from '@/lib/browser-request';
import {Text} from './localization';

export function TrackingPartnerForm({shipmentId}:{shipmentId:string}){
 const router=useRouter(),lock=React.useRef(false);
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[saved,setSaved]=React.useState(false);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(lock.current)return;
  const email=String(new FormData(event.currentTarget).get('email')||'').trim();
  lock.current=true;setBusy(true);setError('');
  try{
   const {response,data}=await browserRequest<{ok?:boolean;data?:boolean;error?:{message?:string}}>('/api/tracking/sessions/partner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipmentId,email})});
   if(!response.ok||data.ok!==true||data.data!==true){
    setError(data.error?.message||'Refresh the shipment and check its partner.');router.refresh();return;
   }
   setSaved(true);router.refresh();
  }catch{setError('Refresh the shipment and check its partner.');router.refresh();}
  finally{setBusy(false);lock.current=false;}
 }
 return <section className="card"><h3><Text message="Shipment partner"/></h3>{saved?<p role="status"><Text message="Partner added"/></p>:
  <form className="stack" onSubmit={submit}>
   <p><Text message="Choose one account to manage customer tracking and approve unloading."/></p>
   <label><Text message="Shipper or broker account email"/><input name="email" type="email" required maxLength={254} disabled={busy}/></label>
   {error?<p role="alert"><Text message={error}/></p>:null}
   <button className="button" disabled={busy}><Text message={busy?'Saving…':'Add partner'}/></button>
  </form>}</section>;
}
