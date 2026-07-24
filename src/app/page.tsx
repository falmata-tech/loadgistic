import Link from 'next/link';
import { PublicHeader } from '@/components/public-header';

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">B2B logistics platform · Built for Ethiopia</span>
            <h1>Connect business shipments with the right logistics provider.</h1>
            <p className="lede">Loadgistic connects enterprise shippers and receivers with parcel delivery companies, freight transporters, and independent truckers or owner-operators.</p>
            <div className="hero-actions">
              <Link href="/login" className="button">Open Loadgistic</Link>
              <Link href="/companies" className="button secondary">Browse company pages</Link>
            </div>
          </div>
          <div className="hero-visual" aria-label="A simple B2B logistics route illustration">
            <div className="map-grid" />
            <div className="route-card">
              <div className="meta">Business shipment</div>
              <div className="route"><strong>Addis Ababa</strong><span>→</span><strong>Hawassa</strong></div>
              <div className="route-line" />
              <div className="split">
                <div><strong>Demand</strong><div className="meta">Enterprise shipper</div></div>
                <div><strong>Supply</strong><div className="meta">Parcel or freight provider</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solutions" className="section alt">
        <div className="container">
          <div className="section-title"><h2>One simple platform for both sides of B2B logistics</h2><p className="lede">Demand comes from enterprise shippers and receivers. Supply comes from parcel companies, transporters, and independent providers.</p></div>
          <div className="grid-3">
            <article className="card soft-blue"><div className="icon-tile">▣</div><h3>Enterprise Shippers & Receivers</h3><ul className="check-list"><li>Create parcel or freight requests</li><li>Find providers and fresh capacity</li><li>Follow simple shipment workflows</li></ul></article>
            <article className="card soft-green"><div className="icon-tile">▱</div><h3>Parcel Delivery Companies</h3><ul className="check-list"><li>Receive B2B shipment requests</li><li>Use manual shipment-code lookup</li><li>Show routes, centers, and services</li></ul></article>
            <article className="card soft-purple"><div className="icon-tile">▰</div><h3>Transporters & Owner-Operators</h3><ul className="check-list"><li>Find loads posted in Ethiopian birr</li><li>Publish Empty, Partial, or Full capacity</li><li>Build a visible provider company page</li></ul></article>
          </div>
        </div>
      </section>

      <section id="how" className="section">
        <div className="container">
          <div className="section-title"><h2>How Loadgistic works</h2><p className="muted">Only the next useful action is emphasized.</p></div>
          <div className="workflow card">
            {['Request','Discover','Discuss','Move','Complete'].map((step,index)=><div className="workflow-step" key={step}><div className="step-number">{index+1}</div><h3>{step}</h3><p className="meta">{['Create B2B demand.','Find provider or load.','Agree directly.','Update simple status.','Record proof if needed.'][index]}</p></div>)}
          </div>
        </div>
      </section>

      <section id="plans" className="section alt">
        <div className="container">
          <div className="section-title"><h2>Every logistics business gets a company page</h2><p className="lede">Show services, centers, corridors, current capacity, and verified contact information—without invented performance data.</p></div>
          <div className="grid-3">
            <article className="card"><span className="status">Parcel Company</span><h3 style={{marginTop:12}}>Addis Parcel Services</h3><p className="muted">Pickup centers, served routes, receiver pickup, and direct delivery.</p></article>
            <article className="card"><span className="status green">Transport Company</span><h3 style={{marginTop:12}}>BlueLine Transport PLC</h3><p className="muted">Vehicle categories, corridors, and fresh truck capacity.</p></article>
            <article className="card"><span className="status purple">Independent Provider</span><h3 style={{marginTop:12}}>Abebe Owner-Operator</h3><p className="muted">Verified identity, active vehicle, corridors, and availability.</p></article>
          </div>
        </div>
      </section>

      <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>B2B logistics for Ethiopian enterprises and providers.</span><Link href="/login" className="button">Open app</Link></div></footer>
    </>
  );
}
