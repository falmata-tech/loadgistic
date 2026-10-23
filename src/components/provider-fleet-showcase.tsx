"use client";

import React from 'react';
import {TruckAuthorityBadges} from './truck-authority';

import {Text,useTranslation} from '@/components/localization';
import {localizedUpdateLabel} from '@/lib/i18n/update-label.js';
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
  X
} from 'lucide-react';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';
import {PublicCapacityMap} from '@/components/public-capacity-map';
import {VerificationBadges} from '@/components/verification-badges';
import {publicFleetRowKey} from '@/lib/public-fleet-row.js';
import {PublicIdentityImage} from './public-identity-image';
import identity from './public-identity-image.module.css';

type Point={lat:number;lng:number};
type LocationState='idle'|'locating'|'ready'|'denied'|'unavailable'|'invalid';

function placeLabels(points:any[]|undefined,separator:string){
  return (points||[]).map(point=>point.label).filter(Boolean).join(separator);
}

function capacityTitle(capacity:any,t:(message:string)=>string){
  if(capacity.availability_geometry==='ROUTE')return placeLabels(capacity.current_route_points,' → ')||t('Published Capacity route');
  const boundary=placeLabels(capacity.capacity_area_boundary,' · ');
  return boundary?`${capacity.capacity_area_center_label||t('Service area')} · ${boundary}`:capacity.capacity_area_center_label||t('Published Service area');
}

function regularServiceTitle(capacity:any,t:(message:string)=>string){
  const signal=capacity?.recurring_corridors?.[0];
  if(!signal)return null;
  if(signal.geometry==='ROUTE')return {label:'Regular capacity route',value:placeLabels(signal.route_points,' ↔ ')};
  const boundary=placeLabels(signal.area_boundary,' · ');
  return {label:'Regular service area',value:boundary?`${signal.area_center_label||t('Service area')} · ${boundary}`:signal.area_center_label||t('Service area')};
}

function panelId(rowKey:string){
  return `truck-map-${encodeURIComponent(rowKey)}`;
}

