"use client";

import Image from 'next/image';
import Link from 'next/link';
import {
  Boxes,
  Building2,
  CalendarClock,
  ChevronDown,
  Clock3,
  LocateFixed,
  Map,
  MapPinned,
  PackageCheck,
  Phone,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  Truck,
  UserRound,
  X
} from 'lucide-react';
import React from 'react';
import { BUSINESS_SEARCH_PRIVACY_KM, obscureCoordinate } from '@/lib/location-privacy.js';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
import { EthiopiaPlaceInput } from './ethiopia-place-input';
import { PublicCapacityMap } from './public-capacity-map';

type FeedResult={items:any[];nextCursor:string|null;hasMore:boolean;pageSize:number};
type Point={lat:number;lng:number};
type VisitorLocationState='idle'|'locating'|'ready'|'denied'|'timeout'|'unavailable'|'unsupported'|'insecure'|'outside'|'error';
type SearchSuggestion={key:string;kind:'PROVIDER'|'TRUCK';title:string;detail:string;href:string};

const routeTolerances=[10,25,50,100,200];

function Choice({name,value,checked,onChange,children,disabled=false}:{
  name:string;
  value:string;
  checked:boolean;
  onChange:()=>void;
  children:React.ReactNode;
  disabled?:boolean;
}){
  return <label className={`capacity-filter-choice${checked?' selected':''}${disabled?' disabled':''}`}>
    <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled}/>
    {children}
  </label>;
}

