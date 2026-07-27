import Link from 'next/link';
import Image from 'next/image';
import { PublicHeader } from '@/components/public-header';

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">B2B logistics platform · Built for Ethiopia</span>
            <h1>Road freight capacity for Ethiopian businesses.</h1>
            <p className="lede">Artisans, farmers, producers, and manufacturers post loads or find available trucks. Fleet transporters and self-managed drivers find reviewed Business demand.</p>
            <div className="hero-actions">
              <Link href="/apply?type=ENTERPRISE_SHIPPER" className="button">Join as a Business looking for capacity</Link>
              <Link href="/apply?type=TRANSPORT_COMPANY" className="button secondary">Join as a transporter looking for demand</Link>
            </div>
          </div>
          <div className="hero-visual" aria-label="A simple B2B logistics route illustration">
            <div className="map-grid" />
            <div className="route-card">
              <div className="market-preview-kicker">Member marketplace preview</div>
              <div className="route"><strong>Addis Ababa</strong><span>→</span><strong>Hawassa</strong></div>
              <div className="route-line" />
              <div className="hero-market-signal">
                <Image src="/vehicle-configurations/medium-box-truck.jpg" alt="Medium box truck" width={112} height={112}/>
                <div><strong>FTL load · Medium Box Truck</strong><div className="meta">Matched with fresh route capacity after login</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solutions" className="section alt">
        <div className="container">
          <div className="section-title"><h2>One freight workspace for demand and capacity</h2><p className="lede">Businesses post real loads. Transporters share preferred corridors, planned routes, and current truck space when they want demand.</p></div>
          <div className="grid-3">
            <article className="card soft-blue"><div className="icon-tile">▣</div><h3>Businesses</h3><ul className="check-list"><li>Post FTL or PTL loads for quotes</li><li>Find transporters and fresh truck capacity</li><li>Share private demand with saved partners</li></ul></article>
            <article className="card soft-green"><div className="icon-tile">▰</div><h3>Fleet Transporters</h3><ul className="check-list"><li>Find reviewed Business loads</li><li>Manage every real truck in one roster</li><li>Publish each truck's Empty or Partial space</li></ul></article>
            <article className="card soft-purple"><div className="icon-tile">▱</div><h3>Self-managed Drivers</h3><ul className="check-list"><li>Use a mobile-first capacity home</li><li>Share an approximate area and corridor</li><li>Choose FTL, PTL, stops, and duty state</li></ul></article>
          </div>
        </div>
      </section>

      <section className="section member-preview-section">
        <div className="container">
          <div className="section-title"><span className="eyebrow">Visible after login</span><h2>See demand and capacity before making the call</h2><p className="lede">These examples show the information members can use. Live loads, truck signals, Business contacts, and company profiles remain private until login.</p></div>
          <div className="market-preview-grid">
            <article className="market-preview-panel"><div className="status-row"><span className="status green">PTL</span><span className="status">Quote requested</span></div><h3>Handwoven baskets · 18 cartons</h3><div className="preview-route"><strong>Addis Ababa</strong><span>→</span><strong>Adama</strong></div><dl><div><dt>Business</dt><dd>Artisan cooperative</dd></div><div><dt>Pickup</dt><dd>Wednesday morning</dd></div><div><dt>Need</dt><dd>Partial truckload</dd></div></dl></article>
            <article className="market-preview-panel"><div className="preview-truck"><Image src="/vehicle-configurations/light-stake-body-truck.jpg" alt="Light stake body truck" width={180} height={180}/><div><span className="status green">Partial · 40%</span><h3>Isuzu NPR · open capacity</h3></div></div><dl><div><dt>Current area</dt><dd>Around Addis Ababa · 40 km privacy zone</dd></div><div><dt>Corridor</dt><dd>Addis Ababa ↔ Hawassa</dd></div><div><dt>Accepting</dt><dd>FTL + PTL · direct only</dd></div></dl></article>
            <article className="market-preview-panel"><div className="status-row"><span className="status">Fleet transporter</span><span className="status green">Reviewed</span></div><h3>Highland Freight Cooperative</h3><p className="muted">Four registered trucks serving Addis Ababa, Jimma, and Hawassa. Two trucks currently contributing fresh capacity.</p><dl><div><dt>Fleet</dt><dd>4 active trucks</dd></div><div><dt>Capacity Board</dt><dd>2 available now</dd></div><div><dt>Contact</dt><dd>Designated Business phone after login</dd></div></dl></article>
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
          <div className="section-title"><h2>Choose the workspace that matches your work</h2><p className="lede">Businesses join to find capacity. Transporters join to reach reviewed demand and manage shipment collaboration without changing how they run offline operations.</p></div>
          <div className="grid-3">
            <article className="card"><span className="status">Business</span><h3 style={{marginTop:12}}>Access freight without owning a fleet</h3><p className="muted">Post pallets, cartons, quarter-truck, half-truck, or full-truck demand and compare responses.</p><Link href="/apply?type=ENTERPRISE_SHIPPER" className="button secondary card-cta">Join as a Business</Link></article>
            <article className="card"><span className="status green">Fleet Transporter</span><h3 style={{marginTop:12}}>Coordinate multiple trucks</h3><p className="muted">Give each real truck make, model, and visual cargo configuration while drivers keep capacity current.</p><Link href="/apply?type=TRANSPORT_COMPANY" className="button secondary card-cta">Join as fleet transporter</Link></article>
            <article className="card"><span className="status purple">Self-managed Driver</span><h3 style={{marginTop:12}}>Keep your own truck in demand</h3><p className="muted">Update location area, route, duty state, cargo space, and accepted load types from Home.</p><Link href="/apply?type=INDEPENDENT_PROVIDER" className="button secondary card-cta">Join as self-managed driver</Link></article>
          </div>
        </div>
      </section>

      <footer className="footer"><div className="container footer-grid"><strong>Loadgistic</strong><span>B2B logistics for businesses and transporters.</span><Link href="/login" className="button">Open app</Link></div></footer>
    </>
  );
}
