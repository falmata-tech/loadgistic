import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getNetworkState, listDirectoryProfiles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { VerificationBadges } from '@/components/verification-badges';
import { Building2, CircleDotDashed, CirclePlus, Eye, MapPin, Search, Send, Star, Truck, UserRound, Users } from 'lucide-react';
import { NetworkActions } from '@/components/network-actions';
import { Pagination } from '@/components/pagination';
import { EthiopiaPlaceInput } from '@/components/ethiopia-place-input';
import { BoardFilterSheet } from '@/components/board-filter-sheet';

export default async function ProvidersPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser();
 const query=await searchParams;
 const type=query.type||'ALL';
 const search=String(query.q||'').trim();
 const locationFilters={
   nearPlaceRef:query.nearPlaceRef||'',
   nearPlace:query.nearPlace||'',
   nearRadiusKm:query.nearRadiusKm||'50'
 };
 const directory:any=listDirectoryProfiles(type,{q:search,...locationFilters,page:query.page,pageSize:18});
 const profiles:any[]=directory.items;
 const preserved={q:search,...locationFilters};
 const typeHref=(value:string)=>`/app/providers?${new URLSearchParams({type:value,...preserved}).toString()}`;
 const returnTo=`/app/providers?${new URLSearchParams({type,...preserved,page:String(directory.page)}).toString()}`;
 const clearHref=`/app/providers?type=${type}`;
 const activeFilters=locationFilters.nearPlaceRef?[{
   label:`Near ${locationFilters.nearPlace||'selected place'} · ${locationFilters.nearRadiusKm} km`,
   href:clearHref
 }]:[];
 return <div className="page"><PageHeader icon={Users} title="Directory" subtitle="Businesses and transporters."/><Flash error={query.error} success={query.success}/>
 <div className="directory-filters">{[['ALL','All',Users],['BUSINESS','Businesses',Building2],['TRANSPORT','Fleet Transporters',Truck],['DRIVER','Self-managed Drivers',UserRound]].map(([v,l,Icon]:any)=><Link className={`button ${type===v?'':'secondary'} icon-button-label`} href={typeHref(v)} key={v}><Icon aria-hidden="true"/>{l}</Link>)}</div>
 <BoardFilterSheet
   title="Filter the Directory"
   description="Use a real place and radius for nearby matches."
   applyLabel="Show profiles"
   clearHref={clearHref}
   resultLabel={`${directory.total} ${directory.total===1?'profile':'profiles'}`}
   activeFilters={activeFilters}
   search={{
     id:'directory-search',
     value:search,
     placeholder:'Business, owner, product, or service',
     hiddenFields:{type,...locationFilters}
   }}
 >
   <input type="hidden" name="type" value={type}/>
   <div className="board-filter-grid">
     <div className="form-group"><label htmlFor="directory-place"><MapPin aria-hidden="true"/>Near city or town</label><EthiopiaPlaceInput id="directory-place" name="nearPlace" placeRefName="nearPlaceRef" defaultPlaceRef={locationFilters.nearPlaceRef} defaultValue={locationFilters.nearPlace} placeholder="Addis Ababa, Ethiopia"/></div>
     <div className="form-group"><label htmlFor="directory-radius"><CircleDotDashed aria-hidden="true"/>Within</label><select id="directory-radius" name="nearRadiusKm" defaultValue={locationFilters.nearRadiusKm}><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option><option value="200">200 km</option></select></div>
   </div>
 </BoardFilterSheet>
 <div className="directory-grid">{profiles.map((p:any)=><article className="card directory-card" key={`${p.ref_kind}-${p.id}`}><div className="directory-card-top"><span className="status">{p.is_business?'BUSINESS':p.type.replaceAll('_',' ')}</span>{p.verified?<StatusPill status="Approved"/>:null}</div><div className="directory-identity"><div className="company-logo small">{p.name.split(' ').slice(0,2).map((word:string)=>word[0]).join('')}</div><div><h3>{p.name}</h3><div className="meta icon-meta"><MapPin aria-hidden="true"/>{p.city||'Location not added'}{Number.isFinite(p.location_distance_km)?` · ${Math.round(p.location_distance_km)} km away`:''}</div></div></div><VerificationBadges badges={p.verification_badges} compact/><p className="muted directory-about">{p.about||p.headline||'Profile information is being completed.'}</p>{p.operating_regions?<p className="directory-regions"><MapPin aria-hidden="true"/><span><strong>{p.is_business?'Operating areas':'Service areas'}</strong>{p.operating_regions}</span></p>:null}{p.is_business?<div className="provider-facts"><div><span><Star aria-hidden="true"/>Rating</span><strong>{p.review_count?`${p.average_rating} / 5`:'New'}</strong></div><div><span>Reviews</span><strong>{p.review_count||0}</strong></div></div>:<><p><strong><MapPin aria-hidden="true"/> Preferred Routes</strong><br/>{p.preferred_routes_text||'Not added'}</p><div className="provider-facts"><div><span>Trucks</span><strong>{p.fleet_size}</strong></div><div><span>Available</span><strong>{p.active_capacity_count}</strong></div></div></>}<div className="hero-actions"><Link href={`/app/providers/${p.handle}`} className="button secondary"><Eye aria-hidden="true"/>Profile</Link>{p.is_business&&['SHIPPER','RECEIVER'].includes(user.role)&&p.id!==user.organization_id?<Link href={`/app/shipments/new?receiver=${p.id}`} className="button"><CirclePlus aria-hidden="true"/>Create shipment</Link>:!p.is_business&&['SHIPPER','RECEIVER'].includes(user.role)?<Link href={`/app/shipments/new?provider=${p.ref_kind}:${p.id}`} className="button"><Send aria-hidden="true"/>Request</Link>:null}</div><NetworkActions state={getNetworkState(user,p.ref_kind,p.id)} targetKind={p.ref_kind} targetId={p.id} returnTo={returnTo}/></article>)}</div>{!profiles.length?<div className="empty-state"><Search aria-hidden="true"/><strong>No matches.</strong><span>Change the search or place.</span></div>:null}<Pagination path="/app/providers" query={{type,...preserved}} page={directory.page} pageCount={directory.pageCount} total={directory.total}/></div>;
}
