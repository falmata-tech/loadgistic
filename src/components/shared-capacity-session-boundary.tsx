'use client';

import {Clock3,LogOut} from 'lucide-react';
import React from 'react';
import {useRouter} from 'next/navigation';
import {
  SHARED_CAPACITY_IDLE_MS,
  sharedCapacitySessionExpired,
  sharedCapacitySessionNeedsRenewal
} from '@/lib/shared-capacity-session';

export function SharedCapacitySessionBoundary({initialExpiresAt,children}:{initialExpiresAt:number;children:React.ReactNode}){
  const router=useRouter();
  const lastActivityAt=React.useRef(Date.now());
  const lastRenewedAt=React.useRef(0);
  const serverExpiresAt=React.useRef(initialExpiresAt);
  const scheduleExpiry=React.useRef((()=>{}) as ()=>void);
  const renewalInFlight=React.useRef(null as Promise<void>|null);
  const ending=React.useRef(false);
  const [locked,setLocked]=React.useState(false);

  const endSession=React.useCallback(async(reason:'inactive'|'logout')=>{
    if(ending.current)return;
    ending.current=true;
    setLocked(true);
    try{await renewalInFlight.current;}catch{}
    try{await fetch('/api/shared-capacity/session',{method:'DELETE',headers:{accept:'application/json'},keepalive:true});}catch{}
    router.replace(`/shared-capacity?session=${reason}`);
    router.refresh();
  },[router]);

  const renew=React.useCallback(async()=>{
    const now=Date.now();
    if(ending.current||renewalInFlight.current||!sharedCapacitySessionNeedsRenewal(now,lastRenewedAt.current))return;
    lastRenewedAt.current=now;
    let expired=false;
    const renewal=(async()=>{
      try{
        const response=await fetch('/api/shared-capacity/session',{method:'POST',headers:{accept:'application/json'},cache:'no-store'});
        if(response.status===401){expired=true;return;}
        if(!response.ok)return;
        const result=await response.json();
        if(Number.isFinite(result.expiresAt)){
          serverExpiresAt.current=Number(result.expiresAt);
          scheduleExpiry.current();
        }
      }catch{}
    })();
    renewalInFlight.current=renewal;
    await renewal;
    if(renewalInFlight.current===renewal)renewalInFlight.current=null;
    if(expired)await endSession('inactive');
  },[endSession]);

  React.useEffect(()=>{
    let idleTimer:number|undefined;
    const schedule=()=>{
      window.clearTimeout(idleTimer);
      const remaining=Math.max(0,Math.min(lastActivityAt.current+SHARED_CAPACITY_IDLE_MS,serverExpiresAt.current)-Date.now());
      idleTimer=window.setTimeout(()=>void endSession('inactive'),remaining+25);
    };
    scheduleExpiry.current=schedule;
    const recordActivity=(event:Event)=>{
      if(ending.current)return;
      if(event.target instanceof Element&&event.target.closest('[data-shared-capacity-logout]'))return;
      const now=Date.now();
      if(sharedCapacitySessionExpired(now,lastActivityAt.current,serverExpiresAt.current)){void endSession('inactive');return;}
      lastActivityAt.current=now;
      schedule();
      void renew();
    };
    const checkAfterBackground=()=>{
      if(document.visibilityState!=='visible')return;
      if(sharedCapacitySessionExpired(Date.now(),lastActivityAt.current,serverExpiresAt.current))void endSession('inactive');
      else schedule();
    };
    const events:Array<keyof DocumentEventMap>=['pointerdown','keydown','touchstart','wheel','scroll'];
    for(const eventName of events)document.addEventListener(eventName,recordActivity,{passive:true});
    document.addEventListener('visibilitychange',checkAfterBackground);
    schedule();
    return()=>{
      scheduleExpiry.current=()=>{};
      window.clearTimeout(idleTimer);
      for(const eventName of events)document.removeEventListener(eventName,recordActivity);
      document.removeEventListener('visibilitychange',checkAfterBackground);
    };
  },[endSession,renew]);

  if(locked)return <section className="container shared-capacity-session-ending" role="status"><Clock3 aria-hidden="true"/><strong>Closing private capacity…</strong></section>;

  return <>
    <div className="container shared-capacity-session-bar">
      <span><Clock3 aria-hidden="true"/>For your privacy, access ends after 30 minutes without activity.</span>
      <button type="button" className="button secondary small" data-shared-capacity-logout onClick={()=>void endSession('logout')}><LogOut aria-hidden="true"/>Log out</button>
    </div>
    {children}
  </>;
}
