"use client";

import React from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

type NamedPoint={lat:number;lng:number;label:string};
type LocationPoint=NamedPoint&{radiusKm:number};

function FitShipment({origin,destination,location,status}:{origin:NamedPoint;destination:NamedPoint;location:LocationPoint;status:string}){
  const map=useMap();
  React.useEffect(()=>{
    const bounds=L.latLngBounds([]);
    bounds.extend([location.lat,location.lng]);
    bounds.extend(status==='TO_PICKUP'?[origin.lat,origin.lng]:[destination.lat,destination.lng]);
    bounds.extend(L.latLng(location.lat,location.lng).toBounds(Math.max(location.radiusKm,5)*2100));
    map.fitBounds(bounds.pad(.16),{animate:false,maxZoom:9});
  },[destination.lat,destination.lng,location.lat,location.lng,location.radiusKm,map,origin.lat,origin.lng,status]);
  return null;
}

export default function TrackingLocationMapLeaflet({origin,destination,location,status}:{origin:NamedPoint;destination:NamedPoint;location:LocationPoint;status:string}){
  const target=status==='TO_PICKUP'?origin:destination;
  return <div className="tracking-location-map"><MapContainer center={[location.lat,location.lng]} zoom={7} minZoom={5} maxZoom={13} maxBounds={[[2.5,32],[15.5,49.5]]} scrollWheelZoom={false} attributionControl>
    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
    <FitShipment origin={origin} destination={destination} location={location} status={status}/>
    <Polyline positions={[[location.lat,location.lng],[target.lat,target.lng]]} pathOptions={{color:'#0d6b6e',weight:4,dashArray:'8 8'}} interactive={false}/>
    <Circle center={[location.lat,location.lng]} radius={location.radiusKm*1000} pathOptions={{color:'#7c3aed',weight:4,dashArray:'8 7',fillColor:'#a78bfa',fillOpacity:.08}}><Tooltip direction="top"><strong>{location.label}</strong><br/>Approximate within {location.radiusKm} km</Tooltip></Circle>
    <CircleMarker center={[origin.lat,origin.lng]} radius={8} pathOptions={{color:'#fff',weight:3,fillColor:'#0d6b6e',fillOpacity:1}}><Tooltip direction="top">Pickup · {origin.label}</Tooltip></CircleMarker>
    <CircleMarker center={[destination.lat,destination.lng]} radius={8} pathOptions={{color:'#fff',weight:3,fillColor:'#f2b01e',fillOpacity:1}}><Tooltip direction="top">Drop-off · {destination.label}</Tooltip></CircleMarker>
  </MapContainer></div>;
}
