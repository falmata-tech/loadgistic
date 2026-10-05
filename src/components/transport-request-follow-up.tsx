'use client';
import React from 'react';
import {useRouter} from 'next/navigation';
import {Save} from 'lucide-react';
import {Text,useTranslation} from './localization';
import type {TransportRequest} from '@/lib/transport-requests';
export function TransportRequestFollowUp({request,canReopen=true}:{request:Pick<TransportRequest,'id'|'status'|'version'|'follow_up_note'>;canReopen?:boolean}){
  const router=useRouter(),{t}=useTranslation();const [busy,setBusy]=React.useState(false),[feedback,setFeedback]=React.useState(''),[error,setError]=React.useState(false),[ready,setReady]=React.useState(false);const pending=React.useRef(false);
  const [version,setVersion]=React.useState(request.version),[status,setStatus]=React.useState(request.status),[note,setNote]=React.useState(request.follow_up_note),[dirty,setDirty]=React.useState(false);
  React.useEffect(()=>{if(!dirty){setVersion(request.version);setStatus(request.status);setNote(request.follow_up_note);}},[request.version,request.status,request.follow_up_note,dirty]);
  React.useEffect(()=>setReady(true),[]);
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending.current)return;const form=new FormData(event.currentTarget);pending.current=true;setBusy(true);setFeedback('');
    try{
      const response=await fetch(`/api/admin/transport-requests/${request.id}`,{method:'POST',body:form,signal:AbortSignal.timeout(15000)}),result=await response.json();
      if(!response.ok||!result.ok)throw new Error(result.error||'Could not save. Please try again.');
      setDirty(false);setError(false);setFeedback('Follow-up saved.');router.refresh();
    }catch(caught){setError(true);setFeedback(caught instanceof Error&&caught.name==='Error'?caught.message:'Could not save. Please reload to check the request before trying again.');}
    finally{pending.current=false;setBusy(false);}
  }
  return <form className="transport-follow-up" onSubmit={save} aria-label={t('Request follow-up')}>
    <input type="hidden" name="version" value={version}/>
    <label><Text message="Status"/><select name="status" value={status} onChange={event=>{setStatus(event.target.value as TransportRequest['status']);setDirty(true);}} disabled={!ready||busy}><option value="NEW" disabled={!canReopen&&request.status==='CLOSED'}>{t('New')}</option><option value="CONTACTED" disabled={!canReopen&&request.status==='CLOSED'}>{t('Contacted')}</option><option value="CLOSED">{t('Resolved')}</option></select></label>
    <label className="transport-follow-up-note"><Text message="Follow-up note"/><textarea name="note" rows={2} maxLength={1000} value={note} onChange={event=>{setNote(event.target.value);setDirty(true);}} disabled={!ready||busy} placeholder={t('Who you called or referred the request to')}/></label>
    <button className="button small" disabled={!ready||busy}><Save aria-hidden="true"/><Text message={busy?'Saving…':'Save follow-up'}/></button>
    {feedback?<p role={error?'alert':'status'} className={error?'form-error':'form-success'}>{t(feedback)}</p>:null}
  </form>;
}
