import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Boxes, Factory, Gauge, Route, ShieldCheck, Truck } from 'lucide-react';
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
        <div className="container about-hero-copy"><span>Road freight coordination for Ethiopia</span><h1>Loadgistic</h1><p>Make freight demand and available truck space easier to find, compare, and organize.</p></div>
      </section>

      <section className="about-purpose-band">
        <div className="container about-purpose-layout">
          <div><span className="section-kicker">Why it exists</span><h2>Move more goods with the trucks already doing the work.</h2></div>
          <p>Small and growing manufacturers, processors, growers, artisans, and distributors often need road freight without maintaining a private fleet. At the same time, owner-operators and transport companies need reliable demand for empty and partial capacity. Loadgistic gives both sides one organized marketplace and shipment workspace.</p>
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
          <div><Gauge aria-hidden="true"/><strong>Better utilization</strong><p>Make useful capacity visible before another truck is added to the road.</p></div>
          <div><Boxes aria-hidden="true"/><strong>Clear coordination</strong><p>Keep shipment decisions, assignment, and tracking in one governed workflow.</p></div>
          <div><ShieldCheck aria-hidden="true"/><strong>Evidence over claims</strong><p>Freshness, route activity, verification, and reviews remain distinct and inspectable.</p></div>
        </div>
      </section>

      <section className="about-cta-band"><div className="container"><div><strong>Need road capacity?</strong><span>Publish a shipment for your Business.</span><Link className="button" href="/apply?type=ENTERPRISE_SHIPPER">Business sign up<ArrowRight aria-hidden="true"/></Link></div><div><strong>Have truck capacity?</strong><span>Connect your truck or fleet with demand.</span><Link className="button" href="/apply?type=TRANSPORT_COMPANY">Transporter sign up<ArrowRight aria-hidden="true"/></Link></div></div></section>
    </main>
    <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>Less capacity waste. Clearer road-freight coordination.</span><Link className="button" href="/login">Log in</Link></div></footer>
  </>;
}
