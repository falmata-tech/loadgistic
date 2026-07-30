"use client";

import React from 'react';
import { ClockAlert, RefreshCw } from 'lucide-react';
import { capacityExpiryState } from '@/lib/domain.js';

export function CapacityExpiryNotice({expiresAt,compact=false}:{expiresAt?:string|null;compact?:boolean}){
  const [now,setNow]=React.useState(null as number|null);
  React.useEffect(()=>{
    setNow(Date.now());
    const timer=window.setInterval(()=>setNow(Date.now()),60_000);
    return ()=>window.clearInterval(timer);
  },[]);
  if(!expiresAt||now===null)return null;
  const state=capacityExpiryState(expiresAt,now);
  if(state==='CURRENT'||state==='UNKNOWN')return null;
  return <div className={`capacity-expiry-notice ${state.toLowerCase()} ${compact?'compact':''}`} role="status">
    {state==='EXPIRING'?<ClockAlert aria-hidden="true"/>:<RefreshCw aria-hidden="true"/>}
    <span>
      <strong>{state==='EXPIRING'?'Expires soon':'Capacity expired'}</strong>
      <small>{state==='EXPIRING'?'Refresh within 2 hours to stay on the Capacity Board.':'Off the Capacity Board. Publish an update to return.'}</small>
    </span>
  </div>;
}
