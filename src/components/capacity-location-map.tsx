"use client";

import dynamic from 'next/dynamic';

const CapacityLocationMapLeaflet=dynamic(()=>import('./capacity-location-map-leaflet').then(module=>module.CapacityLocationMapLeaflet),{ssr:false,loading:()=> <div className="capacity-location-map loading-map" aria-label="Loading capacity map">Loading map…</div>});
type Point={lat:number;lng:number};
type PlacePoint=Point&{place_ref?:string;label:string};
type RegularSignal={id:string;geometry:'ROUTE'|'RADIUS';route_points:PlacePoint[];area_boundary:PlacePoint[];area_center_lat?:number;area_center_lng?:number;area_center_label?:string};

export function CapacityLocationMap({center,radiusKm,areaCenter=null,areaBoundary=[],routePoints=[],regularSignals=[],availabilityStatus='EMPTY',showLegend=true,showTruckLabel=true}:{center:Point;radiusKm:number;areaCenter?:Point|null;areaBoundary?:PlacePoint[];routePoints?:PlacePoint[];regularSignals?:RegularSignal[];availabilityStatus?:string;showLegend?:boolean;showTruckLabel?:boolean}){
  return <CapacityLocationMapLeaflet center={center} radiusKm={radiusKm} areaCenter={areaCenter} areaBoundary={areaBoundary} routePoints={routePoints} regularSignals={regularSignals} availabilityStatus={availabilityStatus} showLegend={showLegend} showTruckLabel={showTruckLabel}/>;
}
