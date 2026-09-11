"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export function SupportRefresh({ enabled=true,intervalMs=5000 }: { enabled?:boolean;intervalMs?:number }) {
  const router=useRouter();

  React.useEffect(()=>{
    if(!enabled)return;
    const refresh=()=>{
      if(document.visibilityState==='visible')router.refresh();
    };
    const timer=window.setInterval(refresh,Math.max(1500,intervalMs));
    return ()=>window.clearInterval(timer);
  },[enabled,intervalMs,router]);

  return null;
}

export function SupportAutoScroll({containerId,lastMessageId}:{containerId:string;lastMessageId?:string}) {
  React.useLayoutEffect(()=>{
    const container=document.getElementById(containerId);
    if(container)container.scrollTop=container.scrollHeight;
  },[containerId,lastMessageId]);
  return null;
}
