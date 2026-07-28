"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Clock3 } from 'lucide-react';

const IDLE_MS=5*60*1000;
const REFRESH_MS=60*1000;

export function TrackingIdleGuard({shipmentId}:{shipmentId:string}) {
  const router=useRouter();
  const lastActivity=React.useRef(Date.now());

  React.useEffect(()=>{
    const markActive=()=>{lastActivity.current=Date.now();};
    const events=['pointerdown','keydown','scroll','touchstart'] as const;
    events.forEach(event=>window.addEventListener(event,markActive,{passive:true}));
    const interval=window.setInterval(async()=>{
      if(Date.now()-lastActivity.current>=IDLE_MS){
        await fetch('/api/tracking/session',{method:'DELETE'});
        router.replace('/track?error=Tracking+locked+after+5+minutes+without+activity.');
        return;
      }
      const form=new FormData();
      form.set('shipmentId',shipmentId);
      const response=await fetch('/api/tracking/session',{method:'POST',body:form});
      if(!response.ok)router.replace('/track?error=Enter+the+tracking+code+again.');
    },REFRESH_MS);
    return ()=>{
      events.forEach(event=>window.removeEventListener(event,markActive));
      window.clearInterval(interval);
    };
  },[router,shipmentId]);

  return <div className="tracking-session-note"><Clock3 aria-hidden="true"/><span>Locks after 5 minutes without activity</span></div>;
}
