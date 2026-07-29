"use client";

import dynamic from 'next/dynamic';

const Picker=dynamic(()=>import('./local-load-map-picker-leaflet').then(module=>module.LeafletLocalLoadMapPicker),{
  ssr:false,
  loading:()=> <div className="local-pin-map loading-map" aria-label="Loading local map">Loading map...</div>
});

export function LocalLoadMapPicker({center}:{center?:{lat:number;lng:number}|null}) {
  return <Picker center={center}/>;
}
