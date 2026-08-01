"use client";

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

function fallbackFor(pathname:string) {
  if(pathname.startsWith('/app/loads/pstl/'))return '/app/loads?board=SHARED';
  if(pathname.startsWith('/app/loads/route/'))return '/app/loads?board=SHARED&sharedMode=ROUTE';
  if(pathname==='/app/shipments/new')return '/app/shipments?view=MY_LOADS';
  if(pathname.startsWith('/app/shipments/'))return '/app/shipments';
  if(pathname.startsWith('/app/capacity/'))return '/app/capacity';
  if(pathname.startsWith('/app/fleet/'))return '/app/fleet';
  if(pathname.startsWith('/app/providers/'))return '/app/providers';
  return null;
}

function isWorkspacePath(value:string|null) {
  return Boolean(value&&(value.startsWith('/app/')||value.startsWith('/admin/')));
}

export function WorkspaceBackButton() {
  const router=useRouter();
  const pathname=usePathname();
  const searchParams=useSearchParams();
  const fallback=fallbackFor(pathname);
  const [previous,setPrevious]=React.useState(null as string|null);
  const query=searchParams.toString();
  const current=query?`${pathname}?${query}`:pathname;

  React.useEffect(()=>{
    const stored=sessionStorage.getItem('loadgistic:workspace-current');
    if(stored!==current){
      if(isWorkspacePath(stored))setPrevious(stored);
      sessionStorage.setItem('loadgistic:workspace-current',current);
    }
  },[current]);

  if(!fallback)return null;
  return <a
    href={fallback}
    className="workspace-back"
    title="Back"
    aria-label="Back to previous workspace page"
    onClick={event=>{
      event.preventDefault();
      if(previous&&previous!==current&&window.history.length>1)router.back();
      else router.push(fallback);
    }}
  ><ArrowLeft aria-hidden="true"/><span>Back</span></a>;
}
