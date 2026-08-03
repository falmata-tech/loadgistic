"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS=15_000;

export function ShipmentProjectionRefresh(){
  const router=useRouter();

  React.useEffect(()=>{
    const refresh=()=>{
      if(document.visibilityState==='visible')router.refresh();
    };
    const timer=window.setInterval(refresh,REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('focus',refresh);
    return()=>{
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange',refresh);
      window.removeEventListener('focus',refresh);
    };
  },[router]);

  return null;
}
