"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Banknote, Boxes, CalendarClock, Clock3, Eye, Gauge, LockKeyhole, MapPin, Route, ShieldCheck, Truck, UserRound, Waypoints } from 'lucide-react';

type ShipmentPreview={movement_scope:string;origin?:string|null;destination?:string|null;local_place_label?:string|null;pickup_area_label?:string|null;dropoff_area_label?:string|null;load_type?:string|null;vehicle_category?:string|null;pickup_label?:string|null;delivery_label?:string|null;price_mode?:string|null;price_minor?:number|null;distribution_mode?:string|null;posted_label?:string|null};
type TruckPreview={status:string;available_percent?:number|null;available_again_date?:string|null;movement_scope?:string|null;local_place_label?:string|null;local_radius_km?:number|null;location_area?:string|null;location_precision_km?:number|null;current_route_origin?:string|null;current_route_destination?:string|null;origin?:string|null;destination?:string|null;travel_date?:string|null;planned_space_status?:string|null;vehicle_make?:string|null;vehicle_model?:string|null;cargo_configuration?:string|null;accepts_full_load:boolean;accepts_partial_load:boolean;accepts_multi_pick:boolean;accepts_multi_drop:boolean;open_to_contract_lanes:boolean;proof_available:boolean;freshness?:string|null;updated_label?:string|null};

function priceLabel(shipment:ShipmentPreview){
  if(shipment.price_mode==='QUOTE_REQUESTED')return 'Request quotes';
  const amount=shipment.price_minor?new Intl.NumberFormat('en-US').format(Math.round(shipment.price_minor/100)):null;
  return amount?`${shipment.price_mode==='TARGET_PRICE'?'Target':'Fixed'} · ${amount} ETB`:'Price discussed';
}

function shipmentRoute(shipment:ShipmentPreview){
  if(shipment.movement_scope==='LOCAL')return `Local in ${shipment.local_place_label||'selected city'}`;
  return `${shipment.origin||'Origin'} → ${shipment.destination||'Destination'}`;
}

function acceptedLoads(truck:TruckPreview){
  if(truck.accepts_full_load&&truck.accepts_partial_load)return 'Full or partial truckload';
  if(truck.accepts_partial_load)return 'Partial Truckload (PTL)';
  return 'Full Truckload (FTL)';
}

function stopPolicy(truck:TruckPreview){
  if(truck.accepts_multi_pick&&truck.accepts_multi_drop)return 'Multi pick + drop';
  if(truck.accepts_multi_pick)return 'Multi pick';
  if(truck.accepts_multi_drop)return 'Multi drop';
  return 'Direct only';
}

function truckRoute(truck:TruckPreview){
  if(truck.movement_scope==='LOCAL')return `Local in ${truck.local_place_label||truck.location_area||'selected city'}`;
  if(truck.status==='PARTIAL'&&truck.current_route_origin)return `${truck.current_route_origin} → ${truck.current_route_destination}`;
  if(truck.origin)return `${truck.origin} → ${truck.destination}`;
  if(truck.movement_scope==='BOTH'&&truck.local_place_label)return `Local + long-distance · ${truck.local_place_label}`;
  return 'Preferred route available after login';
}

