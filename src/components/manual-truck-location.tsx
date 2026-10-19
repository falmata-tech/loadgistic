'use client';
import dynamic from 'next/dynamic';
import React from 'react';
import {Text} from './localization';
type Point={lat:number;lng:number};
const Picker=dynamic(()=>import('./manual-truck-location-map').then(module=>module.ManualTruckLocationMap),{ssr:false,loading:()=> <p><Text message="Loading map…"/></p>});
export function ManualTruckLocation({point,initialCenter=null,onChange,disabled=false}:{point:Point|null;initialCenter?:Point|null;onChange:(point:Point|null)=>void;disabled?:boolean}){
 const [latitude,setLatitude]=React.useState(''),[longitude,setLongitude]=React.useState('');
 const typedPoint=React.useRef(null as Point|null);
 const typing=React.useRef(false);
 React.useEffect(()=>{
  if(typing.current&&point===typedPoint.current){typing.current=false;return;}
  typing.current=false;setLatitude(point?String(point.lat):'');setLongitude(point?String(point.lng):'');
 },[point]);
 function coordinates(lat:string,lng:string){
  setLatitude(lat);setLongitude(lng);
  const a=Number(lat),b=Number(lng);
  const next=lat.trim()&&lng.trim()&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180?{lat:a,lng:b}:null;
  typing.current=true;typedPoint.current=next;onChange(next);
 }
 return <div><p className="meta"><Text message="Tap the map to choose the vehicle’s location."/></p><Picker point={point} initialCenter={initialCenter} onChange={value=>{if(!disabled)onChange(value);}}/>
  <details><summary><Text message="Enter coordinates"/></summary><div className="form-grid">
   <label><Text message="Latitude"/><input type="number" aria-label="Latitude" min={-90} max={90} step="any" value={latitude} disabled={disabled} onChange={event=>coordinates(event.target.value,longitude)}/></label>
   <label><Text message="Longitude"/><input type="number" aria-label="Longitude" min={-180} max={180} step="any" value={longitude} disabled={disabled} onChange={event=>coordinates(latitude,event.target.value)}/></label>
  </div></details></div>;
}
