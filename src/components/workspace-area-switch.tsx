"use client";
import React from 'react';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {MapPinned,Truck} from 'lucide-react';
import {Localized,Text} from './localization';
import {areaReturnPath} from '@/lib/workspace-area-navigation.js';

// Actor-specific, tab-local URL bookmarks; no account or feed snapshots.
export function WorkspaceAreaSwitch({area,actorId}:{area:'marketplace'|'workspace';actorId:string}){
 const pathname=usePathname(),query=useSearchParams().toString();
 const [target,setTarget]=React.useState(area==='workspace'?'/':'/app/home');
 const other=area==='workspace'?'marketplace':'workspace';
 React.useEffect(()=>{
  try{
   const current=areaReturnPath(query?`${pathname}?${query}`:pathname,area);
   if(current)sessionStorage.setItem(`loadgistic:area:${actorId}:${area}`,current);
   setTarget(areaReturnPath(sessionStorage.getItem(`loadgistic:area:${actorId}:${other}`),other)||(other==='workspace'?'/app/home':'/'));
  }catch{/* Storage can be unavailable; direct navigation still works. */}
 },[actorId,area,other,pathname,query]);
 return <Localized as="nav" copy={["aria-label"]} className="workspace-area-switch" aria-label="Switch view">
  {([{key:'marketplace',label:'Marketplace',Icon:MapPinned},{key:'workspace',label:'My workspace',Icon:Truck}] as const).map(({key,label,Icon})=>key===area
   ?<span key={key} className="active" aria-current="page"><Icon aria-hidden="true"/><Text message={label}/></span>
   :<Link key={key} href={target} onClick={()=>{if(key==='marketplace')try{sessionStorage.setItem('loadgistic:market-camera-return','1');}catch{}}}><Icon aria-hidden="true"/><Text message={label}/></Link>)}
 </Localized>;
}
