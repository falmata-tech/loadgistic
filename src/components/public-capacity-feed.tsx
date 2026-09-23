"use client";


import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {
  Boxes,
  Building2,
  CalendarClock,
  PanelLeftClose,
  PanelLeftOpen,
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
import {loadCapacityMapWindow,preserveSelectedMapTruck} from '@/lib/capacity-map-loading.js';
import { BUSINESS_SEARCH_PRIVACY_KM, obscureCoordinate } from '@/lib/location-privacy.js';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
import { EthiopiaPlaceInput } from './ethiopia-place-input';
import { PublicCapacityMap } from './public-capacity-map';
import { TruckDocumentSummary } from './truck-document-summary';
import {LoadingIndicator} from './loading-state';

type FeedResult={items:any[];nextCursor:string|null;hasMore:boolean;pageSize:number;filterError?:string|null};
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

type FeedProps={initial:FeedResult;query:Record<string,string>;searchPath?:string;apiPath?:string};

export function PublicCapacityFeed(props:FeedProps){
  const [resetVersion,setResetVersion]=React.useState(0);
  // Filters own the feed, selected truck and viewport together. Both public and
  // private navigation must discard that state when the applied query changes.
  const queryKey=JSON.stringify(Object.entries(props.query).sort(([a],[b])=>a.localeCompare(b)));
  return <CapacityFeedState key={`${queryKey}:${resetVersion}`} {...props} onReset={()=>setResetVersion((value:number)=>value+1)}/>;
}

function CapacityFeedState({initial,query,searchPath='/',apiPath='/api/public/capacity',onReset}:FeedProps&{onReset:()=>void}){
  // A link to the current unfiltered URL does not navigate. Reset local drafts
  // and the map explicitly in that case; other clears use the new query key.
  function clearUnappliedFilters(){if(!Object.values(query).some(Boolean))onReset();}
  const [items,setItems]=React.useState(initial.items);
  const [loading,setLoading]=React.useState(false);
  const [error,setError]=React.useState(initial.filterError||'');
  const [selectedId,setSelectedId]:[string|null,(value:string|null)=>void]=React.useState(initial.items.some((item:any)=>item.id===query.truck)?query.truck:null);
  const [viewer,setViewer]:[Point|null,(value:Point|null)=>void]=React.useState(null);
  const parsedNearLat=Number(query.nearLat);
  const parsedNearLng=Number(query.nearLng);
  const initialNear=query.nearLat!==''&&query.nearLng!==''&&Number.isFinite(parsedNearLat)&&parsedNearLat>=3&&parsedNearLat<=15&&Number.isFinite(parsedNearLng)&&parsedNearLng>=32&&parsedNearLng<=49
    ?{lat:parsedNearLat,lng:parsedNearLng,radius:Number(query.nearRadiusKm)||20}
    :null;
  const [near,setNear]:[{lat:number;lng:number;radius:number}|null,(value:{lat:number;lng:number;radius:number}|null)=>void]=React.useState(initialNear);
  const [nearFilterEnabled,setNearFilterEnabled]=React.useState(Boolean(initialNear)&&!query.truckCityPlaceRef&&!query.truckCity);
  const [truckCityName,setTruckCityName]=React.useState(query.truckCity||'');
  const [locationState,setLocationState]:[VisitorLocationState,(value:VisitorLocationState)=>void]=React.useState('idle');
  const [locationFeedback,setLocationFeedback]=React.useState('');
  const [filterOpen,setFilterOpen]=React.useState(false);
  const [drawerOpen,setDrawerOpen]=React.useState(false);
  const [controlsReady,setControlsReady]=React.useState(false);
  const drawerTrigger=React.useRef(null as HTMLButtonElement|null);
  const drawer=React.useRef(null as HTMLElement|null);
  const swipeStart=React.useRef(null as {x:number;y:number}|null);
  React.useEffect(()=>{setDrawerOpen(window.matchMedia('(min-width:761px)').matches);setControlsReady(true);},[]);
  function closeDrawer(){setDrawerOpen(false);setSearchSuggestionsOpen(false);requestAnimationFrame(()=>drawerTrigger.current?.focus());}
  function openDrawer(){setDrawerOpen(true);requestAnimationFrame(()=>drawer.current?.focus());}
  function startSwipe(event:React.PointerEvent<HTMLElement>){
    if((event.target as HTMLElement).closest('button,input,select,a'))return;
    swipeStart.current={x:event.clientX,y:event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function finishSwipe(event:React.PointerEvent<HTMLElement>,open:boolean){
    const start=swipeStart.current;swipeStart.current=null;
    if(!start)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5){if(open&&dx<0)closeDrawer();if(!open&&dx>0)openDrawer();}
  }
  const [statusFilter,setStatusFilter]=React.useState(query.status||'');
  const [geometryFilter,setGeometryFilter]=React.useState(query.geometry||'');
  const [vehicleFilter,setVehicleFilter]=React.useState(query.vehicleCategory||'');
  const [searchTerm,setSearchTerm]=React.useState(query.q||'');
  const [searchSuggestions,setSearchSuggestions]=React.useState([] as SearchSuggestion[]);
  const [searchSuggestionsOpen,setSearchSuggestionsOpen]=React.useState(false);
  const [searchSuggestionsLoading,setSearchSuggestionsLoading]=React.useState(false);
  const filterDialog=React.useRef(null as HTMLDialogElement|null);
  const initialLocationRequest=React.useRef(false);
  const viewport=React.useRef('');
  const selectedRef=React.useRef(selectedId);selectedRef.current=selectedId;
  const generation=React.useRef(0);
  const pendingRequest=React.useRef(null as AbortController|null);
  React.useEffect(()=>()=>pendingRequest.current?.abort(),[]);

  const loadWindow=React.useCallback(async()=>{
    generation.current+=1;pendingRequest.current?.abort();
    const version=generation.current;
    const controller=new AbortController();pendingRequest.current=controller;
    const params=new URLSearchParams(query);
    params.delete('overview');params.delete('cursor');
    if(viewport.current)params.set('viewport',viewport.current);
    setLoading(true);setError('');
    try{
      await loadCapacityMapWindow({
        signal:controller.signal,
        requestPage:async(cursor:string|null,signal:AbortSignal)=>{
          const pageParams=new URLSearchParams(params);
          if(cursor)pageParams.set('cursor',cursor);
          const response=await fetch(`${apiPath}?${pageParams.toString()}`,{signal,cache:'no-store'});
          if(!response.ok)throw new Error('Capacity could not be loaded.');
          return response.json();
        },
        onPage:(incoming:FeedResult['items'])=>{
          if(version!==generation.current)return;
          setItems((current:FeedResult['items'])=>preserveSelectedMapTruck(current,incoming,selectedRef.current));
        }
      });
    }catch(problem){
      if(version===generation.current&&!controller.signal.aborted)setError(problem instanceof Error?problem.message:'Capacity could not be loaded.');
    }finally{
      if(version===generation.current)setLoading(false);
    }
  },[apiPath,query]);
  function explore(bounds:number[]){
    const key=bounds.map(value=>value.toFixed(4)).join(',');
    if(key===viewport.current)return;
    viewport.current=key;
    void loadWindow();
  }

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
      setLocationFeedback('Location updated');
    },event=>setLocationState(event.code===event.PERMISSION_DENIED?'denied':event.code===event.TIMEOUT?'timeout':'unavailable'),{
      enableHighAccuracy:true,
      timeout:20000,
      maximumAge:0
    });
  }

  React.useEffect(()=>{
    if(initialLocationRequest.current)return;
    initialLocationRequest.current=true;
    if(!query.truckCityPlaceRef&&!query.truckCity)useMyLocation();
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
      setSearchSuggestionsOpen(true);
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

  const selected=items.find((item:any)=>item.id===selectedId)||null;
  const locationActionLabel=locationState==='locating'
    ?'Finding your location…'
    :locationState==='ready'
      ?'Refresh my location'
      :['denied','timeout','unavailable','outside','error'].includes(locationState)
        ?'Retry location permission'
        :'Use my location';
  const activeFilterCount=[query.status,query.geometry,query.vehicleCategory,query.loadType,query.stopOption,query.freshness,
    query.originPlaceRef||query.origin,query.destinationPlaceRef||query.destination,query.currentAreaPlaceRef||query.currentArea,
    query.truckCityPlaceRef||query.truckCity||(query.nearLat&&query.nearLng)].filter(Boolean).length;
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
  const overlayKind=error?'error':loading?'loading':!items.length?'empty':'';

  const feedback=overlayKind?<div className={`public-feed-overlay ${overlayKind}`} role={overlayKind==='loading'?undefined:overlayKind==='error'?'alert':'status'} aria-live={overlayKind==='loading'?undefined:overlayKind==='error'?'assertive':'polite'} data-testid="capacity-feed-state">{overlayKind==='error'?<>{error}{initial.filterError?<button type="button" onClick={()=>setFilterOpen(true)}><SlidersHorizontal aria-hidden="true"/><Text message="Review filters"/></button>:<button type="button" onClick={()=>void loadWindow()}><RefreshCw aria-hidden="true"/><Text message="Try again"/></button>}</>:overlayKind==='loading'?<LoadingIndicator label="Loading trucks in this map area…"/>:overlayKind==='empty'?<Text message="No truck signals match these filters. Adjust your search or check again later."/>:locationNotice}</div>:null;

  const searchControls=<div className="capacity-search-controls">
    <div className="capacity-search-combobox" onBlur={event=>{
      if(!event.currentTarget.contains(event.relatedTarget as Node))setSearchSuggestionsOpen(false);
    }}>
      <div className="capacity-map-search">
        <label className="sr-only" htmlFor="capacity-market-search"><Text message="Search published truck capacity"/></label>
        <Search aria-hidden="true"/>
        <Localized as="input" copy={["placeholder"]} id="capacity-market-search" type="search" role="combobox" name="q" value={searchTerm} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>setSearchTerm(event.target.value)} onFocus={()=>{if(searchTerm.trim().length>=2)setSearchSuggestionsOpen(true);}} onKeyDown={(event:React.KeyboardEvent<HTMLInputElement>)=>{if(event.key==='Escape')setSearchSuggestionsOpen(false);}} autoComplete="off" aria-autocomplete="list" aria-controls="capacity-search-suggestions" aria-expanded={searchSuggestionsOpen} placeholder="Search trucks, routes, or transporters"/>
        {hasSearch?<Localized as="link" copy={["aria-label"]} href={clearSearchHref} className="capacity-search-clear" aria-label="Clear truck search" onClick={()=>{setSearchTerm('');setSearchSuggestionsOpen(false);}}><X aria-hidden="true"/></Localized>:null}
        <Localized as="button" copy={["aria-label"]} type="submit" aria-label="Search published truck capacity"><Search aria-hidden="true"/></Localized>
      </div>
      {searchSuggestionsOpen?<Localized as="div" copy={["aria-label"]} id="capacity-search-suggestions" className="capacity-search-suggestions" role="listbox" aria-label="Search suggestions">{searchSuggestionsLoading?<LoadingIndicator className="capacity-suggestion-loading" label="Finding trucks…"/>:searchSuggestions.length?searchSuggestions.map((suggestion:SearchSuggestion)=><Link key={suggestion.key} href={suggestion.href} role="option" onClick={()=>setSearchSuggestionsOpen(false)}><span className={`capacity-suggestion-icon ${suggestion.kind.toLowerCase()}`}>{suggestion.kind==='PROVIDER'?<Building2 aria-hidden="true"/>:<Truck aria-hidden="true"/>}</span><span><small>{suggestion.kind==='PROVIDER'?<Text message="Transporter"/>:<Text message="Truck"/>}</small><strong>{suggestion.title}</strong><em>{suggestion.detail}</em></span></Link>):<span className="capacity-suggestion-state"><Text message="No current trucks match that search."/></span>}</Localized>:null}
    </div>
  </div>;

  return <div className="market-workbench market-map-view capacity-drawer-workbench">
    <form action={searchPath} className="capacity-discovery-form" onSubmit={closeFilters}>
    {query.provider&&searchTerm===(query.q||'')?<input type="hidden" name="provider" value={query.provider}/>:null}
    <dialog ref={filterDialog} className="capacity-filter-dialog" aria-labelledby="capacity-filter-title" onClose={()=>setFilterOpen(false)}>
      <div className="capacity-filter-dialog-head"><div><small><Text message="Find the right truck"/></small><h2 id="capacity-filter-title"><Text message="More filters"/></h2></div><Localized as="button" copy={["aria-label"]} type="button" onClick={closeFilters} aria-label="Close filters"><X aria-hidden="true"/></Localized></div>
      <div className="capacity-detail-fields">

        <fieldset><legend><Route aria-hidden="true"/><Text message="Route matching"/></legend>
          <div className="capacity-geography-filter route">
            <label htmlFor="capacity-origin-radius"><span><Text message="Origin range"/></span><select id="capacity-origin-radius" name="originRadiusKm" defaultValue={query.originRadiusKm||'50'}>{routeTolerances.map(value=><option value={value} key={value}><Text message="Within {distance} km" values={{distance:value}}/></option>)}</select></label>
            <label htmlFor="capacity-destination-radius"><span><Text message="Destination range"/></span><select id="capacity-destination-radius" name="destinationRadiusKm" defaultValue={query.destinationRadiusKm||'50'}>{routeTolerances.map(value=><option value={value} key={value}><Text message="Within {distance} km" values={{distance:value}}/></option>)}</select></label>
            <label htmlFor="capacity-route-direction"><span><Text message="Direction"/></span><select id="capacity-route-direction" name="directionMode" defaultValue={query.directionMode||'DIRECT'}><option value="DIRECT"><Text message="Origin to destination"/></option><option value="EITHER"><Text message="Either direction"/></option></select></label>
          </div>
        </fieldset>
        <fieldset>
          <legend><PackageCheck aria-hidden="true"/><Text message="Capacity"/></legend>
          <Localized as="div" copy={["aria-label"]} className="capacity-filter-choice-group capacity-geometry-choices" role="radiogroup" aria-label="Capacity signal">
            <Choice name="geometry" value="" checked={geometryFilter===''} onChange={()=>setGeometryFilter('')}><span className="capacity-choice-symbol any"><Map aria-hidden="true"/></span><span><strong><Text message="Any signal"/></strong><small><Text message="Area or route"/></small></span></Choice>
            <Choice name="geometry" value="RADIUS" checked={geometryFilter==='RADIUS'} onChange={()=>setGeometryFilter('RADIUS')} disabled={statusFilter==='PARTIAL'}><span className="capacity-choice-symbol area"><MapPinned aria-hidden="true"/></span><span><strong><Text message="Service area"/></strong><small><Text message="Empty trucks only"/></small></span></Choice>
            <Choice name="geometry" value="ROUTE" checked={geometryFilter==='ROUTE'} onChange={()=>setGeometryFilter('ROUTE')}><span className="capacity-choice-symbol route"><Route aria-hidden="true"/></span><span><strong><Text message="Capacity route"/></strong><small><Text message="Empty or Partial"/></small></span></Choice>
          </Localized>
          {geometryFilter==='RADIUS'?<div className="capacity-geography-filter"><div className="form-group"><label htmlFor="capacity-area-center"><MapPinned aria-hidden="true"/><Text message="Service area place"/></label><EthiopiaPlaceInput id="capacity-area-center" name="currentArea" placeRefName="currentAreaPlaceRef" defaultPlaceRef={query.currentAreaPlaceRef||''} defaultValue={query.currentArea||''} placeholder="City, town, or area"/></div><label htmlFor="capacity-area-radius"><span><Text message="Area range"/></span><select id="capacity-area-radius" name="currentAreaRadiusKm" defaultValue={query.currentAreaRadiusKm||'50'}>{[10,25,50,100,200,300].map(value=><option value={value} key={value}><Text message="Within {distance} km" values={{distance:value}}/></option>)}</select></label></div>:null}
        </fieldset>

        <fieldset>
          <legend><Truck aria-hidden="true"/><Text message="Truck"/></legend>
          <label htmlFor="capacity-load-filter"><span><Boxes aria-hidden="true"/><Text message="Load type"/></span><select id="capacity-load-filter" name="loadType" defaultValue={query.loadType}><option value=""><Text message="Any load type"/></option><option value="FTL"><Text message="Full truckload"/></option><option value="PTL"><Text message="Partial truckload"/></option></select></label>
          <label htmlFor="capacity-stop-filter"><span><MapPinned aria-hidden="true"/><Text message="Stops"/></span><select id="capacity-stop-filter" name="stopOption" defaultValue={query.stopOption}><option value=""><Text message="Any stop pattern"/></option><option value="MULTI_PICK"><Text message="Multiple pickups"/></option><option value="MULTI_DROP"><Text message="Multiple drop-offs"/></option></select></label>
          <label htmlFor="capacity-freshness-filter"><span><Clock3 aria-hidden="true"/><Text message="Updated"/></span><select id="capacity-freshness-filter" name="freshness" defaultValue={query.freshness}><option value=""><Text message="Any published capacity"/></option><option value="FRESH"><Text message="Within 12 hours"/></option><option value="UPDATE_NEEDED"><Text message="More than 12 hours ago"/></option></select></label>
        </fieldset>


        <div className="capacity-filter-actions"><Link href={searchPath} onClick={()=>{closeFilters();clearUnappliedFilters();}}><Text message="Clear"/></Link><button className="button" type="submit"><SlidersHorizontal aria-hidden="true"/><Text message="Show matching trucks"/></button></div>
      </div>
    </dialog>

    <Localized as="aside" copy={["aria-label"]} ref={drawer} id="capacity-filter-drawer" className={`market-command-column capacity-filter-drawer${drawerOpen?' is-open':''}`} aria-label="Capacity filters" aria-hidden={!drawerOpen} inert={!drawerOpen} tabIndex={-1} onKeyDown={(event:React.KeyboardEvent<HTMLAnchorElement>)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!filterOpen){event.preventDefault();closeDrawer();}}}>
      <header className="capacity-drawer-heading" onPointerDown={startSwipe} onPointerUp={event=>finishSwipe(event,true)} onPointerCancel={()=>{swipeStart.current=null;}}>
        <div><small><Text message="Find a truck"/></small><h2><Text message="Filters"/></h2></div><Localized as="button" copy={["aria-label"]} type="button" aria-label="Close filter drawer" onClick={closeDrawer}><PanelLeftClose aria-hidden="true"/></Localized>
      </header>
      <div className="capacity-drawer-scroll">
        {searchControls}
        <div className="capacity-primary-selects">
          <div className="form-group"><label htmlFor="capacity-main-status"><Text message="Availability"/></label><select id="capacity-main-status" name="status" value={statusFilter} onChange={event=>chooseStatus(event.target.value)}><option value=""><Text message="Empty or Partial"/></option><option value="EMPTY"><Text message="Empty"/></option><option value="PARTIAL"><Text message="Partial"/></option></select></div>
          <div className="form-group"><label htmlFor="capacity-main-truck"><Text message="Truck configuration"/></label><select id="capacity-main-truck" name="vehicleCategory" value={vehicleFilter} onChange={event=>setVehicleFilter(event.target.value)}><option value=""><Text message="Any configuration"/></option>{VEHICLE_CONFIGURATIONS.map(configuration=><option key={configuration.name} value={configuration.name}>{configuration.name}</option>)}</select></div>
        </div>
        <fieldset className="capacity-truck-location-filter">
          <legend><MapPinned aria-hidden="true"/><Text message="Truck location"/></legend>
          <p><Text message="Near the truck’s reported location, allowing for its location accuracy."/></p>
          <div className="capacity-geography-filter">
            <div className="form-group"><label htmlFor="capacity-truck-city"><Text message="In or near a city"/></label><EthiopiaPlaceInput id="capacity-truck-city" name="truckCity" placeRefName="truckCityPlaceRef" defaultPlaceRef={query.truckCityPlaceRef||''} defaultValue={query.truckCity||''} onChange={event=>{setTruckCityName(event.target.value);setNearFilterEnabled(false);}} placeholder="Choose a city or town"/></div>
            <div className="form-group"><label htmlFor="capacity-truck-location-radius"><Text message="Distance from city"/></label><select id="capacity-truck-location-radius" name="truckLocationRadiusKm" disabled={!truckCityName.trim()&&!query.truckCityPlaceRef} defaultValue={query.truckLocationRadiusKm||'50'}>{[5,10,25,50,100,200,300].map(value=><option value={value} key={value}><Text message="Within {distance} km" values={{distance:value}}/></option>)}</select></div>
          </div>
          <label className="checkbox-label" htmlFor="capacity-near-enabled"><input id="capacity-near-enabled" type="checkbox" checked={nearFilterEnabled} disabled={!near||Boolean(truckCityName.trim())} onChange={event=>setNearFilterEnabled(event.target.checked)}/><span><Text message="Show trucks near my area"/></span></label>
          {nearFilterEnabled&&near?<><input type="hidden" name="nearLat" value={near.lat}/><input type="hidden" name="nearLng" value={near.lng}/><label htmlFor="capacity-near-radius"><span><Text message="Distance"/></span><select id="capacity-near-radius" name="nearRadiusKm" defaultValue={query.nearRadiusKm||'20'}>{[5,10,20,50,100].map(value=><option value={value} key={value}><Text message="Within {distance} km" values={{distance:value}}/></option>)}</select></label></>:null}
          <p>{truckCityName.trim()?<Text message="Clear the city to use your area instead."/>:near?<Text message="Your precise location stays on this device."/>:<Text message="You can choose a city without sharing your location."/>}</p>
        </fieldset>

