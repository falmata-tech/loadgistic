'use client';
import React from 'react';
import {ShieldCheck} from 'lucide-react';
import {Text,useTranslation} from './localization';
import type {AccountConnection} from '@/lib/account-directory';
import {WorkspaceTaskDialog} from './workspace-task-dialog';
import styles from './capacity-business-share.module.css';

export type AccountVehicleGrant={id:string;connection_id:string;recipient_kind:string;recipient_id:string;recipient_name:string;revision:number;effective:boolean;revoked_at:string|null};
function responseError(value:unknown,fallback:string){
 if(value&&typeof value==='object'&&'error' in value){const error=(value as {error?:{message?:unknown}}).error;if(typeof error?.message==='string')return error.message;}
 return fallback;
}
export function CapacityAccountShare({vehicleId,connections,grants}:{vehicleId:string;connections:AccountConnection[];grants:AccountVehicleGrant[]}){
 const {t}=useTranslation(),[selected,setSelected]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const available=connections.filter(item=>item.status==='ACCEPTED'&&item.account.kind==='BUSINESS'&&item.account.id&&!grants.some(grant=>grant.connection_id===item.id&&grant.effective));
 async function save(action:'GRANT'|'REVOKE',body:Record<string,string|number>){
  if(busy)return;setBusy(true);setError('');
  try{const response=await fetch('/api/account-vehicle-shares',{method:action==='GRANT'?'POST':'PATCH',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})});
   const value=await response.json();if(!response.ok)throw Error(responseError(value,t('Could not save changes.')));
   location.assign('/app/network?view=vehicles&success='+encodeURIComponent(t(action==='GRANT'?'Vehicle shared.':'Capacity access removed.')));
  }catch(problem){setError(problem instanceof Error?problem.message:t('Could not save changes.'));setBusy(false);}
 }
 return <div className={styles.form}>
  <p className={styles.note}><ShieldCheck aria-hidden="true"/><Text message="Only connected shippers and brokers can receive this vehicle."/></p>
  {available.length?<><label><Text message="Share with connection"/><select value={selected} onChange={event=>setSelected(event.target.value)} disabled={busy}><option value="">{t('Choose a connection')}</option>{available.map(item=><option value={item.id} key={item.id}>{item.account.name}{item.account.handle?` · @${item.account.handle}`:''}</option>)}</select></label><button className="button small" type="button" disabled={!selected||busy} onClick={()=>{void save('GRANT',{connectionId:selected,vehicleId});}}><Text message={busy?'Saving…':'Share vehicle'}/></button></>:<p className="meta"><Text message="Connect with an account in Network before sharing this vehicle."/></p>}
  {error?<p role="alert" className="alert error">{error}</p>:null}
 </div>;
}
export function RemoveAccountCapacityShare({grant}:{grant:AccountVehicleGrant}){
 const {t}=useTranslation(),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 async function remove(){if(busy)return;setBusy(true);setError('');
  try{const response=await fetch('/api/account-vehicle-shares',{method:'PATCH',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'REVOKE',grantId:grant.id,revision:grant.revision})});
   const value=await response.json();if(!response.ok)throw Error(responseError(value,t('Could not save changes.')));
   location.assign('/app/network?view=vehicles&success='+encodeURIComponent(t('Capacity access removed.')));
  }catch(problem){setError(problem instanceof Error?problem.message:t('Could not save changes.'));setBusy(false);}
 }
 return <WorkspaceTaskDialog title="Remove capacity access?" triggerLabel="Remove" triggerClassName="button secondary small"><p><Text message="This account will no longer see this vehicle in Shared capacity."/></p><button type="button" className="button danger" disabled={busy} onClick={()=>{void remove();}}><Text message="Remove access"/></button>{error?<p role="alert" className="alert error">{error}</p>:null}</WorkspaceTaskDialog>;
}
