'use client';
import React from 'react';
import {MapContainer,CircleMarker,useMap,useMapEvents} from 'react-leaflet';
import {BaseMapTiles} from './base-map-tiles';
type Point={lat:number;lng:number};
function Pick({onChange}:{onChange:(point:Point)=>void}){useMapEvents({click:event=>onChange({lat:event.latlng.lat,lng:((event.latlng.lng+180)%360+360)%360-180})});return null;}
function RevealPoint({point}:{point:Point|null}){const map=useMap();React.useEffect(()=>{if(point&&!map.getBounds().contains([point.lat,point.lng]))map.setView([point.lat,point.lng],10,{animate:false});},[map,point]);return null;}
export function ManualTruckLocationMap({point,initialCenter=null,onChange}:{point:Point|null;initialCenter?:Point|null;onChange:(point:Point)=>void}){
 const center=point||initialCenter;
 return <div style={{height:260,border:'1px solid #cbdadb',borderRadius:10,overflow:'hidden'}}><MapContainer style={{height:'100%'}} center={center?[center.lat,center.lng]:[0,0]} zoom={center?10:2} minZoom={2} maxZoom={18} scrollWheelZoom={false}><BaseMapTiles/><RevealPoint point={point}/><Pick onChange={onChange}/>{point?<CircleMarker center={[point.lat,point.lng]} radius={8} pathOptions={{color:'#fff',fillColor:'#925212',fillOpacity:1,weight:3}}/>:null}</MapContainer></div>;
}
