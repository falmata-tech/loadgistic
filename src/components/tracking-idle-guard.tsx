'use client';


import {Text,Localized} from '@/components/localization';
import {Clock3,LogOut} from 'lucide-react';
import React from 'react';
import {
  TRACKING_IDLE_MS,
  trackingSessionExpired,
  trackingSessionNeedsRenewal
} from '@/lib/tracking-session';

export function TrackingSessionBoundary({initialExpiresAt,children}:{initialExpiresAt:number;children:React.ReactNode}){
  const surface=React.useRef(null as HTMLDivElement|null);
  const lastActivityAt=React.useRef(Date.now());
  const lastRenewedAt=React.useRef(0);
  const serverExpiresAt=React.useRef(initialExpiresAt);
  const scheduleExpiry=React.useRef((()=>{}) as ()=>void);
  const renewalInFlight=React.useRef(null as Promise<void>|null);
  const renewalAbort=React.useRef(null as AbortController|null);
  const ending=React.useRef(false);
  const [locked,setLocked]=React.useState(false);
  const [ready,setReady]=React.useState(false);

  const endSession=React.useCallback(async(reason:'inactive'|'logout')=>{
    if(ending.current)return;
    ending.current=true;
    setLocked(true);
    renewalAbort.current?.abort();
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),5000);
    try{
      await fetch('/api/tracking/session',{
        method:'DELETE',headers:{accept:'application/json'},keepalive:true,signal:controller.signal
      });
    }catch{}finally{window.clearTimeout(timer);}
    window.location.replace(`/track?session=${reason}`);
  },[]);

  const renew=React.useCallback(async()=>{
    const now=Date.now();
    if(ending.current||renewalInFlight.current||!trackingSessionNeedsRenewal(now,lastRenewedAt.current))return;
    lastRenewedAt.current=now;
    let expired=false;
    const controller=new AbortController();
    renewalAbort.current=controller;
    const timer=window.setTimeout(()=>controller.abort(),8000);
    const renewal=(async()=>{
      try{
        const response=await fetch('/api/tracking/session',{
          method:'POST',headers:{accept:'application/json'},cache:'no-store',signal:controller.signal
        });
        if(response.status===401){expired=true;return;}
        if(!response.ok)return;
        const result=await response.json();
        if(Number.isFinite(result.expiresAt)){
          serverExpiresAt.current=Number(result.expiresAt);
          scheduleExpiry.current();
        }
      }catch{}finally{window.clearTimeout(timer);}
    })();
    renewalInFlight.current=renewal;
    await renewal;
    if(renewalInFlight.current===renewal)renewalInFlight.current=null;
    if(renewalAbort.current===controller)renewalAbort.current=null;
    if(expired)await endSession('inactive');
  },[endSession]);

  React.useEffect(()=>{
    let idleTimer:number|undefined;
    const schedule=()=>{
      window.clearTimeout(idleTimer);
      const remaining=Math.max(0,Math.min(lastActivityAt.current+TRACKING_IDLE_MS,serverExpiresAt.current)-Date.now());
      idleTimer=window.setTimeout(()=>void endSession('inactive'),remaining+25);
    };
    scheduleExpiry.current=schedule;
    const recordActivity=(event:Event)=>{
      if(ending.current||document.visibilityState!=='visible'||!event.isTrusted)return;
      if(event.target instanceof Element&&event.target.closest('[data-tracking-logout]'))return;
      const now=Date.now();
      if(trackingSessionExpired(now,lastActivityAt.current,serverExpiresAt.current)){void endSession('inactive');return;}
      lastActivityAt.current=now;
      schedule();
      void renew();
    };
    const checkAfterBackground=()=>{
      if(document.visibilityState!=='visible')return;
      if(trackingSessionExpired(Date.now(),lastActivityAt.current,serverExpiresAt.current))void endSession('inactive');
      else schedule();
    };
    // Hide cached private results before history snapshots; recheck the session on restore.
    const hideForHistory=()=>{if(surface.current)surface.current.style.visibility='hidden';};
    const restoreFromHistory=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload();};
    window.addEventListener('pagehide',hideForHistory);
    window.addEventListener('pageshow',restoreFromHistory);
    const events:Array<keyof DocumentEventMap>=['pointerdown','keydown','touchstart','wheel','scroll'];
    for(const eventName of events)document.addEventListener(eventName,recordActivity,{passive:true});
    document.addEventListener('visibilitychange',checkAfterBackground);
    schedule();setReady(true);
    return()=>{
      renewalAbort.current?.abort();
      scheduleExpiry.current=()=>{};
      window.clearTimeout(idleTimer);
      for(const eventName of events)document.removeEventListener(eventName,recordActivity);
      document.removeEventListener('visibilitychange',checkAfterBackground);
      window.removeEventListener('pagehide',hideForHistory);
      window.removeEventListener('pageshow',restoreFromHistory);
    };
  },[endSession,renew]);

  if(locked)return <section className="container shared-capacity-session-ending" role="status"><Clock3 aria-hidden="true"/><strong><Text message="Closing tracking…"/></strong></section>;

  return <Localized as="div" ref={surface} copy={["aria-label"]} className="tracking-session-workspace" aria-label="Shipment tracking session">
    <div className="container shared-capacity-session-bar">
      <Localized as="span" copy={["aria-label"]} aria-label="Tracking access ends after 30 minutes without activity."><Clock3 aria-hidden="true"/><span><strong><Text message="Private session"/></strong><small><Text message="30-minute idle limit"/></small></span></Localized>
      <button type="button" className="button secondary small" data-tracking-logout disabled={!ready} onClick={()=>void endSession('logout')}><LogOut aria-hidden="true"/><Text message="Log out"/></button>
    </div>
    {children}
  </Localized>;
}
