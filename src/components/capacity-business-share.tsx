'use client';
import React from 'react';
import {Building2,Search,X} from 'lucide-react';
import {Text,useTranslation} from './localization';
import type {BusinessPublicIdentity} from '@/lib/business-workspaces/contracts';
import styles from './capacity-business-share.module.css';

export function CapacityBusinessShare({vehicleId}:{vehicleId:string}){
 const {t}=useTranslation(),searchId=React.useId();
 const [query,setQuery]=React.useState(''),[results,setResults]=React.useState([] as BusinessPublicIdentity[]),[selected,setSelected]=React.useState(null as BusinessPublicIdentity|null),[loading,setLoading]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 React.useEffect(()=>{
  if(query.trim().length<2){setResults([]);setLoading(false);return;}
  const controller=new AbortController();let current=true;
  const timer=setTimeout(()=>{setLoading(true);void fetch('/api/business-workspaces/search?q='+encodeURIComponent(query.trim()),{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error?.message||t('Search is temporarily unavailable.'));if(current)setResults(data);}).catch(error=>{if(current&&!controller.signal.aborted)setError(error.message);}).finally(()=>{if(current)setLoading(false);});},300);
  return()=>{current=false;clearTimeout(timer);controller.abort();};
 },[query,t]);
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;if(!selected){setError(t('Choose a business from the results.'));return;}
  setBusy(true);setError('');
  try{const response=await fetch('/api/business-capacity-shares',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'GRANT',vehicleId,workspaceId:selected.id}),signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Error(data.error?.message||t('Could not save changes.'));location.assign('/app/network?success='+encodeURIComponent(t('Capacity access added.')));}
  catch(error){setError(error instanceof Error?error.message:t('Could not save changes.'));setBusy(false);}
 }
 return <form className={styles.form} onSubmit={save} aria-busy={busy}>
   <label htmlFor={searchId}><Text message="Search shippers or brokers"/></label><div className={styles.search}><Search aria-hidden="true"/><input id={searchId} value={query} onChange={event=>{setQuery(event.target.value);setSelected(null);setError('');}} maxLength={100} autoComplete="off" disabled={busy}/>{query?<button type="button" className="icon-button" aria-label={t('Clear search')} onClick={()=>{setQuery('');setSelected(null);setResults([]);}}><X/></button>:null}</div>
   {selected?<div className={styles.selected}><Building2 aria-hidden="true"/><div><strong>{selected.name}</strong><small>@{selected.handle}{selected.city?` · ${selected.city}`:''}</small></div></div>:<div className={styles.results} aria-live="polite">{loading?<p><Text message="Searching…"/></p>:results.map((business:BusinessPublicIdentity)=><button key={business.id} type="button" disabled={busy} onClick={()=>setSelected(business)}><Building2 aria-hidden="true"/><span><strong>{business.name}</strong><small>@{business.handle}{business.city?` · ${business.city}`:''}</small></span></button>)}{!loading&&query.trim().length>=2&&!results.length?<p><Text message="No shippers or brokers match this search."/></p>:null}</div>}
   <p className={styles.note}><Text message="Their permitted team members can view these signals."/></p>
  {error?<p role="alert" className="alert error">{error}</p>:null}
  <button className="button" disabled={busy||!selected}><Text message={busy?'Saving…':'Add access'}/></button>
 </form>;
}
export function RemoveBusinessCapacityShare({grantId,revision}:{grantId:string;revision:number}){
 const {t}=useTranslation();const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 async function remove(){if(busy)return;setBusy(true);setError('');try{const response=await fetch('/api/business-capacity-shares',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'REVOKE',grantId,revision}),signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Error(data.error?.message||t('Could not save changes.'));location.assign('/app/network?success='+encodeURIComponent(t('Capacity access removed.')));}catch(error){setError((error as Error).message);setBusy(false);}}
 return <div><button type="button" className="button danger small" disabled={busy} aria-busy={busy} onClick={()=>void remove()}><Text message="Remove"/></button>{error?<p role="alert">{error}</p>:null}</div>;
}
