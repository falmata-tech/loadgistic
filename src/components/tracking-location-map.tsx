"use client";

import dynamic from 'next/dynamic';
import { LocateFixed } from 'lucide-react';

const TrackingLocationMapLeaflet=dynamic(()=>import('./tracking-location-map-leaflet'),{ssr:false,loading:()=> <div className="tracking-location-map-loading"><LocateFixed aria-hidden="true"/><span>Loading shipment map…</span></div>});

export function TrackingLocationMap({shipment}:{shipment:any}){
  const location=shipment.current_location;
  if(!location)return null;
  return <section className="tracking-location-panel" aria-labelledby="tracking-location-title"><div className="tracking-location-heading"><span><LocateFixed aria-hidden="true"/></span><div><p className="eyebrow">Approximate Driver location</p><h2 id="tracking-location-title">{location.location_area}</h2><p>Within {location.location_precision_km} km · updated {new Date(location.updated_at).toLocaleString()}</p></div></div><TrackingLocationMapLeaflet origin={{lat:Number(shipment.origin_lat),lng:Number(shipment.origin_lng),label:shipment.origin}} destination={{lat:Number(shipment.destination_lat),lng:Number(shipment.destination_lng),label:shipment.destination}} location={{lat:Number(location.location_lat),lng:Number(location.location_lng),radiusKm:Number(location.location_precision_km),label:location.location_area}} status={shipment.operational_status}/><div className="tracking-map-key"><span className="driver-area">Driver area</span><span className="pickup">Pickup</span><span className="dropoff">Drop-off</span></div><p className="tracking-location-note">The circle is an approximate area selected for Driver safety. It is not an exact truck position or a road-route guarantee.</p></section>;
}
