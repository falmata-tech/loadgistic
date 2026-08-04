import Link from 'next/link';
import { Building2, Check, CircleDotDashed, Phone, Route, Send } from 'lucide-react';
import { priceDisplay } from '@/lib/ui';
import { StatusPill } from '@/components/status-pill';
import { VerificationBadges } from '@/components/verification-badges';
import { isPendingDirectRequest } from '@/lib/domain.js';

type Badge={type:string;verified:boolean;expired?:boolean;reviewedAt?:string|null;expiresOn?:string|null;vehicleLabel?:string|null};
type LoadBoardRecord={
  id:string;
  title:string;
  distribution_mode:string;
  commercial_status:string;
  operational_status:string;
  load_owner_name:string;
  load_owner_handle:string;
  load_type:string|null;
  movement_scope:string;
  local_place_label?:string|null;
  pickup_area_label?:string|null;
  dropoff_area_label?:string|null;
  origin:string;
  destination:string;
  pickup_date:string;
  delivery_date?:string|null;
  vehicle_category?:string|null;
  cargo_description:string;
  created_at:string;
  interested?:boolean|number;
  route_match_label?:string|null;
  route_match_score?:string|number|null;
  route_match_source?:string|null;
  route_match_platform_number?:string|null;
  load_contact_phone?:string|null;
  owner_verification_badges?:Badge[];
  owner_review_count?:number;
  owner_average_rating?:number|null;
  price_minor?:number|null;
  target_price_minor?:number|null;
  price_mode?:string|null;
};

export function LoadBoardCard({load,canNegotiate,contextLabel,returnTo='/app/loads'}:{load:LoadBoardRecord;canNegotiate:boolean;contextLabel?:string;returnTo?:string}){
  const pendingDirectRequest=isPendingDirectRequest({distributionMode:load.distribution_mode,commercialStatus:load.commercial_status,operationalStatus:load.operational_status});
  return <article className="card load-board-card" data-testid="load-board-card"><div className="load-board-layout"><div><div className="status-row">{contextLabel?<span className="status blue">{contextLabel}</span>:null}<StatusPill status={load.distribution_mode}/><span className="status">{load.load_owner_name}</span><span className="status green">{load.load_type==='FTL'?'Full Truckload (FTL)':load.load_type==='PTL'?'Partial Truckload (PTL)':'Shipment size missing'}</span><span className="status">{load.movement_scope==='LOCAL'?'Local':'Long-distance route'}</span>{load.interested?<span className="status green">Interest sent</span>:null}{load.route_match_label?<span className={`route-match match-${load.route_match_score}`}><Route aria-hidden="true"/>{load.route_match_label}{load.route_match_source?` · ${load.route_match_platform_number} ${load.route_match_source}`:''}</span>:null}</div><h3>{load.title}</h3>{load.movement_scope==='LOCAL'?<div className="route local-route"><CircleDotDashed aria-hidden="true"/><span>Local in {load.local_place_label}</span></div>:<div className="route">{load.origin}<span>→</span>{load.destination}</div>}<div className="meta">{load.movement_scope==='LOCAL'&&[load.pickup_area_label,load.dropoff_area_label].filter(Boolean).length?[load.pickup_area_label,load.dropoff_area_label].filter(Boolean).join(' → '):null}{load.movement_scope==='LOCAL'&&[load.pickup_area_label,load.dropoff_area_label].filter(Boolean).length?' · ':''}Pick up before {load.pickup_date} · Drop off before {load.delivery_date||'not set'} · {load.vehicle_category||'Vehicle discussed directly'}</div><p>{load.cargo_description}</p><VerificationBadges badges={load.owner_verification_badges} compact label="Shipment owner" reviewCount={load.owner_review_count} averageRating={load.owner_average_rating}/></div><div className="load-board-actions"><strong>{priceDisplay(load)}</strong><div className="meta">Posted {new Date(load.created_at).toLocaleString()}</div><div className="hero-actions"><Link className="button secondary icon-button-label" href={`/app/providers/${load.load_owner_handle}`}><Building2 aria-hidden="true"/>Business</Link>{load.load_contact_phone?<a className="button secondary icon-button-label" href={`tel:${load.load_contact_phone}`}><Phone aria-hidden="true"/>Call</a>:null}{canNegotiate&&pendingDirectRequest?<form action={`/api/shipments/${load.id}/accept`} method="post"><input type="hidden" name="returnTo" value={returnTo}/><button className="button icon-button-label"><Check aria-hidden="true"/>Accept</button></form>:canNegotiate&&!load.interested?<form action={`/api/shipments/${load.id}/interest`} method="post"><button className="button icon-button-label"><Send aria-hidden="true"/>Express interest</button></form>:null}</div></div></div></article>;
}
