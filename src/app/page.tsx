import Link from 'next/link';
import { ArrowRight, Boxes, Factory, Gauge, Hammer, Leaf, MapPinned, Route, ShieldCheck, Truck, UserRound, Warehouse } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { PublicBoardPreview } from '@/components/public-board-preview';
import { listAnonymousMarketplacePreview } from '@/lib/repository.js';

export const dynamic='force-dynamic';

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const query=await searchParams;
  const selectedBoard=query.board==='TRUCKS'?'TRUCKS':'SHIPMENTS';
  const preview=listAnonymousMarketplacePreview(3);
  return <>
    <PublicHeader/>
    <main>
      <section className="producer-hero">
        <div className="producer-hero-shade"/>
        <div className="container producer-hero-content">
          <span className="hero-kicker"><MapPinned aria-hidden="true"/>Road freight capacity for Ethiopian businesses</span>
          <h1>Move goods farther with capacity already on the road.</h1>
          <p>Loadgistic brings shipment demand and available trucks into one B2B marketplace. Manufacturers, workshops, growers, and producers can compare empty trucks, Partial Truckload space, and recurring routes. Owner-operators and small fleets can publish legitimate capacity where businesses can find it.</p>
          <div className="hero-actions"><Link className="button hero-primary" href="/apply?type=ENTERPRISE_SHIPPER">Find truck capacity<ArrowRight aria-hidden="true"/></Link><Link className="button hero-secondary" href="/apply?type=TRANSPORT_COMPANY">Publish a truck<Truck aria-hidden="true"/></Link></div>
          <div className="hero-trust-line"><span>Live capacity signals</span><span>Full and shared truck space</span><span>Document-specific verification</span></div>
        </div>
      </section>

      <section className="producer-strip"><div className="container producer-type-grid"><div className="producer-type"><Factory aria-hidden="true"/><span><strong>Manufacturers</strong><small>Source inputs and deliver finished goods.</small></span></div><div className="producer-type"><Hammer aria-hidden="true"/><span><strong>Workshops</strong><small>Serve customers beyond the local market.</small></span></div><div className="producer-type"><Leaf aria-hidden="true"/><span><strong>Growers</strong><small>Coordinate harvest and delivery windows.</small></span></div><div className="producer-type"><Warehouse aria-hidden="true"/><span><strong>Producers</strong><small>Plan local and regional distribution.</small></span></div></div></section>

      <PublicBoardPreview initialBoard={selectedBoard} shipments={preview.shipments} trucks={preview.trucks} shared={preview.shared}/>

      <section className="section production-value-section"><div className="container value-band-grid"><div className="value-band-copy"><span className="section-kicker">A clearer capacity market</span><h2>Compare shipment demand with current truck availability.</h2><p className="lede">Post a shipment or publish a truck, review compatible capacity and routes, then confirm price, cargo fit, and operating terms directly with the other party.</p></div><div className="landing-icon-list"><div><Boxes aria-hidden="true"/><span><strong>Use shared capacity</strong><small>Match Partial Truckload demand with available cargo space.</small></span></div><div><Route aria-hidden="true"/><span><strong>Compare routes</strong><small>Review current movement, planned trips, and recurring lanes.</small></span></div><div><Gauge aria-hidden="true"/><span><strong>Check availability</strong><small>See Empty, Partial, and available-soon truck signals.</small></span></div><div><ShieldCheck aria-hidden="true"/><span><strong>Review evidence</strong><small>Inspect verification categories and confirm original documents.</small></span></div></div></div></section>

      <section className="public-purpose-band"><div className="container public-purpose-grid"><div><Factory aria-hidden="true"/><span><small>For Businesses</small><strong>Expand distribution without maintaining a private fleet</strong><p>Publish freight requirements, compare truck capacity, record an agreement, and track execution in one place.</p></span></div><div><Truck aria-hidden="true"/><span><small>For Transport Providers</small><strong>Present available capacity to credible B2B demand</strong><p>Owner-operators, small fleets, and authorized self-managed Drivers can publish current space and preferred routes.</p></span></div></div></section>
      <section className="public-entry-band">
        <div className="container public-entry-grid">
          <div><Boxes aria-hidden="true"/><span><strong>Need road capacity?</strong><small>Publish a shipment and compare available trucks.</small></span><Link className="button" href="/apply?type=ENTERPRISE_SHIPPER">Business sign up<ArrowRight aria-hidden="true"/></Link></div>
          <div><Truck aria-hidden="true"/><span><strong>Operate a truck or fleet?</strong><small>Publish available space and the routes you serve.</small></span><Link className="button" href="/apply?type=TRANSPORT_COMPANY">Transporter sign up<ArrowRight aria-hidden="true"/></Link></div>
        </div>
      </section>
    </main>
    <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>B2B road-freight discovery, agreement, and tracking for Ethiopia.</span><Link href="/about">About Loadgistic</Link><Link href="/login" className="button"><UserRound aria-hidden="true"/>Log in</Link></div></footer>
  </>;
}
