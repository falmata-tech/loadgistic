import Link from 'next/link';
import { ArrowRight, Boxes, Factory, Gauge, Truck, UserRound } from 'lucide-react';
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
      <section className="marketplace-intro">
        <div className="marketplace-intro-shade"/>
        <div className="container marketplace-intro-content">
          <span>Welcome to Loadgistic</span>
          <h1>Road freight, connected across Ethiopia.</h1>
          <p>Loadgistic brings growing producers and established businesses together with owner-operators, drivers, and transport companies, making shipment demand and available truck capacity easier to find.</p>
        </div>
      </section>

      <PublicBoardPreview initialBoard={selectedBoard} shipments={preview.shipments} trucks={preview.trucks} shared={preview.shared}/>

      <section className="public-purpose-band">
        <div className="container public-purpose-grid">
          <div><Factory aria-hidden="true"/><span><small>For Businesses</small><strong>One place to find road capacity</strong><p>Producers, growers, artisans, and enterprises can publish freight and organize transport without owning a distribution fleet.</p></span></div>
          <div><Gauge aria-hidden="true"/><span><small>For Transporters</small><strong>Turn available space into useful work</strong><p>Owner-operators, Drivers, and fleets can make empty or partial space visible to verified Business demand.</p></span></div>
        </div>
      </section>

      <section className="public-entry-band">
        <div className="container public-entry-grid">
          <div><Boxes aria-hidden="true"/><span><strong>Need a truck?</strong><small>Move locally made goods without owning a distribution fleet.</small></span><Link className="button" href="/apply?type=ENTERPRISE_SHIPPER">Business sign up<ArrowRight aria-hidden="true"/></Link></div>
          <div><Truck aria-hidden="true"/><span><strong>Have a truck?</strong><small>Make empty and partial cargo space easier to find.</small></span><Link className="button" href="/apply?type=TRANSPORT_COMPANY">Transporter sign up<ArrowRight aria-hidden="true"/></Link></div>
        </div>
      </section>
    </main>
    <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>Shipments <ArrowRight aria-hidden="true"/> Trucks</span><Link href="/about">About</Link><Link href="/login" className="button"><UserRound aria-hidden="true"/>Log in</Link></div></footer>
  </>;
}
