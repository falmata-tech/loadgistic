'use client';
import React from 'react';
import {Building2,CheckCircle2,Minus,Search,X} from 'lucide-react';
import type {BusinessDirectoryPage,BusinessDocumentBadge,DirectoryBusiness} from '@/lib/business-directory/contracts';
import {businessDocumentLabel,businessDocumentState,parseBusinessDirectoryPage} from '@/lib/business-directory/client-contract.js';
import {Localized,Text,FeedbackText} from './localization';
import styles from './business-directory.module.css';

export function BusinessDocumentBadges({documents}:{documents:BusinessDocumentBadge[]}){
 return <ul className={styles.badges}>{documents.map(badge=><li key={badge.type}><span><Text message={businessDocumentLabel(badge.type)}/></span><strong data-reviewed={badge.verified}>{badge.verified?<CheckCircle2 aria-hidden="true"/>:<Minus aria-hidden="true"/>}<Text message={businessDocumentState(badge)}/></strong></li>)}</ul>;
}
export function BusinessDirectory({active=true}:{active?:boolean}){
 const [query,setQuery]=React.useState(''),[page,setPage]=React.useState(1),[result,setResult]=React.useState(null as BusinessDirectoryPage|null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[retry,setRetry]=React.useState(0);
 React.useEffect(()=>{
  if(!active)return;
  const controller=new AbortController();let current=true;
  setResult(null);setError('');setBusy(true);
  const timer=setTimeout(()=>{void (async()=>{const timeout=setTimeout(()=>controller.abort(),20000);try{
   const response=await fetch(`/api/business-directory?${new URLSearchParams({q:query.trim(),page:String(page)})}`,{cache:'no-store',signal:controller.signal});
   const data:unknown=await response.json();if(!response.ok)throw new Error('Could not load business details. Please try again.');
   const parsed=parseBusinessDirectoryPage(data);if(parsed.page!==page&&!(page>1&&parsed.page===1))throw new Error('Could not load business details. Please try again.');
   if(current)setResult(parsed);
  }catch(problem){if(current)setError(problem instanceof Error&&!controller.signal.aborted?problem.message:'Could not load business details. Please try again.');}finally{clearTimeout(timeout);if(current)setBusy(false);}})();},300);
  return()=>{current=false;clearTimeout(timer);controller.abort();};
 },[active,query,page,retry]);
 return <section className={styles.directory} aria-busy={busy}>
  <div className={styles.search}><label><Text message="Find businesses"/><Localized as="input" copy={['placeholder']} value={query} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>{setQuery(event.target.value);setPage(1);setResult(null);}} placeholder="Business name, manager or @handle" autoComplete="off" maxLength={120}/></label>{query?<Localized as="button" copy={['aria-label']} className="button secondary icon-button" aria-label="Clear search" onClick={()=>{setQuery('');setPage(1);setResult(null);}}><X aria-hidden="true"/></Localized>:<Search aria-hidden="true"/>}</div>
  {error?<div role="alert"><p><FeedbackText message={error} fallback="Could not load business details. Please try again."/></p><button className="button secondary small" onClick={()=>setRetry(retry+1)}><Text message="Retry"/></button></div>:null}
  <div role="status" aria-live="polite">{busy?<span className="meta"><Text message="Searching…"/></span>:result&&!result.items.length?<p className="meta"><Text message="No businesses match this search."/></p>:null}</div>
  {result?<><div className={styles.grid}>{result.items.map((business:DirectoryBusiness)=>{const reviewed=business.documents.filter(document=>document.verified);return <article className={styles.business} key={business.id}><header><Building2 aria-hidden="true"/><div><h2>{business.name}</h2><span className={styles.handle}>@{business.handle}</span></div></header>{business.managerName?<p><Text message="Account manager"/> · {business.managerName}</p>:null}{business.city?<p>{business.city}</p>:null}{reviewed.length?<div className={styles.reviewed}><strong><Text message="Reviewed documents"/></strong><BusinessDocumentBadges documents={reviewed}/></div>:null}</article>;})}</div>{result.pageCount>1?<Localized as="nav" copy={['aria-label']} className={styles.pager} aria-label="Business results pages"><button className="button secondary small" disabled={result.page===1||busy} onClick={()=>setPage(result.page-1)}><Text message="Previous"/></button><span>{result.page} / {result.pageCount}</span><button className="button secondary small" disabled={result.page>=result.pageCount||busy} onClick={()=>setPage(result.page+1)}><Text message="Next"/></button></Localized>:null}</>:null}
 </section>;
}
export function NetworkViews({children}:{children:React.ReactNode}){
 const [view,setView]=React.useState('SHARED');
 return <><Localized as="nav" copy={['aria-label']} className={styles.tabs} role="tablist" aria-label="Network"><button type="button" role="tab" aria-selected={view==='SHARED'} onClick={()=>setView('SHARED')}><Text message="Shared with"/></button><button type="button" role="tab" aria-selected={view==='DIRECTORY'} onClick={()=>setView('DIRECTORY')}><Text message="Find businesses"/></button></Localized><div hidden={view!=='SHARED'}>{children}</div>{view==='DIRECTORY'?<BusinessDirectory/>:null}</>;
}
