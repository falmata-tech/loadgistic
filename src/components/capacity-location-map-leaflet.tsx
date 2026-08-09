"use client";

import React from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

type Point={lat:number;lng:number};
type Corridor={id:string;origin:string;destination:string;origin_lat:number;origin_lng:number;destination_lat:number;destination_lng:number};

function CapacityMapBounds({center,radiusKm,workRadiusKm,route,corridors}:{center:Point;radiusKm:number;workRadiusKm?:number|null;route?:{origin:Point;destination:Point}|null;corridors:Corridor[]}){
  const map=useMap();
  React.useEffect(()=>{
    const bounds=L.latLng(center.lat,center.lng).toBounds(Math.max(radiusKm,workRadiusKm||0,5)*2200);
    if(route){bounds.extend([route.origin.lat,route.origin.lng]);bounds.extend([route.destination.lat,route.destination.lng]);}
    for(const corridor of corridors){bounds.extend([corridor.origin_lat,corridor.origin_lng]);bounds.extend([corridor.destination_lat,corridor.destination_lng]);}
    map.fitBounds(bounds,{padding:[24,24],maxZoom:11,animate:false});
  },[center.lat,center.lng,corridors,map,radiusKm,workRadiusKm,route?.origin.lat,route?.origin.lng,route?.destination.lat,route?.destination.lng]);
  return null;
}

export function CapacityLocationMapLeaflet({center,radiusKm,workRadiusKm,route,corridors}:{center:Point;radiusKm:number;workRadiusKm?:number|null;route?:{origin:Point;destination:Point}|null;corridors:Corridor[]}){
  return <div className="capacity-location-map" aria-label={`${radiusKm} kilometre approximate truck location`}>
    <MapContainer center={[center.lat,center.lng]} zoom={8} minZoom={5} maxZoom={13} scrollWheelZoom={false} dragging>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <CapacityMapBounds center={center} radiusKm={radiusKm} workRadiusKm={workRadiusKm} route={route} corridors={corridors}/>
      <Circle center={[center.lat,center.lng]} radius={radiusKm*1000} pathOptions={{color:'#7c3aed',weight:3,fillColor:'#a78bfa',fillOpacity:.14,dashArray:'5 6'}}/>
      {workRadiusKm?<Circle center={[center.lat,center.lng]} radius={workRadiusKm*1000} pathOptions={{color:'#058858',weight:4,fillColor:'#48d597',fillOpacity:.18}}/>:null}
      {route?<>
        <Polyline positions={[[route.origin.lat,route.origin.lng],[route.destination.lat,route.destination.lng]]} pathOptions={{color:'#e1ad00',weight:5,opacity:.9}}/>
        <CircleMarker center={[route.origin.lat,route.origin.lng]} radius={5} pathOptions={{color:'#8a6800',fillColor:'#ffd23f',fillOpacity:1,weight:2}}/>
        <CircleMarker center={[route.destination.lat,route.destination.lng]} radius={5} pathOptions={{color:'#8a6800',fillColor:'#ffd23f',fillOpacity:1,weight:2}}/>
      </>:null}
      {corridors.map(corridor=><React.Fragment key={corridor.id}>
        <Polyline positions={[[corridor.origin_lat,corridor.origin_lng],[corridor.destination_lat,corridor.destination_lng]]} pathOptions={{color:'#2563eb',weight:3,dashArray:'5 8',opacity:.8}}><Tooltip>{corridor.origin} ↔ {corridor.destination}<br/>Two-way regular corridor · confirm availability</Tooltip></Polyline>
        <CircleMarker center={[corridor.origin_lat,corridor.origin_lng]} radius={4} pathOptions={{color:'#1e40af',fillColor:'#93c5fd',fillOpacity:1,weight:2}}/>
        <CircleMarker center={[corridor.destination_lat,corridor.destination_lng]} radius={4} pathOptions={{color:'#1e40af',fillColor:'#93c5fd',fillOpacity:1,weight:2}}/>
      </React.Fragment>)}
      <CircleMarker center={[center.lat,center.lng]} radius={15} pathOptions={{className:'capacity-setting-truck-marker-halo',color:'#facc15',weight:5,fillColor:'#6d28d9',fillOpacity:.22}}/>
      <CircleMarker center={[center.lat,center.lng]} radius={9} pathOptions={{className:'capacity-setting-truck-marker',color:'#ffffff',weight:4,fillColor:'#4c1d95',fillOpacity:1}}><Tooltip className="capacity-setting-truck-label" permanent direction="top" offset={[0,-9]}>Truck area</Tooltip></CircleMarker>
    </MapContainer>
    <div className="capacity-map-key"><span><i className="truck"/>Approximate truck location</span><span><i/>Approximate location radius</span>{workRadiusKm?<span><i className="work"/>Current working radius</span>:null}{route?<span><i className="route"/>Current available corridor</span>:null}{corridors.length?<span><i className="corridor"/>Two-way regular corridors</span>:null}</div>
  </div>;
}
