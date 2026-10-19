"use client";


import {Text,useTranslation} from '@/components/localization';
import React from 'react';
import {Circle,CircleMarker,MapContainer,Marker,Polyline,Tooltip,ZoomControl,useMap} from 'react-leaflet';
import L from 'leaflet';
import { BaseMapTiles } from '@/components/base-map-tiles';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';
import type {TrackingRoutePoint,TrackingReportedLocation,TrackingPublicTruck} from './tracking-map-data';
import {locationSourceLabel,locationSourceColor,locationSourceSvg} from '@/lib/location-source.js';
import sourceStyles from './location-source-badge.module.css';
import markerStyles from './tracking-location-map.module.css';

// Only known artwork and normalized published provenance enter this markup.
export function trackingMarkerContent(configuration:string|undefined,source:unknown,t:(value:string)=>string=value=>value){
 const label=locationSourceLabel(source),escaped=label?t(label).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!)):'';
 const badge=label?`<span class="${sourceStyles.badge}" style="color:${locationSourceColor(source)}" title="${escaped}">${locationSourceSvg(source)}</span>`:'';
 return `<span class="${markerStyles.frame}"><img class="${markerStyles.image}" src="${vehicleConfigurationImage(configuration)}" alt=""/>${badge}</span>`;
}

function FitShipment({route,location}:{route:TrackingRoutePoint[];location:TrackingReportedLocation|null}){
  const map=useMap();
  React.useEffect(()=>{
    const fit=()=>{
      map.invalidateSize({animate:false,pan:false});
      const bounds=L.latLngBounds(route.map(point=>[point.coordinate[1],point.coordinate[0]]));
      if(location)bounds.extend(L.latLng(location.coordinate[1],location.coordinate[0]).toBounds(location.radiusKm*2000));
      if(bounds.isValid())map.fitBounds(bounds.pad(.12),{animate:false,maxZoom:10,paddingTopLeft:[32,130],paddingBottomRight:[32,110]});
    };
    const host=map.getContainer(),observer=new ResizeObserver(fit);observer.observe(host);fit();
    return()=>observer.disconnect();
  },[route,location,map]);
  return null;
}

export default function TrackingLocationMapLeaflet({route,location,truck,onTruckClick}:{route:TrackingRoutePoint[];location:TrackingReportedLocation|null;truck:TrackingPublicTruck|null;onTruckClick:()=>void}){
  const {t}=useTranslation();
  const positions=route.map(point=>[point.coordinate[1],point.coordinate[0]] as [number,number]);
  const publishedSource=locationSourceLabel(location?.source);
  const markerLabel=[t('Reported vehicle area'),publishedSource?t(publishedSource):'',location?.demo===true?t('Demo location'):''].filter(Boolean).join(' · ');
  const icon=React.useMemo(()=>L.divIcon({className:`tracking-truck-marker ${markerStyles.marker}`,html:trackingMarkerContent(truck?.configuration,location?.source,t),iconSize:[68,76],iconAnchor:[34,68]}),[truck?.configuration,location?.source,t]);
  return <div className="tracking-location-map"><MapContainer center={positions[0]} zoom={7} minZoom={2} maxZoom={13} scrollWheelZoom={false} attributionControl zoomControl={false}>
    <BaseMapTiles/>
    <ZoomControl position="bottomright"/>
    <FitShipment route={route} location={location}/>
    <Polyline positions={positions} pathOptions={{className:'tracking-planned-route',color:'#0d6b6e',weight:4,dashArray:'9 8'}} interactive={false}/>
    {route.map((point,index)=><CircleMarker key={`${point.placeRef}-${index}`} center={positions[index]} radius={8} pathOptions={{className:'tracking-city-marker',color:'#fff',weight:3,fillColor:index===route.length-1?'#f2b01e':'#0d6b6e',fillOpacity:1}}><Tooltip direction="top" permanent><span className="tracking-city-label">{index+1}. {point.label}</span></Tooltip></CircleMarker>)}
    {location?<Circle center={[location.coordinate[1],location.coordinate[0]]} radius={location.radiusKm*1000} pathOptions={{className:'tracking-approximate-circle',color:'#1a73e8',weight:3,dashArray:'8 7',fillColor:'#1a73e8',fillOpacity:.1}}><Tooltip direction="top"><strong>{location.label}</strong><br/><Text message="Within {radius} km" values={{radius:location.radiusKm}}/></Tooltip></Circle>:null}
    {location&&truck?<Marker position={[location.coordinate[1],location.coordinate[0]]} icon={icon} alt={markerLabel} title={markerLabel} keyboard eventHandlers={{click:onTruckClick}}><Tooltip direction="top"><Text message="Reported vehicle area"/>{publishedSource?<><br/><Text message={publishedSource}/></>:null}{location.demo===true?<><br/><Text message="Demo location"/></>:null}{location.updatedAt?<><br/>{new Date(location.updatedAt).toLocaleString()}</>:null}</Tooltip></Marker>:null}
  </MapContainer></div>;
}
