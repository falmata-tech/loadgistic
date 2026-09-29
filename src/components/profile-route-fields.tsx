"use client";


import {Text,Localized} from '@/components/localization';
import React from 'react';
import { ArrowRightLeft, MapPin, Plus, Route, Trash2 } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type RouteRow = { id?:string; origin:string; destination:string;origin_place_ref?:string;destination_place_ref?:string };

export function ProfileRouteFields({ initialRoutes = [], isBusiness = false }: { initialRoutes?:RouteRow[];isBusiness?:boolean }) {
  const [routes,setRoutes]:[RouteRow[],(value:RouteRow[]|((current:RouteRow[])=>RouteRow[]))=>void] = React.useState(initialRoutes.length ? initialRoutes : [{origin:'',destination:''}]);
  return <section className="profile-route-editor">
    <div className="section-heading-icon"><Route aria-hidden="true"/><div><h2>{isBusiness?<Text message="Freight Routes"/>:<Text message="Preferred Routes"/>}</h2><p className="meta">{isBusiness?<Text message="Add the city pairs where your Business regularly ships or receives freight."/>:<Text message="Add the city pairs where you regularly prefer to transport freight."/>}</p></div></div>
    <div className="profile-route-rows">
      {routes.map((route,index)=><div className="profile-route-row" key={route.id||index}>
        <div className="form-group"><label htmlFor={`route-origin-${index}`}><MapPin aria-hidden="true"/><Text message="City 1"/></label><EthiopiaPlaceInput id={`route-origin-${index}`} name="routeOrigin" placeRefName="routeOriginPlaceRef" defaultPlaceRef={route.origin_place_ref||''} defaultValue={route.origin} placeholder="Addis Ababa, Ethiopia"/></div>
        <span className="route-pair-arrow" aria-hidden="true"><ArrowRightLeft/></span>
        <div className="form-group"><label htmlFor={`route-destination-${index}`}><MapPin aria-hidden="true"/><Text message="City 2"/></label><EthiopiaPlaceInput id={`route-destination-${index}`} name="routeDestination" placeRefName="routeDestinationPlaceRef" defaultPlaceRef={route.destination_place_ref||''} defaultValue={route.destination} placeholder="Hawassa, Ethiopia"/></div>
        <Localized as="button" copy={["title"]} type="button" className="icon-action danger-outline" aria-label={`Remove route ${index+1}`} title="Remove route" onClick={()=>setRoutes(current=>current.filter((_,rowIndex)=>rowIndex!==index))}><Trash2 aria-hidden="true"/></Localized>
      </div>)}
    </div>
    <button type="button" className="button secondary small icon-button-label" onClick={()=>setRoutes(current=>[...current,{origin:'',destination:''}])}><Plus aria-hidden="true"/><Text message="Add "/>{isBusiness?<Text message="Freight"/>:<Text message="Preferred"/>}<Text message=" Route"/></button>
  </section>;
}
