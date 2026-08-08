"use client";

import React from 'react';
import { CalendarDays, CircleDotDashed, MapPin, Plus, Route, Trash2, Truck } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

function upcomingDays(){const today=new Date();return Array.from({length:14},(_,index)=>{const value=new Date(today.getTime()+(index+1)*86_400_000);return {value:value.toISOString().slice(0,10),label:new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}).format(value)};});}

export function CapacityMarketPlanning({vehicles,nextTrips,corridors,returnTo,allowCorridors}:{vehicles:any[];nextTrips:any[];corridors:any[];returnTo:string;allowCorridors:boolean}){
  const [spaceStatus,setSpaceStatus]=React.useState('EMPTY');
  const [recurringGeometry,setRecurringGeometry]=React.useState('ROUTE');
  const days=React.useMemo(upcomingDays,[]);
  return <div className="capacity-market-planning">
    <section className="card next-trip-editor">
      <div className="section-title-row"><div><span className="section-kicker">Future signal</span><h2><CalendarDays aria-hidden="true"/>One next trip per truck</h2><p>Keep this separate from current capacity. The date is optional.</p></div></div>
      <form action="/api/capacity/next-trip" method="post" className="stack">
        <input type="hidden" name="returnTo" value={returnTo}/>
        <div className="form-grid">
          <div className="form-group"><label htmlFor="next-trip-vehicle"><Truck aria-hidden="true"/>Truck</label><select id="next-trip-vehicle" name="vehicleId" required>{vehicles.map((vehicle:any)=><option value={vehicle.id} key={vehicle.id}>{vehicle.platform_number} · {vehicle.make} {vehicle.model}</option>)}</select></div>
          <div className="form-group"><label htmlFor="next-trip-date"><CalendarDays aria-hidden="true"/>Travel day <span className="meta">(optional)</span></label><select id="next-trip-date" name="travelDate"><option value="">No date selected</option>{days.map((day:any)=><option value={day.value} key={day.value}>{day.label}</option>)}</select></div>
          <div className="form-group"><label htmlFor="next-origin"><MapPin aria-hidden="true"/>From</label><EthiopiaPlaceInput id="next-origin" name="origin" placeRefName="originPlaceRef" required/></div>
          <div className="form-group"><label htmlFor="next-destination"><MapPin aria-hidden="true"/>To</label><EthiopiaPlaceInput id="next-destination" name="destination" placeRefName="destinationPlaceRef" required/></div>
        </div>
        <div className="segmented-control"><label><input type="radio" name="spaceStatus" value="EMPTY" checked={spaceStatus==='EMPTY'} onChange={()=>setSpaceStatus('EMPTY')}/><span>Empty truck</span></label><label><input type="radio" name="spaceStatus" value="PARTIAL" checked={spaceStatus==='PARTIAL'} onChange={()=>setSpaceStatus('PARTIAL')}/><span>Partial space</span></label></div>
        {spaceStatus==='PARTIAL'?<div className="form-group"><label htmlFor="next-percent">Expected space available</label><input id="next-percent" name="availablePercent" type="number" min="5" max="95" step="5" defaultValue="50"/></div>:<input type="hidden" name="availablePercent" value="100"/>}
        <button className="button"><CalendarDays aria-hidden="true"/>Publish next trip</button>
      </form>
      {nextTrips.length?<div className="planning-signal-list">{nextTrips.map((trip:any)=><article key={trip.id}><span className="signal-chip next"><CalendarDays aria-hidden="true"/>Next trip</span><div><strong>{trip.platform_number} · {trip.origin} → {trip.destination}</strong><small>{trip.travel_date?new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${trip.travel_date}T12:00:00Z`)):'Date not set'} · {trip.space_status==='EMPTY'?'Empty':`${trip.available_percent}% open`}</small></div><form action="/api/capacity/next-trip" method="post"><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="action" value="REMOVE"/><input type="hidden" name="vehicleId" value={trip.vehicle_id}/><button className="button danger small" aria-label={`Remove next trip for ${trip.platform_number}`}><Trash2 aria-hidden="true"/>Remove</button></form></article>)}</div>:null}
    </section>
    {allowCorridors?<section className="card corridor-editor">
      <div className="section-title-row"><div><span className="section-kicker">Recurring market signals</span><h2><Route aria-hidden="true"/>Routes and permanent working areas</h2><p>Add as many undated recurring routes or working-radius areas as needed. Visitors are always told to confirm availability.</p></div></div>
      <form action="/api/capacity/corridors" method="post" className="stack recurring-signal-form">
        <input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="geometry" value={recurringGeometry}/>
        <div className="segmented-control geometry-choice">
          <button type="button" aria-pressed={recurringGeometry==='ROUTE'} onClick={()=>setRecurringGeometry('ROUTE')}><Route aria-hidden="true"/><strong>Recurring route</strong><small>Directional corridor</small></button>
          <button type="button" aria-pressed={recurringGeometry==='RADIUS'} onClick={()=>setRecurringGeometry('RADIUS')}><CircleDotDashed aria-hidden="true"/><strong>Working radius</strong><small>Permanent service area</small></button>
        </div>
        {recurringGeometry==='ROUTE'?<div className="form-grid">
          <div className="form-group"><label htmlFor="corridor-origin"><MapPin aria-hidden="true"/>From</label><EthiopiaPlaceInput id="corridor-origin" name="origin" placeRefName="originPlaceRef" required/></div>
          <div className="form-group"><label htmlFor="corridor-destination"><MapPin aria-hidden="true"/>To</label><EthiopiaPlaceInput id="corridor-destination" name="destination" placeRefName="destinationPlaceRef" required/></div>
        </div>:<div className="form-grid">
          <div className="form-group"><label htmlFor="recurring-center"><MapPin aria-hidden="true"/>Area center</label><EthiopiaPlaceInput id="recurring-center" name="center" placeRefName="centerPlaceRef" required/></div>
          <div className="form-group"><label htmlFor="recurring-radius"><CircleDotDashed aria-hidden="true"/>Permanent working radius</label><select id="recurring-radius" name="radiusKm" defaultValue="100">{[5,10,20,30,50,75,100,150,250,500].map(value=><option value={value} key={value}>{value} km</option>)}</select></div>
        </div>}
        <button className="button"><Plus aria-hidden="true"/>Add recurring signal</button>
      </form>
      <div className="planning-signal-list">{corridors.map((corridor:any)=><article key={corridor.id}><span className={`signal-chip corridor ${corridor.geometry==='RADIUS'?'area':''}`}>{corridor.geometry==='RADIUS'?<CircleDotDashed aria-hidden="true"/>:<Route aria-hidden="true"/>}{corridor.geometry==='RADIUS'?'Recurring area':'Recurring route'}</span><div><strong>{corridor.geometry==='RADIUS'?`${corridor.place_label} · ${corridor.radius_km} km radius`:`${corridor.origin} → ${corridor.destination}`}</strong><small>Confirm availability · no scheduled date</small></div><form action="/api/capacity/corridors" method="post"><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="action" value="REMOVE"/><input type="hidden" name="id" value={corridor.id}/><button className="button danger small" aria-label={`Remove recurring signal ${corridor.geometry==='RADIUS'?corridor.place_label:corridor.origin}`}><Trash2 aria-hidden="true"/>Remove</button></form></article>)}</div>
    </section>:null}
  </div>;
}
