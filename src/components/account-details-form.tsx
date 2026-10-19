'use client';


import {Localized,Text} from '@/components/localization';
import React from 'react';
import {useRouter} from 'next/navigation';
import {Save} from 'lucide-react';

export function AccountDetailsForm({name,phone,firstName,lastName='',publicCallbackPhone='',canEditPublicContact=false}:{name:string;phone:string|null;firstName?:string;lastName?:string;publicCallbackPhone?:string;canEditPublicContact?:boolean}){
  const router=useRouter();
  const busy=React.useRef(false);
  const callbackDirty=React.useRef(false);
  const [saving,setSaving]=React.useState(false);
  const [result,setResult]=React.useState({} as {error?:string;success?:string});
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy.current)return;
    const form=event.currentTarget;const fields=new FormData(form);
    const callback=String(fields.get('publicCallbackPhone')??'');
    busy.current=true;setSaving(true);setResult({});
    try{
      const response=await fetch('/api/account/details',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({firstName:fields.get('firstName'),lastName:fields.get('lastName'),phone:fields.get('phone'),...(canEditPublicContact&&callbackDirty.current?{publicCallbackPhone:callback}:{})})});
      const data=await response.json();
      if(!response.ok||!data.ok){setResult({error:typeof data.error==='string'?data.error:'Account details could not be saved. Please try again.'});return;}
      callbackDirty.current=false;
      const marker=form.elements.namedItem('publicCallbackChanged');if(marker instanceof HTMLInputElement)marker.value='0';
      setResult({success:'Account details saved.'});router.refresh();
    }catch{setResult({error:'We could not confirm the save. Check your connection and try again.'});}
    finally{busy.current=false;setSaving(false);}
  }
  return <Localized as="form" copy={["aria-label"]} action="/api/account/details" method="post" onSubmit={submit} className="stack" aria-label="Account details" aria-busy={saving}>
    <div className="form-group"><label htmlFor="account-first-name"><Text message="First name"/></label><input id="account-first-name" name="firstName" autoComplete="given-name" defaultValue={firstName??name.trim().split(/\s+/)[0]??''} minLength={1} maxLength={100} required aria-describedby={canEditPublicContact?'account-name-help':undefined}/>{canEditPublicContact?<p id="account-name-help" className="meta"><Text message="Your first name is shown publicly."/></p>:null}</div>
    <div className="form-group"><label htmlFor="account-last-name"><Text message="Last / father name"/></label><input id="account-last-name" name="lastName" autoComplete="family-name" defaultValue={lastName} maxLength={100} aria-describedby="account-last-name-help"/><p id="account-last-name-help" className="meta"><Text message="Private. Your last or father name is not shown publicly."/></p></div>
    {!lastName&&name!==firstName?<p className="meta"><Text message="Private full name"/>: {name}</p>:null}
    <div className="form-group"><label htmlFor="account-phone"><Text message="Account phone "/><span className="meta"><Text message="(optional)"/></span></label><input id="account-phone" name="phone" type="tel" autoComplete="tel" defaultValue={phone||''} maxLength={32} aria-describedby="account-phone-help"/><p id="account-phone-help" className="meta"><Text message="Private. Public callback numbers are edited separately."/></p></div>
    {canEditPublicContact?<div className="form-group"><input type="hidden" name="publicCallbackChanged" defaultValue="0"/><label htmlFor="account-public-phone"><Text message="Public contact phone"/></label><input id="account-public-phone" name="publicCallbackPhone" type="tel" defaultValue={publicCallbackPhone} maxLength={32} aria-describedby="account-public-phone-help" onChange={(event:{currentTarget:HTMLInputElement})=>{callbackDirty.current=true;const marker=event.currentTarget.form?.elements.namedItem('publicCallbackChanged');if(marker instanceof HTMLInputElement)marker.value='1';}}/><p id="account-public-phone-help" className="meta"><Text message="Leave blank to hide your public phone."/></p></div>:null}
    {result.error?<p role="alert" className="alert error">{result.error}</p>:null}
    {result.success?<p role="status" className="alert success">{result.success}</p>:null}
    <button type="submit" className="button icon-button-label" disabled={saving}><Save aria-hidden="true"/>{saving?<Text message="Saving…"/>:<Text message="Save account details"/>}</button>
  </Localized>;
}
