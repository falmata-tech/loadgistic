'use client';
import React from 'react';
import {useRouter} from 'next/navigation';
import {Text,useTranslation} from './localization';
export function GuestSupportAssignment({id,assignee,agents}:{id:string;assignee:string|null;agents:Array<{user_id:string;name:string}>}){
 const router=useRouter(),{t}=useTranslation(),[ready,setReady]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');const pending=React.useRef(false);
 const [selection,setSelection]=React.useState(assignee||''),[expectedAssignee,setExpectedAssignee]=React.useState(assignee||''),[dirty,setDirty]=React.useState(false);
 React.useEffect(()=>{if(!dirty){setSelection(assignee||'');setExpectedAssignee(assignee||'');}},[assignee,dirty]);
 React.useEffect(()=>setReady(true),[]);
 async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(pending.current)return;const body=new FormData(event.currentTarget);pending.current=true;setBusy(true);setError('');try{const response=await fetch(`/api/admin/guest-support/${id}/assignment`,{method:'POST',body,signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error);setDirty(false);router.refresh();}catch(caught){setError(caught instanceof Error&&caught.name==='Error'?caught.message:'Could not save. Please reload to check the request before trying again.');}finally{pending.current=false;setBusy(false);}}
 return <form className="card brokerage-assignment" onSubmit={save} aria-label={t('Support assignment')}><input type="hidden" name="expectedAssignee" value={expectedAssignee}/><label><Text message="Assigned to"/><select name="assignee" value={selection} onChange={event=>{setSelection(event.target.value);setDirty(true);}} disabled={busy}><option value="">{t('Unassigned')}</option>{assignee&&!agents.some(a=>a.user_id===assignee)?<option value={assignee} disabled>{t('Current assignee')}</option>:null}{agents.map(agent=><option key={agent.user_id} value={agent.user_id}>{agent.name}</option>)}</select></label><button className="button secondary" disabled={!ready||busy}><Text message={busy?'Saving…':'Save assignment'}/></button>{error?<p className="form-error" role="alert">{t(error)}</p>:null}</form>;
}
