"use client";

import React from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';

type Point={lat:number;lng:number};
type Signal={id:string;provider_name:string;platform_number?:string;status:string;available_percent?:number;cargo_configuration?:string;availability_geometry:string;location_lat?:number;location_lng?:number;location_precision_km?:number;work_radius_km?:number;current_origin_lat?:number;current_origin_lng?:number;current_destination_lat?:number;current_destination_lng?:number;recurring_corridors?:any[]};

function hasCoordinate(value:unknown){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
const ETHIOPIA_MAP_BOUNDS=L.latLngBounds([3.3,32.9],[15,48]);

function Bounds({items,viewer,selectedId}:{items:Signal[];viewer:Point|null;selectedId:string|null}){
  const map=useMap();
  React.useEffect(()=>{
    const selected=items.find(item=>item.id===selectedId);
    if(selected){
      const selectedBounds=L.latLngBounds([]);
      if(hasCoordinate(selected.location_lat)&&hasCoordinate(selected.location_lng))selectedBounds.extend(L.latLng(Number(selected.location_lat),Number(selected.location_lng)).toBounds(Math.max(Number(selected.location_precision_km)||20,selected.availability_geometry==='RADIUS'?Number(selected.work_radius_km)||50:0)*2200));
      if(hasCoordinate(selected.current_origin_lat)&&hasCoordinate(selected.current_origin_lng))selectedBounds.extend([Number(selected.current_origin_lat),Number(selected.current_origin_lng)]);
      if(hasCoordinate(selected.current_destination_lat)&&hasCoordinate(selected.current_destination_lng))selectedBounds.extend([Number(selected.current_destination_lat),Number(selected.current_destination_lng)]);
      if(selectedBounds.isValid()){const size=map.getSize();const desktop=size.x>760;map.fitBounds(selectedBounds,{paddingTopLeft:[32,32],paddingBottomRight:desktop?[Math.min(420,Math.round(size.x*.36)),32]:[32,Math.min(300,Math.round(size.y*.45))],maxZoom:10,animate:false});return;}
    }
    if(viewer){map.fitBounds(L.latLng(viewer.lat,viewer.lng).toBounds(140_000),{padding:[28,28],maxZoom:9,animate:false});return;}
    const bounds=L.latLngBounds([]);
    for(const item of items){
      if(hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng))bounds.extend([Number(item.location_lat),Number(item.location_lng)]);
      if(hasCoordinate(item.current_origin_lat)&&hasCoordinate(item.current_origin_lng))bounds.extend([Number(item.current_origin_lat),Number(item.current_origin_lng)]);
      if(hasCoordinate(item.current_destination_lat)&&hasCoordinate(item.current_destination_lng))bounds.extend([Number(item.current_destination_lat),Number(item.current_destination_lng)]);
    }
    if(bounds.isValid())map.fitBounds(bounds,{padding:[28,28],maxZoom:9,animate:false});
  },[items,map,selectedId,viewer]);
  return null;
}

function truckMarker(item:Signal,selected=false){
  const partial=item.status==='PARTIAL';
  const availablePercent=partial?Math.max(0,Math.min(100,Number(item.available_percent)||0)):100;
  const statusClass=partial?'partial':'empty';
  const statusLabel=partial?`${availablePercent}% open`:'Empty';
  const capacityColor=availablePercent>=70?'#16a34a':availablePercent>=40?'#facc15':availablePercent>=20?'#f97316':'#dc2626';
  const markerConfiguration=item.cargo_configuration==='Heavy Rigid Stake Body Truck + Trailer'?'Heavy Rigid Stake Body Truck':item.cargo_configuration;
  const image=vehicleConfigurationImage(markerConfiguration);
  const size:[number,number]=selected?[92,104]:[78,88];
  return L.divIcon({className:`capacity-truck-map-marker vehicle-image-marker ${statusClass}${selected?' selected':''}`,html:`<span class="vehicle-marker-image" style="--capacity-progress:${availablePercent*3.6}deg;--capacity-color:${capacityColor}"><span class="vehicle-marker-content"><img src="${image}" alt=""/><strong>${statusLabel}</strong></span></span>`,iconSize:size,iconAnchor:[size[0]/2,size[1]]});
}

