"use client";

import React from 'react';
import {
  Check,
  Circle,
  CircleCheckBig,
  LockKeyhole,
  Navigation,
  PackageCheck,
  PackageOpen,
  Route,
  TriangleAlert,
  Upload
} from 'lucide-react';

const trackingActions=[
  {status:'LOADING',label:'Loading',hint:'The truck is being loaded',Icon:PackageCheck,acceptsProof:true},
  {status:'IN_TRANSIT',label:'En route',hint:'The shipment is moving',Icon:Navigation,acceptsProof:false},
  {status:'UNLOADING',label:'Unloading',hint:'The truck is being unloaded',Icon:PackageOpen,acceptsProof:true},
  {status:'COMPLETED',label:'Complete',hint:'Tracking is finished',Icon:CircleCheckBig,acceptsProof:false},
  {status:'ISSUE',label:'Problem',hint:'Report an issue',Icon:TriangleAlert,acceptsProof:true}
] as const;

export function ProviderTrackingControls({trackingId,nextStatuses}:{trackingId:string;nextStatuses:string[]}){
  const available=React.useMemo(()=>new Set(nextStatuses),[nextStatuses]);
  const first=trackingActions.find(action=>available.has(action.status))?.status||'';
  const [selected,setSelected]=React.useState(first);
  const action=trackingActions.find(item=>item.status===selected);

  React.useEffect(()=>{
    if(!available.has(selected))setSelected(first);
  },[available,first,selected]);

  return <section className="card tracking-control-panel">
    <div className="control-panel-title"><div className="panel-title-copy"><Route aria-hidden="true"/><div><h2>Tracking update</h2><p>Choose the next available action.</p></div></div></div>
    <form action={`/api/provider-shipments/${trackingId}/status`} method="post" encType="multipart/form-data" className="tracking-action-form">
      <fieldset className="form-group tracking-action-fieldset"><legend><Check aria-hidden="true"/>Tracking status</legend><div className="tracking-action-grid">{trackingActions.map(item=>{
        const enabled=available.has(item.status),isSelected=selected===item.status,Icon=item.Icon;
        return <label className={`tracking-action-choice ${enabled?'available':'disabled'} ${isSelected?'selected':''} ${item.status==='ISSUE'?'problem':''}`} key={item.status} aria-disabled={!enabled}>
          <input type="radio" name="nextStatus" value={item.status} checked={isSelected} onChange={()=>setSelected(item.status)} disabled={!enabled}/>
          <Icon aria-hidden="true"/>
          <span><strong>{item.label}</strong><small>{item.hint}</small></span>
          {isSelected?<Check className="choice-state" aria-hidden="true"/>:enabled?<Circle className="choice-state" aria-hidden="true"/>:<LockKeyhole className="choice-state" aria-hidden="true"/>}
        </label>;
      })}</div></fieldset>
      {selected==='ISSUE'?<div className="form-group tracking-proof-input"><label htmlFor={`tracking-issue-${trackingId}`}><TriangleAlert aria-hidden="true"/>What happened?</label><textarea id={`tracking-issue-${trackingId}`} name="note" required maxLength={1000}/></div>:<input type="hidden" name="note" value={action?.label||''}/>}
      {action?.acceptsProof?<div className="form-group tracking-proof-input"><label htmlFor={`tracking-photo-${trackingId}`}><Upload aria-hidden="true"/>Photo <span className="meta">(optional)</span></label><input id={`tracking-photo-${trackingId}`} name="proof" type="file" accept="image/jpeg,image/png,image/webp"/></div>:null}
      {first?<button className="button"><Check aria-hidden="true"/>Save {action?.label||'update'}</button>:<div className="tracking-finished"><CircleCheckBig aria-hidden="true"/><span><strong>Tracking complete</strong><small>No further status update is needed.</small></span></div>}
    </form>
  </section>;
}
