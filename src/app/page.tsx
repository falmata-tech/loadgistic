import Link from 'next/link';
import { ArrowRight, Boxes, Truck, UserRound } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { PublicBoardPreview } from '@/components/public-board-preview';
import { listAnonymousMarketplacePreview } from '@/lib/repository.js';

export const dynamic='force-dynamic';

export default function HomePage() {
  const preview=listAnonymousMarketplacePreview(3);
  return <>
    <PublicHeader/>
    <main>
      <section className="marketplace-intro">
        <div className="marketplace-intro-shade"/>
        <div className="container marketplace-intro-content">
          <span>Local products <ArrowRight aria-hidden="true"/> Ethiopian trucks</span>
          <h1>Ethiopia's road-freight marketplace.</h1>
          <p>Growing businesses find road capacity. Transporters find useful demand.</p>
        </div>
      </section>

      <PublicBoardPreview shipments={preview.shipments} trucks={preview.trucks} shared={preview.shared}/>

      <section className="public-entry-band">
        <div className="container public-entry-grid">
          <div><Boxes aria-hidden="true"/><span><strong>Need a truck?</strong><small>Move locally made goods without owning a distribution fleet.</small></span><Link className="button" href="/apply?type=ENTERPRISE_SHIPPER">Business sign up<ArrowRight aria-hidden="true"/></Link></div>
          <div><Truck aria-hidden="true"/><span><strong>Have a truck?</strong><small>Make empty and partial cargo space easier to find.</small></span><Link className="button" href="/apply?type=TRANSPORT_COMPANY">Transporter sign up<ArrowRight aria-hidden="true"/></Link></div>
        </div>
      </section>
    </main>
    <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>Shipments <ArrowRight aria-hidden="true"/> Trucks</span><Link href="/login" className="button"><UserRound aria-hidden="true"/>Log in</Link></div></footer>
  </>;
}
