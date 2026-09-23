"use client";

import dynamic from 'next/dynamic';
import {SurfaceSkeleton} from './loading-state';

const Map=dynamic(()=>import('./public-capacity-map-leaflet').then(module=>module.PublicCapacityMapLeaflet),{ssr:false,loading:()=> <SurfaceSkeleton kind="map" className="public-capacity-map loading-map" label="Loading capacity map"/>});

export function PublicCapacityMap(props:any){return <Map {...props}/>;}
