"use client";

import React from 'react';
import {MapContainer,ZoomControl,useMap} from 'react-leaflet';
import {BaseMapTiles} from './base-map-tiles';

function ResizeBasemap(){
  const map=useMap();
  React.useEffect(()=>{
    const resize=()=>map.invalidateSize({animate:false,pan:false});
    const observer=new ResizeObserver(resize);observer.observe(map.getContainer());resize();
    return()=>observer.disconnect();
  },[map]);
  return null;
}

// This public surface accepts no shipment data and makes no location request.
export default function TrackingEntryMapLeaflet(){
  return <MapContainer center={[9,39.5]} zoom={5} minZoom={2} maxZoom={13} scrollWheelZoom={false} attributionControl zoomControl={false}>
    <BaseMapTiles/>
    <ZoomControl position="topleft"/>
    <ResizeBasemap/>
  </MapContainer>;
}
