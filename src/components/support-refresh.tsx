"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export function SupportRefresh({enabled=true,intervalMs=5000,endpoint='/api/support/updates'}:{enabled?:boolean;intervalMs?:number;endpoint?:string}){
  const router=useRouter();
  const [failed,setFailed]=React.useState(false);
  React.useEffect(()=>{
    if(!enabled)return;
    let timer:number|undefined,disposed=false,inFlight=false,failures=0,etag='';
    let controller:AbortController|undefined;
    const schedule=()=>{if(!disposed&&document.visibilityState==='visible')timer=window.setTimeout(poll,Math.min(30000,Math.max(1500,intervalMs)*2**failures));};
    const poll=async()=>{
      if(disposed||inFlight||document.visibilityState!=='visible')return;
      inFlight=true;controller=new AbortController();const timeout=window.setTimeout(()=>controller?.abort(),15000);
      try{
        const response=await fetch(endpoint,{cache:'no-store',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
        if(response.status!==304){
          if(!response.ok){if(response.status===401||response.status===403)router.refresh();throw new Error('UPDATES_UNAVAILABLE');}
          const value=await response.json();if(typeof value.revision!=='string')throw new Error('UPDATES_UNAVAILABLE');
          if(!disposed){etag=value.revision;router.refresh();}
        }
        failures=0;if(!disposed)setFailed(false);
      }catch{failures=Math.min(4,failures+1);if(!disposed)setFailed(true);}
      finally{window.clearTimeout(timeout);inFlight=false;schedule();}
    };
    const visibility=()=>{window.clearTimeout(timer);if(document.visibilityState==='visible')void poll();};
    schedule();document.addEventListener('visibilitychange',visibility);
    return()=>{disposed=true;controller?.abort();window.clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);};
  },[enabled,intervalMs,endpoint,router]);
  return failed?<p role="status">Conversation updates are temporarily unavailable. Retrying…</p>:null;
}

export function SupportAutoScroll({containerId,lastMessageId,atStart=false}:{containerId:string;lastMessageId?:string;atStart?:boolean}) {
  React.useLayoutEffect(()=>{
    const container=document.getElementById(containerId);
    if(container)container.scrollTop=atStart?0:container.scrollHeight;
  },[containerId,lastMessageId,atStart]);
  return null;
}
