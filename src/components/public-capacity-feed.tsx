"use client";

import React from 'react';
import Link from 'next/link';
import { Building2, CalendarDays, ChevronDown, CircleDotDashed, ExternalLink, List, LocateFixed, Mail, Map, MapPinned, MessageCircle, Phone, RefreshCw, Route, ShieldCheck, Star, Truck, X } from 'lucide-react';
import { obscureCoordinate, BUSINESS_SEARCH_PRIVACY_KM } from '@/lib/location-privacy.js';
import { PublicCapacityMap } from './public-capacity-map';

type FeedResult={items:any[];nextCursor:string|null;hasMore:boolean;pageSize:number};
type Point={lat:number;lng:number};

function tripDay(value?:string|null){return value?new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)):'Date not set';}
function signalTitle(item:any){return item.availability_geometry==='ROUTE'?`${item.current_route_origin} → ${item.current_route_destination}`:`${item.location_area||'General current area'} · ${item.work_radius_km||50} km working radius`;}

export function PublicCapacityFeed({initial,query}:{initial:FeedResult;query:Record<string,string>}){
  const [items,setItems]=React.useState(initial.items);
  const [cursor,setCursor]=React.useState(initial.nextCursor);
  const [hasMore,setHasMore]=React.useState(initial.hasMore);
  const [loading,setLoading]=React.useState(false);
  const [error,setError]=React.useState('');
  const [view,setView]:['LIST'|'MAP',(value:'LIST'|'MAP')=>void]=React.useState('LIST');
  const [selectedId,setSelectedId]:[string|null,(value:string|null)=>void]=React.useState(null);
  const [viewer,setViewer]:[Point|null,(value:Point|null)=>void]=React.useState(null);
  const [near,setNear]:[{lat:number;lng:number;radius:number}|null,(value:{lat:number;lng:number;radius:number}|null)=>void]=React.useState(null);
  const [locationState,setLocationState]:['idle'|'locating'|'ready'|'denied'|'error',(value:'idle'|'locating'|'ready'|'denied'|'error')=>void]=React.useState('idle');
  const sentinel=React.useRef(null as HTMLDivElement|null);

  const params=React.useCallback((nextCursor?:string|null,nextNear=near)=>{
    const value=new URLSearchParams(query);
    if(nextCursor)value.set('cursor',nextCursor);else value.delete('cursor');
    if(nextNear){value.set('nearLat',String(nextNear.lat));value.set('nearLng',String(nextNear.lng));value.set('nearRadiusKm',String(nextNear.radius));}
    return value;
  },[near,query]);

  async function loadMore(){
    if(!cursor||loading)return;
    setLoading(true);setError('');
    try{
      const response=await fetch(`/api/public/capacity?${params(cursor).toString()}`);
      if(!response.ok)throw new Error('Capacity could not be loaded.');
      const page:FeedResult=await response.json();
      setItems((current:any[])=>{const seen=new Set(current.map((item:any)=>item.id));return [...current,...page.items.filter((item:any)=>!seen.has(item.id))];});
      setCursor(page.nextCursor);setHasMore(page.hasMore);
    }catch(err){setError(err instanceof Error?err.message:'Capacity could not be loaded.');}finally{setLoading(false);}
  }

  React.useEffect(()=>{
    const node=sentinel.current;if(!node||!hasMore)return;
    const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)void loadMore();},{rootMargin:'500px'});
    observer.observe(node);return()=>observer.disconnect();
  },[cursor,hasMore,loading]);

  function useMyLocation(){
    if(!navigator.geolocation){setLocationState('error');return;}
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(async position=>{
      const exact={lat:position.coords.latitude,lng:position.coords.longitude};
      if(exact.lat<3||exact.lat>15||exact.lng<32||exact.lng>49){setLocationState('error');return;}
      const displaced=obscureCoordinate(exact.lat,exact.lng,BUSINESS_SEARCH_PRIVACY_KM);
      const nextNear={lat:displaced.lat,lng:displaced.lng,radius:20};
      setViewer(exact);setNear(nextNear);setLocationState('ready');setLoading(true);setError('');
      try{const response=await fetch(`/api/public/capacity?${params(null,nextNear).toString()}`);if(!response.ok)throw new Error();const page:FeedResult=await response.json();setItems(page.items);setCursor(page.nextCursor);setHasMore(page.hasMore);}catch{setError('Nearby capacity could not be refreshed.');}finally{setLoading(false);}
    },event=>setLocationState(event.code===event.PERMISSION_DENIED?'denied':'error'),{enableHighAccuracy:true,timeout:12000,maximumAge:0});
  }

  function showOnMap(id:string){setSelectedId(id);setView('MAP');requestAnimationFrame(()=>document.getElementById('capacity-map-view')?.scrollIntoView({behavior:'smooth',block:'start'}));}
  const selected=items.find((item:any)=>item.id===selectedId)||null;

  return <>
    <section className="public-capacity-toolbar" aria-label="Capacity view and location controls">
      <div className="public-view-toggle"><button type="button" aria-pressed={view==='LIST'} onClick={()=>setView('LIST')}><List aria-hidden="true"/>List</button><button type="button" aria-pressed={view==='MAP'} onClick={()=>setView('MAP')}><Map aria-hidden="true"/>Map</button></div>
      <button type="button" className="button location-action" onClick={useMyLocation} disabled={locationState==='locating'}><LocateFixed aria-hidden="true"/>{locationState==='locating'?'Finding your location…':locationState==='ready'?'Refresh my location':'Show capacity near me'}</button>
      <span className="public-location-note">Your exact location stays in this browser.</span>
    </section>
    {locationState==='denied'?<div className="alert warning">Location permission is off. You can still browse everything or use route filters.</div>:null}
    {locationState==='error'?<div className="alert warning">A usable location was not available. Try again or continue without it.</div>:null}
    {view==='MAP'?<section id="capacity-map-view" className="public-map-shell"><PublicCapacityMap items={items} viewer={viewer} selectedId={selectedId} onSelect={setSelectedId}/>{selected?<aside className="map-capacity-sheet" role="dialog" aria-modal="false" aria-label={`${selected.provider_name} capacity details`}><button type="button" className="map-sheet-close" onClick={()=>setSelectedId(null)} aria-label="Close capacity card"><X aria-hidden="true"/></button><div className="status-row"><span className={`signal-chip ${selected.availability_geometry==='ROUTE'?'route':'radius'}`}>{selected.availability_geometry==='ROUTE'?<Route aria-hidden="true"/>:<CircleDotDashed aria-hidden="true"/>}{selected.availability_geometry==='ROUTE'?'Current route':'Current radius'}</span><span className={`status ${selected.status==='PARTIAL'?'yellow':'green'}`}>{selected.status==='PARTIAL'?`${selected.available_percent}% open`:'Empty'}</span></div><h2>{selected.vehicle_make} {selected.vehicle_model}</h2><p>{selected.platform_number} · {selected.cargo_configuration}</p><div className="public-provider-line"><Building2 aria-hidden="true"/><span><strong>{selected.provider_name}</strong><small>{selected.review_count?<><Star aria-hidden="true"/>{selected.average_rating} from {selected.review_count} verified shipment {selected.review_count===1?'review':'reviews'}</>:'New provider profile'}</small></span></div><div className={`current-signal-panel ${selected.availability_geometry==='ROUTE'?'route':'radius'}`}><small>Available now</small><strong>{signalTitle(selected)}</strong><span>{selected.availability_geometry==='ROUTE'?'The yellow line is the capacity route; the violet circle separately shows where the truck could be.':'The green work radius and violet location-privacy circle are separate.'}</span></div><div className="privacy-signal-panel"><CircleDotDashed aria-hidden="true"/><span><small>Location privacy</small><strong>{selected.location_precision_km||20} km area where the truck could be</strong></span></div>{selected.next_trip?<div className="future-signal-panel"><CalendarDays aria-hidden="true"/><span><small>Next trip · {tripDay(selected.next_trip.travel_date)}</small><strong>{selected.next_trip.origin} → {selected.next_trip.destination}</strong></span></div>:null}{selected.recurring_corridors?.length?<div className="map-sheet-corridors"><CircleDotDashed aria-hidden="true"/><span><strong>{selected.recurring_corridors.length} recurring {selected.recurring_corridors.length===1?'signal':'signals'}</strong><small>Market signals · confirm availability</small></span></div>:null}<div className="verification-reminder"><ShieldCheck aria-hidden="true"/><span>Confirm current provider, Driver, truck authority, documents, cargo fit, and terms.</span></div><div className="public-card-actions"><Link className="button" href={`/@${selected.provider_handle}`}><Building2 aria-hidden="true"/>Provider details</Link>{selected.contact_phone?<a className="button secondary" href={`tel:${selected.contact_phone}`}><Phone aria-hidden="true"/>Call</a>:null}</div></aside>:<div className="map-select-hint"><Truck aria-hidden="true"/>Select a truck marker to open its capacity card.</div>}</section>:null}
    {view==='LIST'?<section className="public-capacity-grid" aria-live="polite">
      {items.map((item:any)=><article className="public-capacity-card" key={item.id}>
        <div className="public-capacity-card-head"><div className="truck-symbol"><Truck aria-hidden="true"/></div><div><div className="status-row"><span className={`signal-chip ${item.availability_geometry==='ROUTE'?'route':'radius'}`}>{item.availability_geometry==='ROUTE'?<Route aria-hidden="true"/>:<CircleDotDashed aria-hidden="true"/>}{item.availability_geometry==='ROUTE'?'Current route':'Current radius'}</span><span className={`status ${item.status==='PARTIAL'?'yellow':'green'}`}>{item.status==='PARTIAL'?`${item.available_percent}% open`:'Empty'}</span></div><h2>{item.vehicle_make} {item.vehicle_model}</h2><p>{item.platform_number} · {item.cargo_configuration}</p></div></div>
        <div className="public-provider-line"><Building2 aria-hidden="true"/><span><strong>{item.provider_name}</strong><small>{item.review_count?<><Star aria-hidden="true"/>{item.average_rating} from {item.review_count} verified shipment {item.review_count===1?'review':'reviews'}</>:'New provider profile'}</small></span></div>
        <div className={`current-signal-panel ${item.availability_geometry==='ROUTE'?'route':'radius'}`}><small>Available now</small><strong>{signalTitle(item)}</strong><span>Updated {item.updated_label} · confirm current fit directly</span></div>
        {item.next_trip?<div className="future-signal-panel"><CalendarDays aria-hidden="true"/><span><small>Next trip · {tripDay(item.next_trip.travel_date)}</small><strong>{item.next_trip.origin} → {item.next_trip.destination}</strong><em>{item.next_trip.space_status==='EMPTY'?'Empty truck':`${item.next_trip.available_percent}% open`}</em></span></div>:null}
        {item.recurring_corridors?.length?<details className="corridor-signals"><summary><Route aria-hidden="true"/>{item.recurring_corridors.length} recurring {item.recurring_corridors.length===1?'signal':'signals'}<ChevronDown aria-hidden="true"/></summary>{item.recurring_corridors.slice(0,6).map((corridor:any)=><div key={corridor.id} className={corridor.geometry==='RADIUS'?'recurring-area':''}><strong>{corridor.geometry==='RADIUS'?<>{corridor.place_label} · {corridor.radius_km} km permanent radius</>:<>{corridor.origin} → {corridor.destination}</>}</strong><span>{corridor.geometry==='RADIUS'?'Recurring working area':'Recurring route'} · confirm availability</span></div>)}</details>:null}
        <div className="verification-reminder"><ShieldCheck aria-hidden="true"/><span>Check the provider, Driver, truck authority, and current documents before agreeing.</span></div>
        <div className="public-card-actions"><button type="button" className="button secondary" onClick={()=>showOnMap(item.id)}><MapPinned aria-hidden="true"/>View on map</button><Link className="button" href={`/@${item.provider_handle}`}><Building2 aria-hidden="true"/>Provider details</Link></div>
        {item.contact_phone||item.contact_whatsapp||item.contact_email||item.contact_website?<div className="public-contact-row">{item.contact_phone?<a href={`tel:${item.contact_phone}`}><Phone aria-hidden="true"/>Call</a>:null}{item.contact_whatsapp?<a href={`https://wa.me/${String(item.contact_whatsapp).replace(/\D/g,'')}`}><MessageCircle aria-hidden="true"/>WhatsApp</a>:null}{item.contact_email?<a href={`mailto:${item.contact_email}`}><Mail aria-hidden="true"/>Email</a>:null}{item.contact_website?<a href={item.contact_website} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true"/>Website</a>:null}</div>:null}
      </article>)}
    </section>:null}
    {!items.length&&!loading?<div className="empty-state">No published capacity matches these filters. Clear a filter or check again soon.</div>:null}
    {error?<div className="alert warning">{error} <button type="button" onClick={()=>void loadMore()}><RefreshCw aria-hidden="true"/>Try again</button></div>:null}
    <div ref={sentinel} className="public-feed-end">{hasMore?<button type="button" className="button secondary" onClick={()=>void loadMore()} disabled={loading}><ChevronDown aria-hidden="true"/>{loading?'Loading more capacity…':'Load more capacity'}</button>:items.length?<span>You reached the end of current capacity.</span>:null}</div>
  </>;
}
