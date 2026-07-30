import Link from 'next/link';
import { Building2, Pencil, MapPin, Route } from 'lucide-react';
import { RouteCoverageMap } from './route-coverage-map';

function titleCase(value: string) {
  return value.replace(/\b\w/g, letter => letter.toUpperCase());
}

export function NetworkCoverage({ coverage }: { coverage: any }) {
  if (!coverage) return null;
  return <section className="card network-coverage">
    <div className="page-header compact-header">
      <div><h2><Route aria-hidden="true"/>Network coverage</h2><p className="page-subtitle">Your routes and partner Business areas.</p></div>
      <Link className="button secondary small" href="/app/company-page"><Pencil aria-hidden="true"/>Edit routes</Link>
    </div>
    <div className="coverage-routes" aria-label="Preferred Route network">
      {coverage.preferred_routes.length ? coverage.preferred_routes.map((route:string) => <div className="coverage-lane" key={route}><Route aria-hidden="true"/><span>{route}</span></div>) : <div className="empty-state compact">Add Preferred Routes to compare coverage.</div>}
    </div>
    {coverage.routes?.length?<RouteCoverageMap routes={[]} comparisonRoutes={coverage.routes}/>:null}
    <div className="coverage-businesses">
      {coverage.businesses.map((business:any) => <Link href={`/app/providers/${business.handle}`} className="coverage-business" key={business.id}>
        <Building2 aria-hidden="true"/>
        <span><strong>{business.name}</strong><small><MapPin aria-hidden="true"/>{business.operating_regions || business.city || 'Locations not added'}</small></span>
        <span className={`status ${business.matched_places.length ? 'green' : 'expired'}`}>{business.coverage_label}</span>
        {business.matched_places.length ? <span className="coverage-match">{business.matched_places.map(titleCase).join(' · ')}</span> : null}
      </Link>)}
      {!coverage.businesses.length ? <div className="empty-state compact">Businesses that save this fleet as a partner will appear here.</div> : null}
    </div>
    <p className="meta">Coordinate and activity match. Not a service guarantee.</p>
  </section>;
}
