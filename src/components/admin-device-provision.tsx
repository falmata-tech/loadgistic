'use client';
import React from 'react';
import {Text,FeedbackText,useTranslation} from './localization';
type Owner={id:string;name:string;kind:'ORGANIZATION'|'PROVIDER_PROFILE'};
export function AdminDeviceProvision({owners,gatewayId}:{owners:Owner[];gatewayId:string}){
 const {t}=useTranslation(),lock=React.useRef(false),[busy,setBusy]=React.useState(false),[feedback,setFeedback]=React.useState(''),[failed,setFailed]=React.useState(false);
 async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setFeedback('');const form=new FormData(event.currentTarget),owner=owners.find(item=>item.id===form.get('owner'));
  try{if(!owner)throw Error('Choose an active transport provider.');const body={...(owner.kind==='ORGANIZATION'?{ownerOrganizationId:owner.id}:{ownerProviderProfileId:owner.id}),gatewayId:String(form.get('gatewayId')),gatewayDeviceId:Number(form.get('gatewayDeviceId')),imei:String(form.get('imei')),protocol:String(form.get('protocol')),protocolDeviceId:String(form.get('protocolDeviceId')),label:String(form.get('label'))};const response=await fetch('/api/admin/telematics/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const value=await response.json();if(!response.ok||!value.ok)throw Error(value.error?.message||'Could not confirm this change. Refresh before retrying.');setFailed(false);setFeedback('GPS device added to the provider’s fleet.');}
  catch(error){setFailed(true);setFeedback(error instanceof Error&&error.name==='Error'?error.message:'Could not confirm this change. Refresh before retrying.');}finally{lock.current=false;setBusy(false);}
 }
 return <form onSubmit={save} className="stack" aria-busy={busy}><div className="form-grid"><label><Text message="Transport Provider"/><select name="owner" required defaultValue=""><option value="" disabled><Text message="Choose"/></option>{owners.map(owner=><option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
  <label><Text message="Device name"/><input name="label" minLength={2} maxLength={100} required/></label><label>IMEI<input name="imei" inputMode="numeric" pattern="[0-9]{15}" minLength={15} maxLength={15} required/></label>
  <label><Text message="Device protocol"/><select name="protocol" defaultValue="gt06"><option value="gt06">GT06</option><option value="teltonika">Teltonika</option><option value="h02">H02</option><option value="jt808">JT808</option></select></label>
  <label><Text message="Tracker identifier"/><input name="protocolDeviceId" pattern="[A-Za-z0-9_-]{5,40}" required/></label><label><Text message="Gateway device number"/><input name="gatewayDeviceId" type="number" min={1} step={1} required/></label>
  {gatewayId?<input name="gatewayId" type="hidden" value={gatewayId}/>:<label><Text message="Gateway reference"/><input name="gatewayId" required pattern="[a-fA-F0-9-]{36}"/></label>}</div>
  <p className="meta"><Text message="Register the tracker on the GPS server first. Loadgistic checks its identity before linking it."/></p>
  {feedback?<p role={failed?'alert':'status'} className={failed?'alert error':'alert success'}><FeedbackText message={feedback} fallback={failed?"Could not confirm this change. Refresh before retrying.":"Your request was completed."}/></p>:null}
  <div><button className="button" disabled={busy||!owners.length}><Text message={busy?'Saving…':'Add GPS device'}/></button></div></form>;
}
