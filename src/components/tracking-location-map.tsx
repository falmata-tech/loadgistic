"use client";


import {Text} from '@/components/localization';
import dynamic from 'next/dynamic';
import { LocateFixed } from 'lucide-react';
import {SurfaceSkeleton} from './loading-state';

const TrackingLocationMapLeaflet=dynamic(()=>import('./tracking-location-map-leaflet'),{ssr:false,loading:()=> <SurfaceSkeleton kind="map" className="tracking-location-map-loading" label="Loading shipment map"/>});

export function TrackingLocationMap({shipment}:{shipment:any}){
  const location=shipment.current_location;
  if(!location)return null;
  return <section className="tracking-location-panel" aria-labelledby="tracking-location-title"><div className="tracking-location-heading"><span><LocateFixed aria-hidden="true"/></span><div><p className="eyebrow"><Text message="Approximate Driver location"/></p><h2 id="tracking-location-title">{location.location_area}</h2><p><Text message="Within "/>{location.location_precision_km}<Text message=" km · updated "/>{new Date(location.updated_at).toLocaleString()}</p></div></div><TrackingLocationMapLeaflet origin={{lat:Number(shipment.origin_lat),lng:Number(shipment.origin_lng),label:shipment.origin}} destination={{lat:Number(shipment.destination_lat),lng:Number(shipment.destination_lng),label:shipment.destination}} location={{lat:Number(location.location_lat),lng:Number(location.location_lng),radiusKm:Number(location.location_precision_km),label:location.location_area}} status={shipment.operational_status}/><div className="tracking-map-key"><span className="driver-area"><Text message="Driver area"/></span><span className="pickup"><Text message="Pickup"/></span><span className="dropoff"><Text message="Drop-off"/></span></div><p className="tracking-location-note"><Text message="The circle is an approximate area selected for Driver safety. It is not an exact truck position or a road-route guarantee."/></p></section>;
}
