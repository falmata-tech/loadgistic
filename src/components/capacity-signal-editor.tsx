"use client";

import React from 'react';
import { Boxes, CircleDotDashed, MapPin, Plus, PowerOff, RefreshCw, Route, Save, Trash2, Truck } from 'lucide-react';
import { capacityPrivacyRadii } from '@/lib/location-privacy.js';
import { readDriverLocation, submitCapacityForm, type DriverLocation } from '@/lib/capacity-editor-client';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

export type PlacePoint={place_ref:string;label:string;lat:number;lng:number};
type EditablePlace={key:string;place_ref:string;label:string};
export type CapacitySnapshot={status?:string;visibility?:string;accepts_full_load?:number;accepts_partial_load?:number;availability_geometry?:string;location_area?:string;location_lat?:number;location_lng?:number;location_precision_km?:number;location_updated_at?:string;current_route_points?:PlacePoint[];capacity_area_center_place_ref?:string;capacity_area_center_label?:string;capacity_area_center_lat?:number;capacity_area_center_lng?:number;capacity_area_boundary?:PlacePoint[];accepts_multi_pick?:number;accepts_multi_drop?:number};
export type RegularSignal={id:string;geometry:'ROUTE'|'RADIUS';route_points:PlacePoint[];area_boundary:PlacePoint[];area_center_lat?:number;area_center_lng?:number;area_center_label?:string;area_center_place_ref?:string};

function editable(points:PlacePoint[]|undefined,prefix:string,min:number):EditablePlace[]{
  return points?.length?points.map((point,index)=>({...point,key:`${prefix}-${index}`})):Array.from({length:min},(_,index)=>({key:`${prefix}-${index}`,place_ref:'',label:''}));
}

function PlaceSequenceEditor({items,setItems,name,refName,min,label}:{items:EditablePlace[];setItems:React.Dispatch<React.SetStateAction<EditablePlace[]>>;name:string;refName:string;min:number;label:string}){
  return <div className="multi-place-editor"><div className="multi-place-heading"><strong>{label==='City'?'Route cities':'Surrounding cities'}</strong><button type="button" className="button secondary small" disabled={items.length>=5} onClick={()=>setItems(values=>[...values,{key:crypto.randomUUID(),place_ref:'',label:''}])}><Plus aria-hidden="true"/>Add city</button></div>
    {items.map((item,index)=><div className="multi-place-row" key={item.key}><span>{index+1}</span><div className="form-group"><label htmlFor={item.key}><MapPin aria-hidden="true"/>{label} {index+1}</label><EthiopiaPlaceInput id={item.key} name={name} placeRefName={refName} defaultPlaceRef={item.place_ref} defaultValue={item.label} onChange={event=>setItems(values=>values.map(value=>value.key===item.key?{...value,label:event.target.value,place_ref:''}:value))} onPlaceSelect={place=>setItems(values=>values.map(value=>value.key===item.key?{...value,place_ref:place.id,label:place.display_name}:value))} required/></div>{items.length>min?<button type="button" className="icon-button" aria-label={`Remove ${label.toLowerCase()} ${index+1}`} onClick={()=>setItems(values=>values.filter(value=>value.key!==item.key))}><Trash2 aria-hidden="true"/></button>:null}</div>)}
  </div>;
}

