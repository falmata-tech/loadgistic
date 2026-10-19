'use client';
import React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,Building2,Check,Plus,Truck,Users,X} from 'lucide-react';
import {Text,FeedbackText} from './localization';
import type {BusinessInvitation,BusinessWorkspaceSummary} from '@/lib/business-workspaces/contracts';
import styles from './business-workspace.module.css';

export async function businessRequest(path:string,body:unknown):Promise<Record<string,unknown>|null>{
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const data:unknown=await response.json();
 const row=data&&typeof data==='object'&&!Array.isArray(data)?data as Record<string,unknown>:null;
 const failure=row?.error&&typeof row.error==='object'?row.error as Record<string,unknown>:null;
 if(!response.ok)throw new Error(typeof failure?.message==='string'?failure.message:'The change could not be saved. Please try again.');
 if(data!==null&&!row)throw new Error('The saved change could not be confirmed. Refresh before trying again.');return row;
}
export function BusinessWorkspaceChoice({workspaces,invitations,providerAvailable,canCreateProvider}:{workspaces:BusinessWorkspaceSummary[];invitations:BusinessInvitation[];providerAvailable:boolean;canCreateProvider:boolean}){
 const router=useRouter(),[creating,setCreating]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 async function select(id:string|null){if(busy)return;setBusy(true);setError('');try{await businessRequest('/api/business-workspaces',{action:'SELECT',workspaceId:id});router.push('/app/home');router.refresh();}catch(error){setError((error as Error).message);setBusy(false);}}
 async function accept(id:string){if(busy)return;setBusy(true);setError('');try{await businessRequest(`/api/business-workspaces/invitations/${id}/accept`,{});router.push('/app/home');router.refresh();}catch(error){setError((error as Error).message);setBusy(false);}}
 async function create(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const form=new FormData(event.currentTarget);setBusy(true);setError('');try{await businessRequest('/api/business-workspaces',{action:'CREATE',name:form.get('name'),handle:form.get('handle'),kind:form.get('kind'),city:form.get('city')||null});router.push('/app/home');router.refresh();}catch(error){setError((error as Error).message);setBusy(false);}}
 return <div className={styles.choice}>
  {error?<p className="alert error" role="alert"><FeedbackText message={error} fallback="The change could not be saved. Please try again."/></p>:null}
  {invitations.length?<section><h2><Text message="You have been invited"/></h2><div className={styles.workspaceList}>{invitations.map(invitation=><article key={invitation.id}><Users aria-hidden="true"/><div><strong>{invitation.businessName}</strong><small>@{invitation.handle} · <Text message={invitation.role==='ADMIN'?'Business admin':'Team member'}/></small></div><button className="button small" disabled={busy} onClick={()=>void accept(invitation.id)}><Check aria-hidden="true"/><Text message="Join"/></button></article>)}</div></section>:null}
  {providerAvailable||workspaces.length?<section aria-label="Your workspaces"><div className={styles.workspaceList}>
   {providerAvailable?<article><Truck aria-hidden="true"/><div><strong><Text message="Transport Provider"/></strong><small><Text message="Your vehicles, drivers and capacity"/></small></div><button className="button secondary small" disabled={busy} onClick={()=>void select(null)}><Text message="Open"/><ArrowRight aria-hidden="true"/></button></article>:null}
   {workspaces.map(workspace=><article key={workspace.id}><Building2 aria-hidden="true"/><div><strong>{workspace.name}</strong><small>@{workspace.handle} · <Text message={workspace.membershipRole==='OWNER'?'Owner':workspace.membershipRole==='ADMIN'?'Business admin':'Team member'}/></small></div><button className="button secondary small" disabled={busy} onClick={()=>void select(workspace.id)}><Text message="Open"/><ArrowRight aria-hidden="true"/></button></article>)}
  </div></section>:null}
  {creating?<form onSubmit={event=>void create(event)} className={styles.createForm}>
    <div className={styles.sectionHeading}><h2><Text message="Create a business workspace"/></h2><button className="button secondary icon-button" type="button" aria-label="Cancel" disabled={busy} onClick={()=>setCreating(false)}><X aria-hidden="true"/></button></div>
    <label><Text message="Business name"/><input name="name" required minLength={2} maxLength={100} autoComplete="organization"/></label>
    <div><label htmlFor="business-create-handle"><Text message="Business handle"/></label><input id="business-create-handle" name="handle" required pattern="[a-z0-9][a-z0-9_-]{2,59}" minLength={3} maxLength={60} autoCapitalize="none" autoCorrect="off" aria-describedby="business-handle-help"/><small id="business-handle-help"><Text message="Use letters, numbers, underscores or hyphens."/></small></div>
    <fieldset><legend><Text message="What does your business do?"/></legend><div className={styles.kindChoices}>{[{value:'BROKER',label:'Broker'},{value:'SHIPPER',label:'Shipper'},{value:'RECEIVER',label:'Receiver'}].map((kind,index)=><label key={kind.value}><input name="kind" type="radio" value={kind.value} defaultChecked={index===0}/><Text message={kind.label}/></label>)}</div></fieldset>
    <div><label htmlFor="business-create-city"><Text message="Office city"/></label><input id="business-create-city" name="city" maxLength={100} autoComplete="address-level2" aria-describedby="business-city-help"/><small id="business-city-help"><Text message="Optional"/></small></div>
    <button className="button" disabled={busy}><Plus aria-hidden="true"/><Text message={busy?'Creating…':'Create workspace'}/></button>
  </form>:<section><h2><Text message={providerAvailable||workspaces.length?'Add a workspace':'How will you use Loadgistic?'}/></h2><div className={styles.choiceCards}>
    {!providerAvailable&&canCreateProvider?<form action="/api/workspaces/provider/start" method="post"><button type="submit" className={styles.choiceCard} disabled={busy}><Truck aria-hidden="true"/><h3><Text message="Transport Provider"/></h3><p><Text message="Manage your vehicles and share their capacity with customers."/></p><span><Text message="Set up your vehicles"/><ArrowRight aria-hidden="true"/></span></button></form>:null}
    <button type="button" onClick={()=>setCreating(true)} className={styles.choiceCard} disabled={busy}><Building2 aria-hidden="true"/><h3><Text message="Business workspace"/></h3><p><Text message="Keep your transport network and shipments in view with your team."/></p><span><Text message="Set up your business"/><ArrowRight aria-hidden="true"/></span></button>
  </div></section>}
 </div>;
}
