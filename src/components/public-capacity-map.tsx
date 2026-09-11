"use client";

import dynamic from 'next/dynamic';

const Map=dynamic(()=>import('./public-capacity-map-leaflet').then(module=>module.PublicCapacityMapLeaflet),{ssr:false,loading:()=> <div className="public-capacity-map loading-map">Loading capacity map…</div>});

export function PublicCapacityMap(props:any){return <Map {...props}/>;}
