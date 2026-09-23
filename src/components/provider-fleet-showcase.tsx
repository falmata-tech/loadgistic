"use client";


import {Text} from '@/components/localization';
import React from 'react';
import Image from 'next/image';
import {
  CalendarClock,
  CircleDotDashed,
  Clock3,
  LocateFixed,
  MapPinned,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
  X
} from 'lucide-react';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';
import {PublicCapacityMap} from '@/components/public-capacity-map';
import {VerificationBadges} from '@/components/verification-badges';

type Point={lat:number;lng:number};
type LocationState='idle'|'locating'|'ready'|'denied'|'unavailable'|'outside';

function placeLabels(points:any[]|undefined,separator:string){
  return (points||[]).map(point=>point.label).filter(Boolean).join(separator);
}

function capacityTitle(capacity:any){
  if(capacity.availability_geometry==='ROUTE')return placeLabels(capacity.current_route_points,' → ')||'Published Capacity route';
  const boundary=placeLabels(capacity.capacity_area_boundary,' · ');
  return boundary?`${capacity.capacity_area_center_label||'Service area'} · ${boundary}`:capacity.capacity_area_center_label||'Published Service area';
}

function regularServiceTitle(capacity:any){
  const signal=capacity?.recurring_corridors?.[0];
  if(!signal)return null;
  if(signal.geometry==='ROUTE')return {label:'Regular capacity route',value:placeLabels(signal.route_points,' ↔ ')};
  const boundary=placeLabels(signal.area_boundary,' · ');
  return {label:'Regular service area',value:boundary?`${signal.area_center_label||'Service area'} · ${boundary}`:signal.area_center_label||'Service area'};
}

