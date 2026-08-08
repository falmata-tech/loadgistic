"use client";

import React from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';

type Point={lat:number;lng:number};
type Signal={id:string;provider_name:string;availability_geometry:string;location_lat?:number;location_lng?:number;location_precision_km?:number;work_radius_km?:number;current_origin_lat?:number;current_origin_lng?:number;current_destination_lat?:number;current_destination_lng?:number;next_trip?:any;recurring_corridors?:any[]};

function hasCoordinate(value:unknown){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}

function Bounds({items,viewer,selectedId}:{items:Signal[];viewer:Point|null;selectedId:string|null}){
  const map=useMap();
  React.useEffect(()=>{
    const selected=items.find(item=>item.id===selectedId);
    if(selected){
      const selectedBounds=L.latLngBounds([]);
      if(hasCoordinate(selected.location_lat)&&hasCoordinate(selected.location_lng))selectedBounds.extend(L.latLng(Number(selected.location_lat),Number(selected.location_lng)).toBounds(Math.max(Number(selected.location_precision_km)||20,selected.availability_geometry==='RADIUS'?Number(selected.work_radius_km)||50:0)*2200));
      if(hasCoordinate(selected.current_origin_lat)&&hasCoordinate(selected.current_origin_lng))selectedBounds.extend([Number(selected.current_origin_lat),Number(selected.current_origin_lng)]);
      if(hasCoordinate(selected.current_destination_lat)&&hasCoordinate(selected.current_destination_lng))selectedBounds.extend([Number(selected.current_destination_lat),Number(selected.current_destination_lng)]);
      if(selected.next_trip&&hasCoordinate(selected.next_trip.origin_lat)&&hasCoordinate(selected.next_trip.origin_lng))selectedBounds.extend([Number(selected.next_trip.origin_lat),Number(selected.next_trip.origin_lng)]);
      if(selected.next_trip&&hasCoordinate(selected.next_trip.destination_lat)&&hasCoordinate(selected.next_trip.destination_lng))selectedBounds.extend([Number(selected.next_trip.destination_lat),Number(selected.next_trip.destination_lng)]);
      for(const signal of selected.recurring_corridors||[]){
        if(signal.geometry==='RADIUS'&&hasCoordinate(signal.center_lat)&&hasCoordinate(signal.center_lng))selectedBounds.extend(L.latLng(Number(signal.center_lat),Number(signal.center_lng)).toBounds((Number(signal.radius_km)||50)*2200));
        if(signal.geometry==='ROUTE'&&hasCoordinate(signal.origin_lat)&&hasCoordinate(signal.origin_lng))selectedBounds.extend([Number(signal.origin_lat),Number(signal.origin_lng)]);
        if(signal.geometry==='ROUTE'&&hasCoordinate(signal.destination_lat)&&hasCoordinate(signal.destination_lng))selectedBounds.extend([Number(signal.destination_lat),Number(signal.destination_lng)]);
      }
      if(selectedBounds.isValid()){map.fitBounds(selectedBounds,{padding:[32,32],maxZoom:9,animate:false});return;}
    }
    const bounds=L.latLngBounds([]);
    if(viewer)bounds.extend([viewer.lat,viewer.lng]);
    for(const item of items){
      if(hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng))bounds.extend([Number(item.location_lat),Number(item.location_lng)]);
      if(hasCoordinate(item.current_origin_lat)&&hasCoordinate(item.current_origin_lng))bounds.extend([Number(item.current_origin_lat),Number(item.current_origin_lng)]);
      if(hasCoordinate(item.current_destination_lat)&&hasCoordinate(item.current_destination_lng))bounds.extend([Number(item.current_destination_lat),Number(item.current_destination_lng)]);
    }
    if(bounds.isValid())map.fitBounds(bounds,{padding:[28,28],maxZoom:9,animate:false});
  },[items,map,selectedId,viewer]);
  return null;
}

