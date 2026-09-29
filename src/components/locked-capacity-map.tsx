"use client";
import {PublicCapacityMap} from './public-capacity-map';
import {SharedCapacityAccessForm} from './shared-capacity-access-form';
import {Localized} from './localization';
// This locked surface has no feed, recipient identity, query or loading callback.
// It renders only base-map tiles until the server verifies the email session.
export function LockedCapacityMap({localInbox}:{localInbox:string|null}){
  return <Localized as="section" copy={["aria-label"]} className="container home-market-shell locked-capacity-map" aria-label="Map of signals shared with you">
    <div className="locked-capacity-basemap"><PublicCapacityMap items={[]} viewer={null} selectedId={null} onSelect={()=>{}}/></div>
    <div className="locked-capacity-access"><SharedCapacityAccessForm localInbox={localInbox}/></div>
  </Localized>;
}
