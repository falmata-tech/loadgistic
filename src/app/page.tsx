import Link from 'next/link';
import { Boxes, CirclePlus, Factory, Gauge, Route, ShieldCheck, Truck } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { PublicCapacityFeed } from '@/components/public-capacity-feed';
import { listPublicCapacityCursor } from '@/lib/repository.js';

export const dynamic='force-dynamic';

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const raw=await searchParams;
  const query={q:raw.q||'',status:raw.status||'',geometry:raw.geometry||''};
  const initial=listPublicCapacityCursor(query,{pageSize:14});
  return <><PublicHeader/><main className="public-capacity-page">
    <section className="public-capacity-intro"><div className="container"><span className="hero-kicker"><Gauge aria-hidden="true"/>Freight capacity near you</span><h1>Find a truck already moving your way.</h1><p>Explore available trucks by current radius or corridor, check regular corridors, and contact the provider directly. No account required.</p><div className="verification-reminder hero-warning"><ShieldCheck aria-hidden="true"/><span>Review each provider&apos;s profile and confirm current documents, authority, cargo fit, price, and terms before you agree.</span></div></div></section>
    <section id="capacity-market" className="container public-capacity-body"><PublicCapacityFeed key={`${query.q}|${query.status}|${query.geometry}`} initial={initial} query={query}/></section>
    <section className="production-value-section"><div className="container value-band-grid"><div className="value-band-copy"><span className="section-kicker">Why this market matters</span><h2>More local trade from trucks already on the road.</h2><p className="lede">A truck with unused space or an empty return may offer a more affordable way to move goods. Loadgistic helps small producers find that space. Customers and providers still agree on price, cargo fit, documents, and timing directly.</p></div><div className="landing-icon-list"><div><Boxes aria-hidden="true"/><span><strong>Use partial cargo space</strong><small>Ask whether your goods can share space on a truck.</small></span></div><div><Route aria-hidden="true"/><span><strong>Follow regular corridors</strong><small>Find providers who often serve the corridor you need.</small></span></div><div><Factory aria-hidden="true"/><span><strong>Support local businesses</strong><small>Help workshops, growers, producers, and small manufacturers reach more markets.</small></span></div><div><ShieldCheck aria-hidden="true"/><span><strong>Check before agreeing</strong><small>Badges show reviewed documents. Always check current originals yourself.</small></span></div></div></div></section>
    <section className="public-purpose-band"><div className="container public-purpose-grid"><div><Factory aria-hidden="true"/><span><small>Shipping freight</small><strong>See nearby options before you call</strong><p>Compare available space, routes, provider credentials, and contact options without creating an account.</p></span></div><div><Truck aria-hidden="true"/><span><small>Transport providers</small><strong>Put every available truck to work</strong><p>Publish capacity, present your transport business professionally, and keep customers informed after an agreement.</p><Link href="/apply" className="button"><CirclePlus aria-hidden="true"/>Join as a provider</Link></span></div></div></section>
  </main><footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>Find available road-freight capacity and follow agreed shipments across Ethiopia.</span><Link href="/about">About</Link><Link href="/providers">Providers</Link><Link href="/track">Track shipment</Link></div></footer></>;
}