export function PublicCapacityFeed({initial,query,searchPath='/',apiPath='/api/public/capacity'}:{initial:FeedResult;query:Record<string,string>;searchPath?:string;apiPath?:string}){
  const [items,setItems]=React.useState(initial.items);
  const [cursor,setCursor]=React.useState(initial.nextCursor);
  const [hasMore,setHasMore]=React.useState(initial.hasMore);
  const [loading,setLoading]=React.useState(false);
  const [error,setError]=React.useState('');
  const [selectedId,setSelectedId]:[string|null,(value:string|null)=>void]=React.useState(initial.items.some((item:any)=>item.id===query.truck)?query.truck:null);
  const [viewer,setViewer]:[Point|null,(value:Point|null)=>void]=React.useState(null);
  const parsedNearLat=Number(query.nearLat);
  const parsedNearLng=Number(query.nearLng);
  const initialNear=query.nearLat!==''&&query.nearLng!==''&&Number.isFinite(parsedNearLat)&&parsedNearLat>=3&&parsedNearLat<=15&&Number.isFinite(parsedNearLng)&&parsedNearLng>=32&&parsedNearLng<=49
    ?{lat:parsedNearLat,lng:parsedNearLng,radius:Number(query.nearRadiusKm)||20}
    :null;
  const [near,setNear]:[{lat:number;lng:number;radius:number}|null,(value:{lat:number;lng:number;radius:number}|null)=>void]=React.useState(initialNear);
  const [nearFilterEnabled,setNearFilterEnabled]=React.useState(Boolean(initialNear));
  const [locationState,setLocationState]:[VisitorLocationState,(value:VisitorLocationState)=>void]=React.useState('idle');
  const [locationFeedback,setLocationFeedback]=React.useState('');
  const [filterOpen,setFilterOpen]=React.useState(false);
  const [statusFilter,setStatusFilter]=React.useState(query.status||'');
  const [geometryFilter,setGeometryFilter]=React.useState(query.geometry||'');
  const [vehicleFilter,setVehicleFilter]=React.useState(query.vehicleCategory||'');
  const [searchTerm,setSearchTerm]=React.useState(query.q||'');
  const [searchSuggestions,setSearchSuggestions]=React.useState([] as SearchSuggestion[]);
  const [searchSuggestionsOpen,setSearchSuggestionsOpen]=React.useState(false);
  const [searchSuggestionsLoading,setSearchSuggestionsLoading]=React.useState(false);
  const filterDialog=React.useRef(null as HTMLDialogElement|null);
  const vehiclePicker=React.useRef(null as HTMLDetailsElement|null);
  const initialLocationRequest=React.useRef(false);
  const loadMoreInFlight=React.useRef(false);

  const params=React.useCallback((nextCursor?:string|null)=>{
    const value=new URLSearchParams(query);
    if(nextCursor)value.set('cursor',nextCursor);else value.delete('cursor');
    return value;
  },[query]);

  const loadMore=React.useCallback(async()=>{
    if(!cursor||loadMoreInFlight.current)return false;
    loadMoreInFlight.current=true;
    setLoading(true);
    setError('');
    try{
      const response=await fetch(`${apiPath}?${params(cursor).toString()}`);
      if(!response.ok)throw new Error('Capacity could not be loaded.');
      const page:FeedResult=await response.json();
      setItems((current:any[])=>{
        const currentIds=new Set(current.map((item:any)=>item.id));
        return [...current,...page.items.filter((item:any)=>!currentIds.has(item.id))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      return page.items.length>0;
    }catch(problem){
      setError(problem instanceof Error?problem.message:'Capacity results could not be loaded.');
      return false;
    }finally{
      loadMoreInFlight.current=false;
      setLoading(false);
    }
  },[apiPath,cursor,params]);

  function useMyLocation(){
    setLocationFeedback('');
    if(!window.isSecureContext){setLocationState('insecure');return;}
    if(!navigator.geolocation){setLocationState('unsupported');return;}
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(position=>{
      const exact={lat:position.coords.latitude,lng:position.coords.longitude};
      if(exact.lat<3||exact.lat>15||exact.lng<32||exact.lng>49){
        setLocationState('outside');
        setLocationFeedback('Your location is outside the current Ethiopia coverage area. You can continue browsing available trucks.');
        return;
      }
      const displaced=obscureCoordinate(exact.lat,exact.lng,BUSINESS_SEARCH_PRIVACY_KM);
      const requestedNearRadius=Number(query.nearRadiusKm);
      const nextNear={lat:displaced.lat,lng:displaced.lng,radius:[5,10,20,50,100].includes(requestedNearRadius)?requestedNearRadius:20};
      setViewer(exact);
      setNear(nextNear);
      setLocationState('ready');
      setLocationFeedback('Location updated. The map is centered around your area.');
    },event=>setLocationState(event.code===event.PERMISSION_DENIED?'denied':event.code===event.TIMEOUT?'timeout':'unavailable'),{
      enableHighAccuracy:true,
      timeout:20000,
      maximumAge:0
    });
  }

  React.useEffect(()=>{
    if(initialLocationRequest.current)return;
    initialLocationRequest.current=true;
    useMyLocation();
  },[]);

  React.useEffect(()=>{
    const dialog=filterDialog.current;
    if(!dialog)return;
    if(filterOpen&&!dialog.open)dialog.showModal();
    if(!filterOpen&&dialog.open)dialog.close();
  },[filterOpen]);

  React.useEffect(()=>{
    const term=searchTerm.trim();
    if(term.length<2){
      setSearchSuggestions([]);
      setSearchSuggestionsOpen(false);
      setSearchSuggestionsLoading(false);
      return;
    }
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setSearchSuggestionsLoading(true);
      try{
        const response=await fetch(`${apiPath}?q=${encodeURIComponent(term)}`,{signal:controller.signal});
        if(!response.ok)throw new Error();
        const result:FeedResult=await response.json();
        const suggestions:SearchSuggestion[]=[];
        const providers=new Set<string>();
        for(const item of result.items){
          if(!providers.has(item.provider_handle)&&providers.size<4){
            providers.add(item.provider_handle);
            const suggestionParams=new URLSearchParams({q:item.provider_name,provider:item.provider_handle});
            suggestions.push({key:`provider:${item.provider_handle}`,kind:'PROVIDER',title:item.provider_name,detail:'Transporter · current trucks in Open capacity',href:`${searchPath}?${suggestionParams.toString()}`});
          }
        }
        for(const item of result.items.slice(0,5)){
          const suggestionParams=new URLSearchParams({q:item.platform_number||`${item.vehicle_make} ${item.vehicle_model}`,truck:item.id});
          suggestions.push({key:`truck:${item.id}`,kind:'TRUCK',title:`${item.vehicle_make} ${item.vehicle_model}`,detail:`${item.platform_number} · ${item.cargo_configuration} · ${item.provider_name}`,href:`${searchPath}?${suggestionParams.toString()}`});
        }
        setSearchSuggestions(suggestions);
        setSearchSuggestionsOpen(true);
      }catch(problem){
        if((problem as Error).name!=='AbortError'){
          setSearchSuggestions([]);
          setSearchSuggestionsOpen(true);
        }
      }finally{
        if(!controller.signal.aborted)setSearchSuggestionsLoading(false);
      }
    },220);
    return()=>{
      window.clearTimeout(timer);
      controller.abort();
    };
  },[apiPath,searchPath,searchTerm]);

  function closeFilters(){
    if(filterDialog.current?.open)filterDialog.current.close();
    setFilterOpen(false);
  }

  function chooseStatus(status:string){
    setStatusFilter(status);
    if(status==='PARTIAL'&&geometryFilter==='RADIUS')setGeometryFilter('ROUTE');
  }

  function chooseVehicle(configuration:string){
    setVehicleFilter(configuration);
    vehiclePicker.current?.removeAttribute('open');
  }

  const selected=items.find((item:any)=>item.id===selectedId)||null;
  const selectedConfiguration=VEHICLE_CONFIGURATIONS.find(configuration=>configuration.name===vehicleFilter);
  const locationActionLabel=locationState==='locating'
    ?'Finding your location…'
    :locationState==='ready'
      ?'Refresh my location'
      :['denied','timeout','unavailable','outside','error'].includes(locationState)
        ?'Retry location permission'
        :'Use my location';
  const activeFilterCount=Object.entries(query).filter(([key,value])=>!['q','provider','truck'].includes(key)&&Boolean(value)).length;
  const clearSearchParams=new URLSearchParams(query);
  ['q','provider','truck','cursor'].forEach(key=>clearSearchParams.delete(key));
  const clearSearchHref=`${searchPath}${clearSearchParams.size?`?${clearSearchParams.toString()}`:''}`;
  const hasSearch=Boolean(searchTerm.trim()||query.provider||query.truck);
  const locationNotice=locationFeedback||({
    denied:'Location permission is blocked. Enable location for this site in browser settings, then retry.',
    timeout:'The location request timed out. Move somewhere with a clearer signal and retry.',
    unavailable:'The device could not provide a location. Check the device location service and retry.',
    unsupported:'Location is not supported by this browser. You can continue browsing all trucks.',
    insecure:'Location is available only through a secure connection.',
    error:'Location could not be updated. Try again or continue browsing.'
  } as Partial<Record<VisitorLocationState,string>>)[locationState]||'';
  const overlayKind=error?'error':loading?'loading':!items.length?'empty':locationNotice?'location':'';

  const searchControls=<div className="capacity-search-controls">
    <div className="capacity-search-combobox" onBlur={event=>{
      if(!event.currentTarget.contains(event.relatedTarget as Node))setSearchSuggestionsOpen(false);
    }}>
      <form action={searchPath} className="capacity-map-search">
        <label className="sr-only" htmlFor="capacity-market-search">Search published truck capacity</label>
        <Search aria-hidden="true"/>
        <input id="capacity-market-search" type="search" role="combobox" name="q" value={searchTerm} onChange={event=>setSearchTerm(event.target.value)} onFocus={()=>{if(searchTerm.trim().length>=2)setSearchSuggestionsOpen(true);}} onKeyDown={event=>{if(event.key==='Escape')setSearchSuggestionsOpen(false);}} autoComplete="off" aria-autocomplete="list" aria-controls="capacity-search-suggestions" aria-expanded={searchSuggestionsOpen} placeholder="Search trucks, routes, or transporters"/>
        {Object.entries(query).filter(([key,value])=>!['q','provider','truck'].includes(key)&&Boolean(value)).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>) }
        {hasSearch?<Link href={clearSearchHref} className="capacity-search-clear" aria-label="Clear truck search" onClick={()=>{setSearchTerm('');setSearchSuggestionsOpen(false);}}><X aria-hidden="true"/></Link>:null}
        <button type="submit" aria-label="Search published truck capacity"><Search aria-hidden="true"/></button>
      </form>
      {searchSuggestionsOpen?<div id="capacity-search-suggestions" className="capacity-search-suggestions" role="listbox" aria-label="Search suggestions">{searchSuggestionsLoading?<span className="capacity-suggestion-state">Finding trucks…</span>:searchSuggestions.length?searchSuggestions.map((suggestion:SearchSuggestion)=><Link key={suggestion.key} href={suggestion.href} role="option" onClick={()=>setSearchSuggestionsOpen(false)}><span className={`capacity-suggestion-icon ${suggestion.kind.toLowerCase()}`}>{suggestion.kind==='PROVIDER'?<Building2 aria-hidden="true"/>:<Truck aria-hidden="true"/>}</span><span><small>{suggestion.kind==='PROVIDER'?'Transporter':'Truck'}</small><strong>{suggestion.title}</strong><em>{suggestion.detail}</em></span></Link>):<span className="capacity-suggestion-state">No current trucks match that search.</span>}</div>:null}
    </div>
    <button type="button" className="capacity-filter-trigger" onClick={()=>setFilterOpen(true)}><SlidersHorizontal aria-hidden="true"/>Filters{activeFilterCount?<span>{activeFilterCount}</span>:null}</button>
  </div>;

  return <>
    <dialog ref={filterDialog} className="capacity-filter-dialog" aria-labelledby="capacity-filter-title" onClose={()=>setFilterOpen(false)}>
      <div className="capacity-filter-dialog-head"><div><small>Find the right truck</small><h2 id="capacity-filter-title">Filters</h2></div><button type="button" onClick={closeFilters} aria-label="Close filters"><X aria-hidden="true"/></button></div>
      <form action={searchPath} onSubmit={closeFilters}>
        <input type="hidden" name="q" value={query.q}/>{query.provider?<input type="hidden" name="provider" value={query.provider}/>:null}

        <fieldset className="capacity-route-filter">
          <legend><Route aria-hidden="true"/>Shipment route</legend>
          <p>Enter either endpoint or both. Routes are checked along their full path.</p>
          <div className="capacity-geography-filter route">
            <div className="form-group"><label htmlFor="capacity-route-origin"><MapPinned aria-hidden="true"/>Origin <small>(optional)</small></label><EthiopiaPlaceInput id="capacity-route-origin" name="origin" placeRefName="originPlaceRef" defaultPlaceRef={query.originPlaceRef||''} defaultValue={query.origin||''} placeholder="City or town"/></div>
            <div className="form-group"><label htmlFor="capacity-route-destination"><MapPinned aria-hidden="true"/>Destination <small>(optional)</small></label><EthiopiaPlaceInput id="capacity-route-destination" name="destination" placeRefName="destinationPlaceRef" defaultPlaceRef={query.destinationPlaceRef||''} defaultValue={query.destination||''} placeholder="City or town"/></div>
            <label htmlFor="capacity-origin-radius"><span>Origin range</span><select id="capacity-origin-radius" name="originRadiusKm" defaultValue={query.originRadiusKm||'50'}>{routeTolerances.map(value=><option value={value} key={value}>Within {value} km</option>)}</select></label>
            <label htmlFor="capacity-destination-radius"><span>Destination range</span><select id="capacity-destination-radius" name="destinationRadiusKm" defaultValue={query.destinationRadiusKm||'50'}>{routeTolerances.map(value=><option value={value} key={value}>Within {value} km</option>)}</select></label>
            <label htmlFor="capacity-route-direction"><span>Direction</span><select id="capacity-route-direction" name="directionMode" defaultValue={query.directionMode||'DIRECT'}><option value="DIRECT">Origin to destination</option><option value="EITHER">Either direction</option></select></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><PackageCheck aria-hidden="true"/>Capacity</legend>
          <div className="capacity-filter-choice-group capacity-status-choices" role="radiogroup" aria-label="Availability">
            <Choice name="status" value="" checked={statusFilter===''} onChange={()=>chooseStatus('')}><span className="capacity-choice-symbol any"><Truck aria-hidden="true"/></span><span><strong>Any</strong><small>Empty or Partial</small></span></Choice>
            <Choice name="status" value="EMPTY" checked={statusFilter==='EMPTY'} onChange={()=>chooseStatus('EMPTY')}><span className="capacity-choice-symbol empty"/><span><strong>Empty</strong><small>Full truck available</small></span></Choice>
            <Choice name="status" value="PARTIAL" checked={statusFilter==='PARTIAL'} onChange={()=>chooseStatus('PARTIAL')}><span className="capacity-choice-symbol partial"/><span><strong>Partial</strong><small>Some space available</small></span></Choice>
          </div>
          <div className="capacity-filter-choice-group capacity-geometry-choices" role="radiogroup" aria-label="Capacity signal">
            <Choice name="geometry" value="" checked={geometryFilter===''} onChange={()=>setGeometryFilter('')}><span className="capacity-choice-symbol any"><Map aria-hidden="true"/></span><span><strong>Any signal</strong><small>Area or route</small></span></Choice>
            <Choice name="geometry" value="RADIUS" checked={geometryFilter==='RADIUS'} onChange={()=>setGeometryFilter('RADIUS')} disabled={statusFilter==='PARTIAL'}><span className="capacity-choice-symbol area"><MapPinned aria-hidden="true"/></span><span><strong>Service area</strong><small>Empty trucks only</small></span></Choice>
            <Choice name="geometry" value="ROUTE" checked={geometryFilter==='ROUTE'} onChange={()=>setGeometryFilter('ROUTE')}><span className="capacity-choice-symbol route"><Route aria-hidden="true"/></span><span><strong>Capacity route</strong><small>Empty or Partial</small></span></Choice>
          </div>
          {geometryFilter==='RADIUS'?<div className="capacity-geography-filter"><div className="form-group"><label htmlFor="capacity-area-center"><MapPinned aria-hidden="true"/>Service area place</label><EthiopiaPlaceInput id="capacity-area-center" name="currentArea" placeRefName="currentAreaPlaceRef" defaultPlaceRef={query.currentAreaPlaceRef||''} defaultValue={query.currentArea||''} placeholder="City, town, or area"/></div><label htmlFor="capacity-area-radius"><span>Area range</span><select id="capacity-area-radius" name="currentAreaRadiusKm" defaultValue={query.currentAreaRadiusKm||'50'}>{[10,25,50,100,200,300].map(value=><option value={value} key={value}>Within {value} km</option>)}</select></label></div>:null}
        </fieldset>

        <fieldset>
          <legend><Truck aria-hidden="true"/>Truck</legend>
          <details ref={vehiclePicker} className="capacity-vehicle-picker">
            <summary><span className="capacity-vehicle-summary-art">{selectedConfiguration?<Image src={selectedConfiguration.image} alt="" width={88} height={58}/>:<Truck aria-hidden="true"/>}</span><span><small>Configuration</small><strong>{selectedConfiguration?.name||'Any configuration'}</strong></span><ChevronDown className="capacity-vehicle-chevron" aria-hidden="true"/></summary>
            <div className="capacity-vehicle-options" role="radiogroup" aria-label="Truck configuration">
              <label className={`capacity-vehicle-option${vehicleFilter===''?' selected':''}`}><input type="radio" name="vehicleCategory" value="" checked={vehicleFilter===''} onChange={()=>chooseVehicle('')}/><span><Truck aria-hidden="true"/></span><strong>Any configuration</strong></label>
              {VEHICLE_CONFIGURATIONS.map(configuration=><label className={`capacity-vehicle-option${vehicleFilter===configuration.name?' selected':''}`} key={configuration.name}><input type="radio" name="vehicleCategory" value={configuration.name} checked={vehicleFilter===configuration.name} onChange={()=>chooseVehicle(configuration.name)}/><Image src={configuration.image} alt="" width={112} height={74}/><strong>{configuration.name}</strong></label>)}
            </div>
          </details>
          <label htmlFor="capacity-load-filter"><span><Boxes aria-hidden="true"/>Load type</span><select id="capacity-load-filter" name="loadType" defaultValue={query.loadType}><option value="">Any load type</option><option value="FTL">Full truckload</option><option value="PTL">Partial truckload</option></select></label>
          <label htmlFor="capacity-stop-filter"><span><MapPinned aria-hidden="true"/>Stops</span><select id="capacity-stop-filter" name="stopOption" defaultValue={query.stopOption}><option value="">Any stop pattern</option><option value="MULTI_PICK">Multiple pickups</option><option value="MULTI_DROP">Multiple drop-offs</option></select></label>
          <label htmlFor="capacity-freshness-filter"><span><Clock3 aria-hidden="true"/>Updated</span><select id="capacity-freshness-filter" name="freshness" defaultValue={query.freshness}><option value="">Any published capacity</option><option value="FRESH">Within 12 hours</option><option value="UPDATE_NEEDED">More than 12 hours ago</option></select></label>
        </fieldset>

        <fieldset>
          <legend><LocateFixed aria-hidden="true"/>Near me</legend>
          <label className="checkbox-label" htmlFor="capacity-near-enabled"><input id="capacity-near-enabled" type="checkbox" checked={nearFilterEnabled} disabled={!near} onChange={event=>setNearFilterEnabled(event.target.checked)}/><span>Show trucks near my area</span></label>
          {nearFilterEnabled&&near?<><input type="hidden" name="nearLat" value={near.lat}/><input type="hidden" name="nearLng" value={near.lng}/><label htmlFor="capacity-near-radius"><span>Distance</span><select id="capacity-near-radius" name="nearRadiusKm" defaultValue={query.nearRadiusKm||'20'}>{[5,10,20,50,100].map(value=><option value={value} key={value}>Within {value} km</option>)}</select></label></>:null}
          <p>{near?'Your precise location stays on this device.':'Use your location first to enable nearby filtering.'}</p>
        </fieldset>

        <div className="capacity-filter-actions"><Link href={searchPath} onClick={closeFilters}>Clear</Link><button className="button" type="submit"><SlidersHorizontal aria-hidden="true"/>Show matching trucks</button></div>
      </form>
    </dialog>

    <div className="market-workbench market-map-view">
      <div className="market-command-column"><section className="public-capacity-toolbar" aria-label="Capacity map location controls"><button type="button" className="button location-action" onClick={useMyLocation} disabled={locationState==='locating'}><LocateFixed aria-hidden="true"/>{locationActionLabel}</button><span className="public-location-note">Your precise location remains on this device.</span></section>{searchControls}</div>
      <section id="capacity-map-view" className={`public-map-shell${selected?' has-selected-truck':''}`}>
        <div className="public-map-canvas"><PublicCapacityMap items={items} viewer={viewer} selectedId={selectedId} keepItemsInView={Boolean(query.provider)} onSelect={setSelectedId} onExplore={hasMore?()=>void loadMore():undefined}/>{selected?<aside className="map-capacity-sheet" aria-label={`${selected.provider_name} truck summary`}><button type="button" className="map-focus-exit" onClick={()=>setSelectedId(null)} aria-label="Close truck summary"><X aria-hidden="true"/></button><div className="map-truck-identity"><span className={`status ${selected.status==='PARTIAL'?'yellow':'green'}`}>{selected.status==='PARTIAL'?'Partial':'Empty'}</span><strong>{selected.vehicle_make} {selected.vehicle_model}</strong><small>{selected.provider_name}</small></div><div className={`map-signal-age ${selected.capacity_confirmation_needed?'confirm':''}`}><CalendarClock aria-hidden="true"/><span><strong>{selected.capacity_updated_label||'Capacity update unavailable'}</strong>{selected.current_signal_geometry_visible!==false?<small>{selected.location_updated_label||'Location update unavailable'}</small>:null}{selected.capacity_confirmation_needed?<small>Confirm availability directly.</small>:null}</span></div>{selected.current_signal_geometry_visible===false?<p className="map-private-signal-note"><MapPinned aria-hidden="true"/><span><strong>Regular service—not current location</strong>Call for current details or ask the Driver to share private capacity with your email.</span></p>:null}<div className="public-truck-driver"><UserRound aria-hidden="true"/><span><strong>{selected.assigned_driver_first_name||'Driver not named'}</strong><small>{selected.driver_kind_label}{selected.assigned_driver_phone?` · ${selected.assigned_driver_phone}`:' · Phone not published'}</small></span></div><div className="public-driver-trust"><span className={selected.driver_verification_badges?.every((badge:any)=>badge.verified)?'verified':'unverified'}>Driver documents {selected.driver_verification_badges?.every((badge:any)=>badge.verified)?'reviewed':'not fully verified'}</span><span className={selected.truck_verification_badges?.every((badge:any)=>badge.verified)?'verified':'unverified'}>Truck documents {selected.truck_verification_badges?.every((badge:any)=>badge.verified)?'reviewed':'not verified'}</span></div><div className="public-card-actions"><Link className="button" href={`/@${selected.provider_handle}`}><Building2 aria-hidden="true"/>Profile</Link>{selected.assigned_driver_phone?<a className="button secondary" href={`tel:${selected.assigned_driver_phone}`}><Phone aria-hidden="true"/>Call driver</a>:selected.contact_phone?<a className="button secondary" href={`tel:${selected.contact_phone}`}><Phone aria-hidden="true"/>Call</a>:null}</div></aside>:null}</div>
        {overlayKind?<div className={`public-feed-overlay ${overlayKind}`} role={overlayKind==='error'?'alert':'status'} aria-live={overlayKind==='error'?'assertive':'polite'} data-testid={overlayKind==='location'?'visitor-location-state':'capacity-feed-state'}>{overlayKind==='error'?<>{error}<button type="button" onClick={()=>void loadMore()}><RefreshCw aria-hidden="true"/>Try again</button></>:overlayKind==='loading'?'Loading more truck capacity…':overlayKind==='empty'?'No truck signals match these filters. Adjust your search or check again later.':locationNotice}</div>:null}
      </section>
    </div>
  </>;
}
