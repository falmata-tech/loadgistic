"use client";


import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import Form from 'next/form';
import {
  PanelLeftClose,
  Clock3,
  LocateFixed,
  MapPinned,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react';
import React from 'react';
import {useBlockedProviders} from './content-safety';
import {loadCapacityMapWindow,reconcileCapacityMapWindow} from '@/lib/capacity-map-loading.js';
import {BUSINESS_SEARCH_PRIVACY_KM,obscureCoordinate,isValidCoordinate} from '@/lib/location-privacy.js';
import {CapacityConfigurationPicker} from './capacity-configuration-picker';
import {CapacityMultiOptions} from './capacity-multi-options';
import { EthiopiaPlaceInput } from './ethiopia-place-input';
import { PublicCapacityMap } from './public-capacity-map';
import { MapTruckDetails } from './map-truck-details';
import {LoadingIndicator} from './loading-state';
import {CapacitySearchResults,CapacityDocumentFilters} from './capacity-search-results';
import {TRANSPORTER_SEARCH_DELAY_MS,transporterSearchQuery} from '@/lib/transporter-search.js';
import searchStyles from './transporter-search.module.css';

type FeedResult={items:any[];nextCursor:string|null;hasMore:boolean;pageSize:number;filterError?:string|null};
type Point={lat:number;lng:number};
type VisitorLocationState='idle'|'locating'|'ready'|'denied'|'timeout'|'unavailable'|'unsupported'|'insecure'|'outside'|'error';

const routeTolerances=[10,25,50,100,200];

type FeedProps={initial:FeedResult;query:Record<string,string>;searchPath?:string;apiPath?:string;searchApiPath?:string};
type ProfileSearchControls={
  searchTerm:string;submittedSearch:string|null;drawerOpen:boolean;setDrawerOpen:React.Dispatch<React.SetStateAction<boolean>>;
  inputRef:React.RefObject<HTMLInputElement|null>;change:(value:string)=>void;clear:()=>void;submit:()=>void;pause:()=>void;
  compositionStart:()=>void;compositionEnd:(value:string)=>void;preventComposedEnter:(event:React.KeyboardEvent<HTMLInputElement>)=>void;
};

export function PublicCapacityFeed(props:FeedProps){
  const [resetVersion,setResetVersion]=React.useState(0);
  const [drawerOpen,setDrawerOpen]=React.useState(false);
  const [searchTerm,setSearchTerm]=React.useState(props.query.q||'');
  const [submittedSearch,setSubmittedSearch]=React.useState(null as string|null);
  const [searchVersion,setSearchVersion]=React.useState(0);
  const [composing,setComposing]=React.useState(false);
  const composition=React.useRef(false),searchInput=React.useRef(null as HTMLInputElement|null),searchTimer=React.useRef(null as ReturnType<typeof setTimeout>|null);
  function cancelSearchDelay(){if(searchTimer.current!==null){clearTimeout(searchTimer.current);searchTimer.current=null;}}
  function changeSearch(value:string){cancelSearchDelay();setSearchTerm(value);setSubmittedSearch(null);setSearchVersion((current:number)=>current+1);}
  function clearSearch(){changeSearch('');searchInput.current?.focus();}
  function pauseSearch(){cancelSearchDelay();setSubmittedSearch(null);setSearchVersion((current:number)=>current+1);setDrawerOpen(false);}
  function submitSearch(){if(composition.current)return;cancelSearchDelay();setSubmittedSearch(transporterSearchQuery(searchTerm));setSearchVersion((current:number)=>current+1);}
  React.useEffect(()=>{
    cancelSearchDelay();const value=transporterSearchQuery(searchTerm);
    if(drawerOpen&&!composing&&value&&value!==submittedSearch)searchTimer.current=setTimeout(()=>{searchTimer.current=null;setSubmittedSearch(value);},TRANSPORTER_SEARCH_DELAY_MS);
    return cancelSearchDelay;
  },[searchTerm,drawerOpen,composing,submittedSearch]);
  const search:ProfileSearchControls={searchTerm,submittedSearch,drawerOpen,setDrawerOpen,inputRef:searchInput,change:changeSearch,clear:clearSearch,submit:submitSearch,pause:pauseSearch,
    compositionStart:()=>{composition.current=true;setComposing(true);cancelSearchDelay();setSubmittedSearch(null);},
    compositionEnd:value=>{composition.current=false;setComposing(false);changeSearch(value);},
    preventComposedEnter:event=>{if(event.key==='Enter'&&(composition.current||event.nativeEvent.isComposing))event.preventDefault();}};
  // Truck filters still reset map state and drafts. Profile search stays above
  // that boundary, with its request authority and exclusions owned separately.
  const queryKey=JSON.stringify(Object.entries(props.query).sort(([a],[b])=>a.localeCompare(b)));
  return <CapacitySearchResults active={drawerOpen&&submittedSearch!==null} requestVersion={searchVersion} query={{q:submittedSearch||''}} mapQuery={props.query} view={props.apiPath==='/api/shared-capacity'?'private':props.apiPath==='/api/admin/capacity-network'?'loadgistic':'open'} searchPath={props.searchPath||'/'} apiPath={props.searchApiPath} onProfileSelect={pauseSearch} render={profileResults=><CapacityFeedState key={`${queryKey}:${resetVersion}`} {...props} search={search} profileResults={profileResults} onReset={()=>setResetVersion((value:number)=>value+1)}/>}/>;
}

function CapacityFeedState({initial,query,searchPath='/',apiPath='/api/public/capacity',onReset,search,profileResults}:FeedProps&{onReset:()=>void;search:ProfileSearchControls;profileResults:React.ReactNode}){
  const {searchTerm,submittedSearch,drawerOpen,setDrawerOpen}=search;
  // A link to the current unfiltered URL does not navigate. Reset local drafts
  // and the map explicitly in that case; other clears use the new query key.
  function clearUnappliedFilters(){if(!Object.values(query).some(Boolean))onReset();}
  const {blocked}=useBlockedProviders(),blockKey=JSON.stringify(blocked);
  const [allItems,setItems]=React.useState(initial.items);
  const items=React.useMemo(()=>allItems.filter((item:any)=>!blocked.includes(item.provider_handle)),[allItems,blockKey]);
  const [loading,setLoading]=React.useState(false);
  const [error,setError]=React.useState(initial.filterError||'');
  const [selectedId,setSelectedId]:[string|null,(value:string|null)=>void]=React.useState(initial.items.some((item:any)=>item.id===query.truck)?query.truck:null);
  const [viewer,setViewer]:[Point|null,(value:Point|null)=>void]=React.useState(null);
  const parsedNearLat=Number(query.nearLat);
  const parsedNearLng=Number(query.nearLng);
  const initialNear=query.nearLat!==''&&query.nearLng!==''&&query.nearLat!==undefined&&query.nearLng!==undefined&&Number.isFinite(parsedNearLat)&&parsedNearLat>=-90&&parsedNearLat<=90&&Number.isFinite(parsedNearLng)&&parsedNearLng>=-180&&parsedNearLng<=180
    ?{lat:parsedNearLat,lng:parsedNearLng,radius:Number(query.nearRadiusKm)||20}
    :null;
  const [near,setNear]:[{lat:number;lng:number;radius:number}|null,(value:{lat:number;lng:number;radius:number}|null)=>void]=React.useState(initialNear);
  const [nearFilterEnabled,setNearFilterEnabled]=React.useState(Boolean(initialNear)&&!query.truckCityPlaceRef&&!query.truckCity);
  const [truckCityName,setTruckCityName]=React.useState(query.truckCity||'');
  const [locationState,setLocationState]:[VisitorLocationState,(value:VisitorLocationState)=>void]=React.useState('idle');
  const [locationFeedback,setLocationFeedback]=React.useState('');
  const [filterOpen,setFilterOpen]=React.useState(false);
  const [controlsReady,setControlsReady]=React.useState(false);
  const drawerTrigger=React.useRef(null as HTMLButtonElement|null);
  const drawer=React.useRef(null as HTMLElement|null);
  const resultsScroll=React.useRef(null as HTMLDivElement|null);
  const savedResultsScroll=React.useRef(0);
  function selectTruck(id:string|null){
    if(id){if(!selectedId)savedResultsScroll.current=resultsScroll.current?.scrollTop||0;search.pause();setSelectedId(id);}
    else closeTruck();
  }
  function closeTruck(){
    setSelectedId(null);setDrawerOpen(true);
    requestAnimationFrame(()=>{if(resultsScroll.current)resultsScroll.current.scrollTop=savedResultsScroll.current;drawer.current?.focus();});
  }
  const swipeStart=React.useRef(null as {x:number;y:number}|null);
  React.useEffect(()=>{setControlsReady(true);},[]);
  function closeDrawer(){search.pause();requestAnimationFrame(()=>drawerTrigger.current?.focus());}
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
  const [vehicleFilter,setVehicleFilter]=React.useState(query.vehicleCategory||'');
  const [locationSourceFilter,setLocationSourceFilter]=React.useState(query.locationSource||'');
  const [stopFilter,setStopFilter]=React.useState(query.stopOption||'');
  const [freshnessFilter,setFreshnessFilter]=React.useState(query.freshness||'');
  const filterDialog=React.useRef(null as HTMLDialogElement|null);
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
    params.delete('q');
    if(blocked.length)params.set('blocked',blockKey);
    params.delete('overview');params.delete('cursor');
    if(viewport.current&&!query.provider&&!query.truck)params.set('viewport',viewport.current);
    setLoading(true);setError('');
    try{
      await loadCapacityMapWindow({
        signal:controller.signal,
        requestPage:async(cursor:string|null,signal:AbortSignal)=>{
          const pageParams=new URLSearchParams(params);
          if(cursor)pageParams.set('cursor',cursor);
          const response=await fetch(`${apiPath}?${pageParams.toString()}`,{signal,cache:'no-store'});
          if(!response.ok){
            if(apiPath.startsWith('/api/business-workspaces/')&&[401,403].includes(response.status)&&version===generation.current){setItems([]);setSelectedId(null);}
            throw new Error('Capacity could not be loaded.');
          }
          return response.json();
        },
        onPage:(incoming:FeedResult['items'],state:{complete:boolean})=>{
          if(version!==generation.current)return;
          setItems((current:FeedResult['items'])=>reconcileCapacityMapWindow(current,incoming,selectedRef.current,state.complete));
        }
      });
    }catch(problem){
      if(version===generation.current&&!controller.signal.aborted)setError(problem instanceof Error?problem.message:'Capacity could not be loaded.');
    }finally{
      if(version===generation.current)setLoading(false);
    }
  },[apiPath,query,blockKey]);
  function explore(bounds:number[]){
    const key=bounds.map(value=>value.toFixed(4)).join(',');
    if(key===viewport.current||viewport.current&&Boolean(query.provider||query.truck))return;
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
      if(!isValidCoordinate(exact.lat,exact.lng)){
        setLocationState('unavailable');
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
    const dialog=filterDialog.current;
    if(!dialog)return;
    if(filterOpen&&!dialog.open)dialog.showModal();
    if(!filterOpen&&dialog.open)dialog.close();
  },[filterOpen]);

  function closeFilters(){
    if(filterDialog.current?.open)filterDialog.current.close();
    setFilterOpen(false);
  }

  const selected=items.find((item:any)=>item.id===selectedId)||null;
  const locationActionLabel=locationState==='locating'
    ?'Finding your location…'
    :locationState==='ready'
      ?'Refresh my location'
      :['denied','timeout','unavailable','outside','error'].includes(locationState)
        ?'Retry location permission'
        :'Use my location';
  const activeFilterCount=[query.ownerDocs,query.driverDocs,query.truckDocs,query.status,query.vehicleCategory,query.locationSource,query.stopOption,query.freshness,
    query.originPlaceRef||query.origin,query.destinationPlaceRef||query.destination,
    query.truckCityPlaceRef||query.truckCity||(query.nearLat&&query.nearLng)].filter(Boolean).length;
  const clearSearchParams=new URLSearchParams(query);
  ['q','provider','truck','cursor'].forEach(key=>clearSearchParams.delete(key));
  const clearSearchHref=`${searchPath}${clearSearchParams.size?`?${clearSearchParams.toString()}`:''}`;
  const hasSearch=Boolean(searchTerm||submittedSearch!==null);
  const locationNotice=locationFeedback||({
    denied:'Location permission is blocked. Enable location for this site in browser settings, then retry.',
    timeout:'The location request timed out. Move somewhere with a clearer signal and retry.',
    unavailable:'The device could not provide a location. Check the device location service and retry.',
    unsupported:'Location is not supported by this browser. You can continue browsing all vehicles.',
    insecure:'Location is available only through a secure connection.',
    error:'Location could not be updated. Try again or continue browsing.'
  } as Partial<Record<VisitorLocationState,string>>)[locationState]||'';
  const overlayKind=error?'error':loading?'loading':!items.length?'empty':'';

  const feedback=overlayKind?<div className={`public-feed-overlay ${overlayKind}`} role={overlayKind==='loading'?undefined:overlayKind==='error'?'alert':'status'} aria-live={overlayKind==='loading'?undefined:overlayKind==='error'?'assertive':'polite'} data-testid="capacity-feed-state">{overlayKind==='error'?<>{error}{initial.filterError?<button type="button" onClick={()=>setFilterOpen(true)}><SlidersHorizontal aria-hidden="true"/><Text message="Review filters"/></button>:<button type="button" onClick={()=>void loadWindow()}><RefreshCw aria-hidden="true"/><Text message="Try again"/></button>}</>:overlayKind==='loading'?<LoadingIndicator label="Loading vehicles in this map area…"/>:overlayKind==='empty'?<Text message="No vehicle signals match these filters. Adjust the filters or check again later."/>:locationNotice}</div>:null;

  const searchControls=<form className="capacity-people-search-form" onSubmit={event=>{event.preventDefault();search.submit();}}><div className={searchStyles.field}>
    <label className="sr-only" htmlFor="capacity-market-search"><Text message="Search transporters"/></label><Search aria-hidden="true"/>
    <Localized as="input" copy={["placeholder"]} ref={search.inputRef} id="capacity-market-search" type="search" name="q" maxLength={120} value={searchTerm} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>search.change(event.target.value)} onCompositionStart={search.compositionStart} onCompositionEnd={(event:React.CompositionEvent<HTMLInputElement>)=>search.compositionEnd(event.currentTarget.value)} onKeyDown={search.preventComposedEnter} placeholder="Account name, manager or @handle"/>
    <Localized as="button" copy={["aria-label"]} type="button" className={searchStyles.clear} aria-label="Clear search" disabled={!hasSearch} onClick={search.clear}><X aria-hidden="true"/></Localized>
    <Localized as="button" copy={["aria-label"]} type="submit" className={searchStyles.submit} aria-label="Search"><Search aria-hidden="true"/></Localized>
  </div></form>;

  return <div className="market-workbench market-map-view capacity-drawer-workbench">
    <Form action={searchPath} prefetch={false} scroll={false} className="capacity-discovery-form" onSubmit={closeFilters}>
    {query.provider?<input type="hidden" name="provider" value={query.provider}/>:null}
    {query.truck?<input type="hidden" name="truck" value={query.truck}/>:null}
    {query.q?<input type="hidden" name="q" value={query.q}/>:null}
    <dialog ref={filterDialog} className="capacity-filter-dialog" aria-labelledby="capacity-filter-title" onClose={()=>setFilterOpen(false)}>
      <div className="capacity-filter-dialog-head"><div><h2 id="capacity-filter-title"><Text message="Vehicle filters"/></h2></div><Localized as="button" copy={["aria-label"]} type="button" onClick={closeFilters} aria-label="Close filters"><X aria-hidden="true"/></Localized></div>
      <div className="capacity-detail-fields">
        {query.provider||query.truck?<p className="capacity-identity-filter"><Text message="Showing selected profile vehicles"/> <Link href={clearSearchHref}><Text message="Show all transporters"/></Link></p>:null}
        <div className="capacity-primary-selects">
          <CapacityMultiOptions name="status" label="Vehicle's current load" anyLabel="Any available vehicle" options={[["EMPTY","Empty vehicle"],["PARTIAL","Partly loaded"]]} value={statusFilter} onChange={setStatusFilter}/>
          <CapacityConfigurationPicker multiple value={vehicleFilter} onChange={setVehicleFilter}/>
        </div>
        <p className="meta"><Text message="Select one or more options."/></p>
        <fieldset className="capacity-truck-location-filter">
          <legend><MapPinned aria-hidden="true"/><Text message="Vehicle location"/></legend>
          <p><Text message="Near the vehicle’s reported location, allowing for its location accuracy."/></p>
          <CapacityMultiOptions name="locationSource" label="Location source" anyLabel="Any location source" options={[["GPS","GPS device"],["MOBILE","Driver’s phone"],["MANUAL","Manually entered"]]} value={locationSourceFilter} onChange={setLocationSourceFilter}/>
          <div className="capacity-geography-filter">
            <div className="form-group"><label htmlFor="capacity-truck-city"><Text message="In or near a city"/></label><EthiopiaPlaceInput id="capacity-truck-city" name="truckCity" placeRefName="truckCityPlaceRef" defaultPlaceRef={query.truckCityPlaceRef||''} defaultValue={query.truckCity||''} onChange={event=>{setTruckCityName(event.target.value);setNearFilterEnabled(false);}} placeholder="Choose a city or town"/></div>
            <div className="form-group"><label htmlFor="capacity-truck-location-radius"><Text message="Distance from city"/></label><select id="capacity-truck-location-radius" name="truckLocationRadiusKm" disabled={!truckCityName.trim()&&!query.truckCityPlaceRef} defaultValue={query.truckLocationRadiusKm||'50'}>{[5,10,25,50,100,200,300].map(value=><option value={value} key={value}><Text message="Within {distance} km" values={{distance:value}}/></option>)}</select></div>
          </div>
          <label className="checkbox-label" htmlFor="capacity-near-enabled"><input id="capacity-near-enabled" type="checkbox" checked={nearFilterEnabled} disabled={!near||Boolean(truckCityName.trim())} onChange={event=>setNearFilterEnabled(event.target.checked)}/><span><Text message="Show vehicles near my area"/></span></label>
          {nearFilterEnabled&&near?<><input type="hidden" name="nearLat" value={near.lat}/><input type="hidden" name="nearLng" value={near.lng}/><label htmlFor="capacity-near-radius"><span><Text message="Distance"/></span><select id="capacity-near-radius" name="nearRadiusKm" defaultValue={query.nearRadiusKm||'20'}>{[5,10,20,50,100].map(value=><option value={value} key={value}><Text message="Within {distance} km" values={{distance:value}}/></option>)}</select></label></>:null}
          <p>{truckCityName.trim()?<Text message="Clear the city to use your area instead."/>:near?<Text message="Your precise location stays on this device."/>:<Text message="You can choose a city without sharing your location."/>}</p>
        </fieldset>