function markerPoint(item:Signal):[number,number]|null{
  if(hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng))return [Number(item.location_lat),Number(item.location_lng)];
  if(item.availability_geometry==='ROUTE'&&hasCoordinate(item.current_origin_lat)&&hasCoordinate(item.current_origin_lng)&&hasCoordinate(item.current_destination_lat)&&hasCoordinate(item.current_destination_lng))return [(Number(item.current_origin_lat)+Number(item.current_destination_lat))/2,(Number(item.current_origin_lng)+Number(item.current_destination_lng))/2];
  return null;
}

function CapacityMarkers({items,selectedId,onSelect}:{items:Signal[];selectedId:string|null;onSelect:(id:string)=>void}){
  const map=useMap();
  const [,setRevision]=React.useState(0);
  useMapEvents({zoomend:()=>setRevision((value:number)=>value+1),moveend:()=>setRevision((value:number)=>value+1)});
  const selected=items.find(item=>item.id===selectedId);
  if(selected){const point=markerPoint(selected);return point?<Marker position={point} icon={truckMarker(selected,true)} zIndexOffset={2000}/>:null;}
  const zoom=map.getZoom();
  const groups=new Map<string,{point:[number,number];items:Signal[]}>();
  for(const item of items){
    const point=markerPoint(item);if(!point)continue;
    const pixel=map.project(point,zoom);const cell=zoom>=12?32:zoom>=10?54:72;
    const key=`${Math.floor(pixel.x/cell)}:${Math.floor(pixel.y/cell)}`;
    const current=groups.get(key);if(current){current.items.push(item);current.point=[(current.point[0]*(current.items.length-1)+point[0])/current.items.length,(current.point[1]*(current.items.length-1)+point[1])/current.items.length];}else groups.set(key,{point,items:[item]});
  }
  return <>{[...groups.entries()].map(([key,group])=>{
    if(group.items.length===1){const item=group.items[0];return <Marker key={key} position={group.point} icon={truckMarker(item)} eventHandlers={{click:()=>onSelect(item.id)}}><Tooltip direction="top" offset={[0,-78]} opacity={1} className="capacity-marker-tooltip">{item.cargo_configuration||'Truck'} · {item.status==='PARTIAL'?`${item.available_percent}% open`:'Empty'}<br/>{item.provider_name}<br/>{item.availability_geometry==='RADIUS'?'Current radius':'Current corridor'}<br/>Select for details</Tooltip></Marker>;}
    if(zoom>=12){const center=map.project(group.point,zoom);const radius=Math.max(34,Math.min(58,group.items.length*7));return <React.Fragment key={key}>{group.items.map((item,index)=>{const angle=(Math.PI*2*index)/group.items.length;const point=map.unproject(L.point(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius),zoom);return <Marker key={item.id} position={point} icon={truckMarker(item)} eventHandlers={{click:()=>onSelect(item.id)}}><Tooltip direction="top" offset={[0,-78]} opacity={1} className="capacity-marker-tooltip">{item.cargo_configuration||'Truck'} · {item.status==='PARTIAL'?`${item.available_percent}% open`:'Empty'}<br/>{item.provider_name}<br/>{item.availability_geometry==='RADIUS'?'Current radius':'Current corridor'}<br/>Select for details</Tooltip></Marker>;})}</React.Fragment>;}
    const icon=L.divIcon({className:'capacity-map-cluster',html:`<span>${group.items.length}</span><small>trucks</small>`,iconSize:[54,54],iconAnchor:[27,27]});
    return <Marker key={key} position={group.point} icon={icon} eventHandlers={{click:()=>map.setView(group.point,Math.min(13,zoom+3),{animate:false})}}><Tooltip direction="top">{group.items.length} available trucks<br/>Zoom in to see each truck</Tooltip></Marker>;
  })}</>;
}

