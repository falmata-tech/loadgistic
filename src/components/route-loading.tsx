'use client';

import {usePathname} from 'next/navigation';
import {MapWorkspaceSkeleton,SurfaceSkeleton} from './loading-state';

// Authentication and the eventual shell are still unresolved here. Reserve the
// route's content geometry without inventing a signed-out header or account.
export function RouteLoading(){
  const pathname=usePathname();
  const map=pathname==='/'||pathname==='/app/home'||pathname==='/app/home/market';
  return <main className="app-route-loading" data-loading-surface={map?'map':'records'}>
    {map?<MapWorkspaceSkeleton/>:<SurfaceSkeleton label="Loading page"/>}
  </main>;
}
