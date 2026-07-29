"use client";

import React from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { MapPin, Navigation } from 'lucide-react';

type Point={lat:number;lng:number};

function MapCenter({center}:{center:Point}) {
  const map=useMap();
  React.useEffect(()=>{map.setView([center.lat,center.lng],12);},[center,map]);
  return null;
}

function PointCapture({mode,onPoint}:{mode:'pickup'|'dropoff';onPoint:(point:Point)=>void}) {
  useMapEvents({click(event){onPoint({lat:event.latlng.lat,lng:event.latlng.lng});}});
  return null;
}

export function LeafletLocalLoadMapPicker({center}:{center?:Point|null}) {
  const mapCenter=center||{lat:9.03,lng:38.74};
  const [mode,setMode]=React.useState('pickup' as 'pickup'|'dropoff');
  const [pickup,setPickup]=React.useState(null as Point|null);
  const [dropoff,setDropoff]=React.useState(null as Point|null);
  function capture(point:Point){
    if(mode==='pickup'){setPickup(point);setMode('dropoff');}
    else setDropoff(point);
  }
  return <div className="local-pin-picker">
    <div className="local-pin-toolbar">
      <div className="segmented-control">
        <label><input type="radio" checked={mode==='pickup'} onChange={()=>setMode('pickup')}/><span><Navigation aria-hidden="true"/>Pickup pin</span></label>
        <label><input type="radio" checked={mode==='dropoff'} onChange={()=>setMode('dropoff')}/><span><MapPin aria-hidden="true"/>Drop-off pin</span></label>
      </div>
      <span className="meta">Optional and private. Tap the map to place or move the selected pin.</span>
    </div>
    <div className="local-pin-map">
      <MapContainer center={[mapCenter.lat,mapCenter.lng]} zoom={12} minZoom={7} maxZoom={18} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        <MapCenter center={mapCenter}/>
        <PointCapture mode={mode} onPoint={capture}/>
        {pickup?<CircleMarker center={[pickup.lat,pickup.lng]} radius={9} pathOptions={{color:'#1769e0',fillColor:'#1769e0',fillOpacity:.9}}><Tooltip permanent direction="top">Pickup</Tooltip></CircleMarker>:null}
        {dropoff?<CircleMarker center={[dropoff.lat,dropoff.lng]} radius={9} pathOptions={{color:'#c45116',fillColor:'#c45116',fillOpacity:.9}}><Tooltip permanent direction="top">Drop-off</Tooltip></CircleMarker>:null}
      </MapContainer>
    </div>
    <input type="hidden" name="pickupLat" value={pickup?.lat??''}/>
    <input type="hidden" name="pickupLng" value={pickup?.lng??''}/>
    <input type="hidden" name="dropoffLat" value={dropoff?.lat??''}/>
    <input type="hidden" name="dropoffLng" value={dropoff?.lng??''}/>
  </div>;
}