export function CapacitySignalEditor({section,vehicleId,current,location,allowDeviceLocation,onBusyChange,onSaved,onCancel}:{section:'AVAILABILITY'|'ROUTE';vehicleId:string;current?:CapacitySnapshot|null;location:DriverLocation|null;allowDeviceLocation:boolean;onBusyChange:(busy:boolean)=>void;onSaved:()=>void;onCancel:()=>void}){
  const [status,setStatus]=React.useState(current?.status||'EMPTY');
  const [visibility,setVisibility]=React.useState(current?.visibility==='PRIVATE'?'PRIVATE':'OPEN');
  const [geometry,setGeometry]=React.useState(current?.status==='PARTIAL'?'ROUTE':current?.availability_geometry||'RADIUS');
  const [acceptedLoads,setAcceptedLoads]=React.useState(current?.accepts_partial_load?(current.accepts_full_load?'BOTH':'PTL'):'FTL');
  const [multiPick,setMultiPick]=React.useState(Boolean(current?.accepts_multi_pick));
  const [multiDrop,setMultiDrop]=React.useState(Boolean(current?.accepts_multi_drop));
  const [routePoints,setRoutePoints]=React.useState(editable(current?.current_route_points,'current-route',2));
  const [areaBoundary,setAreaBoundary]=React.useState(editable(current?.capacity_area_boundary,'area-boundary',3));
  const [areaCenter,setAreaCenter]=React.useState({place_ref:current?.capacity_area_center_place_ref||'',label:current?.capacity_area_center_label||''});
  const [captured,setCaptured]=React.useState(null as DriverLocation|null);
  const [radius,setRadius]=React.useState(location?.radius||20);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const submitting=React.useRef(false);
  const onDuty=status!=='OFF_DUTY';
  // Only a new signal or a status transition can require coverage in the
  // availability dialog. An ordinary capacity edit never exposes other groups.
  const needsCoverage=!current?.availability_geometry||current.status==='OFF_DUTY'||(status==='PARTIAL'&&current.availability_geometry!=='ROUTE');
  const showCoverage=onDuty&&(section==='ROUTE'||needsCoverage);
  const needsLocation=onDuty&&allowDeviceLocation&&!location;
  const draftLocation=captured||location;
  const invalidCoverage=showCoverage&&(geometry==='ROUTE'?routePoints.some((point:EditablePlace)=>!point.place_ref):!areaCenter.place_ref||areaBoundary.some((point:EditablePlace)=>!point.place_ref));

  function chooseStatus(value:string){
    setStatus(value);
    if(value==='PARTIAL')setGeometry('ROUTE');
    else if(value==='EMPTY'&&current?.availability_geometry)setGeometry(current.availability_geometry);
  }

  async function capture(){
    if(submitting.current)return;
    submitting.current=true;setBusy(true);onBusyChange(true);setError('');
    try{setCaptured(await readDriverLocation(radius));}catch(reason){setError(reason instanceof Error?reason.message:'Location could not be read.');}
    finally{submitting.current=false;setBusy(false);onBusyChange(false);}
  }
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(submitting.current)return;
    const form=event.currentTarget;
    submitting.current=true;setBusy(true);onBusyChange(true);setError('');
    try{await submitCapacityForm(form);onSaved();}
    catch(reason){setError(reason instanceof Error?reason.message:'Changes could not be saved. Please try again.');}
    finally{submitting.current=false;setBusy(false);onBusyChange(false);}
  }
  return <form action="/api/capacity" method="post" onSubmit={save} className="capacity-signal-form" data-testid="capacity-form">
    <input type="hidden" name="vehicleId" value={vehicleId}/><input type="hidden" name="status" value={status}/><input type="hidden" name="acceptedLoads" value={status==='PARTIAL'?'PTL':acceptedLoads}/><input type="hidden" name="availabilityGeometry" value={geometry}/><input type="hidden" name="visibility" value={visibility}/>
    <input type="hidden" name="locationSource" value={captured?'DEVICE_OBSCURED':'PRESERVE_DRIVER'}/><input type="hidden" name="approximateLat" value={captured?.lat??''}/><input type="hidden" name="approximateLng" value={captured?.lng??''}/><input type="hidden" name="locationPrecisionKm" value={captured?.radius??''}/>
    <div className="capacity-signal-dialog-body">
      <fieldset disabled={busy} className="capacity-signal-fields">
        {section==='AVAILABILITY'?<section className="capacity-signal-group">
          <h3>Capacity now</h3>
          <div className="segmented-control capacity-status-choices">{[{value:'EMPTY',label:'Empty',Icon:Truck},{value:'PARTIAL',label:'Partial',Icon:Boxes},{value:'OFF_DUTY',label:'Off Duty',Icon:PowerOff}].map(({value,label,Icon})=><button key={value} type="button" aria-pressed={status===value} onClick={()=>chooseStatus(value)}><Icon aria-hidden="true"/><strong>{label}</strong></button>)}</div>
          {onDuty?<><h3>Who can see it?</h3><div className="segmented-control capacity-visibility-choices"><button type="button" aria-pressed={visibility==='OPEN'} onClick={()=>setVisibility('OPEN')}><strong>Open capacity</strong><small>Anyone browsing the map</small></button><button type="button" aria-pressed={visibility==='PRIVATE'} onClick={()=>setVisibility('PRIVATE')}><strong>Private capacity</strong><small>Your approved contacts</small></button></div></>:null}
          {status==='EMPTY'?<fieldset className="capacity-load-choices"><legend>Loads you accept</legend>{[{value:'FTL',label:'Full truckload'},{value:'PTL',label:'Partial truckload'},{value:'BOTH',label:'Either'}].map(({value,label})=><label key={value}><input type="radio" name="loadChoice" value={value} checked={acceptedLoads===value} onChange={()=>setAcceptedLoads(value)}/>{label}</label>)}</fieldset>:null}
          {status==='PARTIAL'?<p className="meta">Some space available. Confirm the actual fit directly.</p>:null}
          {!onDuty?<p className="meta">Off Duty hides this truck from capacity maps. Your regular service stays saved.</p>:null}
        </section>:null}
        {showCoverage?<section className="capacity-signal-group">
          <h3>{geometry==='ROUTE'?'Availability route':'Availability area'}</h3>
          {section==='AVAILABILITY'?<p className="meta">{status==='PARTIAL'?'Partial capacity needs a route. Choose the cities below.':'Add where this truck is available to publish this signal.'}</p>:null}
          <div className="segmented-control geometry-choice">{status==='EMPTY'?<button type="button" aria-pressed={geometry==='RADIUS'} onClick={()=>setGeometry('RADIUS')}><CircleDotDashed aria-hidden="true"/><strong>Service area</strong></button>:null}<button type="button" aria-pressed={geometry==='ROUTE'} onClick={()=>setGeometry('ROUTE')}><Route aria-hidden="true"/><strong>Capacity route</strong></button></div>
          {geometry==='RADIUS'?<><div className="form-group"><label htmlFor="capacity-area-center"><MapPin aria-hidden="true"/>Area center</label><EthiopiaPlaceInput id="capacity-area-center" name="capacityAreaCenter" placeRefName="capacityAreaCenterPlaceRef" defaultPlaceRef={areaCenter.place_ref} defaultValue={areaCenter.label} onChange={event=>setAreaCenter({place_ref:'',label:event.target.value})} onPlaceSelect={place=>setAreaCenter({place_ref:place.id,label:place.display_name})} required/></div><PlaceSequenceEditor items={areaBoundary} setItems={setAreaBoundary} name="capacityAreaBoundary" refName="capacityAreaBoundaryPlaceRef" min={3} label="Boundary city"/></>:<PlaceSequenceEditor items={routePoints} setItems={setRoutePoints} name="currentRoutePlace" refName="currentRoutePlaceRef" min={2} label="City"/>}
          <div className="capacity-stop-choices"><label><input name="acceptsMultiPick" type="checkbox" checked={multiPick} onChange={event=>setMultiPick(event.target.checked)}/>Multiple pickups</label><label><input name="acceptsMultiDrop" type="checkbox" checked={multiDrop} onChange={event=>setMultiDrop(event.target.checked)}/>Multiple drop-offs</label></div>
        </section>:<>
          <input type="hidden" name="acceptsMultiPick" value={multiPick?'on':''}/><input type="hidden" name="acceptsMultiDrop" value={multiDrop?'on':''}/>
          {(current?.current_route_points||[]).map(point=><React.Fragment key={point.place_ref}><input type="hidden" name="currentRoutePlace" value={point.label}/><input type="hidden" name="currentRoutePlaceRef" value={point.place_ref}/></React.Fragment>)}
          <input type="hidden" name="capacityAreaCenter" value={current?.capacity_area_center_label||''}/><input type="hidden" name="capacityAreaCenterPlaceRef" value={current?.capacity_area_center_place_ref||''}/>
          {(current?.capacity_area_boundary||[]).map(point=><React.Fragment key={point.place_ref}><input type="hidden" name="capacityAreaBoundary" value={point.label}/><input type="hidden" name="capacityAreaBoundaryPlaceRef" value={point.place_ref}/></React.Fragment>)}
        </>}
        {needsLocation?<section className="capacity-signal-group"><h3>Approximate current location</h3><p className="meta">A Driver location is needed to publish this truck.</p><label htmlFor="new-location-radius">Approximate location radius<select id="new-location-radius" value={radius} onChange={event=>{setRadius(Number(event.target.value));setCaptured(null);}}>{capacityPrivacyRadii('BOTH').map(value=><option key={value} value={value}>{value} km</option>)}</select></label><button type="button" className="button secondary" onClick={capture}><RefreshCw aria-hidden="true"/>{captured?'Refresh location':'Use my location'}</button>{captured?<p role="status" className="meta">Location ready · within {captured.radius} km</p>:null}</section>:null}
      </fieldset>
      {error?<p className="alert error" role="alert">{error}</p>:null}
    </div>
    <footer className="capacity-signal-dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="button" disabled={busy||Boolean(invalidCoverage)||(needsLocation&&!draftLocation)}><Save aria-hidden="true"/>{busy?'Saving…':'Save'}</button></footer>
  </form>;
}
