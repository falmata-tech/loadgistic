"use client";
import React from 'react';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {Localized,Text} from './localization';
import {areaReturnPath} from '@/lib/workspace-area-navigation.js';
import styles from './workspace-area-switch.module.css';

type Area='marketplace'|'workspace';
// This remembers presentation only. No account/feed payload, credential or
// workspace authority is persisted here; the destination authorizes its request.
export function WorkspaceAreaSwitch({area,actorId}:{area:Area;actorId?:string}){
 const pathname=usePathname(),query=useSearchParams().toString();
 const currentArea:Area=pathname==='/workspaces'?'workspace':!actorId&&['/login','/apply','/signup','/join-fleet','/workspaces'].includes(pathname)?'workspace':area;
 const other:Area=currentArea==='workspace'?'marketplace':'workspace';
 const [bookmark,setBookmark]=React.useState(null as {actorId:string;area:Area;path:string}|null);
 const fallback=other==='marketplace'?'/':actorId?'/app/home':'/login';
 const target=bookmark&&bookmark.actorId===actorId&&bookmark.area===other?bookmark.path:fallback;
 React.useEffect(()=>{
  if(!actorId)return;
  try{
   const current=areaReturnPath(query?`${pathname}?${query}`:pathname,currentArea);
   if(current)sessionStorage.setItem(`loadgistic:area:${actorId}:${currentArea}`,current);
   const path=areaReturnPath(sessionStorage.getItem(`loadgistic:area:${actorId}:${other}`),other)||fallback;
   setBookmark({actorId,area:other,path});
  }catch{setBookmark(null);}
 },[actorId,currentArea,other,pathname,query,fallback]);
 return <Localized as="nav" copy={["aria-label"]} className={`workspace-area-switch ${styles.switcher}`} aria-label="Switch view">
  {([{key:'marketplace',label:'Marketplace'},{key:'workspace',label:'My workspace'}] as const).map(({key,label})=>key===currentArea
   ?<span key={key} className="active" aria-current="page"><Text message={label}/></span>
   :<Link key={key} href={target} onClick={()=>{if(key==='marketplace')try{sessionStorage.setItem('loadgistic:market-camera-return','1');}catch{}}}><Text message={label}/></Link>)}
 </Localized>;
}
