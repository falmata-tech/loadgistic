"use client";

import React from 'react';
import { CircleDotDashed, MapPin, Plus, Route, Trash2 } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

const MIN_ROUTE_POINTS=2;
const MIN_AREA_POINTS=3;
const MAX_POINTS=5;

function routeLabel(signal:any){const points=signal.route_points||[];return points.length?points.map((point:any)=>point.label).join(' ↔ '):'Route needs an update';}
function areaLabel(signal:any){const boundary=signal.area_boundary||[];return `${signal.area_center_label||'Area center'} · ${boundary.length} surrounding ${boundary.length===1?'city':'cities'}`;}

function PlaceRows({keys,setKeys,prefix,label,min,name,refName}:{keys:string[];setKeys:React.Dispatch<React.SetStateAction<string[]>>;prefix:string;label:string;min:number;name:string;refName:string}){
  return <div className="multi-place-editor"><div className="multi-place-heading"><div><strong>{label}s</strong><span>Choose up to five cities.</span></div><button type="button" className="button secondary small" disabled={keys.length>=MAX_POINTS} onClick={()=>setKeys(values=>[...values,`${prefix}-${Date.now()}`])}><Plus aria-hidden="true"/>Add city</button></div>
    {keys.map((key,index)=><div className="multi-place-row" key={key}><span>{index+1}</span><div className="form-group"><label htmlFor={key}><MapPin aria-hidden="true"/>{label} {index+1}</label><EthiopiaPlaceInput id={key} name={name} placeRefName={refName} required/></div>{keys.length>min?<button type="button" className="icon-button" aria-label={`Remove ${label.toLowerCase()} ${index+1}`} onClick={()=>setKeys(values=>values.filter(value=>value!==key))}><Trash2 aria-hidden="true"/></button>:null}</div>)}
  </div>;
}

export function CapacityMarketPlanning({corridors,returnTo}:{corridors:any[];returnTo:string}){
  const published=corridors[0]||null;
  const [geometry,setGeometry]=React.useState('ROUTE' as 'RADIUS'|'ROUTE');
  const [routeKeys,setRouteKeys]=React.useState(['regular-route-1','regular-route-2']);
  const [areaKeys,setAreaKeys]=React.useState(['regular-area-1','regular-area-2','regular-area-3']);
  return <section className="focused-capacity-editor">
    <div className="focused-editor-heading"><div><h2>{published?.geometry==='RADIUS'?<CircleDotDashed aria-hidden="true"/>:<Route aria-hidden="true"/>}Regular service</h2><p>Publish one undated Service area or Capacity route that you serve regularly. Customers must confirm availability with you.</p></div></div>
    {published?<div className="planning-signal-list compact"><article><span className={`signal-chip ${published.geometry==='RADIUS'?'radius':'corridor'}`}>{published.geometry==='RADIUS'?<CircleDotDashed aria-hidden="true"/>:<Route aria-hidden="true"/>}{published.geometry==='RADIUS'?'Service area':'Two-way route'}</span><div><strong>{published.geometry==='RADIUS'?areaLabel(published):routeLabel(published)}</strong><small>Regular service · confirm availability</small></div><form action="/api/capacity/corridors" method="post"><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="action" value="REMOVE"/><input type="hidden" name="id" value={published.id}/><button className="button danger small" aria-label="Remove regular service"><Trash2 aria-hidden="true"/>Remove</button></form></article></div>:<div className="planning-empty"><Route aria-hidden="true"/><strong>No regular service published</strong><span>Add one Service area or Capacity route below.</span></div>}
    {!published?<form action="/api/capacity/corridors" method="post" className="planning-editor-form recurring-signal-form"><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="action" value="ADD"/><input type="hidden" name="geometry" value={geometry}/>
      <div className="segmented-control geometry-choice"><button type="button" aria-pressed={geometry==='RADIUS'} onClick={()=>setGeometry('RADIUS')}><CircleDotDashed aria-hidden="true"/><strong>Service area</strong><small>A center with surrounding cities</small></button><button type="button" aria-pressed={geometry==='ROUTE'} onClick={()=>setGeometry('ROUTE')}><Route aria-hidden="true"/><strong>Capacity route</strong><small>Two to five cities in travel order</small></button></div>
      {geometry==='ROUTE'?<PlaceRows keys={routeKeys} setKeys={setRouteKeys} prefix="regular-route" label="Route city" min={MIN_ROUTE_POINTS} name="routePlace" refName="routePlaceRef"/>:<><div className="form-group"><label htmlFor="regular-area-center"><MapPin aria-hidden="true"/>Area center</label><EthiopiaPlaceInput id="regular-area-center" name="areaCenter" placeRefName="areaCenterPlaceRef" required/></div><PlaceRows keys={areaKeys} setKeys={setAreaKeys} prefix="regular-area" label="Surrounding city" min={MIN_AREA_POINTS} name="areaBoundaryPlace" refName="areaBoundaryPlaceRef"/></>}
      <div className="planning-save-row"><span>One regular service signal per transporter.</span><button className="button"><Plus aria-hidden="true"/>Publish regular service</button></div>
    </form>:<div className="alert success">Your regular service is published. Remove it first if you want to replace it.</div>}
  </section>;
}
