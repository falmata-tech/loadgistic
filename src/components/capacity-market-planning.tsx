"use client";


import {Text,Localized} from '@/components/localization';
import React from 'react';
import { CircleDotDashed, MapPin, Plus, Route, Save, Trash2 } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';
import { submitCapacityForm } from '@/lib/capacity-editor-client';
import type { RegularSignal, PlacePoint } from './capacity-signal-editor';

const MIN_ROUTE_POINTS=2;
const MIN_AREA_POINTS=3;
const MAX_POINTS=5;

function PlaceRows({keys,setKeys,prefix,label,min,name,refName,points=[]}:{keys:string[];setKeys:React.Dispatch<React.SetStateAction<string[]>>;prefix:string;label:string;min:number;name:string;refName:string;points?:PlacePoint[]}){
  return <div className="multi-place-editor"><div className="multi-place-heading"><div><strong>{label}s</strong><span><Text message="Choose up to five cities."/></span></div><button type="button" className="button secondary small" disabled={keys.length>=MAX_POINTS} onClick={()=>setKeys(values=>[...values,`${prefix}-${Date.now()}`])}><Plus aria-hidden="true"/><Text message="Add city"/></button></div>
    {keys.map((key,index)=>{const point=points[Number(key.replace(`${prefix}-`,''))];return <div className="multi-place-row" key={key}><span>{index+1}</span><div className="form-group"><label htmlFor={key}><MapPin aria-hidden="true"/>{label} {index+1}</label><EthiopiaPlaceInput id={key} name={name} placeRefName={refName} defaultValue={point?.label} defaultPlaceRef={point?.place_ref} required/></div>{keys.length>min?<button type="button" className="icon-button" aria-label={`Remove ${label.toLowerCase()} ${index+1}`} onClick={()=>setKeys(values=>values.filter(value=>value!==key))}><Trash2 aria-hidden="true"/></button>:null}</div>;})}
  </div>;
}

export function CapacityMarketPlanning({corridors,returnTo,onBusyChange,onSaved,onRemoved,onCancel}:{corridors:RegularSignal[];returnTo:string;onBusyChange:(busy:boolean)=>void;onSaved:()=>void;onRemoved:()=>void;onCancel:()=>void}){
  const [removed,setRemoved]=React.useState(false);
  const published=removed?null:corridors[0]||null;
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const active=React.useRef(false);
  const [geometry,setGeometry]=React.useState(published?.geometry||'ROUTE');
  const [routeKeys,setRouteKeys]=React.useState(Array.from({length:Math.max(2,published?.route_points?.length||0)},(_,index)=>`regular-route-${index}`));
  const [areaKeys,setAreaKeys]=React.useState(Array.from({length:Math.max(3,published?.area_boundary?.length||0)},(_,index)=>`regular-area-${index}`));
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(active.current)return;
    const form=event.currentTarget;
    const removing=new FormData(form).get('action')==='REMOVE';
    active.current=true;setBusy(true);onBusyChange(true);setError('');
    try{await submitCapacityForm(form);if(removing){setRemoved(true);onRemoved();}else onSaved();}
    catch(reason){setError(reason instanceof Error?reason.message:'Regular service could not be saved. Please try again.');}
    finally{active.current=false;setBusy(false);onBusyChange(false);}
  }
  return <section className="capacity-signal-form" data-testid="capacity-planning-editor">
    <div className="capacity-signal-dialog-body">
    <p className="meta"><Text message="The area or two-way route you serve regularly. Customers still confirm current availability with you."/></p>
    {error?<p className="alert error" role="alert">{error}</p>:null}
    <form id="regular-service-form" action="/api/capacity/corridors" method="post" onSubmit={submit} className="planning-editor-form recurring-signal-form"><fieldset className="capacity-signal-fields" disabled={busy}><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="action" value={published?'UPDATE':'ADD'}/><input type="hidden" name="id" value={published?.id||''}/><input type="hidden" name="geometry" value={geometry}/>
      <div className="segmented-control geometry-choice"><button type="button" aria-pressed={geometry==='RADIUS'} onClick={()=>setGeometry('RADIUS')}><CircleDotDashed aria-hidden="true"/><strong><Text message="Service area"/></strong><small><Text message="Nearby towns"/></small></button><button type="button" aria-pressed={geometry==='ROUTE'} onClick={()=>setGeometry('ROUTE')}><Route aria-hidden="true"/><strong><Text message="Capacity route"/></strong><small><Text message="Cities in travel order"/></small></button></div>
      {geometry==='ROUTE'?<PlaceRows keys={routeKeys} setKeys={setRouteKeys} prefix="regular-route" label="Route city" min={MIN_ROUTE_POINTS} name="routePlace" refName="routePlaceRef" points={corridors[0]?.route_points}/>:<><div className="form-group"><label htmlFor="regular-area-center"><MapPin aria-hidden="true"/><Text message="Area center"/></label><EthiopiaPlaceInput id="regular-area-center" name="areaCenter" placeRefName="areaCenterPlaceRef" defaultValue={corridors[0]?.area_center_label} defaultPlaceRef={corridors[0]?.area_center_place_ref} required/></div><PlaceRows keys={areaKeys} setKeys={setAreaKeys} prefix="regular-area" label="Surrounding city" min={MIN_AREA_POINTS} name="areaBoundaryPlace" refName="areaBoundaryPlaceRef" points={corridors[0]?.area_boundary}/></>}
      </fieldset>
    </form>
    {published?<form action="/api/capacity/corridors" method="post" onSubmit={submit}><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="action" value="REMOVE"/><input type="hidden" name="id" value={published.id}/><Localized as="button" copy={["aria-label"]} className="button secondary small" aria-label="Remove regular service" disabled={busy}><Trash2 aria-hidden="true"/><Text message="Remove regular service"/></Localized></form>:null}
    </div>
    <footer className="capacity-signal-dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}><Text message="Cancel"/></button><button className="button" form="regular-service-form" disabled={busy}><Save aria-hidden="true"/>{busy?<Text message="Saving…"/>:<Text message="Save"/>}</button></footer>
  </section>;
}
