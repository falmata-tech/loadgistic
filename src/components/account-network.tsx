'use client';
import React from 'react';
import Link from 'next/link';
import {Building2,Check,MapPinned,Search,Truck,UserRound,X} from 'lucide-react';
import {Localized,Text} from './localization';
import type {AccountConnection,AccountDirectoryPage,DirectoryAccount} from '@/lib/account-directory';
import styles from './business-directory.module.css';

type View='FIND'|'CONNECTIONS'|'VEHICLES';
const kinds:Record<DirectoryAccount['kind'],string>={ORGANIZATION:'Transport Provider',PROVIDER_PROFILE:'Transport Provider',BUSINESS:'Shipper / broker',DRIVER:'Fleet driver'};
const statusLabels:Record<NonNullable<DirectoryAccount['statusBadge']>,string>={TRANSPORT_PROVIDER:'Transport Provider',FLEET_PROVIDER:'Fleet provider',OWNER_OPERATED:'Owner-operated',LICENSED_OPERATOR:'Licence holder',SELF_MANAGED:'Self-managed',ACCOUNT_MANAGED:'Account-managed',FLEET_DRIVER:'Fleet driver'};
function accountLabel(account:DirectoryAccount){return kinds[account.kind];}
function responseError(value:unknown){
 if(value&&typeof value==='object'&&'error' in value){const error=(value as {error?:{message?:unknown}}).error;if(typeof error?.message==='string')return error.message;}
 return 'Could not load connections. Try again.';
}
export function AccountNetwork({children,canShareVehicles,initialView='FIND'}:{children?:React.ReactNode;canShareVehicles:boolean;initialView?:View}){
 const [view,setView]=React.useState(initialView),[query,setQuery]=React.useState(''),[page,setPage]=React.useState(1),
  [results,setResults]=React.useState(null as AccountDirectoryPage|null),[connections,setConnections]=React.useState([] as AccountConnection[]),
  [busy,setBusy]=React.useState(false),[saving,setSaving]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[version,setVersion]=React.useState(0),[confirmId,setConfirmId]=React.useState('');
 const lock=React.useRef(false);
 React.useEffect(()=>{
  if(view==='VEHICLES')return;
  const controller=new AbortController();let current=true;
  const timer=setTimeout(()=>{void(async()=>{
   if(current){setBusy(true);setError('');}
   try{
    const url=view==='FIND'?`/api/account-directory?${new URLSearchParams({q:query.trim(),page:String(page)})}`:'/api/account-connections';
    const response=await fetch(url,{cache:'no-store',signal:controller.signal});const value=await response.json();
    if(!response.ok)throw Error(responseError(value));
    if(current){if(view==='FIND')setResults(value as AccountDirectoryPage);else setConnections((value as {items:AccountConnection[]}).items);}
   }catch(problem){if(current&&!controller.signal.aborted)setError(problem instanceof Error?problem.message:'Could not load connections. Try again.');}
   finally{if(current)setBusy(false);}
  })();},view==='FIND'?250:0);
  return()=>{current=false;clearTimeout(timer);controller.abort();};
 },[view,query,page,version]);
 async function act(method:'POST'|'PATCH',body:Record<string,string>){
  if(lock.current)return;lock.current=true;setSaving(true);setError('');setNotice('');
  try{const response=await fetch('/api/account-connections',{method,cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const value=await response.json();if(!response.ok)throw Error(responseError(value));
   setNotice(method==='POST'?'Request sent. Vehicle access begins only after it is shared.':body.decision==='ACCEPT'?'Connection accepted. Vehicle access is shared separately.':body.decision==='REVOKE'?'Connection removed. Its Network vehicle shares are no longer visible.':'Request updated.');setConfirmId('');
   setVersion((value:number)=>value+1);
  }catch(problem){setError(problem instanceof Error?problem.message:'Could not save the request. Try again.');}
  finally{setSaving(false);lock.current=false;}
 }
 const active=connections.filter((item:AccountConnection)=>['PENDING','ACCEPTED'].includes(item.status));
 const history=connections.filter((item:AccountConnection)=>!['PENDING','ACCEPTED'].includes(item.status));
 return <div className={styles.directory}>
  <Localized as="nav" copy={['aria-label']} className={styles.tabs} role="tablist" aria-label="Network views">
   {([['FIND','Find accounts',Search],['CONNECTIONS','Connections',Check],...(canShareVehicles?[['VEHICLES','Vehicle sharing',Truck] as const]:[])] as const).map(([key,label,Icon])=><button key={key} type="button" role="tab" aria-selected={view===key} onClick={()=>{setView(key);setError('');setNotice('');}}><Icon aria-hidden="true"/><Text message={label}/></button>)}
  </Localized>
  {notice?<p role="status" className={styles.feedback}><Text message={notice}/></p>:null}
  {error?<div role="alert" className={styles.feedback}><p><Text message={error}/></p><button className="button secondary small" onClick={()=>setVersion((value:number)=>value+1)}><Text message="Retry"/></button></div>:null}
  {view==='FIND'?<section className={styles.directory} aria-busy={busy}>
   <div className={styles.search}><label><Text message="Find transport accounts"/><Localized as="input" copy={['placeholder']} value={query} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>{setQuery(event.target.value);setPage(1);}} placeholder="Account name, first name or @handle" autoComplete="off" maxLength={120}/></label>{query?<Localized as="button" copy={['aria-label']} className="button secondary icon-button" aria-label="Clear search" onClick={()=>{setQuery('');setPage(1);}}><X aria-hidden="true"/></Localized>:<Search aria-hidden="true"/>}</div>
   <div role="status" aria-live="polite">{busy?<span className="meta"><Text message="Searching…"/></span>:results&&!results.items.length?<p className="meta"><Text message="No accounts match this search."/></p>:null}</div>
   {results?<><div className={styles.grid}>{results.items.map((account:DirectoryAccount)=><article className={styles.business} key={`${account.kind}:${account.id}`}><header>{account.kind==='BUSINESS'?<Building2 aria-hidden="true"/>:account.kind==='DRIVER'?<UserRound aria-hidden="true"/>:<Truck aria-hidden="true"/>}<div><span className={styles.handle}><Text message={accountLabel(account)}/></span><h2>{account.name}</h2>{account.handle?<span className={styles.handle}>@{account.handle}</span>:null}</div></header>{account.statusBadge&&account.statusBadge!=='TRANSPORT_PROVIDER'&&account.statusBadge!=='FLEET_DRIVER'?<span className={styles.statusBadge}><Text message={statusLabels[account.statusBadge]}/></span>:null}{account.managerName?<p><Text message="Account manager"/> · {account.managerName}</p>:null}{account.city?<p>{account.city}</p>:null}{account.networkSize!==null?<p><Text message="Vehicles in network"/> · {account.networkSize}</p>:null}<div className={styles.actions}>{account.handle&&account.kind!=='BUSINESS'?<Link className="button secondary small" href={`/providers/${encodeURIComponent(account.handle)}`}><Text message="View profile"/></Link>:null}{account.connectionStatus?<button type="button" className="button secondary small" onClick={()=>setView('CONNECTIONS')}><Text message={account.connectionStatus==='ACCEPTED'?'Connected':'View request'}/></button>:<button type="button" className="button small" disabled={saving} onClick={()=>{void act('POST',{kind:account.kind,targetId:account.id});}}><Text message="Request connection"/></button>}</div></article>)}</div>{results.pageCount>1?<nav className={styles.pager}><button className="button secondary small" disabled={busy||page===1} onClick={()=>setPage(page-1)}><Text message="Previous"/></button><span>{results.page} / {results.pageCount}</span><button className="button secondary small" disabled={busy||page>=results.pageCount} onClick={()=>setPage(page+1)}><Text message="Next"/></button></nav>:null}</>:null}
  </section>:view==='CONNECTIONS'?<section className={styles.directory} aria-busy={busy}>
   <p className="meta"><Text message="A connection does not share vehicles. The provider chooses which vehicles each account can see."/></p>
   {!busy&&!active.length?<p className="meta"><Text message="No connections yet. Find an account to send a request."/></p>:null}
   <div className={styles.grid}>{active.map((item:AccountConnection)=><article className={styles.business} key={item.id}><header>{item.account.kind==='BUSINESS'?<Building2 aria-hidden="true"/>:<Truck aria-hidden="true"/>}<div><span className={styles.handle}><Text message={item.status==='ACCEPTED'?'Connected':item.direction==='INCOMING'?'Incoming request':'Request sent'}/></span><h2>{item.account.name}</h2>{item.account.handle?<span className={styles.handle}>@{item.account.handle}</span>:null}</div></header><div className={styles.actions}>{item.canManage&&item.status==='PENDING'&&item.direction==='INCOMING'?<><button className="button small" disabled={saving} onClick={()=>{void act('PATCH',{id:item.id,decision:'ACCEPT'});}}><Text message="Accept"/></button><button className="button secondary small" disabled={saving} onClick={()=>{void act('PATCH',{id:item.id,decision:'DECLINE'});}}><Text message="Decline"/></button></>:null}{item.canManage&&item.status==='PENDING'&&item.direction==='OUTGOING'?<button className="button secondary small" disabled={saving} onClick={()=>{void act('PATCH',{id:item.id,decision:'CANCEL'});}}><Text message="Cancel request"/></button>:null}{item.status==='ACCEPTED'&&!canShareVehicles?<Link className="button secondary small" href="/?view=private"><MapPinned aria-hidden="true"/><Text message="Shared with you"/></Link>:null}{item.status==='ACCEPTED'&&canShareVehicles?<button className="button secondary small" onClick={()=>setView('VEHICLES')}><Text message="Share vehicles"/></button>:null}{item.status==='ACCEPTED'&&item.canManage?<button className="button secondary small" type="button" onClick={()=>setConfirmId(item.id)}><Text message="Disconnect"/></button>:null}</div>{confirmId===item.id?<div className={styles.actions}><p><Text message="Disconnecting stops vehicle access shared through this connection."/></p><button className="button danger small" disabled={saving} onClick={()=>{void act('PATCH',{id:item.id,decision:'REVOKE'});}}><Text message="Disconnect"/></button><button className="button secondary small" onClick={()=>setConfirmId('')}><Text message="Cancel"/></button></div>:null}</article>)}</div>
   {history.length?<details><summary><Text message="Past requests"/> ({history.length})</summary><div className={styles.grid}>{history.map((item:AccountConnection)=><article className={styles.business} key={item.id}><header>{item.account.kind==='BUSINESS'?<Building2 aria-hidden="true"/>:<Truck aria-hidden="true"/>}<div><span className={styles.handle}><Text message={item.status==='REVOKED'?'Disconnected':item.status==='DECLINED'?'Declined':'Cancelled'}/></span><h2>{item.account.name}</h2>{item.account.handle?<span className={styles.handle}>@{item.account.handle}</span>:null}</div></header></article>)}</div></details>:null}
  </section>:<section className={styles.directory}>{children}</section>}
 </div>;
}
