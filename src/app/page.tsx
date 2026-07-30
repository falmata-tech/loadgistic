import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Building2,
  Factory,
  Gauge,
  Handshake,
  Hammer,
  MapPinned,
  PackageCheck,
  Search,
  Sprout,
  Store,
  Truck,
  UserRound,
  Users
} from 'lucide-react';
import { PublicHeader } from '@/components/public-header';

const businessTypes = [
  { label: 'Manufacturers', icon: Factory },
  { label: 'Artisans', icon: Hammer },
  { label: 'Growers', icon: Sprout },
  { label: 'Producers', icon: Store }
];

const steps = [
  { label: 'Post', detail: 'Load', icon: Boxes },
  { label: 'Match', detail: 'Truck', icon: Search },
  { label: 'Agree', detail: 'Directly', icon: Handshake },
  { label: 'Track', detail: 'Delivery', icon: MapPinned }
];

export default function HomePage() {
  return (
    <>
      <PublicHeader/>

      <section className="producer-hero">
        <div className="producer-hero-shade"/>
        <div className="container producer-hero-content">
          <span className="hero-kicker"><Building2 aria-hidden="true"/>Businesses <ArrowRight aria-hidden="true"/> Transporters</span>
          <h1>Road freight for every Ethiopian business.</h1>
          <p>Move materials, products, and orders. Find real truck capacity. Keep every agreed load in one place.</p>
          <div className="hero-actions">
            <Link href="/apply?type=ENTERPRISE_SHIPPER" className="button hero-primary"><Boxes aria-hidden="true"/>I need a truck</Link>
            <Link href="/apply?type=TRANSPORT_COMPANY" className="button hero-secondary"><Truck aria-hidden="true"/>I have a fleet</Link>
            <Link href="/apply?type=INDEPENDENT_PROVIDER" className="button hero-secondary"><UserRound aria-hidden="true"/>I drive a truck</Link>
          </div>
          <div className="hero-trust-line">
            <span><PackageCheck aria-hidden="true"/>FTL + PTL</span>
            <span><Users aria-hidden="true"/>Business network</span>
            <span><MapPinned aria-hidden="true"/>Protected location</span>
          </div>
        </div>
      </section>

      <section className="producer-strip" aria-label="Businesses served">
        <div className="container producer-type-grid">
          {businessTypes.map(({label, icon: Icon}) => (
            <div className="producer-type" key={label}>
              <Icon aria-hidden="true"/>
              <strong>{label}</strong>
            </div>
          ))}
        </div>
      </section>

      <section id="businesses" className="section business-value-band">
        <div className="container value-band-grid">
          <div className="value-band-copy">
            <span className="eyebrow"><Factory aria-hidden="true"/>For businesses</span>
            <h2>Built for the workshop. Ready for the enterprise.</h2>
            <p className="lede">Local makers, growers, producers, and growing manufacturers deserve the same organized logistics tools as a large company.</p>
          </div>
          <div className="landing-icon-list">
            <div><Boxes aria-hidden="true"/><span><strong>Post loads</strong><small>FTL or PTL</small></span></div>
            <div><Gauge aria-hidden="true"/><span><strong>Find capacity</strong><small>Truck by truck</small></span></div>
            <div><Handshake aria-hidden="true"/><span><strong>Build a network</strong><small>Private partners</small></span></div>
            <div><MapPinned aria-hidden="true"/><span><strong>Track delivery</strong><small>Shared status</small></span></div>
          </div>
        </div>
      </section>

      <section id="product" className="section product-proof-section">
        <div className="container">
          <div className="section-title">
            <span className="eyebrow"><Gauge aria-hidden="true"/>The working platform</span>
            <h2>See demand. See capacity. Move.</h2>
            <p className="lede">Clear boards for businesses. A mobile capacity console for drivers.</p>
          </div>
          <div className="product-proof-grid">
            <figure className="product-screen product-screen-wide">
              <Image src="/landing/product-capacity-board.png" alt="Loadgistic Capacity Board showing route, truck, and cargo-space filters" width={1440} height={900} priority={false}/>
              <figcaption><Search aria-hidden="true"/><strong>Capacity Board</strong><span>Find the closest truck</span></figcaption>
            </figure>
            <figure className="product-screen product-screen-phone">
              <Image src="/landing/product-driver-home.png" alt="Loadgistic mobile driver capacity controls" width={390} height={844} priority={false}/>
              <figcaption><Gauge aria-hidden="true"/><strong>Driver Home</strong><span>Update in seconds</span></figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section id="transporters" className="section transporter-purpose-band">
        <div className="container value-band-grid reverse">
          <div className="value-band-copy">
            <span className="eyebrow"><Truck aria-hidden="true"/>For transporters</span>
            <h2>You keep Ethiopia moving.</h2>
            <p className="lede">Every workshop, farm, warehouse, shop, and market depends on transport. Loadgistic connects fleets and owner-operators with business demand so available trucks are easier to use well.</p>
          </div>
          <div className="landing-icon-list transporter-list">
            <div><Truck aria-hidden="true"/><span><strong>Every fleet size</strong><small>One truck or many</small></span></div>
            <div><Gauge aria-hidden="true"/><span><strong>Fresh capacity</strong><small>Empty or Partial</small></span></div>
            <div><MapPinned aria-hidden="true"/><span><strong>Route matching</strong><small>Local or intercity</small></span></div>
            <div><Building2 aria-hidden="true"/><span><strong>Reviewed demand</strong><small>Business accounts</small></span></div>
          </div>
        </div>
      </section>

      <section id="how" className="section landing-workflow-band">
        <div className="container">
          <div className="section-title"><h2>Four clear steps.</h2></div>
          <div className="landing-workflow">
            {steps.map(({label, detail, icon: Icon}, index) => (
              <div className="landing-workflow-step" key={label}>
                <span>{index + 1}</span>
                <Icon aria-hidden="true"/>
                <strong>{label}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section join-section">
        <div className="container">
          <div className="section-title"><h2>Choose your workspace.</h2></div>
          <div className="join-grid">
            <article><Factory aria-hidden="true"/><h3>Business</h3><p>Find trucks and track loads.</p><Link href="/apply?type=ENTERPRISE_SHIPPER" className="button"><Boxes aria-hidden="true"/>Find capacity</Link></article>
            <article><Truck aria-hidden="true"/><h3>Fleet transporter</h3><p>Manage trucks and find loads.</p><Link href="/apply?type=TRANSPORT_COMPANY" className="button"><Truck aria-hidden="true"/>Open fleet workspace</Link></article>
            <article><UserRound aria-hidden="true"/><h3>Self-managed driver</h3><p>Publish capacity and find loads.</p><Link href="/apply?type=INDEPENDENT_PROVIDER" className="button"><Gauge aria-hidden="true"/>Open driver workspace</Link></article>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-grid">
          <strong>Loadgistic</strong>
          <span>Businesses <ArrowRight aria-hidden="true"/> Transporters</span>
          <Link href="/login" className="button"><UserRound aria-hidden="true"/>Log in</Link>
        </div>
      </footer>
    </>
  );
}
