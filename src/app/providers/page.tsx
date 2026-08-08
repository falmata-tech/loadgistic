import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Gauge, MapPinned, Star, Truck } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { listPublicProviders } from '@/lib/repository.js';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Transport providers',description:'Explore public transport-provider profiles, fleets, reviews, and available truck capacity.'};

export default function ProvidersPage(){
  const providers=listPublicProviders({limit:48});
  return <><PublicHeader/><main className="public-provider-directory"><section className="provider-directory-hero"><div className="container"><span className="hero-kicker"><Building2 aria-hidden="true"/>Transport provider directory</span><h1>Find the operator behind the truck.</h1><p>Review services, fleet presentation, verified-shipment feedback, public contacts, and the capacity each provider has chosen to publish.</p></div></section><section className="container provider-directory-grid">{providers.map((provider:any)=><article className="provider-directory-card" key={provider.id} style={{'--provider-primary':provider.theme_primary,'--provider-accent':provider.theme_accent} as any}><div className="provider-monogram">{provider.name.split(/\s+/).slice(0,2).map((part:string)=>part[0]).join('')}</div><div><h2>{provider.name}</h2><p>{provider.headline||'Road freight capacity and transport service'}</p></div><div className="provider-directory-facts"><span><Truck aria-hidden="true"/><strong>{provider.fleet_size}</strong> active {provider.fleet_size===1?'truck':'trucks'}</span><span><Gauge aria-hidden="true"/><strong>{provider.active_capacity_count}</strong> capacity {provider.active_capacity_count===1?'signal':'signals'}</span><span><Star aria-hidden="true"/><strong>{provider.review_count?provider.average_rating:'New'}</strong> {provider.review_count?`${provider.review_count} verified ${provider.review_count===1?'review':'reviews'}`:'No reviews yet'}</span></div><Link className="button" href={`/@${provider.handle}`}><MapPinned aria-hidden="true"/>Visit provider page</Link></article>)}</section></main></>;
}