const truckMarker=L.divIcon({className:'capacity-truck-map-marker',html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17h4V5H2v12h2m6 0H8m10 0h2v-5l-3-3h-3v8h1m3 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>',iconSize:[42,42],iconAnchor:[21,21]});

function markerPoint(item:Signal):[number,number]|null{
  if(item.availability_geometry==='RADIUS'&&hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng))return [Number(item.location_lat),Number(item.location_lng)];
  if(item.availability_geometry==='ROUTE'&&hasCoordinate(item.current_origin_lat)&&hasCoordinate(item.current_origin_lng)&&hasCoordinate(item.current_destination_lat)&&hasCoordinate(item.current_destination_lng))return [(Number(item.current_origin_lat)+Number(item.current_destination_lat))/2,(Number(item.current_origin_lng)+Number(item.current_destination_lng))/2];
  return null;
}

function CapacityMarkers({items,onSelect}:{items:Signal[];onSelect:(id:string)=>void}){
  const map=useMap();
  const [revision,setRevision]=React.useState(0);
  useMapEvents({zoomend:()=>setRevision((value:number)=>value+1),moveend:()=>setRevision((value:number)=>value+1)});
  const zoom=map.getZoom();
  const groups=new Map<string,{point:[number,number];items:Signal[]}>();
  for(const item of items){
    const point=markerPoint(item);if(!point)continue;
    const pixel=map.project(point,zoom);const cell=zoom>=12?32:zoom>=10?54:72;
    const key=`${Math.floor(pixel.x/cell)}:${Math.floor(pixel.y/cell)}`;
    const current=groups.get(key);if(current){current.items.push(item);current.point=[(current.point[0]*(current.items.length-1)+point[0])/current.items.length,(current.point[1]*(current.items.length-1)+point[1])/current.items.length];}else groups.set(key,{point,items:[item]});
  }
  return <>{[...groups.entries()].map(([key,group])=>{
    if(group.items.length===1){const item=group.items[0];return <Marker key={`${key}-${revision}`} position={group.point} icon={truckMarker} eventHandlers={{click:()=>onSelect(item.id)}}><Tooltip direction="top">{item.provider_name}<br/>{item.availability_geometry==='RADIUS'?'Approximate privacy area':'Route signal · not current truck position'}<br/>Open capacity card</Tooltip></Marker>;}
    const icon=L.divIcon({className:'capacity-map-cluster',html:`<span>${group.items.length}</span><small>trucks</small>`,iconSize:[54,54],iconAnchor:[27,27]});
    return <Marker key={`${key}-${revision}`} position={group.point} icon={icon} eventHandlers={{click:()=>{const bounds=L.latLngBounds(group.items.map(item=>markerPoint(item)!).filter(Boolean));map.fitBounds(bounds,{padding:[70,70],maxZoom:Math.min(13,zoom+3)});}}}><Tooltip direction="top">{group.items.length} capacity signals<br/>Zoom in to separate trucks</Tooltip></Marker>;
  })}</>;
}

export function PublicCapacityMapLeaflet({items,viewer,selectedId,onSelect}:{items:Signal[];viewer:Point|null;selectedId:string|null;onSelect:(id:string)=>void}){
  return <div className="public-capacity-map" aria-label="Map of public truck capacity signals">
    <MapContainer center={[9.03,38.74]} zoom={6} minZoom={5} maxZoom={13} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <Bounds items={items} viewer={viewer} selectedId={selectedId}/>
      {viewer?<CircleMarker center={[viewer.lat,viewer.lng]} radius={8} pathOptions={{color:'#6d28d9',fillColor:'#8b5cf6',fillOpacity:1,weight:3}}><Tooltip permanent direction="top">You · kept in this browser</Tooltip></CircleMarker>:null}
      {items.filter(item=>item.id===selectedId).map(item=><React.Fragment key={item.id}>
        {hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)?<Circle center={[Number(item.location_lat),Number(item.location_lng)]} radius={(Number(item.location_precision_km)||20)*1000} pathOptions={{className:'map-location-privacy-circle',color:'#7c3aed',weight:3,fillColor:'#a78bfa',fillOpacity:.14,dashArray:'5 6'}}><Tooltip>{item.provider_name}<br/>{item.location_precision_km||20} km location privacy area</Tooltip></Circle>:null}
        {item.availability_geometry==='RADIUS'&&hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)?<Circle center={[Number(item.location_lat),Number(item.location_lng)]} radius={(Number(item.work_radius_km)||50)*1000} pathOptions={{color:'#064e3b',weight:5,fillColor:'#34d399',fillOpacity:.18}}><Tooltip>{item.provider_name}<br/>{item.work_radius_km||50} km working radius around an obscured center</Tooltip></Circle>:null}
        {item.availability_geometry==='ROUTE'&&hasCoordinate(item.current_origin_lat)&&hasCoordinate(item.current_origin_lng)&&hasCoordinate(item.current_destination_lat)&&hasCoordinate(item.current_destination_lng)?<Polyline positions={[[Number(item.current_origin_lat),Number(item.current_origin_lng)],[Number(item.current_destination_lat),Number(item.current_destination_lng)]]} pathOptions={{color:'#eab308',weight:6,opacity:.9}}><Tooltip>{item.provider_name}<br/>Selected current available route</Tooltip></Polyline>:null}
        {item.next_trip&&hasCoordinate(item.next_trip.origin_lat)&&hasCoordinate(item.next_trip.origin_lng)&&hasCoordinate(item.next_trip.destination_lat)&&hasCoordinate(item.next_trip.destination_lng)?<Polyline positions={[[Number(item.next_trip.origin_lat),Number(item.next_trip.origin_lng)],[Number(item.next_trip.destination_lat),Number(item.next_trip.destination_lng)]]} pathOptions={{color:'#f97316',weight:3,dashArray:'10 7',opacity:.9}}><Tooltip>{item.provider_name}<br/>Selected truck next trip</Tooltip></Polyline>:null}
        {(item.recurring_corridors||[]).slice(0,6).map(corridor=>corridor.geometry==='RADIUS'&&hasCoordinate(corridor.center_lat)&&hasCoordinate(corridor.center_lng)?<Circle key={corridor.id} center={[Number(corridor.center_lat),Number(corridor.center_lng)]} radius={(Number(corridor.radius_km)||50)*1000} pathOptions={{className:'map-recurring-work-area',color:'#0891b2',weight:3,dashArray:'2 7',fillColor:'#22d3ee',fillOpacity:.1}}><Tooltip>{item.provider_name}<br/>Recurring working area · {corridor.radius_km} km · confirm availability</Tooltip></Circle>:hasCoordinate(corridor.origin_lat)&&hasCoordinate(corridor.origin_lng)&&hasCoordinate(corridor.destination_lat)&&hasCoordinate(corridor.destination_lng)?<Polyline key={corridor.id} positions={[[Number(corridor.origin_lat),Number(corridor.origin_lng)],[Number(corridor.destination_lat),Number(corridor.destination_lng)]]} pathOptions={{color:'#2563eb',weight:2,dashArray:'4 8',opacity:.75}}><Tooltip>{item.provider_name}<br/>Recurring route · confirm availability</Tooltip></Polyline>:null)}
      </React.Fragment>)}
      <CapacityMarkers items={items} onSelect={onSelect}/>
    </MapContainer>
    <div className="public-map-legend"><span className="privacy">Location privacy</span><span className="radius">Current work radius</span><span className="current-route">Current route</span><span className="next-trip">Next trip</span><span className="corridor">Recurring route</span><span className="recurring-area">Recurring work area</span></div>
  </div>;
}
