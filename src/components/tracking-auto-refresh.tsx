'use client';

import React from 'react';
import {useRouter} from 'next/navigation';
import {RefreshCw} from 'lucide-react';
import {Text} from './localization';
import {trackingRefreshAllowed,trackingRefreshDelay} from '@/lib/tracking-refresh-policy.js';

export function TrackingAutoRefresh({shipmentId,revision,active,expiresAt}:{shipmentId:string;revision:string;active:boolean;expiresAt:number}){
 const router=useRouter();
 const checkRef=React.useRef((()=>{}) as ()=>void);
 const [checking,setChecking]=React.useState(false);

 React.useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|null=null;
  let controller:AbortController|null=null;
  let disposed=false,failed=0,pending=false,revoked=false;
  const permitted=(manual=false)=>trackingRefreshAllowed({active:manual||active,visible:document.visibilityState==='visible',expiresAt,now:Date.now()});
  const schedule=()=>{
   if(timer)clearTimeout(timer);
   if(!disposed&&!revoked&&permitted())timer=setTimeout(()=>{void check();},trackingRefreshDelay(failed));
  };
  async function check(manual=false){
   if(disposed||revoked||pending||!permitted(manual))return;
   if(timer)clearTimeout(timer);
   pending=true;setChecking(true);controller=new AbortController();
   try{
    const response=await fetch(`/api/tracking/${encodeURIComponent(shipmentId)}/refresh`,{
     credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal:controller.signal
    });
    if(disposed||document.visibilityState!=='visible')return;
    if([401,403,404].includes(response.status)){
     revoked=true;
     window.dispatchEvent(new Event('tracking-access-lost'));
     return;
    }
    if(!response.ok)throw new Error('TRACKING_REFRESH_FAILED');
    const snapshot=await response.json() as {revision?:unknown;active?:unknown};
    if(typeof snapshot.revision!=='string'||typeof snapshot.active!=='boolean')throw new Error('TRACKING_REFRESH_INVALID');
    failed=0;
    if(manual||snapshot.revision!==revision||!snapshot.active)router.refresh();
    if(snapshot.active)schedule();
   }catch{
    if(!disposed&&document.visibilityState==='visible'&&!controller?.signal.aborted){failed++;schedule();}
   }finally{
    pending=false;controller=null;
    if(!disposed)setChecking(false);
   }
  }
  checkRef.current=()=>{void check(true);};
  const visibility=()=>{
   if(document.visibilityState==='hidden'){
    if(timer)clearTimeout(timer);
    controller?.abort();
   }else schedule();
  };
  document.addEventListener('visibilitychange',visibility);
  schedule();
  return()=>{
   disposed=true;if(timer)clearTimeout(timer);controller?.abort();
   document.removeEventListener('visibilitychange',visibility);
   checkRef.current=()=>{};
  };
 },[active,expiresAt,revision,router,shipmentId]);

 return <button type="button" className="button secondary small" disabled={checking} onClick={()=>checkRef.current()}><RefreshCw aria-hidden="true"/><Text message="Refresh"/></button>;
}
