"use client";

import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import { getPlaceCoordinate } from '@/lib/ethiopia-places.js';

export function LeafletRouteMap({ routes, comparisonRoutes = [] }: { routes:any[]; comparisonRoutes?:any[] }) {
  const projected = routes.map((route:any) => ({...route,from:getPlaceCoordinate(route.origin),to:getPlaceCoordinate(route.destination),group:'profile'}));
  const comparisons = comparisonRoutes.map((route:any) => ({...route,from:getPlaceCoordinate(route.origin),to:getPlaceCoordinate(route.destination),group:'viewer'}));
  const visible = [...projected,...comparisons].filter(route => route.from && route.to);
  const unknown = [...new Set([...projected,...comparisons].flatMap(route => [route.from ? null : route.origin,route.to ? null : route.destination]).filter(Boolean))];
  const markers = new Map();
  for (const route of visible) {
    markers.set(route.from.name,route.from);
    markers.set(route.to.name,route.to);
  }
  const hasPreferred=projected.some((route:any)=>route.route_kind==='PROFILE'||!route.route_kind);
  const hasCurrent=projected.some((route:any)=>route.route_kind==='CURRENT_PARTIAL');
  const hasPlanned=projected.some((route:any)=>route.route_kind==='PLANNED');
  function routeStyle(route:any) {
    if(route.group==='viewer')return {color:'#c45116',weight:6,opacity:.96,dashArray:'12 8'};
    if(route.route_kind==='CURRENT_PARTIAL')return {color:'#16794d',weight:6,opacity:.88};
    if(route.route_kind==='PLANNED')return {color:'#b86708',weight:5,opacity:.84,dashArray:'10 7'};
    return {color:'#1769e0',weight:5,opacity:.82};
  }
  return <div className="route-map-block">
    <div className="route-map" aria-label="Approximate coverage route map">
      <MapContainer center={[9.1,39.7]} zoom={6} minZoom={5} maxZoom={10} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {visible.map((route:any,index:number)=><Polyline key={`${route.group}-${route.id||index}`} positions={[[route.from.lat,route.from.lng],[route.to.lat,route.to.lng]]} pathOptions={routeStyle(route)}/>)}
        {[...markers.entries()].map(([name,marker]:any)=><CircleMarker key={name} center={[marker.lat,marker.lng]} radius={6} pathOptions={{color:'#0b3f91',fillColor:'#ffffff',fillOpacity:1,weight:3}}><Tooltip permanent direction="top" offset={[0,-5]}>{name}</Tooltip></CircleMarker>)}
      </MapContainer>
      <div className="route-map-legend">{hasPreferred?<span><i className="profile"/>Profile route</span>:null}{hasCurrent?<span><i className="current"/>Current partial</span>:null}{hasPlanned?<span><i className="planned"/>Planned</span>:null}{comparisonRoutes.length?<span><i className="viewer"/>Your routes</span>:null}</div>
    </div>
    <p className="meta">Approximate city-to-city lines over OpenStreetMap. They are not exact facilities, live movement, or a guaranteed road path.</p>
    {unknown.length?<p className="map-unavailable">Map placement is unavailable for: {unknown.join(', ')}. These member-entered places remain included in route comparison.</p>:null}
  </div>;
}
