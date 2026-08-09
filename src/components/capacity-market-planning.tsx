"use client";

import { ArrowLeft, MapPin, Plus, Route, Trash2 } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

const MAX_REGULAR_CORRIDORS=2;

export function CapacityMarketPlanning({corridors,returnTo,onCancel}:{corridors:any[];returnTo:string;onCancel:()=>void}){
  const published=corridors.slice(0,MAX_REGULAR_CORRIDORS);
  const canAdd=published.length<MAX_REGULAR_CORRIDORS;

  return <section className="capacity-focused-editor recurring-focused" data-testid="recurring-service-editor">
    <div className="focused-editor-heading"><button type="button" className="button secondary small" onClick={onCancel}><ArrowLeft aria-hidden="true"/>Summary</button><div><span className="section-kicker blue">Regular work</span><h2><Route aria-hidden="true"/>Regular corridors</h2><p>Publish up to two two-way corridors you serve regularly. These do not claim that a truck is available now.</p></div></div>
    {published.length?<div className="planning-signal-list compact">{published.map((corridor:any)=><article key={corridor.id}><span className="signal-chip corridor"><Route aria-hidden="true"/>Two-way</span><div><strong>{corridor.origin} ↔ {corridor.destination}</strong><small>Regular service · customers confirm availability</small></div><form action="/api/capacity/corridors" method="post"><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="action" value="REMOVE"/><input type="hidden" name="id" value={corridor.id}/><button className="button danger small" aria-label={`Remove regular corridor between ${corridor.origin} and ${corridor.destination}`}><Trash2 aria-hidden="true"/>Remove</button></form></article>)}</div>:<div className="planning-empty"><Route aria-hidden="true"/><strong>No regular corridors published</strong><span>Add a two-way corridor below if you serve it regularly.</span></div>}
    {canAdd?<form action="/api/capacity/corridors" method="post" className="planning-editor-form recurring-signal-form">
      <input type="hidden" name="returnTo" value={returnTo}/>
      <div className="route-inputs"><div className="form-group"><label htmlFor="corridor-origin"><MapPin aria-hidden="true"/>Place 1</label><EthiopiaPlaceInput id="corridor-origin" name="origin" placeRefName="originPlaceRef" required/></div><span className="route-arrow" aria-label="Both directions">↔</span><div className="form-group"><label htmlFor="corridor-destination"><MapPin aria-hidden="true"/>Place 2</label><EthiopiaPlaceInput id="corridor-destination" name="destination" placeRefName="destinationPlaceRef" required/></div></div>
      <div className="planning-save-row"><span>{MAX_REGULAR_CORRIDORS-published.length} regular corridor {MAX_REGULAR_CORRIDORS-published.length===1?'space':'spaces'} remaining.</span><button className="button"><Plus aria-hidden="true"/>Add regular corridor</button></div>
    </form>:<div className="alert success">You have published the maximum of two regular corridors. Remove one before adding another.</div>}
  </section>;
}