<fieldset className="capacity-route-filter"><legend><Route aria-hidden="true"/><Text message="Shipment route"/></legend><div className="capacity-main-route">            <div className="form-group"><label htmlFor="capacity-route-origin"><MapPinned aria-hidden="true"/><Text message="Origin "/><small><Text message="(optional)"/></small></label><EthiopiaPlaceInput id="capacity-route-origin" name="origin" placeRefName="originPlaceRef" defaultPlaceRef={query.originPlaceRef||''} defaultValue={query.origin||''} placeholder="City or town"/></div>
            <div className="form-group"><label htmlFor="capacity-route-destination"><MapPinned aria-hidden="true"/><Text message="Destination "/><small><Text message="(optional)"/></small></label><EthiopiaPlaceInput id="capacity-route-destination" name="destination" placeRefName="destinationPlaceRef" defaultPlaceRef={query.destinationPlaceRef||''} defaultValue={query.destination||''} placeholder="City or town"/></div>
</div></fieldset>
        <Localized as="section" copy={["aria-label"]} className="public-capacity-toolbar" aria-label="Capacity map location controls"><button type="button" className="button location-action" onClick={useMyLocation} disabled={locationState==='locating'}><LocateFixed aria-hidden="true"/>{locationActionLabel}</button><span className="public-location-note"><Text message="Your precise location remains on this device."/></span></Localized>
        {locationNotice?<small className={`capacity-location-status ${locationState==='ready'?'ready':'attention'}`} role="status" data-testid="visitor-location-state">{locationNotice}</small>:null}
      </div>
      <footer className="capacity-drawer-actions"><button type="button" className="capacity-filter-trigger" onClick={()=>setFilterOpen(true)}><SlidersHorizontal aria-hidden="true"/><Text message="More filters"/>{activeFilterCount?<span>{activeFilterCount}</span>:null}</button><button type="submit" className="button"><Search aria-hidden="true"/><Text message="Show matching trucks"/></button><Link href={searchPath} onClick={clearUnappliedFilters}><Text message="Clear all"/></Link></footer>
    </Localized>
    </form>
    <div className="capacity-drawer-handle" hidden={drawerOpen}>
      <button ref={drawerTrigger} onPointerDown={event=>{swipeStart.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={event=>finishSwipe(event,false)} onPointerCancel={()=>{swipeStart.current=null;}} type="button" disabled={!controlsReady} aria-expanded={drawerOpen} aria-controls="capacity-filter-drawer" onClick={openDrawer}><PanelLeftOpen aria-hidden="true"/><Text message="Filters"/>{activeFilterCount?<span>{activeFilterCount}</span>:null}</button>
    </div>
      <section id="capacity-map-view" className={`public-map-shell${selected?' has-selected-truck':''}`}>
        <div className="public-map-canvas"><PublicCapacityMap items={items} viewer={viewer} selectedId={selectedId} keepItemsInView={Boolean(query.provider)} onSelect={(id:string|null)=>{setSelectedId(id);if(id&&window.matchMedia('(max-width:760px)').matches)setDrawerOpen(false);}} onExplore={explore}/>{selected?<aside className="map-capacity-sheet" aria-label={`${selected.provider_name} truck summary`}><Localized as="button" copy={["aria-label"]} type="button" className="map-focus-exit" onClick={()=>setSelectedId(null)} aria-label="Close truck summary"><X aria-hidden="true"/></Localized><div className="map-truck-identity"><span className={`status ${selected.status==='PARTIAL'?'yellow':'green'}`}>{selected.status==='PARTIAL'?<Text message="Partial"/>:<Text message="Empty"/>}</span><strong>{selected.vehicle_make} {selected.vehicle_model}</strong><small>{selected.provider_name}</small></div><div className={`map-signal-age ${selected.capacity_confirmation_needed?'confirm':''}`}><CalendarClock aria-hidden="true"/><span><strong>{selected.capacity_updated_label||'Capacity update unavailable'}</strong>{selected.current_signal_geometry_visible!==false?<small>{selected.location_updated_label||'Location update unavailable'}</small>:null}{selected.capacity_confirmation_needed?<small><Text message="Confirm availability directly."/></small>:null}</span></div>{selected.current_signal_geometry_visible===false?<p className="map-private-signal-note"><MapPinned aria-hidden="true"/><span><strong><Text message="Regular service—not current location"/></strong><Text message="Call for current details or ask the Driver to share private capacity with your email."/></span></p>:null}<div className="public-truck-driver"><UserRound aria-hidden="true"/><span><strong>{selected.assigned_driver_first_name||'Driver not named'}</strong><small>{selected.driver_kind_label}{selected.assigned_driver_phone?` · ${selected.assigned_driver_phone}`:<Text message=" · Phone not published"/>}</small></span></div><div className="map-truck-documents"><TruckDocumentSummary label={selected.provider_organization_id?"Company documents":"Owner documents"} badges={selected.owner_verification_badges}/><TruckDocumentSummary label="Driver documents" badges={selected.driver_verification_badges}/><TruckDocumentSummary label="Truck documents" badges={selected.truck_verification_badges}/></div><div className="public-card-actions"><Link className="button" href={`/@${selected.provider_handle}`}><Building2 aria-hidden="true"/><Text message="Profile"/></Link>{selected.assigned_driver_phone?<a className="button secondary" href={`tel:${selected.assigned_driver_phone}`}><Phone aria-hidden="true"/><Text message="Call driver"/></a>:selected.contact_phone?<a className="button secondary" href={`tel:${selected.contact_phone}`}><Phone aria-hidden="true"/><Text message="Call"/></a>:null}</div>{feedback}</aside>:null}</div>
        {!selected?feedback:null}
      </section>
    </div>;
}
