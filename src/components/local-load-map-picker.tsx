"use client";

import dynamic from 'next/dynamic';
import {SurfaceSkeleton} from './loading-state';

const Picker=dynamic(()=>import('./local-load-map-picker-leaflet').then(module=>module.LeafletLocalLoadMapPicker),{
  ssr:false,
  loading:()=> <SurfaceSkeleton kind="map" className="local-pin-map loading-map" label="Loading local map"/>
});

export function LocalLoadMapPicker({center}:{center?:{lat:number;lng:number}|null}) {
  return <Picker center={center}/>;
}
