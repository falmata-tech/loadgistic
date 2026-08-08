"use client";

import React from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

type Point={lat:number;lng:number};

function CapacityMapBounds({center,radiusKm,workRadiusKm,route}:{center:Point;radiusKm:number;workRadiusKm?:number|null;route?:{origin:Point;destination:Point}|null}){
  const map=useMap();
  React.useEffect(()=>{
    const bounds=L.latLng(center.lat,center.lng).toBounds(Math.max(radiusKm,workRadiusKm||0,5)*2200);
    if(route){bounds.extend([route.origin.lat,route.origin.lng]);bounds.extend([route.destination.lat,route.destination.lng]);}
    map.fitBounds(bounds,{padding:[24,24],maxZoom:11,animate:false});
  },[center.lat,center.lng,map,radiusKm,workRadiusKm,route?.origin.lat,route?.origin.lng,route?.destination.lat,route?.destination.lng]);
  return null;
}

export function CapacityLocationMapLeaflet({center,radiusKm,workRadiusKm,route}:{center:Point;radiusKm:number;workRadiusKm?:number|null;route?:{origin:Point;destination:Point}|null}){
  return <div className="capacity-location-map" aria-label={`${radiusKm} kilometre published location privacy area`}>
    <MapContainer center={[center.lat,center.lng]} zoom={8} minZoom={5} maxZoom={13} scrollWheelZoom={false} dragging>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <CapacityMapBounds center={center} radiusKm={radiusKm} workRadiusKm={workRadiusKm} route={route}/>
      <Circle center={[center.lat,center.lng]} radius={radiusKm*1000} pathOptions={{color:'#7c3aed',weight:3,fillColor:'#a78bfa',fillOpacity:.14,dashArray:'5 6'}}/>
      {workRadiusKm?<Circle center={[center.lat,center.lng]} radius={workRadiusKm*1000} pathOptions={{color:'#058858',weight:4,fillColor:'#48d597',fillOpacity:.18}}/>:null}
      {route?<>
        <Polyline positions={[[route.origin.lat,route.origin.lng],[route.destination.lat,route.destination.lng]]} pathOptions={{color:'#e1ad00',weight:5,opacity:.9}}/>
        <CircleMarker center={[route.origin.lat,route.origin.lng]} radius={5} pathOptions={{color:'#8a6800',fillColor:'#ffd23f',fillOpacity:1,weight:2}}/>
        <CircleMarker center={[route.destination.lat,route.destination.lng]} radius={5} pathOptions={{color:'#8a6800',fillColor:'#ffd23f',fillOpacity:1,weight:2}}/>
      </>:null}
    </MapContainer>
    <div className="capacity-map-key"><span><i/>Location privacy</span>{workRadiusKm?<span><i className="work"/>Current working radius</span>:null}{route?<span><i className="route"/>Current available route</span>:null}</div>
  </div>;
}
