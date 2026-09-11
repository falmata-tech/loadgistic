"use client";

import React from 'react';
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BaseMapTiles } from '@/components/base-map-tiles';

type Point={lat:number;lng:number};type PlacePoint=Point&{label:string};type RegularSignal={id:string;geometry:'ROUTE'|'RADIUS';route_points:PlacePoint[];area_boundary:PlacePoint[];area_center_lat?:number;area_center_lng?:number;area_center_label?:string};
const EAST_AFRICA_MAP_BOUNDS:L.LatLngBoundsExpression=[[-12.5,28],[18,52.5]];

function Bounds({center,radiusKm,areaCenter,areaBoundary,routePoints,regularSignals}:{center:Point;radiusKm:number;areaCenter:Point|null;areaBoundary:PlacePoint[];routePoints:PlacePoint[];regularSignals:RegularSignal[]}){const map=useMap();React.useEffect(()=>{const bounds=L.latLng(center.lat,center.lng).toBounds(Math.max(radiusKm,5)*2200);if(areaCenter)bounds.extend([areaCenter.lat,areaCenter.lng]);areaBoundary.forEach(point=>bounds.extend([point.lat,point.lng]));routePoints.forEach(point=>bounds.extend([point.lat,point.lng]));regularSignals.forEach(signal=>(signal.geometry==='RADIUS'?signal.area_boundary:signal.route_points).forEach(point=>bounds.extend([point.lat,point.lng])));const compact=map.getSize().x<=760;map.fitBounds(bounds,{paddingTopLeft:[compact?16:24,compact?88:76],paddingBottomRight:[compact?16:24,compact?112:94],maxZoom:11,animate:false});},[areaBoundary,areaCenter,center.lat,center.lng,map,radiusKm,regularSignals,routePoints]);return null;}

function ResizeMap(){const map=useMap();React.useEffect(()=>{const host=map.getContainer().parentElement;if(!host||typeof ResizeObserver==='undefined')return;let frame=0;const resize=()=>{window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(()=>map.invalidateSize({animate:false,pan:false}));};const observer=new ResizeObserver(resize);observer.observe(host);resize();return()=>{observer.disconnect();window.cancelAnimationFrame(frame);};},[map]);return null;}

export function CapacityLocationMapLeaflet({center,radiusKm,areaCenter=null,areaBoundary=[],routePoints=[],regularSignals=[],availabilityStatus='EMPTY',showLegend=true,showTruckLabel=true}:{center:Point;radiusKm:number;areaCenter?:Point|null;areaBoundary?:PlacePoint[];routePoints?:PlacePoint[];regularSignals?:RegularSignal[];availabilityStatus?:string;showLegend?:boolean;showTruckLabel?:boolean}){
  const capacityColor=availabilityStatus==='PARTIAL'?'#eab308':'#16a34a';
  const capacityLabel=availabilityStatus==='PARTIAL'?'Partial availability':'Empty availability';
  const currentTooltipClass=`capacity-route-tooltip ${availabilityStatus==='PARTIAL'?'partial':'empty'}`;
  return <div className="capacity-location-map" aria-label={`${radiusKm} kilometre approximate truck location`}>
    <MapContainer center={[center.lat,center.lng]} zoom={8} minZoom={5} maxZoom={13} maxBounds={EAST_AFRICA_MAP_BOUNDS} maxBoundsViscosity={0.85} scrollWheelZoom={false} dragging>
      <BaseMapTiles/>
      <ResizeMap/>
      <Bounds center={center} radiusKm={radiusKm} areaCenter={areaCenter} areaBoundary={areaBoundary} routePoints={routePoints} regularSignals={regularSignals}/>
      <Circle center={[center.lat,center.lng]} radius={radiusKm*1000} pathOptions={{color:'#7c3aed',weight:7,fill:false,dashArray:'7 7'}}><Tooltip className="capacity-route-tooltip location">Approximate truck location<br/>Within {radiusKm} km · not an exact position</Tooltip></Circle>
      {areaBoundary.length>=3?<Polygon positions={areaBoundary.map(point=>[point.lat,point.lng])} pathOptions={{color:capacityColor,weight:8,fill:false}}><Tooltip className={currentTooltipClass}>{capacityLabel} Service area<br/>{areaBoundary.map(point=>point.label).join(' · ')}<br/>Confirm current availability and cargo fit</Tooltip></Polygon>:null}
      {areaCenter?<CircleMarker center={[areaCenter.lat,areaCenter.lng]} radius={5} pathOptions={{color:capacityColor,fillColor:'#fff',fillOpacity:1,weight:2}}><Tooltip className={currentTooltipClass}>Service area center</Tooltip></CircleMarker>:null}
      {routePoints.length>=2?<Polyline positions={routePoints.map(point=>[point.lat,point.lng])} pathOptions={{color:capacityColor,weight:8,opacity:.95}}><Tooltip className={currentTooltipClass}>{capacityLabel} route<br/>{routePoints.map(point=>point.label).join(' → ')}<br/>Confirm current availability and cargo fit</Tooltip></Polyline>:null}
      {regularSignals.map(signal=>signal.geometry==='RADIUS'?<Polygon key={signal.id} positions={signal.area_boundary.map(point=>[point.lat,point.lng])} pathOptions={{color:'#2563eb',weight:7,dashArray:'6 7',fill:false}}><Tooltip className="capacity-route-tooltip regular">{signal.area_center_label||'Regular Service area'}<br/>Regular service · confirm current availability</Tooltip></Polygon>:<Polyline key={signal.id} positions={signal.route_points.map(point=>[point.lat,point.lng])} pathOptions={{color:'#2563eb',weight:7,dashArray:'5 8',opacity:.9}}><Tooltip className="capacity-route-tooltip regular">{signal.route_points.map(point=>point.label).join(' ↔ ')}<br/>Regular capacity route · confirm current availability</Tooltip></Polyline>)}
      <CircleMarker center={[center.lat,center.lng]} radius={15} pathOptions={{className:`capacity-setting-truck-marker-halo ${availabilityStatus==='PARTIAL'?'partial':'empty'}`,color:capacityColor,weight:5,fillColor:'#fff',fillOpacity:.72}}/>
      <CircleMarker center={[center.lat,center.lng]} radius={9} pathOptions={{className:'capacity-setting-truck-marker',color:'#fff',weight:4,fillColor:'#4c1d95',fillOpacity:1}}>{showTruckLabel?<Tooltip className="capacity-setting-truck-label" permanent direction="top" offset={[0,-9]}>Truck area</Tooltip>:<Tooltip direction="top" offset={[0,-9]}>Approximate truck location</Tooltip>}</CircleMarker>
    </MapContainer>
    {showLegend?<div className="capacity-map-key"><span><i className={`truck ${availabilityStatus==='PARTIAL'?'partial-truck':'empty-truck'}`}/>{availabilityStatus==='PARTIAL'?'Partial':'Empty'} truck marker</span><span><i/>Approximate location radius</span>{areaBoundary.length>=3?<span><i className={availabilityStatus==='PARTIAL'?'partial-area':'empty-area'}/>{capacityLabel} area</span>:null}{routePoints.length>=2?<span><i className={availabilityStatus==='PARTIAL'?'partial-route':'empty-route'}/>{capacityLabel} route</span>:null}{regularSignals.length?<span><i className="corridor"/>Regular service</span>:null}</div>:null}
  </div>;
}
