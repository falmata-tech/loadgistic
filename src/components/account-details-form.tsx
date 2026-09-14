'use client';

import React from 'react';
import {useRouter} from 'next/navigation';
import {Save} from 'lucide-react';

export function AccountDetailsForm({name,phone}:{name:string;phone:string|null}){
  const router=useRouter();
  const busy=React.useRef(false);
  const [saving,setSaving]=React.useState(false);
  const [result,setResult]=React.useState({} as {error?:string;success?:string});
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy.current)return;
    const form=event.currentTarget;const fields=new FormData(form);
    busy.current=true;setSaving(true);setResult({});
    try{
      const response=await fetch('/api/account/details',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:fields.get('name'),phone:fields.get('phone')})});
      const data=await response.json();
      if(!response.ok||!data.ok){setResult({error:typeof data.error==='string'?data.error:'Account details could not be saved. Please try again.'});return;}
      setResult({success:'Account details saved.'});router.refresh();
    }catch{setResult({error:'We could not confirm the save. Check your connection and try again.'});}
    finally{busy.current=false;setSaving(false);}
  }
  return <form action="/api/account/details" method="post" onSubmit={submit} className="stack" aria-label="Account details" aria-busy={saving}>
    <div className="form-group"><label htmlFor="account-name">Your name</label><input id="account-name" name="name" autoComplete="name" defaultValue={name} minLength={2} maxLength={100} required aria-describedby="account-name-help"/><p id="account-name-help" className="meta">Your name can appear with Driver activity and Support messages.</p></div>
    <div className="form-group"><label htmlFor="account-phone">Account phone <span className="meta">(optional)</span></label><input id="account-phone" name="phone" type="tel" autoComplete="tel" defaultValue={phone||''} maxLength={32} aria-describedby="account-phone-help"/><p id="account-phone-help" className="meta">Private. Public callback numbers are edited separately.</p></div>
    {result.error?<p role="alert" className="alert error">{result.error}</p>:null}
    {result.success?<p role="status" className="alert success">{result.success}</p>:null}
    <button type="submit" className="button icon-button-label" disabled={saving}><Save aria-hidden="true"/>{saving?'Saving…':'Save account details'}</button>
  </form>;
}