<fieldset className="capacity-route-filter"><legend><Route aria-hidden="true"/><Text message="Shipment route"/></legend><div className="capacity-main-route">            <div className="form-group"><label htmlFor="capacity-route-origin"><MapPinned aria-hidden="true"/><Text message="Origin "/><small><Text message="(optional)"/></small></label><EthiopiaPlaceInput id="capacity-route-origin" name="origin" placeRefName="originPlaceRef" defaultPlaceRef={query.originPlaceRef||''} defaultValue={query.origin||''} placeholder="City or town"/></div>
            <div className="form-group"><label htmlFor="capacity-route-destination"><MapPinned aria-hidden="true"/><Text message="Destination "/><small><Text message="(optional)"/></small></label><EthiopiaPlaceInput id="capacity-route-destination" name="destination" placeRefName="destinationPlaceRef" defaultPlaceRef={query.destinationPlaceRef||''} defaultValue={query.destination||''} placeholder="City or town"/></div>
</div></fieldset>

        <CapacityDocumentFilters query={query}/>

        <fieldset><legend><Route aria-hidden="true"/><Text message="Route matching"/></legend>
          <div className="capacity-geography-filter route">
            <label htmlFor="capacity-origin-radius"><span><Text message="Origin range"/></span><select id="capacity-origin-radius" name="originRadiusKm" defaultValue={query.originRadiusKm||'50'}>{routeTolerances.map(value=><option value={value} key={value}><Text message="Within {distance} km" values={{distance:value}}/></option>)}</select></label>
            <label htmlFor="capacity-destination-radius"><span><Text message="Destination range"/></span><select id="capacity-destination-radius" name="destinationRadiusKm" defaultValue={query.destinationRadiusKm||'50'}>{routeTolerances.map(value=><option value={value} key={value}><Text message="Within {distance} km" values={{distance:value}}/></option>)}</select></label>
            <label htmlFor="capacity-route-direction"><span><Text message="Direction"/></span><select id="capacity-route-direction" name="directionMode" defaultValue={query.directionMode||'DIRECT'}><option value="DIRECT"><Text message="Origin to destination"/></option><option value="EITHER"><Text message="Either direction"/></option></select></label>
          </div>
        </fieldset>
        <div className="capacity-secondary-options">
          <CapacityMultiOptions name="stopOption" label="Stops" anyLabel="Any stop pattern" options={[["MULTI_PICK","Multiple pickups"],["MULTI_DROP","Multiple drop-offs"]]} value={stopFilter} onChange={setStopFilter} icon={<MapPinned aria-hidden="true"/>}/>
          <CapacityMultiOptions name="freshness" label="Updated" anyLabel="Any published capacity" options={[["FRESH","Within 12 hours"],["UPDATE_NEEDED","More than 12 hours ago"]]} value={freshnessFilter} onChange={setFreshnessFilter} icon={<Clock3 aria-hidden="true"/>}/>
        </div>


        <div className="capacity-filter-actions"><Link href={searchPath} onClick={()=>{closeFilters();clearUnappliedFilters();}}><Text message="Clear"/></Link><button className="button" type="submit"><SlidersHorizontal aria-hidden="true"/><Text message="Show matching vehicles"/></button></div>
      </div>
    </dialog>
    </Form>

    <Localized as="aside" copy={["aria-label"]} ref={drawer} id="capacity-filter-drawer" className={`market-command-column capacity-filter-drawer capacity-people-drawer${drawerOpen?' is-open':''}`} aria-label="Transporter search" aria-hidden={!drawerOpen} inert={!drawerOpen} tabIndex={-1} onKeyDown={(event:React.KeyboardEvent<HTMLAnchorElement>)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!filterOpen){event.preventDefault();closeDrawer();}}}>
      <header className="capacity-drawer-heading" onPointerDown={startSwipe} onPointerUp={event=>finishSwipe(event,true)} onPointerCancel={()=>{swipeStart.current=null;}}>
        <div><h2><Text message="Transporter search"/></h2></div><Localized as="button" copy={["aria-label"]} type="button" aria-label="Close transporter search" onClick={closeDrawer}><PanelLeftClose aria-hidden="true"/></Localized>
      </header>
      <div ref={resultsScroll} className="capacity-drawer-scroll">
        {searchControls}
        <Localized as="section" copy={["aria-label"]} className="public-capacity-toolbar" aria-label="Capacity map location controls"><button type="button" className="button location-action" onClick={useMyLocation} disabled={locationState==='locating'}><LocateFixed aria-hidden="true"/>{locationActionLabel}</button><span className="public-location-note"><Text message="Your precise location remains on this device."/></span></Localized>
        {locationNotice?<small className={`capacity-location-status ${locationState==='ready'?'ready':'attention'}`} role="status" data-testid="visitor-location-state">{locationNotice}</small>:null}
        {submittedSearch===null?<p className="capacity-search-instruction"><Text message={searchTerm.trim()&&!transporterSearchQuery(searchTerm)?'Enter at least two characters.':'Search by account name, manager, @handle or city.'}/></p>:null}
        {profileResults}

      </div>

    </Localized>
    <div className="capacity-drawer-handle capacity-map-controls">
      <button ref={drawerTrigger} onPointerDown={event=>{swipeStart.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={event=>finishSwipe(event,false)} onPointerCancel={()=>{swipeStart.current=null;}} type="button" disabled={!controlsReady} aria-expanded={drawerOpen} aria-controls="capacity-filter-drawer" onClick={()=>{if(drawerOpen)closeDrawer();else if(selected)closeTruck();else openDrawer();}}><Search aria-hidden="true"/><Text message="Transporter search"/></button>
      <button type="button" className="capacity-filter-trigger" disabled={!controlsReady} aria-haspopup="dialog" onClick={()=>setFilterOpen(true)}><SlidersHorizontal aria-hidden="true"/><Text message="Vehicle filters"/>{activeFilterCount?<span>{activeFilterCount}</span>:null}</button>
    </div>
      <section id="capacity-map-view" className="public-map-shell">
        <div className="public-map-canvas"><PublicCapacityMap rememberPublicView={apiPath==='/api/public/capacity'} items={items} viewer={viewer} selectedId={selectedId} keepItemsInView={Boolean(query.provider||query.truck)} onSelect={selectTruck} onDeselect={()=>setSelectedId(null)} onExplore={explore} truckDetails={selected?<MapTruckDetails truck={selected}/>:null}/></div>
        {feedback}
      </section>
    </div>;
}
