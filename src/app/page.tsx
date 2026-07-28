import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Boxes,
  Factory,
  Handshake,
  Hammer,
  MapPinned,
  PackageSearch,
  Route,
  Sprout,
  Store,
  Truck,
  Users
} from 'lucide-react';
import { PublicHeader } from '@/components/public-header';

const producerTypes = [
  { label: 'Manufacturers', detail: 'Finished goods and production inputs', icon: Factory },
  { label: 'Artisans', detail: 'Cartons, bundles, and regional orders', icon: Hammer },
  { label: 'Growers', detail: 'Produce moving toward buyers and processors', icon: Sprout },
  { label: 'Producers', detail: 'Pallets, sacks, crates, and wholesale supply', icon: Store }
];

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <section className="producer-hero">
        <div className="producer-hero-shade" />
        <div className="container producer-hero-content">
          <span className="hero-kicker">Built for Ethiopia's production and transport economy</span>
          <h1>Road freight for the businesses that make Ethiopia.</h1>
          <p>Move what you make, grow, process, or distribute without owning a private fleet. Work directly with fleet transporters and self-managed drivers looking for reviewed Business demand.</p>
          <div className="hero-actions">
            <Link href="/apply?type=ENTERPRISE_SHIPPER" className="button hero-primary"><Boxes aria-hidden="true"/>Sign up as a Business</Link>
            <Link href="/apply?type=TRANSPORT_COMPANY" className="button hero-secondary"><Truck aria-hidden="true"/>Sign up as Fleet Transporter</Link>
            <Link href="/apply?type=INDEPENDENT_PROVIDER" className="button hero-secondary"><Users aria-hidden="true"/>Sign up as Self-managed Driver</Link>
          </div>
          <div className="hero-trust-line"><span>Business accounts sign up free</span><span>Member information visible after login</span><span>FTL and PTL road freight</span></div>
        </div>
      </section>

      <section className="producer-strip" aria-label="Businesses served">
        <div className="container producer-type-grid">
          {producerTypes.map(({label,detail,icon:Icon}) => <div className="producer-type" key={label}><Icon aria-hidden="true"/><span><strong>{label}</strong><small>{detail}</small></span></div>)}
        </div>
      </section>

      <section id="solutions" className="section production-value-section">
        <div className="container">
          <div className="section-title align-left"><span className="eyebrow">Production needs movement</span><h2>A logistics workspace sized for growing Businesses</h2><p className="lede">Large manufacturers can maintain distribution fleets. Smaller makers and producers need a dependable way to find existing road capacity, compare interest, and keep every agreed movement organized.</p></div>
          <div className="production-journey">
            <div className="journey-step"><div className="journey-icon"><Boxes aria-hidden="true"/></div><span><strong>Record the real load</strong><small>FTL or PTL, route, cargo, truck type, and deadlines.</small></span></div>
            <ArrowRight className="journey-arrow" aria-hidden="true"/>
            <div className="journey-step"><div className="journey-icon green"><PackageSearch aria-hidden="true"/></div><span><strong>Find aligned capacity</strong><small>Search fresh trucks or publish demand for quotes.</small></span></div>
            <ArrowRight className="journey-arrow" aria-hidden="true"/>
            <div className="journey-step"><div className="journey-icon amber"><Handshake aria-hidden="true"/></div><span><strong>Work with known partners</strong><small>Confirm profiles, agree directly, and keep private relationships.</small></span></div>
            <ArrowRight className="journey-arrow" aria-hidden="true"/>
            <div className="journey-step"><div className="journey-icon red"><MapPinned aria-hidden="true"/></div><span><strong>Track the movement</strong><small>Use a real status timeline or privacy-protected location updates.</small></span></div>
          </div>
        </div>
      </section>

      <section className="section member-preview-section">
        <div className="container">
          <div className="section-title"><span className="eyebrow">Illustrative member view</span><h2>Match demand and truck capacity by route</h2><p className="lede">Live marketplace records stay behind login. These examples show the practical facts members use to decide what deserves a conversation.</p></div>
          <div className="market-preview-grid">
            <article className="market-preview-panel"><div className="status-row"><span className="status green">PTL</span><span className="status">Quote requested</span></div><h3>Woven home goods · 18 cartons</h3><div className="preview-route"><strong>Addis Ababa</strong><span>→</span><strong>Adama</strong></div><dl><div><dt>Business</dt><dd>Local artisan cooperative</dd></div><div><dt>Pick up before</dt><dd>Wednesday morning</dd></div><div><dt>Need</dt><dd>Partial truckload</dd></div></dl></article>
            <article className="market-preview-panel"><div className="preview-truck"><Image src="/vehicle-configurations/light-stake-body-truck.jpg" alt="Light stake body truck" width={180} height={180}/><div><span className="status green">Partial · 40%</span><h3>Isuzu NPR · open capacity</h3></div></div><dl><div><dt>Current area</dt><dd>Around Addis Ababa · privacy protected</dd></div><div><dt>Corridor</dt><dd>Addis Ababa ↔ Hawassa</dd></div><div><dt>Accepting</dt><dd>FTL + PTL · direct only</dd></div></dl></article>
            <article className="market-preview-panel"><div className="status-row"><span className="status">Route match</span><span className="status green">Both cities align</span></div><h3>Truck route compared with load route</h3><div className="route-comparison"><span><Route aria-hidden="true"/>Truck</span><strong>Addis Ababa ↔ Hawassa</strong><span><Boxes aria-hidden="true"/>Load</span><strong>Addis Ababa → Hawassa</strong></div><p className="meta">Matching helps members search. It never assigns a truck or guarantees a job.</p></article>
          </div>
        </div>
      </section>

      <section className="section transporter-value-section">
        <div className="container transporter-value-grid">
          <div>
            <span className="eyebrow">For Ethiopia's transport capacity</span>
            <h2>More of the right demand for every real truck</h2>
            <p className="lede">Small fleets, owner-operators, and drivers keep goods moving between production areas and markets. Loadgistic helps them make current capacity visible to reviewed Businesses and organize the work that follows.</p>
            <div className="transport-outcomes">
              <div><Truck aria-hidden="true"/><span><strong>Fleet transporters</strong><small>Manage the full roster, compare corridors with Business locations, and update each truck from My Fleet.</small></span></div>
              <div><Route aria-hidden="true"/><span><strong>Self-managed drivers</strong><small>Keep location area, cargo space, accepted loads, and planned movement fresh from a mobile-first Home.</small></span></div>
            </div>
          </div>
          <div className="fleet-signal">
            <div className="fleet-signal-header"><span>Fleet demand view</span><span className="status green">Illustrative</span></div>
            <div className="fleet-signal-row"><strong>Addis Ababa ↔ Hawassa</strong><span>2 matching Business areas</span></div>
            <div className="fleet-signal-row"><strong>Addis Ababa ↔ Dire Dawa</strong><span>1 matching open load</span></div>
            <div className="fleet-signal-row"><strong>Mekelle ↔ Addis Ababa</strong><span>Truck route ready to compare</span></div>
            <p>Signals are based on recorded routes and declared regional locations, not exact live positions.</p>
          </div>
        </div>
      </section>

      <section id="plans" className="section join-section">
        <div className="container">
          <div className="section-title"><h2>Choose your Loadgistic account</h2><p className="lede">One network for Businesses looking for capacity and transport providers looking for reviewed demand.</p></div>
          <div className="join-grid">
            <article><Factory aria-hidden="true"/><h3>Business</h3><p>For makers, growers, processors, producers, distributors, and enterprises moving road freight.</p><Link href="/apply?type=ENTERPRISE_SHIPPER" className="button">Sign up as a Business<ArrowRight aria-hidden="true"/></Link></article>
            <article><Truck aria-hidden="true"/><h3>Fleet Transporter</h3><p>For transport companies coordinating multiple registered vehicles and coworkers.</p><Link href="/apply?type=TRANSPORT_COMPANY" className="button secondary">Sign up as Fleet Transporter<ArrowRight aria-hidden="true"/></Link></article>
            <article><Users aria-hidden="true"/><h3>Self-managed Driver</h3><p>For drivers and owner-operators managing their own truck and market signal.</p><Link href="/apply?type=INDEPENDENT_PROVIDER" className="button secondary">Sign up as Self-managed Driver<ArrowRight aria-hidden="true"/></Link></article>
          </div>
        </div>
      </section>

      <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>Road freight collaboration for Ethiopian Businesses and transport providers.</span><Link href="/login" className="button">Open workspace</Link></div></footer>
    </>
  );
}
