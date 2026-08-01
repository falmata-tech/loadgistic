import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getNetworkState, listDirectoryProfiles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { VerificationBadges } from '@/components/verification-badges';
import { Building2, CircleDotDashed, Eye, MapPin, Search, Send, Star, Truck, UserRound, Users } from 'lucide-react';
import { NetworkActions } from '@/components/network-actions';
import { Pagination } from '@/components/pagination';
import { EthiopiaPlaceInput } from '@/components/ethiopia-place-input';
import { BoardFilterSheet } from '@/components/board-filter-sheet';

export default async function ProvidersPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  const query=await searchParams;
  const type=query.type||'ALL';
  const search=String(query.q||'').trim();
  const hasSearch=search.length>0;
  const locationFilters={nearPlaceRef:query.nearPlaceRef||'',nearPlace:query.nearPlace||'',nearRadiusKm:query.nearRadiusKm||'50'};
  const directory:any=hasSearch
    ? listDirectoryProfiles(type,{q:search,...locationFilters,page:query.page,pageSize:7})
    : {items:[],total:0,page:1,pageSize:7,pageCount:1};
  const profiles:any[]=directory.items;
  const preserved={q:search,...locationFilters};
  const typeHref=(value:string)=>`/app/providers?${new URLSearchParams({type:value,...preserved}).toString()}`;
  const returnTo=`/app/providers?${new URLSearchParams({type,...preserved,page:String(directory.page)}).toString()}`;
  const clearHref=`/app/providers?type=${type}`;
  const activeFilters=locationFilters.nearPlaceRef?[{label:`Near ${locationFilters.nearPlace||'selected place'} · ${locationFilters.nearRadiusKm} km`,href:clearHref}]:[];

  return <div className="page">
    <PageHeader icon={Users} title="Directory" subtitle="Businesses and transporters."/>
    <Flash error={query.error} success={query.success}/>
    <div className="directory-filters">{[['ALL','All',Users],['BUSINESS','Businesses',Building2],['TRANSPORT','Fleet Transporters',Truck],['DRIVER','Self-managed Drivers',UserRound]].map(([value,label,Icon]:any)=><Link className={`button ${type===value?'':'secondary'} icon-button-label`} href={typeHref(value)} key={value}><Icon aria-hidden="true"/>{label}</Link>)}</div>
    <BoardFilterSheet
      title="Search the Directory"
      description="Results appear only after you search. Nearby matching uses a real place and radius."
      applyLabel="Search"
      clearHref={clearHref}
      resultLabel={hasSearch?`${directory.total} ${directory.total===1?'profile':'profiles'}`:'Search to see profiles'}
      activeFilters={activeFilters}
      search={{id:'directory-search',value:search,placeholder:'Name, company, owner, or public phone',hiddenFields:{type,...locationFilters}}}
    >
      <input type="hidden" name="type" value={type}/>
      <div className="board-filter-grid">
        <div className="form-group"><label htmlFor="directory-place"><MapPin aria-hidden="true"/>Near city or town</label><EthiopiaPlaceInput id="directory-place" name="nearPlace" placeRefName="nearPlaceRef" defaultPlaceRef={locationFilters.nearPlaceRef} defaultValue={locationFilters.nearPlace} placeholder="Addis Ababa, Ethiopia"/></div>
        <div className="form-group"><label htmlFor="directory-radius"><CircleDotDashed aria-hidden="true"/>Within</label><select id="directory-radius" name="nearRadiusKm" defaultValue={locationFilters.nearRadiusKm}><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option><option value="200">200 km</option></select></div>
      </div>
    </BoardFilterSheet>

    {!hasSearch?<div className="empty-state directory-search-empty"><Search aria-hidden="true"/><strong>Find a Business or transporter</strong><span>Search by name, company, owner, or public phone.</span></div>:null}
    <div className="directory-grid">{profiles.map((profile:any)=><article className="card directory-card" key={`${profile.ref_kind}-${profile.id}`}>
      <div className="directory-card-top"><span className="status">{profile.is_business?'BUSINESS':profile.type.replaceAll('_',' ')}</span>{profile.verified?<StatusPill status="Approved"/>:null}</div>
      <div className="directory-identity"><div className="company-logo small">{profile.name.split(' ').slice(0,2).map((word:string)=>word[0]).join('')}</div><div><h3>{profile.name}</h3><div className="meta icon-meta"><MapPin aria-hidden="true"/>{profile.city||'Location not added'}{Number.isFinite(profile.location_distance_km)?` · ${Math.round(profile.location_distance_km)} km away`:''}</div></div></div>
      <VerificationBadges badges={profile.verification_badges} compact/>
      <p className="muted directory-about">{profile.about||profile.headline||'Profile information is being completed.'}</p>
      {profile.operating_regions?<p className="directory-regions"><MapPin aria-hidden="true"/><span><strong>{profile.is_business?'Operating areas':'Service areas'}</strong>{profile.operating_regions}</span></p>:null}
      {profile.is_business?<div className="provider-facts"><div><span><Star aria-hidden="true"/>Rating</span><strong>{profile.review_count?`${profile.average_rating} / 5`:'New'}</strong></div><div><span>Reviews</span><strong>{profile.review_count||0}</strong></div></div>:<><p><strong><MapPin aria-hidden="true"/> Preferred Routes</strong><br/>{profile.preferred_routes_text||'Not added'}</p><div className="provider-facts"><div><span>Trucks</span><strong>{profile.fleet_size}</strong></div><div><span>Available</span><strong>{profile.active_capacity_count}</strong></div></div></>}
      <div className="hero-actions"><Link href={`/app/providers/${profile.handle}`} className="button secondary"><Eye aria-hidden="true"/>Profile</Link>{!profile.is_business&&['SHIPPER','RECEIVER'].includes(user.role)?<Link href={`/app/shipments/new?provider=${profile.ref_kind}:${profile.id}`} className="button"><Send aria-hidden="true"/>Request</Link>:null}</div>
      <NetworkActions state={getNetworkState(user,profile.ref_kind,profile.id)} targetKind={profile.ref_kind} targetId={profile.id} returnTo={returnTo}/>
    </article>)}</div>
    {hasSearch&&!profiles.length?<div className="empty-state"><Search aria-hidden="true"/><strong>No matches.</strong><span>Change the name, phone, or location.</span></div>:null}
    {hasSearch?<Pagination path="/app/providers" query={{type,...preserved}} page={directory.page} pageCount={directory.pageCount} total={directory.total}/>:null}
  </div>;
}
