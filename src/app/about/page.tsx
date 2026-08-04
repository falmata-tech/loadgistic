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
        <div className="container about-hero-copy"><span>Road freight coordination for Ethiopia</span><h1>A more connected freight market for businesses that make and move goods.</h1><p>Loadgistic connects structured shipment demand with current truck capacity across local, regional, and interregional routes.</p></div>
      </section>

      <section className="about-purpose-band">
        <div className="container about-purpose-layout">
          <div><span className="section-kicker">Why it exists</span><h2>Logistics should expand a producer&apos;s market—not define its limits.</h2></div>
          <p>Manufacturers, workshops, growers, processors, and producers often depend on third-party road transport to reach suppliers and customers. At the same time, owner-operators and small fleets may have empty trucks, Partial capacity, or established routes that are difficult for businesses to discover. Loadgistic makes both sides visible in one governed B2B workflow, from discovery and agreement through truck assignment and tracking.</p>
        </div>
      </section>

      <section className="about-work-band">
        <div className="container about-work-grid">
          <div><Factory aria-hidden="true"/><span><strong>Businesses publish freight requirements</strong><p>Structured routes, deadlines, shipment size, and visibility make demand comparable.</p></span></div>
          <ArrowRight className="about-flow-arrow" aria-hidden="true"/>
          <div><Truck aria-hidden="true"/><span><strong>Transport providers publish capacity</strong><p>Current area, cargo space, route, freshness, and work preferences describe availability.</p></span></div>
          <ArrowRight className="about-flow-arrow" aria-hidden="true"/>
          <div><Route aria-hidden="true"/><span><strong>Both sides assess operational fit</strong><p>Route and Local-area matching support a direct commercial and operational discussion.</p></span></div>
        </div>
      </section>

      <section className="about-principles-band">
        <div className="container about-principles-grid">
          <div><Gauge aria-hidden="true"/><strong>Use existing capacity efficiently</strong><p>Consider Empty and Partial capacity before arranging a separate dedicated movement.</p></div>
          <div><Boxes aria-hidden="true"/><strong>Keep every shipment accountable</strong><p>Each shipment retains its own agreement, assignment, and tracking history even when cargo space is shared.</p></div>
          <div><ShieldCheck aria-hidden="true"/><strong>Use evidence with independent judgment</strong><p>Badges identify reviewed document categories. Each party must still confirm identity, authority, cargo fit, and terms.</p></div>
        </div>
      </section>

      <section className="about-cta-band"><div className="container"><div><strong>Need road capacity?</strong><span>Publish a shipment for your Business.</span><Link className="button" href="/apply?type=ENTERPRISE_SHIPPER">Business sign up<ArrowRight aria-hidden="true"/></Link></div><div><strong>Have truck capacity?</strong><span>Connect your truck or fleet with demand.</span><Link className="button" href="/apply?type=TRANSPORT_COMPANY">Transporter sign up<ArrowRight aria-hidden="true"/></Link></div></div></section>
    </main>
    <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>B2B road-freight discovery, agreement, and tracking for Ethiopia.</span><Link className="button" href="/login"><UserRound aria-hidden="true"/>Log in</Link></div></footer>
  </>;
}
