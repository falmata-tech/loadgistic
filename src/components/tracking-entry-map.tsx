"use client";

import dynamic from 'next/dynamic';

const Basemap=dynamic(()=>import('./tracking-entry-map-leaflet'),{ssr:false});

export function TrackingEntryMap(){
  return <div className="tracking-entry-map"><Basemap/></div>;
}
