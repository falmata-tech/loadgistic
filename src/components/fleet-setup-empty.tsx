
import {Text} from '@/components/localization';
import Link from 'next/link';
import {Truck,Plus,UsersRound} from 'lucide-react';

export function FleetSetupEmpty({companyDriver,fleetOwner}:{companyDriver:boolean;fleetOwner:boolean}){
  return <section className="empty-state fleet-empty-state">
    <Truck aria-hidden="true"/><strong><Text message="No eligible vehicle yet"/></strong>
    <span>{companyDriver?<Text message="Ask your fleet owner to assign an active vehicle and enable the access you need."/>:fleetOwner?<Text message="Add a vehicle, add its driver by email, then assign the vehicle. The driver verifies their email when they log in."/>:<Text message="Add your vehicle to get started."/>}</span>
    {!companyDriver?<div className="fleet-setup-actions"><Link className="button success" href="/app/fleet/new"><Plus aria-hidden="true"/><Text message="Add vehicle"/></Link><Link className="button secondary" href={fleetOwner?'/app/fleet?view=drivers':'/app/fleet'}><UsersRound aria-hidden="true"/>{fleetOwner?<Text message="Manage drivers"/>:<Text message="My vehicles"/>}</Link></div>:null}
  </section>;
}
