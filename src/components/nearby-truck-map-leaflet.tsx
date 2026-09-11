"use client";

import React from 'react';
import { Circle, CircleMarker, MapContainer, Tooltip, useMap } from 'react-leaflet';
import { BaseMapTiles } from '@/components/base-map-tiles';

type Point={lat:number;lng:number};
type TruckArea={id:string;label:string;lat:number;lng:number;radiusKm:number};

function MapCenter({point}:{point:Point}) {
  const map=useMap();
  React.useEffect(()=>{map.setView([point.lat,point.lng],11);},[map,point]);
  return null;
}

export function NearbyTruckMapLeaflet({viewer,trucks}:{viewer:Point;trucks:TruckArea[]}) {
  return <div className="nearby-truck-map">
    <MapContainer center={[viewer.lat,viewer.lng]} zoom={11} minZoom={6} maxZoom={16} scrollWheelZoom>
      <BaseMapTiles/>
      <MapCenter point={viewer}/>
      <CircleMarker center={[viewer.lat,viewer.lng]} radius={8} pathOptions={{color:'#8a3ffc',fillColor:'#8a3ffc',fillOpacity:1,weight:3}}><Tooltip permanent direction="top">You · private</Tooltip></CircleMarker>
      {trucks.map(truck=><Circle key={truck.id} center={[truck.lat,truck.lng]} radius={truck.radiusKm*1000} pathOptions={{color:'#0b65d8',weight:3,fillColor:'#2f80ed',fillOpacity:.14}}><Tooltip direction="center">{truck.label}<br/>Approximate current location · {truck.radiusKm} km radius</Tooltip></Circle>)}
    </MapContainer>
  </div>;
}
