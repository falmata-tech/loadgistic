"use client";

import React from 'react';
import { CircleDotDashed, MapPin, Route } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type BoardGeographyFiltersProps={
  idPrefix:string;
  movementScope:string;
  localPlaceRef:string;
  locality:string;
  origin:string;
  destination:string;
  routeLabels?:[string,string];
};

export function BoardGeographyFilters({
  idPrefix,movementScope:initialScope,localPlaceRef,locality,origin,destination,
  routeLabels=['Origin area','Destination area']
}:BoardGeographyFiltersProps){
  const inferredScope=initialScope||(locality||localPlaceRef?'LOCAL':origin||destination?'INTERCITY':'');
  const [movementScope,setMovementScope]=React.useState(inferredScope);
  return <>
    <fieldset className="form-group full">
      <legend><CircleDotDashed aria-hidden="true"/>Movement</legend>
      <div className="segmented-control">
        <label><input type="radio" name="movementScope" value="" checked={!movementScope} onChange={()=>setMovementScope('')}/><span>All</span></label>
        <label><input type="radio" name="movementScope" value="LOCAL" checked={movementScope==='LOCAL'} onChange={()=>setMovementScope('LOCAL')}/><span>Local</span></label>
        <label><input type="radio" name="movementScope" value="INTERCITY" checked={movementScope==='INTERCITY'} onChange={()=>setMovementScope('INTERCITY')}/><span>Between cities</span></label>
      </div>
    </fieldset>
    {movementScope==='LOCAL'?<div className="form-group full">
      <label htmlFor={`${idPrefix}-locality`}><MapPin aria-hidden="true"/>Local city or town</label>
      <EthiopiaPlaceInput id={`${idPrefix}-locality`} name="locality" placeRefName="localPlaceRef" defaultPlaceRef={localPlaceRef} defaultValue={locality} placeholder="Addis Ababa, Ethiopia"/>
    </div>:null}
    {movementScope==='INTERCITY'?<>
      <div className="form-group"><label htmlFor={`${idPrefix}-origin`}><MapPin aria-hidden="true"/>{routeLabels[0]}</label><EthiopiaPlaceInput id={`${idPrefix}-origin`} name="origin" defaultValue={origin} placeholder="Addis Ababa, Ethiopia"/></div>
      <div className="form-group"><label htmlFor={`${idPrefix}-destination`}><Route aria-hidden="true"/>{routeLabels[1]}</label><EthiopiaPlaceInput id={`${idPrefix}-destination`} name="destination" defaultValue={destination} placeholder="Hawassa, Ethiopia"/></div>
    </>:null}
    {!movementScope?<p className="meta full geography-filter-hint">Choose Local or Between cities to narrow the Board by geography.</p>:null}
  </>;
}
