"use client";

import React from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';

function FitCoverage({points}:{points:{lat:number;lng:number;radiusKm?:number}[]}) {
  const map=useMap();
  React.useEffect(()=>{
    if(!points.length)return;
    const bounds=new LatLngBounds([]);
    for(const point of points){
      const delta=(point.radiusKm||0)/111;
      bounds.extend([point.lat-delta,point.lng-delta]);
      bounds.extend([point.lat+delta,point.lng+delta]);
    }
    map.fitBounds(bounds.pad(.12),{maxZoom:points.length===1?10:9});
  },[map,points]);
  return null;
}

export function LeafletRouteMap({ routes, comparisonRoutes = [],areas=[],comparisonAreas=[] }: { routes:any[]; comparisonRoutes?:any[];areas?:any[];comparisonAreas?:any[] }) {
  const routePoints=(route:any)=>({
    from:Number.isFinite(Number(route.origin_lat))&&Number.isFinite(Number(route.origin_lng))
      ? {name:route.origin,lat:Number(route.origin_lat),lng:Number(route.origin_lng)}
      : null,
    to:Number.isFinite(Number(route.destination_lat))&&Number.isFinite(Number(route.destination_lng))
      ? {name:route.destination,lat:Number(route.destination_lat),lng:Number(route.destination_lng)}
      : null
  });
  const projected = routes.map((route:any) => ({...route,...routePoints(route),group:'profile'}));
  const comparisons = comparisonRoutes.map((route:any) => ({...route,...routePoints(route),group:'viewer'}));
  const visible = [...projected,...comparisons].filter(route => route.from && route.to);
  const projectedAreas=areas.filter(area=>Number.isFinite(Number(area.center_lat))&&Number.isFinite(Number(area.center_lng))).map(area=>({...area,group:'profile'}));
  const viewerAreas=comparisonAreas.filter(area=>Number.isFinite(Number(area.center_lat))&&Number.isFinite(Number(area.center_lng))).map(area=>({...area,group:'viewer'}));
  const visibleAreas=[...projectedAreas,...viewerAreas];
  const unknown = [...new Set([...projected,...comparisons].flatMap(route => [route.from ? null : route.origin,route.to ? null : route.destination]).filter(Boolean))];
  const markers = new Map();
  for (const route of visible) {
    markers.set(route.from.name,route.from);
    markers.set(route.to.name,route.to);
  }
  function routeStyle(route:any) {
    if(route.group==='viewer')return {color:'#c45116',weight:6,opacity:.96,dashArray:'12 8'};
    return {color:'#1769e0',weight:5,opacity:.82};
  }
  const fitPoints=[
    ...visible.flatMap(route=>[route.from,route.to]).map(point=>({lat:point.lat,lng:point.lng})),
    ...visibleAreas.map(area=>({lat:Number(area.center_lat),lng:Number(area.center_lng),radiusKm:Number(area.radius_km)}))
  ];
  return <div className="route-map-block">
    <div className="route-map" aria-label="Approximate coverage map">
      <MapContainer center={[9.1,39.7]} zoom={6} minZoom={5} maxZoom={10} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {visible.map((route:any,index:number)=><Polyline key={`${route.group}-${route.id||index}`} positions={[[route.from.lat,route.from.lng],[route.to.lat,route.to.lng]]} pathOptions={routeStyle(route)}/>)}
        {visibleAreas.map((area:any,index:number)=><Circle key={`${area.group}-area-${area.id||index}`} center={[area.center_lat,area.center_lng]} radius={Number(area.radius_km)*1000} pathOptions={area.group==='viewer'?{color:'#c45116',weight:4,opacity:.96,dashArray:'10 7',fillColor:'#c45116',fillOpacity:.12}:{color:'#1769e0',weight:3,opacity:.86,fillColor:'#1769e0',fillOpacity:.15}}><Tooltip permanent direction="center">{area.place_label}<br/>{area.radius_km} km</Tooltip></Circle>)}
        {[...markers.entries()].map(([name,marker]:any)=><CircleMarker key={name} center={[marker.lat,marker.lng]} radius={6} pathOptions={{color:'#0b3f91',fillColor:'#ffffff',fillOpacity:1,weight:3}}><Tooltip permanent direction="top" offset={[0,-5]}>{name}</Tooltip></CircleMarker>)}
        <FitCoverage points={fitPoints}/>
      </MapContainer>
      <div className="route-map-legend">{routes.length||areas.length?<span><i className="profile"/>Profile coverage</span>:null}{comparisonRoutes.length||comparisonAreas.length?<span><i className="viewer"/>Your coverage</span>:null}</div>
    </div>
    <p className="meta">Approximate city-radius areas and city-to-city lines over OpenStreetMap. They are not exact facilities, live movement, or guaranteed road paths.</p>
    {unknown.length?<p className="map-unavailable">Map placement is unavailable for legacy locations that have not been confirmed from the place catalog: {unknown.join(', ')}.</p>:null}
  </div>;
}