export function ProviderFleetShowcase({providerName,trucks,total=trucks.length,startIndex=0}:{providerName:string;trucks:any[];total?:number;startIndex?:number}){
  const {t}=useTranslation();
  const [expanded,setExpanded]=React.useState(null as string|null);
  const [viewer,setViewer]=React.useState(null as Point|null);
  const [locationState,setLocationState]=React.useState('idle' as LocationState);
  const mapButtons=React.useRef(new Map<string,HTMLButtonElement>());
  const availableCount=trucks.filter(truck=>truck.capacity).length;

  function requestLocation(){
    if(!navigator.geolocation){setViewer(null);setLocationState('unavailable');return;}
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(position=>{
      const point={lat:position.coords.latitude,lng:position.coords.longitude};
      if(!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||Math.abs(point.lat)>90||Math.abs(point.lng)>180){setViewer(null);setLocationState('invalid');return;}
      setViewer(point);
      setLocationState('ready');
    },error=>{
      setViewer(null);
      setLocationState(error.code===error.PERMISSION_DENIED?'denied':'unavailable');
    },{enableHighAccuracy:false,timeout:10_000,maximumAge:120_000});
  }

  function openMap(rowKey:string){
    setExpanded(rowKey);
    if(locationState==='idle')requestLocation();
    if(window.matchMedia('(max-width: 760px)').matches)window.setTimeout(()=>document.getElementById(panelId(rowKey))?.scrollIntoView({block:'start',behavior:'smooth'}),80);
  }

  function closeMap(rowKey:string){
    setExpanded(null);
    window.requestAnimationFrame(()=>mapButtons.current.get(rowKey)?.focus());
  }

  return <section className="provider-fleet-showcase" aria-labelledby="provider-fleet-title">
    <header className="provider-fleet-heading">
      <div>

        <h2 id="provider-fleet-title"><Text message="Vehicles and published capacity"/></h2>

      </div>
      <div className="provider-fleet-counts" aria-label={t('{shown} of {total} active vehicles shown, {count} published capacity signals on this page',{shown:trucks.length,total,count:availableCount})}>
        <span><Text message="{shown} of {total} vehicles" values={{shown:trucks.length,total}}/></span>
        <span className="available"><Text message="{count} with published capacity" values={{count:availableCount}}/></span>
      </div>
    </header>

    <div className="provider-truck-list">{trucks.map((truck,index)=>{
      const capacity=truck.capacity;
      const rowKey=publicFleetRowKey(truck.platform_number,startIndex+index);
      const isOpen=expanded===rowKey;
      const regularService=regularServiceTitle(capacity,t);
      const mapPanelId=panelId(rowKey);
      const mapTruckLabel=truck.platform_number||[truck.make,truck.model].filter(Boolean).join(' ')||t('Vehicle {number}',{number:startIndex+index+1});
      const capacityState=capacity?.status==='PARTIAL'?'Partial space · confirm fit':'Empty vehicle';
      const capacityHeading=capacity?.capacity_confirmation_needed?t(capacityState==='Empty vehicle'?'Last reported empty vehicle':'Last reported partial space · confirm fit'):t(capacityState);
      return <article className={`provider-truck-card${isOpen?' expanded':''}`} key={rowKey}>
        <div className="provider-truck-card-main">
          <div className="provider-truck-image">
            <Image src={vehicleConfigurationImage(truck.cargo_configuration)} width={300} height={210} alt={`${truck.make||''} ${truck.model||''} ${t(truck.cargo_configuration||'Road-freight vehicle')}`.trim()}/>
            <span className={`status ${capacity?.status==='PARTIAL'?'yellow':capacity?'green':'neutral'}`}>{capacity?capacityHeading:<Text message="Ask about availability"/>}</span>
          </div>

          <div className="provider-truck-copy">
            <div className="provider-truck-title-row">
              <span><small><Text message="Vehicle "/>{String(startIndex+index+1).padStart(2,'0')}</small><strong>{truck.platform_number}</strong></span>
              <div><h3>{truck.make||t('Vehicle')} {truck.model||''}</h3><p>{t(truck.cargo_configuration||'Road-freight vehicle')}</p></div>
            </div>

            <div className={`public-truck-driver ${identity.fleetRow}`}><PublicIdentityImage path={truck.assigned_driver_portrait_url} kind="person" label={truck.assigned_driver_first_name||''} size="small"/><span><strong>{truck.assigned_driver_first_name||t('Driver not named')} · {t(truck.driver_kind_label||'Driver')}</strong><small>{truck.assigned_driver_phone||t('Driver phone not published')}{truck.driver_kind==='COMPANY_DRIVER'?` · ${providerName}`:''}</small></span>{truck.assigned_driver_phone?<a href={`tel:${truck.assigned_driver_phone}`}><Phone aria-hidden="true"/><Text message="Call driver"/></a>:null}</div>
            <TruckAuthorityBadges authority={truck.authority}/><div className="public-truck-verification"><VerificationBadges badges={truck.driver_verification_badges} compact label="Driver documents"/><VerificationBadges badges={truck.truck_verification_badges} compact label="Vehicle documents"/></div>

            {capacity?<div className="provider-truck-capacity-grid">
              <section className={`provider-truck-current ${capacity.status==='PARTIAL'?'partial':'empty'}`}>
                {capacity.availability_geometry==='ROUTE'?<Route aria-hidden="true"/>:<CircleDotDashed aria-hidden="true"/>}
                <span><small>{capacityHeading} · {capacity.availability_geometry==='ROUTE'?<Text message="Capacity route"/>:<Text message="Service area"/>}</small><strong>{capacityTitle(capacity,t)}</strong></span>
              </section>
              <div className="provider-truck-meta">
                <span><Clock3 aria-hidden="true"/><span><small><Text message="Capacity update"/></small><strong>{localizedUpdateLabel(capacity.capacity_updated_label,t)}</strong>{capacity.location_updated_label?<em>{localizedUpdateLabel(capacity.location_updated_label,t,'location')}</em>:null}</span></span>
                {regularService?<span><Navigation aria-hidden="true"/><span><small><Text message={regularService.label}/></small><strong>{regularService.value||t('Confirm route directly')}</strong></span></span>:null}
              </div>
            </div>:<div className="provider-truck-off-duty"><CalendarClock aria-hidden="true"/><span><strong><Text message="No current capacity published"/></strong><small><Text message="Ask the transporter about this vehicle's next availability."/></small></span></div>}
          </div>

          <div className="provider-truck-actions">
            {capacity?<button
              type="button"
              className="button secondary"
              ref={node=>{if(node)mapButtons.current.set(rowKey,node);else mapButtons.current.delete(rowKey);}}
              onClick={()=>isOpen?closeMap(rowKey):openMap(rowKey)}
              aria-expanded={isOpen}
              aria-controls={mapPanelId}
            >{isOpen?<><X aria-hidden="true"/><Text message="Close capacity map"/></>:<><MapPinned aria-hidden="true"/><Text message="View capacity on map"/></>}</button>:<a className="button secondary" href="#provider-contacts"><CalendarClock aria-hidden="true"/><Text message="Ask about this vehicle"/></a>}
          </div>
        </div>

        {isOpen&&capacity?<section id={mapPanelId} className="provider-truck-map-panel" aria-label={t('Capacity map for {truck}',{truck:mapTruckLabel})}>
          <header className="provider-truck-map-toolbar">
            <div className="provider-truck-map-context"><MapPinned aria-hidden="true"/><span><small><Text message="Viewing on map"/></small><strong>{truck.make||t('Vehicle')} {truck.model||''}{truck.platform_number?` · ${truck.platform_number}`:''}</strong></span></div>
            <div className="provider-truck-map-location"><LocateFixed aria-hidden="true"/><span><strong>{locationState==='ready'?<Text message="Your location is shown"/>:locationState==='locating'?<Text message="Finding your location…"/>:locationState==='denied'?<Text message="Location permission declined"/>:locationState==='invalid'?<Text message="Your location could not be determined. Try again."/>:<Text message="Your location is not shown"/>}</strong><small><Text message="Your precise location remains on this device."/></small></span></div>
            <div className="provider-truck-map-actions"><button type="button" className="button secondary" onClick={requestLocation} disabled={locationState==='locating'}><RefreshCw aria-hidden="true"/>{locationState==='ready'?<Text message="Refresh my location"/>:<Text message="Use my location"/>}</button><button type="button" className="button ghost" onClick={()=>closeMap(rowKey)}><X aria-hidden="true"/><Text message="Close map"/></button></div>
          </header>
          <div className="provider-truck-relative-map"><PublicCapacityMap items={[capacity]} viewer={viewer} selectedId={capacity.id} onSelect={()=>{}}/></div>
          <p className="provider-truck-map-note"><ShieldCheck aria-hidden="true"/><Text message="Blue outlines show the driver’s approximate location. Confirm availability directly with the transporter."/></p>
        </section>:null}
      </article>;
    })}</div>
  </section>;
}
