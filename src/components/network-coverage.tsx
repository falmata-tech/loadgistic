import Link from 'next/link';
import { Building2, MapPin, Route } from 'lucide-react';

function titleCase(value: string) {
  return value.replace(/\b\w/g, letter => letter.toUpperCase());
}

export function NetworkCoverage({ coverage }: { coverage: any }) {
  if (!coverage) return null;
  return <section className="card network-coverage">
    <div className="page-header compact-header">
      <div><h2>Network corridor coverage</h2><p className="page-subtitle">Compare your recorded corridors with the declared locations of Businesses in your network.</p></div>
      <Link className="button secondary small" href="/app/company-page">Edit corridors</Link>
    </div>
    <div className="coverage-corridors" aria-label="Preferred corridor network">
      {coverage.corridors.length ? coverage.corridors.map((corridor:string) => <div className="coverage-lane" key={corridor}><Route aria-hidden="true"/><span>{corridor}</span></div>) : <div className="empty-state compact">Add preferred corridors to compare coverage.</div>}
    </div>
    <div className="coverage-businesses">
      {coverage.businesses.map((business:any) => <Link href={`/companies/${business.handle}`} className="coverage-business" key={business.id}>
        <Building2 aria-hidden="true"/>
        <span><strong>{business.name}</strong><small><MapPin aria-hidden="true"/>{business.operating_regions || business.city || 'Locations not added'}</small></span>
        <span className={`status ${business.matched_places.length ? 'green' : 'expired'}`}>{business.coverage_label}</span>
        {business.matched_places.length ? <span className="coverage-match">{business.matched_places.map(titleCase).join(' · ')}</span> : null}
      </Link>)}
      {!coverage.businesses.length ? <div className="empty-state compact">Businesses that save this fleet as a partner will appear here.</div> : null}
    </div>
    <p className="meta">This is a corridor comparison, not a geographic map or service guarantee. It uses only member-entered city and regional names.</p>
  </section>;
}
