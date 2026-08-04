import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Boxes, Factory, Gauge, Route, ShieldCheck, Truck, UserRound } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';

export const metadata:Metadata={
  title:'About',
  description:'How Loadgistic helps Ethiopian Businesses and transport providers coordinate road freight and use truck capacity more effectively.'
};

export default function AboutPage(){
  return <>
    <PublicHeader/>
    <main>
      <section className="about-hero">
        <div className="about-hero-shade"/>
        <div className="container about-hero-copy"><span>Road freight coordination for Ethiopia</span><h1>The people making goods should not be stranded by the space between markets.</h1><p>Loadgistic exists to help local production meet road capacity already available nearby or moving in the right direction.</p></div>
      </section>

      <section className="about-purpose-band">
        <div className="container about-purpose-layout">
          <div><span className="section-kicker">Why it exists</span><h2>Production takes courage. Reaching a buyer should not require owning a fleet.</h2></div>
          <p>Small manufacturers, workshops, growers, processors, and producers carry the cost and uncertainty of making something before it sells. Road logistics can narrow where they trade and make a promising order harder to serve. Meanwhile, owner-operators, small transport companies, and authorized self-managed Drivers may already have empty space, Partial capacity, or a recurring lane that fits. Loadgistic makes those signals easier to find and gives both sides a governed record for agreement and tracking.</p>
        </div>
      </section>

      <section className="about-work-band">
        <div className="container about-work-grid">
          <div><Factory aria-hidden="true"/><span><strong>Businesses publish shipments</strong><p>Structured routes, deadlines, truck needs, and visibility make demand clear.</p></span></div>
          <ArrowRight className="about-flow-arrow" aria-hidden="true"/>
          <div><Truck aria-hidden="true"/><span><strong>Transport providers publish trucks</strong><p>Current area, cargo space, route, freshness, and work preferences describe supply.</p></span></div>
          <ArrowRight className="about-flow-arrow" aria-hidden="true"/>
          <div><Route aria-hidden="true"/><span><strong>Both sides compare fit</strong><p>Coordinate-based route and Local-area matching supports a practical decision.</p></span></div>
        </div>
      </section>

      <section className="about-principles-band">
        <div className="container about-principles-grid">
          <div><Gauge aria-hidden="true"/><strong>Use what already moves</strong><p>Make Empty and Partial capacity visible before assuming another dedicated truck is needed.</p></div>
          <div><Boxes aria-hidden="true"/><strong>Share without losing the record</strong><p>Keep each shipment, agreement, assignment, and tracking history distinct even when cargo space is shared.</p></div>
          <div><ShieldCheck aria-hidden="true"/><strong>Evidence, then judgment</strong><p>Badges confirm only reviewed document categories. Every party must still check identity, authority, fit, and terms directly.</p></div>
        </div>
      </section>

      <section className="about-cta-band"><div className="container"><div><strong>Need road capacity?</strong><span>Publish a shipment for your Business.</span><Link className="button" href="/apply?type=ENTERPRISE_SHIPPER">Business sign up<ArrowRight aria-hidden="true"/></Link></div><div><strong>Have truck capacity?</strong><span>Connect your truck or fleet with demand.</span><Link className="button" href="/apply?type=TRANSPORT_COMPANY">Transporter sign up<ArrowRight aria-hidden="true"/></Link></div></div></section>
    </main>
    <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>For the people who make goods, and the people who keep them moving.</span><Link className="button" href="/login"><UserRound aria-hidden="true"/>Log in</Link></div></footer>
  </>;
}
