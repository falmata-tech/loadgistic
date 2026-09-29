'use client';
import React from 'react';
import {useRouter} from 'next/navigation';
import {Text,useTranslation} from './localization';
export function TransportRequestAssignment({id,version,assignee,agents,admin,closed}:{id:string;version:number;assignee:string|null;agents:Array<{id:string;name:string}>;admin:boolean;closed:boolean}){
 const router=useRouter(),{t}=useTranslation();const [ready,setReady]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');const pending=React.useRef(false);
 const [selection,setSelection]=React.useState(assignee||''),[expectedVersion,setExpectedVersion]=React.useState(version),[dirty,setDirty]=React.useState(false);
 React.useEffect(()=>{if(!dirty){setSelection(assignee||'');setExpectedVersion(version);}},[assignee,version,dirty]);
 React.useEffect(()=>setReady(true),[]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending.current)return;const body=new FormData(event.currentTarget);pending.current=true;setBusy(true);setError('');
  try{const response=await fetch(`/api/admin/transport-requests/${id}`,{method:'POST',body,signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Could not save. Please try again.');setDirty(false);router.refresh();}
  catch(caught){setError(caught instanceof Error&&caught.name==='Error'?caught.message:'Could not save. Please reload to check the request before trying again.');}
  finally{pending.current=false;setBusy(false);}
 }
 if(!admin&&(assignee||closed))return null;
 return <form className="brokerage-assignment" onSubmit={submit} aria-label={t('Request assignment')}>
  <input type="hidden" name="version" value={expectedVersion}/><input type="hidden" name="action" value={admin?'assign':'claim'}/>
  {admin?<label><Text message="Assigned to"/><select name="assignee" value={selection} onChange={event=>{setSelection(event.target.value);setDirty(true);}} disabled={!ready||busy}><option value="">{t('Unassigned')}</option>{assignee&&!agents.some(a=>a.id===assignee)?<option value={assignee} disabled>{t('Current assignee')}</option>:null}{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>:<p><Text message="Claim this request to see contact details and follow up."/></p>}
  <button className="button secondary" disabled={!ready||busy}><Text message={busy?'Saving…':admin?'Save assignment':'Claim request'}/></button>
  {error?<p role="alert" className="form-error">{t(error)}</p>:null}
 </form>;
}
