import Link from 'next/link';
import {Truck,Plus,UsersRound} from 'lucide-react';

export function FleetSetupEmpty({companyDriver,fleetOwner}:{companyDriver:boolean;fleetOwner:boolean}){
  return <section className="empty-state fleet-empty-state">
    <Truck aria-hidden="true"/><strong>No eligible truck yet</strong>
    <span>{companyDriver?'Ask your fleet owner to assign an active truck and enable the access you need.':fleetOwner?'Add a truck, invite its driver, then assign them after they accept.':'Add your truck to get started.'}</span>
    {!companyDriver?<div className="fleet-setup-actions"><Link className="button success" href="/app/fleet/new"><Plus aria-hidden="true"/>Add truck</Link><Link className="button secondary" href={fleetOwner?'/app/fleet#driver-access':'/app/fleet'}><UsersRound aria-hidden="true"/>{fleetOwner?'Manage drivers':'My trucks'}</Link></div>:null}
  </section>;
}