export function PublicCapacityMapLeaflet({items,viewer,selectedId,onSelect}:{items:Signal[];viewer:Point|null;selectedId:string|null;onSelect:(id:string)=>void}){
  return <div className="public-capacity-map" aria-label="Map of available trucks">
    <MapContainer center={[9.1,40.2]} zoom={7} minZoom={6} maxZoom={13} maxBounds={ETHIOPIA_MAP_BOUNDS} maxBoundsViscosity={1} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <Bounds items={items} viewer={viewer} selectedId={selectedId}/>
      {viewer?<CircleMarker center={[viewer.lat,viewer.lng]} radius={8} pathOptions={{className:'public-viewer-location-marker',color:'#6d28d9',fillColor:'#8b5cf6',fillOpacity:1,weight:3}}><Tooltip direction="top" offset={[0,-10]} opacity={1} className="capacity-location-tooltip">Your search location</Tooltip></CircleMarker>:null}
      {items.filter(item=>item.id===selectedId).map(item=><React.Fragment key={item.id}>
        {hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)?<Circle center={[Number(item.location_lat),Number(item.location_lng)]} radius={(Number(item.location_precision_km)||20)*1000} pathOptions={{className:'map-location-privacy-circle',color:'#7c3aed',weight:3,fillColor:'#a78bfa',fillOpacity:.14,dashArray:'5 6'}}><Tooltip>{item.provider_name}<br/>Approximate current location · {item.location_precision_km||20} km radius</Tooltip></Circle>:null}
        {item.availability_geometry==='RADIUS'&&hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)?<Circle center={[Number(item.location_lat),Number(item.location_lng)]} radius={(Number(item.work_radius_km)||50)*1000} pathOptions={{color:'#064e3b',weight:5,fillColor:'#34d399',fillOpacity:.18}}><Tooltip>{item.provider_name}<br/>{item.work_radius_km||50} km working radius around the approximate location</Tooltip></Circle>:null}
        {item.availability_geometry==='ROUTE'&&hasCoordinate(item.current_origin_lat)&&hasCoordinate(item.current_origin_lng)&&hasCoordinate(item.current_destination_lat)&&hasCoordinate(item.current_destination_lng)?<Polyline positions={[[Number(item.current_origin_lat),Number(item.current_origin_lng)],[Number(item.current_destination_lat),Number(item.current_destination_lng)]]} pathOptions={{color:'#eab308',weight:6,opacity:.9}}><Tooltip>{item.provider_name}<br/>Current available corridor</Tooltip></Polyline>:null}
        {(item.recurring_corridors||[]).slice(0,2).map(corridor=>hasCoordinate(corridor.origin_lat)&&hasCoordinate(corridor.origin_lng)&&hasCoordinate(corridor.destination_lat)&&hasCoordinate(corridor.destination_lng)?<Polyline key={corridor.id} positions={[[Number(corridor.origin_lat),Number(corridor.origin_lng)],[Number(corridor.destination_lat),Number(corridor.destination_lng)]]} pathOptions={{color:'#2563eb',weight:2,dashArray:'4 8',opacity:.75}}><Tooltip>{item.provider_name}<br/>{corridor.origin} ↔ {corridor.destination}<br/>Two-way regular corridor · confirm availability</Tooltip></Polyline>:null)}
      </React.Fragment>)}
      <CapacityMarkers items={items} selectedId={selectedId} onSelect={onSelect}/>
    </MapContainer>
    <div className="ethiopia-map-label">Ethiopia freight map</div>
    <div className="public-map-legend" aria-label="Map key"><span className="empty-status">Empty truck</span><span className="partial-status">Partial capacity</span><span className="privacy">Approximate location radius</span><span className="radius">Current radius</span><span className="current-route">Current corridor</span><span className="corridor">Two-way regular corridor</span></div>
  </div>;
}
