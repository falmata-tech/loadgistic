"use client";


import {Text} from '@/components/localization';
import React from 'react';
import { ArrowRightLeft, CircleDotDashed, MapPin, Route } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type BoardGeographyFiltersProps={
  idPrefix:string;
  movementScope:string;
  localPlaceRef:string;
  locality:string;
  localRadiusKm?:string;
  originPlaceRef?:string;
  origin:string;
  originRadiusKm?:string;
  destinationPlaceRef?:string;
  destination:string;
  destinationRadiusKm?:string;
  directionMode?:string;
  routeLabels?:[string,string];
};

export function BoardGeographyFilters({
  idPrefix,movementScope:initialScope,localPlaceRef,locality,localRadiusKm='50',
  originPlaceRef='',origin,originRadiusKm='50',destinationPlaceRef='',destination,
  destinationRadiusKm='50',directionMode='DIRECT',
  routeLabels=['Origin area','Destination area']
}:BoardGeographyFiltersProps){
  const inferredScope=initialScope||(locality||localPlaceRef?'LOCAL':origin||destination?'INTERCITY':'');
  const [movementScope,setMovementScope]=React.useState(inferredScope);
  return <>
    <fieldset className="form-group full">
      <legend><CircleDotDashed aria-hidden="true"/><Text message="Movement"/></legend>
      <div className="segmented-control movement-segments">
        <label><input type="radio" name="movementScope" value="" checked={!movementScope} onChange={()=>setMovementScope('')}/><span><Text message="All"/></span></label>
        <label><input type="radio" name="movementScope" value="LOCAL" checked={movementScope==='LOCAL'} onChange={()=>setMovementScope('LOCAL')}/><span><Text message="Local"/></span></label>
        <label><input type="radio" name="movementScope" value="INTERCITY" checked={movementScope==='INTERCITY'} onChange={()=>setMovementScope('INTERCITY')}/><span><Text message="Long distance"/></span></label>
      </div>
    </fieldset>
    {movementScope==='LOCAL'?<div className="form-group full">
      <label htmlFor={`${idPrefix}-locality`}><MapPin aria-hidden="true"/><Text message="Local city or town"/></label>
      <EthiopiaPlaceInput id={`${idPrefix}-locality`} name="locality" placeRefName="localPlaceRef" defaultPlaceRef={localPlaceRef} defaultValue={locality} placeholder="Addis Ababa, Ethiopia"/>
      <label htmlFor={`${idPrefix}-local-radius`}><CircleDotDashed aria-hidden="true"/><Text message="Match within"/></label>
      <select id={`${idPrefix}-local-radius`} name="localRadiusKm" defaultValue={localRadiusKm}>
        <option value="10"><Text message="10 km"/></option><option value="25"><Text message="25 km"/></option><option value="50"><Text message="50 km"/></option>
        <option value="100"><Text message="100 km"/></option><option value="200"><Text message="200 km"/></option>
      </select>
    </div>:null}
    {movementScope==='INTERCITY'?<>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-origin`}><MapPin aria-hidden="true"/>{routeLabels[0]}</label>
        <EthiopiaPlaceInput id={`${idPrefix}-origin`} name="origin" placeRefName="originPlaceRef" defaultPlaceRef={originPlaceRef} defaultValue={origin} placeholder="Addis Ababa, Ethiopia"/>
        <label htmlFor={`${idPrefix}-origin-radius`}><CircleDotDashed aria-hidden="true"/><Text message="City 1 radius"/></label>
        <select id={`${idPrefix}-origin-radius`} name="originRadiusKm" defaultValue={originRadiusKm}>
          <option value="10"><Text message="10 km"/></option><option value="25"><Text message="25 km"/></option><option value="50"><Text message="50 km"/></option>
          <option value="100"><Text message="100 km"/></option><option value="200"><Text message="200 km"/></option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-destination`}><MapPin aria-hidden="true"/>{routeLabels[1]}</label>
        <EthiopiaPlaceInput id={`${idPrefix}-destination`} name="destination" placeRefName="destinationPlaceRef" defaultPlaceRef={destinationPlaceRef} defaultValue={destination} placeholder="Hawassa, Ethiopia"/>
        <label htmlFor={`${idPrefix}-destination-radius`}><CircleDotDashed aria-hidden="true"/><Text message="City 2 radius"/></label>
        <select id={`${idPrefix}-destination-radius`} name="destinationRadiusKm" defaultValue={destinationRadiusKm}>
          <option value="10"><Text message="10 km"/></option><option value="25"><Text message="25 km"/></option><option value="50"><Text message="50 km"/></option>
          <option value="100"><Text message="100 km"/></option><option value="200"><Text message="200 km"/></option>
        </select>
      </div>
      <fieldset className="form-group full">
        <legend><ArrowRightLeft aria-hidden="true"/><Text message="Direction"/></legend>
        <div className="segmented-control">
          <label><input type="radio" name="directionMode" value="DIRECT" defaultChecked={directionMode!=='EITHER'}/><span><Text message="City 1 to City 2"/></span></label>
          <label><input type="radio" name="directionMode" value="EITHER" defaultChecked={directionMode==='EITHER'}/><span><Text message="Either direction"/></span></label>
        </div>
      </fieldset>
    </>:null}
    {!movementScope?<p className="meta full geography-filter-hint"><Text message="Choose Local or Long distance to narrow the Board by geography."/></p>:null}
  </>;
}
