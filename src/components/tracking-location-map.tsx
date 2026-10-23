"use client";


import React from 'react';
import Link from 'next/link';
import {Text,useTranslation} from '@/components/localization';
import dynamic from 'next/dynamic';
import {Building2,LocateFixed,Phone,Truck,UserRound} from 'lucide-react';
import {SurfaceSkeleton} from './loading-state';
import {TrackingDetailDialog} from './tracking-detail-dialog';
import {TrackingProgressPanel} from './tracking-progress-panel';
import type {TrackingMapData,TrackingPublicTruck} from './tracking-map-data';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';
import {TruckAuthorityBadges} from './truck-authority';
import {locationSourceLabel} from '@/lib/location-source.js';

const TrackingLocationMapLeaflet=dynamic(()=>import('./tracking-location-map-leaflet'),{ssr:false,loading:()=> <SurfaceSkeleton kind="map" className="tracking-location-map-loading" label="Loading shipment map"/>});

function TrackingTruckSummary({truck}:{truck:TrackingPublicTruck}){
  return <section className="tracking-truck-summary">
    <div className="tracking-truck-identity"><img src={vehicleConfigurationImage(truck.configuration)} alt=""/><div><small>{truck.platformNumber}</small><h3>{[truck.make,truck.model].filter(Boolean).join(' ')||<Text message="Vehicle"/>}</h3>{truck.configuration?<p><Text message={truck.configuration}/></p>:null}</div></div>
    <TruckAuthorityBadges authority={truck.authority}/>
    <div className="tracking-truck-person"><Building2 aria-hidden="true"/><div><small><Text message="Transport Provider"/></small><strong>{truck.providerName}</strong>{truck.contactPhone?<span>{truck.contactPhone}</span>:null}</div>{truck.providerHandle?<Link className="button secondary small" href={`/@${encodeURIComponent(truck.providerHandle)}`}><Text message="Profile"/></Link>:null}{truck.contactPhone?<a className="button secondary small" href={`tel:${truck.contactPhone}`}><Phone aria-hidden="true"/><Text message="Call"/></a>:null}</div>
    <div className="tracking-truck-person"><UserRound aria-hidden="true"/><div><small><Text message="Driver"/></small><strong>{truck.driverName||<Text message="Driver not named"/>}</strong><span>{truck.driverPhone||<Text message="Phone not published"/>}</span></div>{truck.driverPhone?<a className="button secondary small" href={`tel:${truck.driverPhone}`}><Phone aria-hidden="true"/><Text message="Call driver"/></a>:null}</div>
  </section>;
}

export function TrackingLocationMap({shipment,children}:{shipment:TrackingMapData;children?:React.ReactNode}){
  const {t}=useTranslation();const [truckOpen,setTruckOpen]=React.useState(false),[ready,setReady]=React.useState(false),routeTitleId=React.useId();
  React.useEffect(()=>setReady(true),[]);
  const {route,location,truck}=shipment;
  return <section className="tracking-map-workspace" data-testid="tracking-map-workspace" aria-labelledby={routeTitleId}>
    <div className="tracking-map-stage">
      {route.length>=2?<TrackingLocationMapLeaflet route={route} location={location} truck={truck} onTruckClick={()=>setTruckOpen(true)}/>:<div className="tracking-map-unavailable" role="status"><Text message="Saved route is unavailable."/></div>}
      <div className="tracking-route-card"><h2 id={routeTitleId}><Text message="Shipment route"/></h2><ol>{route.map((point,index)=><li data-route-stop key={`${point.placeRef}-${index}`}><span className="tracking-route-number" aria-hidden="true">{index+1}</span><span><small><Text message={index===0?'Pickup':index===route.length-1?'Delivery':'Via city'}/></small><strong>{point.label}</strong></span>{index<route.length-1?<span className="tracking-route-arrow" aria-hidden="true">→</span>:null}</li>)}</ol></div>
      {truck?<button type="button" className="tracking-truck-button" disabled={!ready} aria-label={t('Open vehicle details')} onClick={()=>setTruckOpen(true)}><Truck aria-hidden="true"/><span><Text message="Vehicle and driver"/></span></button>:null}
      <TrackingProgressPanel status={shipment.status} recordedStatuses={shipment.recordedStatuses}>{children}</TrackingProgressPanel>
    </div>
    <div className="tracking-map-caption">
      {location?<p className="tracking-reported-area" data-location-radius-km={location.radiusKm}><LocateFixed aria-hidden="true"/><span><strong><Text message="Reported approximate area"/> · {location.label}</strong><small><Text message="Within {radius} km" values={{radius:location.radiusKm}}/>{location.demo===true?<> · <Text message="Demo location"/></>:null}{locationSourceLabel(location.source)?<> · <Text message={locationSourceLabel(location.source)}/></>:null}{location.updatedAt?<> · <Text message="Updated"/> {new Date(location.updatedAt).toLocaleString()}</>:null}</small></span></p>:<p><Text message={shipment.trackingMode==='LOCATION_AND_STATUS'&&!['COMPLETED','CANCELLED'].includes(shipment.status)?'Waiting for the Driver’s approximate location':'Saved shipment route'}/></p>}
      <p><Text message={location?"Vehicle circle shows an approximate location, not exact GPS.":"The line connects the saved pickup, passing-through and delivery cities."}/></p>
    </div>
    {truckOpen&&truck?<TrackingDetailDialog title="Vehicle and driver" closeLabel="Close vehicle details" onClose={()=>setTruckOpen(false)}><TrackingTruckSummary truck={truck}/></TrackingDetailDialog>:null}
  </section>;
}
