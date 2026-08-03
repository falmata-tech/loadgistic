"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Banknote, Boxes, CalendarClock, CircleDotDashed, Clock3, Eye, Gauge, Layers3, MapPin, MapPinned, Route, Truck, UserRound, Waypoints } from 'lucide-react';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';

type ShipmentPreview={movement_scope:string;origin?:string|null;destination?:string|null;local_place_label?:string|null;pickup_area_label?:string|null;dropoff_area_label?:string|null;load_type?:string|null;vehicle_category?:string|null;pickup_label?:string|null;delivery_label?:string|null;price_mode?:string|null;price_minor?:number|null;distribution_mode?:string|null;posted_label?:string|null};
type TruckPreview={status:string;available_percent?:number|null;available_again_date?:string|null;available_again_place_label?:string|null;movement_scope?:string|null;local_place_label?:string|null;local_radius_km?:number|null;location_area?:string|null;location_precision_km?:number|null;current_route_origin?:string|null;current_route_destination?:string|null;origin?:string|null;destination?:string|null;travel_date?:string|null;planned_space_status?:string|null;cargo_configuration?:string|null;accepts_full_load:boolean;accepts_partial_load:boolean;accepts_multi_pick:boolean;accepts_multi_drop:boolean;open_to_contract_lanes:boolean;proof_available:boolean;freshness?:string|null;updated_label?:string|null};
type SharedPreview={pool:{member_count:number;origin:string|null;destination:string|null;origin_spread_km:number;destination_spread_km:number;earliest_pickup:string|null;latest_delivery:string|null}|null;along:{member_count:number;origin:string|null;destination:string|null;loaded_distance_km:number;connector_distance_km:number;stops:{origin:string|null;destination:string|null}[]}|null};
type PublicBoard='SHIPMENTS'|'TRUCKS';

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

function capacityStatus(status:string){
  return status.charAt(0)+status.slice(1).toLowerCase().replaceAll('_',' ');
}

function truckRoute(truck:TruckPreview){
  if(truck.status==='PARTIAL'&&truck.current_route_origin)return `${truck.current_route_origin} → ${truck.current_route_destination}`;
  if(truck.origin)return `${truck.origin} → ${truck.destination}`;
  if(truck.movement_scope==='LOCAL')return `Local in ${truck.local_place_label||truck.location_area||'selected city'}`;
  if(truck.movement_scope==='BOTH'&&truck.local_place_label)return `Local + long-distance · ${truck.local_place_label}`;
  return truck.status==='EMPTY'?'Willing to go anywhere':'Route not specified';
}

