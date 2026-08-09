"use client";

import React from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, CircleDotDashed, ExternalLink, List, LocateFixed, Mail, Map, MapPinned, MessageCircle, Phone, RefreshCw, Route, Search, ShieldCheck, SlidersHorizontal, Star, Truck, X } from 'lucide-react';
import { obscureCoordinate, BUSINESS_SEARCH_PRIVACY_KM } from '@/lib/location-privacy.js';
import { PublicCapacityMap } from './public-capacity-map';

type FeedResult={items:any[];nextCursor:string|null;hasMore:boolean;pageSize:number};
type Point={lat:number;lng:number};
type VisitorLocationState='idle'|'locating'|'ready'|'denied'|'timeout'|'unavailable'|'unsupported'|'insecure'|'outside'|'error';

function signalTitle(item:any){return item.availability_geometry==='ROUTE'?`${item.current_route_origin} → ${item.current_route_destination}`:`${item.location_area||'General current area'} · ${item.work_radius_km||50} km working radius`;}

export function PublicCapacityFeed({initial,query,searchPath='/'}:{initial:FeedResult;query:Record<string,string>;searchPath?:string}){
  const [items,setItems]=React.useState(initial.items);
  const [cursor,setCursor]=React.useState(initial.nextCursor);
  const [hasMore,setHasMore]=React.useState(initial.hasMore);
  const [loading,setLoading]=React.useState(false);
  const [error,setError]=React.useState('');
  const [view,setView]:['LIST'|'MAP',(value:'LIST'|'MAP')=>void]=React.useState('MAP');
  const [selectedId,setSelectedId]:[string|null,(value:string|null)=>void]=React.useState(null);
  const [viewer,setViewer]:[Point|null,(value:Point|null)=>void]=React.useState(null);
  const [near,setNear]:[{lat:number;lng:number;radius:number}|null,(value:{lat:number;lng:number;radius:number}|null)=>void]=React.useState(null);
  const [locationState,setLocationState]:[VisitorLocationState,(value:VisitorLocationState)=>void]=React.useState('idle');
  const [locationFeedback,setLocationFeedback]=React.useState('');
  const [filterOpen,setFilterOpen]=React.useState(false);
  const filterDialog=React.useRef(null as HTMLDialogElement|null);
  const sentinel=React.useRef(null as HTMLDivElement|null);
  const initialLocationRequest=React.useRef(false);

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
    setLocationFeedback('');
    if(!window.isSecureContext){setLocationState('insecure');return;}
    if(!navigator.geolocation){setLocationState('unsupported');return;}
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(async position=>{
      const exact={lat:position.coords.latitude,lng:position.coords.longitude};
      if(exact.lat<3||exact.lat>15||exact.lng<32||exact.lng>49){setLocationState('outside');setLocationFeedback('Your device location is outside the current Ethiopia market area. The full capacity market remains available.');return;}
      const displaced=obscureCoordinate(exact.lat,exact.lng,BUSINESS_SEARCH_PRIVACY_KM);
      const nextNear={lat:displaced.lat,lng:displaced.lng,radius:20};
      setViewer(exact);setNear(nextNear);setSelectedId(null);setLoading(true);setError('');
      try{const response=await fetch(`/api/public/capacity?${params(null,nextNear).toString()}`);if(!response.ok)throw new Error();const page:FeedResult=await response.json();setItems(page.items);setCursor(page.nextCursor);setHasMore(page.hasMore);setView('MAP');setLocationState('ready');setLocationFeedback(`Location updated at ${new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date())}. Showing capacity that may serve the surrounding area.`);}catch{setLocationState('error');setLocationFeedback('Your location was found, but nearby capacity could not be refreshed. Retry or continue with the full market.');}finally{setLoading(false);}
    },event=>setLocationState(event.code===event.PERMISSION_DENIED?'denied':event.code===event.TIMEOUT?'timeout':'unavailable'),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  }

  React.useEffect(()=>{
    if(initialLocationRequest.current)return;
    initialLocationRequest.current=true;
    useMyLocation();
  },[]);

  React.useEffect(()=>{
    const dialog=filterDialog.current;if(!dialog)return;
    if(filterOpen&&!dialog.open)dialog.showModal();
    if(!filterOpen&&dialog.open)dialog.close();
  },[filterOpen]);

  function showOnMap(id:string){setSelectedId(id);setView('MAP');requestAnimationFrame(()=>document.getElementById('capacity-map-view')?.scrollIntoView({behavior:'smooth',block:'start'}));}
  const selected=items.find((item:any)=>item.id===selectedId)||null;
  const locationActionLabel=locationState==='locating'?'Finding your location…':locationState==='ready'?'Refresh my location':['denied','timeout','unavailable','outside','error'].includes(locationState)?'Retry location permission':'Use my location';
  const activeFilterCount=Number(Boolean(query.status))+Number(Boolean(query.geometry));
  const searchControls=<div className="capacity-search-controls"><form action={searchPath} className="capacity-map-search"><label className="sr-only" htmlFor="capacity-market-search">Search capacity</label><Search aria-hidden="true"/><input id="capacity-market-search" type="search" name="q" defaultValue={query.q} placeholder="Search trucks or providers"/><input type="hidden" name="status" value={query.status}/><input type="hidden" name="geometry" value={query.geometry}/><button type="submit" aria-label="Search capacity"><Search aria-hidden="true"/></button></form><button type="button" className="capacity-filter-trigger" onClick={()=>setFilterOpen(true)}><SlidersHorizontal aria-hidden="true"/>Filters{activeFilterCount?<span>{activeFilterCount}</span>:null}</button></div>;

  return <>
    <dialog ref={filterDialog} className="capacity-filter-dialog" aria-labelledby="capacity-filter-title" onClose={()=>setFilterOpen(false)}><div className="capacity-filter-dialog-head"><div><small>Refine the map</small><h2 id="capacity-filter-title">Capacity filters</h2></div><button type="button" onClick={()=>setFilterOpen(false)} aria-label="Close filters"><X aria-hidden="true"/></button></div><form action={searchPath}><input type="hidden" name="q" value={query.q}/><label htmlFor="capacity-status-filter"><span>Availability</span><select id="capacity-status-filter" name="status" defaultValue={query.status}><option value="">Empty or Partial</option><option value="EMPTY">Empty</option><option value="PARTIAL">Partial</option></select></label><label htmlFor="capacity-geometry-filter"><span>Available by</span><select id="capacity-geometry-filter" name="geometry" defaultValue={query.geometry}><option value="">Radius or corridor</option><option value="RADIUS">Radius</option><option value="ROUTE">Corridor</option></select></label><div className="capacity-filter-actions"><Link href={searchPath}>Clear all</Link><button className="button" type="submit"><SlidersHorizontal aria-hidden="true"/>Show capacity</button></div></form></dialog>
    <section className="public-capacity-toolbar" aria-label="Capacity view and location controls">
      <div className="public-view-toggle"><button type="button" aria-pressed={view==='MAP'} onClick={()=>setView('MAP')}><Map aria-hidden="true"/>Map</button><button type="button" aria-pressed={view==='LIST'} onClick={()=>setView('LIST')}><List aria-hidden="true"/>List</button></div>
      <button type="button" className="button location-action" onClick={useMyLocation} disabled={locationState==='locating'}><LocateFixed aria-hidden="true"/>{locationActionLabel}</button>
      <span className="public-location-note">Your exact location stays in this browser.</span>
    </section>
    {locationFeedback?<div className={`alert ${locationState==='ready'?'success':'warning'}`} data-testid="visitor-location-state">{locationFeedback}</div>:null}
    {locationState==='denied'?<div className="alert warning" data-testid="visitor-location-state">Location permission is blocked. Enable location for this site in browser settings, then press Retry location permission.</div>:null}
    {locationState==='timeout'?<div className="alert warning" data-testid="visitor-location-state">The location request timed out. Move somewhere with a clearer signal and retry.</div>:null}
    {locationState==='unavailable'?<div className="alert warning" data-testid="visitor-location-state">The device could not provide a location. Check the device location service and retry.</div>:null}
    {locationState==='unsupported'?<div className="alert warning" data-testid="visitor-location-state">This browser does not provide device location. The full market remains available.</div>:null}
    {locationState==='insecure'?<div className="alert warning" data-testid="visitor-location-state">Location requires HTTPS, or localhost during development. Open Loadgistic through a secure address and retry.</div>:null}
    {locationState==='error'?<div className="alert warning" data-testid="visitor-location-state">A usable location was not available. Try again or continue without it.</div>:null}
    {view==='MAP'?<section id="capacity-map-view" className="public-map-shell">{selected?null:searchControls}<PublicCapacityMap items={items} viewer={viewer} selectedId={selectedId} onSelect={setSelectedId}/>{selected?<aside className="map-capacity-sheet" role="dialog" aria-modal="false" aria-label={`${selected.provider_name} capacity details`}><button type="button" className="map-focus-exit" onClick={()=>setSelectedId(null)}><Map aria-hidden="true"/>Show all trucks</button><div className="status-row"><span className={`signal-chip ${selected.availability_geometry==='ROUTE'?'route':'radius'}`}>{selected.availability_geometry==='ROUTE'?<Route aria-hidden="true"/>:<CircleDotDashed aria-hidden="true"/>}{selected.availability_geometry==='ROUTE'?'Current corridor':'Current radius'}</span><span className={`status ${selected.status==='PARTIAL'?'yellow':'green'}`}>{selected.status==='PARTIAL'?`${selected.available_percent}% open`:'Empty'}</span></div><h2>{selected.vehicle_make} {selected.vehicle_model}</h2><p>{selected.platform_number} · {selected.cargo_configuration}</p><div className="public-provider-line"><Building2 aria-hidden="true"/><span><strong>{selected.provider_name}</strong><small>{selected.review_count?<><Star aria-hidden="true"/>{selected.average_rating} from {selected.review_count} verified shipment {selected.review_count===1?'review':'reviews'}</>:'New provider profile'}</small></span></div><div className={`current-signal-panel ${selected.availability_geometry==='ROUTE'?'route':'radius'}`}><small>Available now</small><strong>{signalTitle(selected)}</strong><span>{selected.availability_geometry==='ROUTE'?'The yellow line is the available corridor. The violet circle shows the approximate current location.':'The green circle shows where the truck can work. The violet circle shows its approximate current location.'}</span></div><div className="privacy-signal-panel"><CircleDotDashed aria-hidden="true"/><span><small>Approximate current location</small><strong>{selected.location_precision_km||20} km radius</strong></span></div>{selected.recurring_corridors?.length?<div className="map-sheet-corridors"><Route aria-hidden="true"/><span><strong>{selected.recurring_corridors.map((corridor:any)=>`${corridor.origin} ↔ ${corridor.destination}`).join(' · ')}</strong><small>Two-way regular corridors · confirm availability</small></span></div>:null}<div className="verification-reminder"><ShieldCheck aria-hidden="true"/><span>Confirm the provider, Driver, truck permits, documents, cargo fit, and terms.</span></div><div className="public-card-actions"><Link className="button" href={`/@${selected.provider_handle}`}><Building2 aria-hidden="true"/>Provider details</Link>{selected.contact_phone?<a className="button secondary" href={`tel:${selected.contact_phone}`}><Phone aria-hidden="true"/>Call {selected.contact_phone}</a>:null}</div></aside>:null}</section>:null}
    {view==='LIST'?<>{searchControls}<section className="public-capacity-grid" aria-live="polite">
      {items.map((item:any)=><article className="public-capacity-card" key={item.id}>
        <div className="public-capacity-card-head"><div className="truck-symbol"><Truck aria-hidden="true"/></div><div><div className="status-row"><span className={`signal-chip ${item.availability_geometry==='ROUTE'?'route':'radius'}`}>{item.availability_geometry==='ROUTE'?<Route aria-hidden="true"/>:<CircleDotDashed aria-hidden="true"/>}{item.availability_geometry==='ROUTE'?'Current corridor':'Current radius'}</span><span className={`status ${item.status==='PARTIAL'?'yellow':'green'}`}>{item.status==='PARTIAL'?`${item.available_percent}% open`:'Empty'}</span></div><h2>{item.vehicle_make} {item.vehicle_model}</h2><p>{item.platform_number} · {item.cargo_configuration}</p></div></div>
        <div className="public-provider-line"><Building2 aria-hidden="true"/><span><strong>{item.provider_name}</strong><small>{item.review_count?<><Star aria-hidden="true"/>{item.average_rating} from {item.review_count} verified shipment {item.review_count===1?'review':'reviews'}</>:'New provider profile'}</small></span></div>
        <div className={`current-signal-panel ${item.availability_geometry==='ROUTE'?'route':'radius'}`}><small>Available now</small><strong>{signalTitle(item)}</strong><span>Updated {item.updated_label} · confirm current fit directly</span>{item.possible_distance_min_km!=null&&item.possible_distance_max_km!=null?<em data-testid="possible-distance">Possibly {item.possible_distance_min_km}–{item.possible_distance_max_km} km from your area</em>:null}</div>
        {item.recurring_corridors?.length?<section className="corridor-signals" aria-label="Regular corridors" data-testid="visible-regular-corridors"><div className="corridor-signals-title"><Route aria-hidden="true"/><strong>{item.recurring_corridors.length} regular {item.recurring_corridors.length===1?'corridor':'corridors'}</strong></div>{item.recurring_corridors.slice(0,2).map((corridor:any)=><div className="corridor-signal-row" key={corridor.id}><strong>{corridor.origin} ↔ {corridor.destination}</strong><span>Two-way regular corridor · confirm availability</span></div>)}</section>:null}
        <div className="verification-reminder"><ShieldCheck aria-hidden="true"/><span>Check the provider, Driver, truck permits, and current documents before agreeing.</span></div>
        <div className="public-card-actions"><button type="button" className="button secondary" onClick={()=>showOnMap(item.id)}><MapPinned aria-hidden="true"/>View on map</button><Link className="button" href={`/@${item.provider_handle}`}><Building2 aria-hidden="true"/>Provider details</Link></div>
        {item.contact_phone||item.contact_whatsapp||item.contact_email||item.contact_website?<div className="public-contact-row">{item.contact_phone?<a href={`tel:${item.contact_phone}`}><Phone aria-hidden="true"/>Call {item.contact_phone}</a>:null}{item.contact_whatsapp?<a href={`https://wa.me/${String(item.contact_whatsapp).replace(/\D/g,'')}`}><MessageCircle aria-hidden="true"/>WhatsApp</a>:null}{item.contact_email?<a href={`mailto:${item.contact_email}`}><Mail aria-hidden="true"/>Email</a>:null}{item.contact_website?<a href={item.contact_website} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true"/>Website</a>:null}</div>:null}
      </article>)}
    </section></>:null}
    {!items.length&&!loading?<div className="empty-state">No published capacity matches these filters. Clear a filter or check again soon.</div>:null}
    {error?<div className="alert warning">{error} <button type="button" onClick={()=>void loadMore()}><RefreshCw aria-hidden="true"/>Try again</button></div>:null}
    <div ref={sentinel} className="public-feed-end">{hasMore?<button type="button" className="button secondary" onClick={()=>void loadMore()} disabled={loading}><ChevronDown aria-hidden="true"/>{loading?'Loading more capacity…':'Load more capacity'}</button>:items.length?<span>You reached the end of current capacity.</span>:null}</div>
  </>;
}
