'use client';
import React from 'react';
import {FileCheck2,Plus,X} from 'lucide-react';
import type {BusinessDocumentsView,BusinessDocumentType,BusinessDocumentRequest} from '@/lib/business-directory/contracts';
import {businessDocumentLabel,parseBusinessDocuments} from '@/lib/business-directory/client-contract.js';
import {BusinessDocumentBadges} from './business-directory';
import {DatePicker} from './date-picker';
import {Localized,Text,FeedbackText} from './localization';
import styles from './business-directory.module.css';

export function BusinessDocuments({workspaceId,canManage}:{workspaceId:string;canManage:boolean}){
 const [data,setData]=React.useState(null as BusinessDocumentsView|null),[open,setOpen]=React.useState(false),[submitting,setSubmitting]=React.useState(false),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[committed,setCommitted]=React.useState(false),[notice,setNotice]=React.useState('');
 const current=React.useRef(workspaceId);current.current=workspaceId;
 const dialog=React.useRef(null as HTMLDialogElement|null),lock=React.useRef(false);
 async function refresh(signal?:AbortSignal){
  const response=await fetch(`/api/business-workspaces/${workspaceId}/documents`,{cache:'no-store',signal:signal||AbortSignal.timeout(20000)}),value:unknown=await response.json();
  if(!response.ok){if(response.status===401||response.status===403)setData(null);throw new Error('Could not load workspace details. Please try again.');}
  const next=parseBusinessDocuments(value,workspaceId,canManage);if(!signal?.aborted&&current.current===workspaceId)setData(next);
 }
 React.useEffect(()=>{const controller=new AbortController();setData(null);setError('');void refresh(controller.signal).catch(problem=>{if(!controller.signal.aborted)setError(problem.message);});return()=>controller.abort();},[workspaceId,canManage]);
 React.useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();return()=>{if(dialog.current?.open)dialog.current.close();};},[open]);
 async function reload(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await refresh();if(committed){setSubmitting(false);setCommitted(false);setNotice('Document submitted for review.');}}catch(problem){setError((problem as Error).message);}finally{lock.current=false;setBusy(false);}}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current||committed||!data?.canManage)return;lock.current=true;setBusy(true);setError('');setNotice('');
  try{
   const form=new FormData(event.currentTarget),file=form.get('file');
   if(!(file instanceof File)||!file.size||file.size>4*1024*1024||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw new Error('Choose a supported file smaller than 4 MB.');
   const body=new FormData();body.set('command',JSON.stringify({verificationType:String(form.get('verificationType')||''),documentName:String(form.get('documentName')||'').trim(),expiresOn:String(form.get('expiresOn')||'')}));body.set('file',file);
   const response=await fetch(`/api/business-workspaces/${workspaceId}/documents`,{method:'POST',credentials:'same-origin',body,signal:AbortSignal.timeout(60000)}),value:unknown=await response.json();
   if(!response.ok){const row=value&&typeof value==='object'?value as {error?:{message?:string}}:null;throw new Error(row?.error?.message||'Could not confirm submission. Refresh documents before trying again.');}
   setCommitted(true);await refresh();setCommitted(false);setSubmitting(false);setNotice('Document submitted for review.');
  }catch(problem){setError((problem as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 function close(){if(!busy&&!committed){setOpen(false);setSubmitting(false);setError('');setNotice('');}}
 return <section className={styles.documentCard}>
  <div className={styles.heading}><h3><Text message="Documents"/></h3>{canManage&&data?<button type="button" className="button secondary small" onClick={()=>setOpen(true)}><FileCheck2 aria-hidden="true"/><Text message="Manage documents"/></button>:null}</div>
  {data?<><BusinessDocumentBadges documents={data.documents}/>{canManage?<p className="meta"><Text message="Review is optional. Transport Providers can find and share Capacity with your account without documents. Approved documents add trust badges. Fees are paid offline."/></p>:null}<button type="button" className="button secondary small" disabled={busy} onClick={()=>void reload()}><Text message="Refresh documents"/></button></>:null}
  {error&&!open?<p role="alert"><FeedbackText message={error} fallback="Could not load workspace details. Please try again."/></p>:null}{!data?<button type="button" className="button secondary small" disabled={busy} onClick={()=>void reload()}><Text message="Refresh documents"/></button>:null}
  {open&&canManage?<dialog ref={dialog} className={styles.dialog} aria-labelledby="business-documents-title" onCancel={event=>{event.preventDefault();close();}}><div className={styles.heading}><h2 id="business-documents-title"><Text message="Shipper / broker documents"/></h2><Localized as="button" copy={['aria-label']} type="button" className="button secondary icon-button" aria-label="Close" disabled={busy||committed} onClick={close}><X aria-hidden="true"/></Localized></div>
   <div className={styles.body}><p className="meta"><Text message="Documents are private and reviewed by Loadgistic administrators."/></p><p className="meta"><Text message="Review is optional. Transport Providers can find and share Capacity with your account without documents. Approved documents add trust badges. Fees are paid offline."/></p>{!submitting&&!committed?<button type="button" className="button secondary small" disabled={busy} onClick={()=>void reload()}><Text message="Refresh documents"/></button>:null}{notice?<p role="status" className={styles.feedback}><Text message={notice}/></p>:null}{error?<p role="alert"><FeedbackText message={error} fallback="Could not load workspace details. Please try again."/></p>:null}
   {committed?<><p><Text message="Your change was saved. Reload to see the latest details."/></p><button className="button secondary" disabled={busy} onClick={()=>void reload()}><Text message="Reload saved change"/></button></>:submitting?<form onSubmit={event=>void submit(event)} className={styles.body}><label><Text message="Document type"/><select name="verificationType" required disabled={busy}>{data?.subjects[0]?.allowedTypes.map((type:BusinessDocumentType)=><option key={type} value={type}><Text message={businessDocumentLabel(type)}/></option>)}</select></label><label><Text message="Document name"/><input name="documentName" required maxLength={150} disabled={busy}/></label><label><Text message="Expires on (optional)"/><DatePicker name="expiresOn" min={new Date().toISOString().slice(0,10)} disabled={busy}/></label><label><Text message="Choose file"/><input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" required disabled={busy}/></label><p className="meta"><Text message="JPG, PNG, WebP or PDF"/> · <Text message="Up to 4 MB"/></p><div className={styles.actions}><button type="submit" className="button" disabled={busy}><Text message={busy?'Saving…':'Send for review'}/></button><button type="button" className="button secondary" disabled={busy} onClick={()=>setSubmitting(false)}><Text message="Cancel"/></button></div></form>:data?.subjects[0]?.allowedTypes.length?<button type="button" className="button" onClick={()=>setSubmitting(true)}><Plus aria-hidden="true"/><Text message="Submit a document"/></button>:<p className="meta"><Text message="No documents to submit"/></p>}
   {!submitting&&!committed?<div className={styles.history}><h3><Text message="Request history"/></h3>{data?.requests.length?data.requests.map((request:BusinessDocumentRequest)=><article key={request.id} className={styles.request}><h4>{request.name}</h4><p><Text message={businessDocumentLabel(request.type)}/> · <Text message={request.stale?'Account details changed':request.status==='PENDING'?'Awaiting review':request.status==='APPROVED'?'Loadgistic reviewed':request.status==='MORE_INFO'?'More information requested':'Not approved'}/></p>{request.note?<p>{request.note}</p>:null}{request.hasFile?<a className="button secondary small" href={`/api/files/verification/${request.id}`} target="_blank" rel="noreferrer"><Text message="Open private document"/></a>:null}</article>):<p className="meta"><Text message="No submitted documents"/></p>}</div>:null}
   </div></dialog>:null}
 </section>;
}