export function PublicBoardPreview({initialBoard,shipments,trucks,shared}:{initialBoard:PublicBoard;shipments:ShipmentPreview[];trucks:TruckPreview[];shared:SharedPreview}){
  const router=useRouter();
  const [active,setActive]:[PublicBoard,(value:PublicBoard)=>void]=React.useState(initialBoard);
  React.useEffect(()=>setActive(initialBoard),[initialBoard]);
  React.useEffect(()=>{
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')router.refresh();},60000);
    return()=>window.clearInterval(timer);
  },[router]);
  const selectBoard=(board:PublicBoard)=>{
    setActive(board);
    router.push(`/?board=${board}#marketplace-preview-title`);
  };
  const rows=active==='SHIPMENTS'?shipments:trucks;
  return <section className="public-board-section" aria-labelledby="marketplace-preview-title"><div className="container">
    <div className="public-board-heading"><div><span className="eyebrow"><Eye aria-hidden="true"/>Live marketplace</span><h2 id="marketplace-preview-title">Shipments meet available trucks.</h2></div></div>
    <div className="public-board-shell">
      <div className="public-board-tabs" role="tablist" aria-label="Marketplace boards">
        <button type="button" role="tab" aria-controls="marketplace-preview-panel" aria-selected={active==='SHIPMENTS'} className={active==='SHIPMENTS'?'active':''} onClick={()=>selectBoard('SHIPMENTS')}><Boxes aria-hidden="true"/><span>Shipment Board</span></button>
        <button type="button" role="tab" aria-controls="marketplace-preview-panel" aria-selected={active==='TRUCKS'} className={active==='TRUCKS'?'active':''} onClick={()=>selectBoard('TRUCKS')}><Truck aria-hidden="true"/><span>Truck Board</span></button>
      </div>
      <div className="public-board-list" id="marketplace-preview-panel" role="tabpanel">
        {active==='SHIPMENTS'?<>
          {shared.pool||shared.along?<div className="public-shared-matches">
            {shared.pool?<article><Layers3 aria-hidden="true"/><div><span className="status green">Pool together</span><h3>{shared.pool.member_count} Partial Truckload shipments</h3><p>{shared.pool.origin} <ArrowRight aria-hidden="true"/> {shared.pool.destination}</p><small><CircleDotDashed aria-hidden="true"/> Origins within {shared.pool.origin_spread_km} km · destinations within {shared.pool.destination_spread_km} km</small></div><Link href="/login" className="button secondary"><Eye aria-hidden="true"/>View</Link></article>:null}
            {shared.along?<article><MapPinned aria-hidden="true"/><div><span className="status blue">Along the route</span><h3>{shared.along.member_count} shipments in travel order</h3><p>{shared.along.origin} <ArrowRight aria-hidden="true"/> {shared.along.destination}</p><small><Route aria-hidden="true"/> {shared.along.loaded_distance_km} km carrying shipments · {shared.along.connector_distance_km} km between work</small></div><Link href="/login" className="button secondary"><Eye aria-hidden="true"/>View</Link></article>:null}
          </div>:null}
          {(shipments as ShipmentPreview[]).map((shipment,index)=><article className="locked-board-card rich-preview-card" key={index}>
          <div className="preview-card-main"><div className="preview-card-title"><span className="status green">{shipment.load_type||'Freight'}</span><h3>{shipment.vehicle_category||'Road-freight shipment'}</h3></div><p className="preview-route"><Waypoints aria-hidden="true"/>{shipmentRoute(shipment)}</p></div>
          <div className="locked-card-facts"><div><Truck aria-hidden="true"/><span><small>Truck needed</small><strong>{shipment.vehicle_category||'Discuss directly'}</strong></span></div><div><CalendarClock aria-hidden="true"/><span><small>Pick up before</small><strong>{shipment.pickup_label||'Date open'}</strong></span></div><div><Clock3 aria-hidden="true"/><span><small>Drop off before</small><strong>{shipment.delivery_label||'Date open'}</strong></span></div><div><Banknote aria-hidden="true"/><span><small>Price</small><strong>{priceLabel(shipment)}</strong></span></div></div>
          <div className="preview-tags"><span>{shipment.movement_scope==='LOCAL'?'Local':'Long-distance route'}</span><span>{shipment.distribution_mode==='OPEN_MARKET'?'Public':'Limited'}</span><span>Posted {shipment.posted_label||'recently'}</span></div>
          <div className="preview-card-actions"><Link href="/login" className="button secondary"><Eye aria-hidden="true"/>Details</Link><Link href="/login" className="button"><UserRound aria-hidden="true"/>Contact<ArrowRight aria-hidden="true"/></Link></div>
        </article>)}</>:(trucks as TruckPreview[]).map((truck,index)=><article className="locked-board-card rich-preview-card" key={index}>
          <div className="preview-card-main truck-preview-main"><Image className="truck-thumbnail large" src={vehicleConfigurationImage(truck.cargo_configuration)} alt={truck.cargo_configuration||'Truck configuration'} width={120} height={120}/><div><div className="preview-card-title"><span className="status green">{capacityStatus(truck.status)}{truck.status!=='BUSY'?` · ${truck.available_percent||0}%`:''}</span><h3>{truck.cargo_configuration||'Available truck'}</h3></div><p className="preview-route"><Route aria-hidden="true"/>{truckRoute(truck)}</p></div></div>
          <div className="locked-card-facts"><div><MapPin aria-hidden="true"/><span><small>Current area</small><strong>{truck.location_area||truck.local_place_label||'Area not set'}</strong></span></div><div><Boxes aria-hidden="true"/><span><small>Shipment size</small><strong>{acceptedLoads(truck)}</strong></span></div><div><Route aria-hidden="true"/><span><small>Stops</small><strong>{stopPolicy(truck)}</strong></span></div><div><Clock3 aria-hidden="true"/><span><small>Updated</small><strong>{truck.updated_label||truck.freshness||'Recently updated'}</strong></span></div></div>
          <div className="preview-tags"><span>{truck.movement_scope==='BOTH'?'Local + long-distance':truck.movement_scope==='LOCAL'?'Local':'Long-distance route'}</span><span>{truck.proof_available?'Photo recorded':'No photo'}</span><span>{truck.open_to_contract_lanes?'Contract routes':'Single trip'}</span>{truck.status==='BUSY'&&truck.available_again_place_label?<span>Available near {truck.available_again_place_label}</span>:null}{truck.status==='BUSY'&&truck.available_again_date?<span>Ready {truck.available_again_date}</span>:null}</div>
          <div className="preview-card-actions"><Link href="/login" className="button secondary"><Eye aria-hidden="true"/>Details</Link><Link href="/login" className="button"><UserRound aria-hidden="true"/>Contact<ArrowRight aria-hidden="true"/></Link></div>
        </article>)}
        {!rows.length?<div className="empty-state"><Gauge aria-hidden="true"/><strong>No listings right now.</strong><span>Check again soon.</span></div>:null}
      </div>
    </div>
  </div></section>;
}
