"use client";

import React from 'react';
import { CircleDotDashed, MapPin, Plus, Trash2 } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type ServiceArea={
  id?:string;
  place_ref?:string;
  place_label?:string;
  radius_km?:number;
};

type EditableServiceArea=ServiceArea&{key:string};

export function ProfileServiceAreaFields({initialAreas=[]}:{initialAreas?:ServiceArea[]}) {
  const [areas,setAreas]:[
    EditableServiceArea[],
    (value:EditableServiceArea[]|((current:EditableServiceArea[])=>EditableServiceArea[]))=>void
  ]=React.useState(initialAreas.map(area=>({...area,key:area.id||crypto.randomUUID()})));

  return <section className="profile-coverage-editor">
    <div className="section-heading-icon">
      <CircleDotDashed aria-hidden="true"/>
      <div><h2>Local Service Areas</h2><p className="meta">Add each city or town separately and choose how far around it you normally work.</p></div>
    </div>
    <div className="service-area-editor-list">
      {areas.map((area:EditableServiceArea,index:number)=><div className="service-area-editor-row" key={area.key}>
        <div className="form-group">
          <label htmlFor={`service-area-${index}`}><MapPin aria-hidden="true"/>City or town</label>
          <EthiopiaPlaceInput id={`service-area-${index}`} name="serviceAreaPlaceLabel" placeRefName="serviceAreaPlaceRef" defaultPlaceRef={area.place_ref} defaultValue={area.place_label} required placeholder="Addis Ababa, Ethiopia"/>
        </div>
        <div className="form-group">
          <label htmlFor={`service-radius-${index}`}><CircleDotDashed aria-hidden="true"/>Operating radius</label>
          <select id={`service-radius-${index}`} name="serviceAreaRadiusKm" defaultValue={String(area.radius_km||25)} required>
            {[10,25,40,60,100].map(radius=><option value={radius} key={radius}>{radius} km</option>)}
          </select>
        </div>
        <button className="icon-button danger" type="button" title="Remove service area" aria-label="Remove service area" onClick={()=>setAreas(current=>current.filter((item:EditableServiceArea)=>item.key!==area.key))}><Trash2 aria-hidden="true"/></button>
      </div>)}
    </div>
    {areas.length<8?<button className="button secondary icon-button-label" type="button" onClick={()=>setAreas(current=>[...current,{key:crypto.randomUUID(),radius_km:25}])}><Plus aria-hidden="true"/>Add Local Service Area</button>:null}
  </section>;
}
