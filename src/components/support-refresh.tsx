"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export function SupportRefresh({ enabled=true }: { enabled?:boolean }) {
  const router=useRouter();

  React.useEffect(()=>{
    if(!enabled)return;
    const refresh=()=>{
      if(document.visibilityState==='visible')router.refresh();
    };
    const timer=window.setInterval(refresh,5000);
    return ()=>window.clearInterval(timer);
  },[enabled,router]);

  return null;
}

export function SupportAutoScroll({containerId,lastMessageId}:{containerId:string;lastMessageId?:string}) {
  React.useLayoutEffect(()=>{
    const container=document.getElementById(containerId);
    if(container)container.scrollTop=container.scrollHeight;
  },[containerId,lastMessageId]);
  return null;
}
