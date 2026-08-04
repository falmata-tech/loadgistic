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
          <span className="hero-kicker"><MapPinned aria-hidden="true"/>Built for the people who make and move Ethiopia&apos;s goods</span>
          <h1>Let the next truck carry your growth—not hold it back.</h1>
          <p>Small manufacturers, workshops, growers, and producers take the biggest risks before a product ever reaches a buyer. Loadgistic helps them find existing empty space, share Partial Truckload capacity, and connect with trucks already serving recurring lanes—locally, regionally, and across regions.</p>
          <div className="hero-actions"><Link className="button hero-primary" href="/apply?type=ENTERPRISE_SHIPPER">Find truck capacity<ArrowRight aria-hidden="true"/></Link><Link className="button hero-secondary" href="/apply?type=TRANSPORT_COMPANY">Publish a truck<Truck aria-hidden="true"/></Link></div>
          <div className="hero-trust-line"><span>Public and partner-only Boards</span><span>Full or shared cargo space</span><span>Evidence-specific verification badges</span></div>
        </div>
      </section>

      <section className="producer-strip"><div className="container producer-type-grid"><div className="producer-type"><Factory aria-hidden="true"/><span><strong>Manufacturers</strong><small>Move inputs and finished goods.</small></span></div><div className="producer-type"><Hammer aria-hidden="true"/><span><strong>Workshops</strong><small>Reach customers beyond one neighborhood.</small></span></div><div className="producer-type"><Leaf aria-hidden="true"/><span><strong>Growers</strong><small>Find capacity when goods are ready.</small></span></div><div className="producer-type"><Warehouse aria-hidden="true"/><span><strong>Producers</strong><small>Coordinate local and regional freight.</small></span></div></div></section>

      <PublicBoardPreview initialBoard={selectedBoard} shipments={preview.shipments} trucks={preview.trucks} shared={preview.shared}/>

      <section className="section production-value-section"><div className="container value-band-grid"><div className="value-band-copy"><span className="section-kicker">Capacity before more cost</span><h2>See what is already moving in your market.</h2><p className="lede">A full truck is not the only answer. Businesses can compare empty trucks, Partial Truckload space, Local availability, planned routes, and recurring lanes, then coordinate price and physical fit directly.</p></div><div className="landing-icon-list"><div><Boxes aria-hidden="true"/><span><strong>Share cargo space</strong><small>Post PTL demand and find trucks accepting partial cargo.</small></span></div><div><Route aria-hidden="true"/><span><strong>Follow active lanes</strong><small>Compare your route with declared truck movement.</small></span></div><div><Gauge aria-hidden="true"/><span><strong>Use visible capacity</strong><small>Find Empty, Partial, or available-soon truck signals.</small></span></div><div><ShieldCheck aria-hidden="true"/><span><strong>Check the evidence</strong><small>Inspect specific badges and confirm documents yourself.</small></span></div></div></div></section>

      <section className="public-purpose-band"><div className="container public-purpose-grid"><div><Factory aria-hidden="true"/><span><small>For Businesses</small><strong>Trade farther without building a fleet first</strong><p>Organize freight demand, compare truck capacity, make an agreement, and track the work in one record.</p></span></div><div><Truck aria-hidden="true"/><span><small>For Transport Providers</small><strong>Make real capacity easier to discover</strong><p>Owner-operators, small fleets, and authorized self-managed Drivers can publish empty or partial space and the routes they want to serve.</p></span></div></div></section>
      <section className="public-entry-band">
        <div className="container public-entry-grid">
          <div><Boxes aria-hidden="true"/><span><strong>Need a truck?</strong><small>Move locally made goods without owning a distribution fleet.</small></span><Link className="button" href="/apply?type=ENTERPRISE_SHIPPER">Business sign up<ArrowRight aria-hidden="true"/></Link></div>
          <div><Truck aria-hidden="true"/><span><strong>Have a truck?</strong><small>Make empty and partial cargo space easier to find.</small></span><Link className="button" href="/apply?type=TRANSPORT_COMPANY">Transporter sign up<ArrowRight aria-hidden="true"/></Link></div>
        </div>
      </section>
    </main>
    <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>More local goods reaching more markets with capacity already on the road.</span><Link href="/about">Our purpose</Link><Link href="/login" className="button"><UserRound aria-hidden="true"/>Log in</Link></div></footer>
  </>;
}
