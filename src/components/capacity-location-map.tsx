"use client";

import dynamic from 'next/dynamic';

const CapacityLocationMapLeaflet=dynamic(
  ()=>import('./capacity-location-map-leaflet').then(module=>module.CapacityLocationMapLeaflet),
  {ssr:false,loading:()=> <div className="capacity-location-map loading-map" aria-label="Loading capacity map">Loading map…</div>}
);

type Point={lat:number;lng:number};
type Corridor={id:string;origin:string;destination:string;origin_lat:number;origin_lng:number;destination_lat:number;destination_lng:number};

export function CapacityLocationMap({center,radiusKm,workRadiusKm,route,corridors=[]}:{center:Point;radiusKm:number;workRadiusKm?:number|null;route?:{origin:Point;destination:Point}|null;corridors?:Corridor[]}){
  return <CapacityLocationMapLeaflet center={center} radiusKm={radiusKm} workRadiusKm={workRadiusKm} route={route} corridors={corridors}/>;
}
