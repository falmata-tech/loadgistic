"use client";


import {Text} from '@/components/localization';
import React from 'react';
import { useRouter } from 'next/navigation';

export function SupportRefresh({enabled=true,intervalMs=5000,endpoint='/api/support/updates',initialRevision=''}:{enabled?:boolean;intervalMs?:number;endpoint?:string;initialRevision?:string}){
  const router=useRouter();
  const [failed,setFailed]=React.useState(false);
  React.useEffect(()=>{
    if(!enabled)return;
    let timer:number|undefined,disposed=false,inFlight=false,failures=0,etag=initialRevision,paused=Boolean(document.querySelector('dialog[open]'));
    let controller:AbortController|undefined;
    const stop=()=>{disposed=true;window.clearTimeout(timer);controller?.abort();};
    const nativeSubmit=(event:Event)=>{const form=event.target;if(!event.defaultPrevented&&form instanceof HTMLFormElement&&(!form.target||form.target==='_self'))stop();};
    const schedule=()=>{if(!disposed&&!paused&&document.visibilityState==='visible')timer=window.setTimeout(poll,Math.min(30000,Math.max(1500,intervalMs)*2**failures));};
    const poll=async()=>{
      if(disposed||paused||inFlight||document.visibilityState!=='visible')return;
      inFlight=true;controller=new AbortController();const timeout=window.setTimeout(()=>controller?.abort(),15000);
      try{
        const response=await fetch(endpoint,{cache:'no-store',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
        if(response.status!==304){
          if(!response.ok){if(!disposed&&(response.status===401||response.status===403))router.refresh();throw new Error('UPDATES_UNAVAILABLE');}
          const value=await response.json();if(typeof value.revision!=='string')throw new Error('UPDATES_UNAVAILABLE');
          if(!disposed&&!paused){const changed=etag!==value.revision;etag=value.revision;if(changed)router.refresh();}
        }
        failures=0;if(!disposed)setFailed(false);
      }catch{if(!paused){failures=Math.min(4,failures+1);if(!disposed)setFailed(true);}}
      finally{window.clearTimeout(timeout);inFlight=false;schedule();}
    };
    const visibility=()=>{window.clearTimeout(timer);if(document.visibilityState==='visible')void poll();};
    // Queue refresh must not replace the record underneath a deliberate edit.
    const dialogs=new MutationObserver(()=>{const blocked=Boolean(document.querySelector('dialog[open]'));if(blocked===paused)return;paused=blocked;window.clearTimeout(timer);if(paused)controller?.abort();else void poll();});
    dialogs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    schedule();document.addEventListener('visibilitychange',visibility);document.addEventListener('submit',nativeSubmit);window.addEventListener('beforeunload',stop);window.addEventListener('pagehide',stop);
    return()=>{stop();dialogs.disconnect();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('submit',nativeSubmit);window.removeEventListener('beforeunload',stop);window.removeEventListener('pagehide',stop);};
  },[enabled,intervalMs,endpoint,initialRevision,router]);
  return failed?<p role="status"><Text message="Conversation updates are temporarily unavailable. Retrying…"/></p>:null;
}

export function SupportAutoScroll({containerId,lastMessageId,atStart=false}:{containerId:string;lastMessageId?:string;atStart?:boolean}) {
  React.useLayoutEffect(()=>{
    const container=document.getElementById(containerId);
    if(container)container.scrollTop=atStart?0:container.scrollHeight;
  },[containerId,lastMessageId,atStart]);
  return null;
}