export function PublicBoardPreview({shipments,trucks}:{shipments:ShipmentPreview[];trucks:TruckPreview[]}){
  const router=useRouter();
  const [active,setActive]:['SHIPMENTS'|'TRUCKS',(value:'SHIPMENTS'|'TRUCKS')=>void]=React.useState('SHIPMENTS');
  React.useEffect(()=>{
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')router.refresh();},60000);
    return()=>window.clearInterval(timer);
  },[router]);
  const rows=active==='SHIPMENTS'?shipments:trucks;
  const label=active==='SHIPMENTS'?'Shipment Board':'Truck Board';
  const BoardIcon=active==='SHIPMENTS'?Boxes:Truck;
  return <section className="public-board-section" aria-labelledby="marketplace-preview-title"><div className="container">
    <div className="public-board-heading"><div><span className="eyebrow"><Eye aria-hidden="true"/>Live marketplace</span><h2 id="marketplace-preview-title">See what is moving.</h2></div><p>Real routes and availability. Member identity and contact stay protected.</p></div>
    <div className="public-board-shell">
      <div className="public-board-tabs" role="tablist" aria-label="Marketplace boards">
        <button type="button" role="tab" aria-selected={active==='SHIPMENTS'} className={active==='SHIPMENTS'?'active':''} onClick={()=>setActive('SHIPMENTS')}><Boxes aria-hidden="true"/><span>Shipment Board</span></button>
        <button type="button" role="tab" aria-selected={active==='TRUCKS'} className={active==='TRUCKS'?'active':''} onClick={()=>setActive('TRUCKS')}><Truck aria-hidden="true"/><span>Truck Board</span></button>
      </div>
      <div className="public-board-toolbar"><strong><BoardIcon aria-hidden="true"/>{label}</strong><span><LockKeyhole aria-hidden="true"/>Names and contacts require login</span></div>
      <div className="public-board-list" role="tabpanel">
        {active==='SHIPMENTS'?(shipments as ShipmentPreview[]).map((shipment,index)=><article className="locked-board-card rich-preview-card" key={index}>
          <div className="preview-card-main"><div className="preview-card-title"><span className="status green">{shipment.load_type||'Freight'}</span><h3>{shipment.vehicle_category||'Road-freight shipment'}</h3></div><p className="preview-route"><Waypoints aria-hidden="true"/>{shipmentRoute(shipment)}</p><div className="preview-identity"><UserRound aria-hidden="true"/><span><small>Business</small><strong>Shown after login</strong></span><ShieldCheck aria-label="Member identity protected"/></div></div>
          <div className="locked-card-facts"><div><Truck aria-hidden="true"/><span><small>Truck needed</small><strong>{shipment.vehicle_category||'Discuss directly'}</strong></span></div><div><CalendarClock aria-hidden="true"/><span><small>Pick up before</small><strong>{shipment.pickup_label||'Date open'}</strong></span></div><div><Clock3 aria-hidden="true"/><span><small>Drop off before</small><strong>{shipment.delivery_label||'Date open'}</strong></span></div><div><Banknote aria-hidden="true"/><span><small>Price</small><strong>{priceLabel(shipment)}</strong></span></div></div>
          <div className="preview-tags"><span>{shipment.movement_scope==='LOCAL'?'Local':'Long-distance route'}</span><span>{shipment.distribution_mode==='OPEN_MARKET'?'Public':'Limited'}</span><span>Posted {shipment.posted_label||'recently'}</span></div>
          <div className="preview-card-actions"><Link href="/login" className="button secondary"><Eye aria-hidden="true"/>Details</Link><Link href="/login" className="button"><UserRound aria-hidden="true"/>Contact<ArrowRight aria-hidden="true"/></Link></div>
        </article>):(trucks as TruckPreview[]).map((truck,index)=><article className="locked-board-card rich-preview-card" key={index}>
          <div className="preview-card-main"><div className="preview-card-title"><span className="status green">{truck.status}{truck.status!=='BUSY'?` · ${truck.available_percent||0}%`:''}</span><h3>{[truck.vehicle_make,truck.vehicle_model].filter(Boolean).join(' · ')||truck.cargo_configuration||'Available truck'}</h3></div><p className="preview-route"><Route aria-hidden="true"/>{truckRoute(truck)}</p><div className="preview-identity"><UserRound aria-hidden="true"/><span><small>Transporter</small><strong>Shown after login</strong></span><ShieldCheck aria-label="Member identity protected"/></div></div>
          <div className="locked-card-facts"><div><Truck aria-hidden="true"/><span><small>Cargo configuration</small><strong>{truck.cargo_configuration||'Truck configuration'}</strong></span></div><div><MapPin aria-hidden="true"/><span><small>{truck.status==='BUSY'?'Expected area':'Current area'}</small><strong>{truck.location_area||truck.local_place_label||'General area shared'}</strong></span></div><div><Boxes aria-hidden="true"/><span><small>Accepting</small><strong>{acceptedLoads(truck)} · {stopPolicy(truck)}</strong></span></div><div><Clock3 aria-hidden="true"/><span><small>Freshness</small><strong>{truck.updated_label||truck.freshness||'Recently updated'}</strong></span></div></div>
          <div className="preview-tags"><span>{truck.movement_scope==='BOTH'?'Local + long-distance':truck.movement_scope==='LOCAL'?'Local':'Long-distance route'}</span><span>{truck.proof_available?'Photo recorded':'No photo'}</span><span>{truck.open_to_contract_lanes?'Contract routes':'Single trip'}</span>{truck.status==='BUSY'&&truck.available_again_date?<span>Ready {truck.available_again_date}</span>:null}</div>
          <div className="preview-card-actions"><Link href="/login" className="button secondary"><Eye aria-hidden="true"/>Details</Link><Link href="/login" className="button"><UserRound aria-hidden="true"/>Contact<ArrowRight aria-hidden="true"/></Link></div>
        </article>)}
        {!rows.length?<div className="empty-state"><Gauge aria-hidden="true"/><strong>No public signals right now.</strong><span>Check again soon.</span></div>:null}
      </div>
    </div>
  </div></section>;
}