function panelId(platformNumber:string){
  return `truck-map-${platformNumber.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
}

export function ProviderFleetShowcase({providerName,trucks,total=trucks.length,startIndex=0}:{providerName:string;trucks:any[];total?:number;startIndex?:number}){
  const [expanded,setExpanded]=React.useState(null as string|null);
  const [viewer,setViewer]=React.useState(null as Point|null);
  const [locationState,setLocationState]=React.useState('idle' as LocationState);
  const mapButtons=React.useRef(new Map<string,HTMLButtonElement>());
  const availableCount=trucks.filter(truck=>truck.capacity).length;

  function requestLocation(){
    if(!navigator.geolocation){setLocationState('unavailable');return;}
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(position=>{
      const point={lat:position.coords.latitude,lng:position.coords.longitude};
      if(point.lat<3||point.lat>15||point.lng<32||point.lng>49){setViewer(null);setLocationState('outside');return;}
      setViewer(point);
      setLocationState('ready');
    },error=>{
      setViewer(null);
      setLocationState(error.code===error.PERMISSION_DENIED?'denied':'unavailable');
    },{enableHighAccuracy:false,timeout:10_000,maximumAge:120_000});
  }

  function openMap(truck:any){
    setExpanded(truck.platform_number);
    if(locationState==='idle')requestLocation();
    if(window.matchMedia('(max-width: 760px)').matches)window.setTimeout(()=>document.getElementById(panelId(truck.platform_number))?.scrollIntoView({block:'start',behavior:'smooth'}),80);
  }

  function closeMap(platformNumber:string){
    setExpanded(null);
    window.requestAnimationFrame(()=>mapButtons.current.get(platformNumber)?.focus());
  }

  return <section className="provider-fleet-showcase" aria-labelledby="provider-fleet-title">
    <header className="provider-fleet-heading">
      <div>
        <span><Truck aria-hidden="true"/><Text message="Active fleet"/></span>
        <h2 id="provider-fleet-title"><Text message="Trucks and published capacity"/></h2>
        <p><Text message="Review each "/>{providerName}<Text message=" truck, check when its capacity and approximate location were updated, then open its map for geographic context."/></p>
      </div>
      <div className="provider-fleet-counts" aria-label={`${trucks.length} of ${total} active trucks shown, ${availableCount} published capacity signals on this page`}>
        <span><strong>{trucks.length}</strong><Text message=" of "/>{total}<Text message=" trucks"/></span>
        <span className="available"><strong>{availableCount}</strong><Text message=" signals on this page"/></span>
      </div>
    </header>

    <div className="provider-truck-list">{trucks.map((truck,index)=>{
      const capacity=truck.capacity;
      const isOpen=expanded===truck.platform_number;
      const regularService=regularServiceTitle(capacity);
      const mapPanelId=panelId(truck.platform_number);
      const capacityState=capacity?.status==='PARTIAL'?'Partial space · confirm fit':'Empty truck';
      const capacityHeading=capacity?.capacity_confirmation_needed?`Last reported ${capacityState.toLowerCase()}`:capacityState;
      return <article className={`provider-truck-card${isOpen?' expanded':''}`} key={truck.platform_number}>
        <div className="provider-truck-card-main">
          <div className="provider-truck-image">
            <Image src={vehicleConfigurationImage(truck.cargo_configuration)} width={300} height={210} alt={`${truck.make||''} ${truck.model||''} ${truck.cargo_configuration||'road freight truck'}`.trim()}/>
            <span className={`status ${capacity?.status==='PARTIAL'?'yellow':capacity?'green':'neutral'}`}>{capacity?capacityHeading:<Text message="Ask about availability"/>}</span>
          </div>

          <div className="provider-truck-copy">
            <div className="provider-truck-title-row">
              <span><small><Text message="Truck "/>{String(startIndex+index+1).padStart(2,'0')}</small><strong>{truck.platform_number}</strong></span>
              <div><h3>{truck.make||'Truck'} {truck.model||''}</h3><p>{truck.cargo_configuration||'Road-freight truck'}</p></div>
            </div>

            <div className="public-truck-driver"><UserRound aria-hidden="true"/><span><strong>{truck.assigned_driver_first_name||'Driver not named'} · {truck.driver_kind_label||'Driver'}</strong><small>{truck.assigned_driver_phone||'Driver phone not published'}{truck.driver_kind==='COMPANY_DRIVER'?` · ${providerName}`:''}</small></span>{truck.assigned_driver_phone?<a href={`tel:${truck.assigned_driver_phone}`}><Phone aria-hidden="true"/><Text message="Call driver"/></a>:null}</div>
            <div className="public-truck-verification"><VerificationBadges badges={truck.driver_verification_badges} compact label="Driver documents"/><VerificationBadges badges={truck.truck_verification_badges} compact label="Truck documents"/></div>

            {capacity?<div className="provider-truck-capacity-grid">
              <section className={`provider-truck-current ${capacity.status==='PARTIAL'?'partial':'empty'}`}>
                {capacity.availability_geometry==='ROUTE'?<Route aria-hidden="true"/>:<CircleDotDashed aria-hidden="true"/>}
                <span><small>{capacityHeading} · {capacity.availability_geometry==='ROUTE'?<Text message="Capacity route"/>:<Text message="Service area"/>}</small><strong>{capacityTitle(capacity)}</strong></span>
              </section>
              <div className="provider-truck-meta">
                <span><Clock3 aria-hidden="true"/><span><small><Text message="Capacity update"/></small><strong>{capacity.capacity_updated_label||capacity.updated_label||'Update unavailable'}</strong>{capacity.location_updated_label?<em>{capacity.location_updated_label}</em>:null}</span></span>
                {regularService?<span><Navigation aria-hidden="true"/><span><small>{regularService.label}</small><strong>{regularService.value||'Confirm route directly'}</strong></span></span>:null}
              </div>
            </div>:<div className="provider-truck-off-duty"><CalendarClock aria-hidden="true"/><span><strong><Text message="No current capacity published"/></strong><small><Text message="Ask the transporter about this truck's next availability."/></small></span></div>}
          </div>

          <div className="provider-truck-actions">
            {capacity?<button
              type="button"
              className="button secondary"
              ref={node=>{if(node)mapButtons.current.set(truck.platform_number,node);else mapButtons.current.delete(truck.platform_number);}}
              onClick={()=>isOpen?closeMap(truck.platform_number):openMap(truck)}
              aria-expanded={isOpen}
              aria-controls={mapPanelId}
            >{isOpen?<><X aria-hidden="true"/><Text message="Close capacity map"/></>:<><MapPinned aria-hidden="true"/><Text message="View capacity on map"/></>}</button>:<a className="button secondary" href="#provider-contacts"><CalendarClock aria-hidden="true"/><Text message="Ask about this truck"/></a>}
          </div>
        </div>

        {isOpen&&capacity?<section id={mapPanelId} className="provider-truck-map-panel" aria-label={`Capacity map for ${truck.platform_number}`}>
          <header className="provider-truck-map-toolbar">
            <div className="provider-truck-map-context"><MapPinned aria-hidden="true"/><span><small><Text message="Viewing on map"/></small><strong>{truck.make||'Truck'} {truck.model||''} · {truck.platform_number}</strong></span></div>
            <div className="provider-truck-map-location"><LocateFixed aria-hidden="true"/><span><strong>{locationState==='ready'?<Text message="Your location is shown"/>:locationState==='locating'?<Text message="Finding your location…"/>:locationState==='denied'?<Text message="Location permission declined"/>:locationState==='outside'?<Text message="Your location is outside the Ethiopia map"/>:<Text message="Your location is not shown"/>}</strong><small><Text message="Your precise location remains on this device."/></small></span></div>
            <div className="provider-truck-map-actions"><button type="button" className="button secondary" onClick={requestLocation} disabled={locationState==='locating'}><RefreshCw aria-hidden="true"/>{locationState==='ready'?<Text message="Refresh my location"/>:<Text message="Use my location"/>}</button><button type="button" className="button ghost" onClick={()=>closeMap(truck.platform_number)}><X aria-hidden="true"/><Text message="Close map"/></button></div>
          </header>
          <div className="provider-truck-relative-map"><PublicCapacityMap items={[capacity]} viewer={viewer} selectedId={capacity.id} onSelect={()=>{}}/></div>
          <p className="provider-truck-map-note"><ShieldCheck aria-hidden="true"/><Text message="The violet boundary shows the Driver-selected approximate location. Confirm the truck's position, capacity, cargo fit, documents, price, and timing directly with the transporter."/></p>
        </section>:null}
      </article>;
    })}</div>
  </section>;
}
