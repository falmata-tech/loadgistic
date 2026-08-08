import type { Metadata } from 'next';
import { Filter, Gauge, Route, Search, ShieldCheck } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { PublicCapacityFeed } from '@/components/public-capacity-feed';
import { listPublicCapacityCursor } from '@/lib/repository.js';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Available truck capacity',description:'Browse current truck capacity, next trips, recurring routes, and permanent working areas without creating an account.'};

export default async function CapacityPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const raw=await searchParams;
  const query={q:raw.q||'',status:raw.status||'',geometry:raw.geometry||''};
  const initial=listPublicCapacityCursor(query,{pageSize:14});
  return <><PublicHeader/><main className="public-capacity-page"><section className="public-capacity-intro"><div className="container"><span className="hero-kicker"><Gauge aria-hidden="true"/>Public capacity market</span><h1>See who has space before you make the call.</h1><p>Browse current truck availability, planned next trips, recurring routes, and permanent working areas. No capacity-seeker account is required.</p><div className="verification-reminder hero-warning"><ShieldCheck aria-hidden="true"/><span>Badges and profiles help with due diligence; always confirm current documents, authority, cargo fit, price, and terms yourself.</span></div></div></section><section className="container public-capacity-body"><form className="public-capacity-filters" action="/capacity"><label><Search aria-hidden="true"/><span>Search</span><input name="q" defaultValue={query.q} placeholder="Provider, truck, or cargo body"/></label><label><Gauge aria-hidden="true"/><span>Availability</span><select name="status" defaultValue={query.status}><option value="">Empty or Partial</option><option value="EMPTY">Empty</option><option value="PARTIAL">Partial</option></select></label><label><Route aria-hidden="true"/><span>Available by</span><select name="geometry" defaultValue={query.geometry}><option value="">Radius or route</option><option value="RADIUS">Current radius</option><option value="ROUTE">Specific route</option></select></label><button className="button"><Filter aria-hidden="true"/>Apply filters</button></form><PublicCapacityFeed initial={initial} query={query}/></section></main></>;
}
