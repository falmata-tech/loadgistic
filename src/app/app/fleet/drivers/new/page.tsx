import Link from 'next/link';
import {ArrowLeft,UserRound,UserPlus} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {fleetReturnPath} from '@/lib/fleet-navigation.js';
import {PageHeader} from '@/components/page-header';

export default async function AddDriverPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  await requireUser(['TRANSPORTER']);
  const query=await searchParams;
  const returnTo=fleetReturnPath(query.returnTo,'/app/fleet#driver-access');
  return <div className="page vehicle-registration-page">
    <PageHeader icon={UserRound} title="Add driver" subtitle="Add a driver and assign their truck right away." action={<Link className="button secondary small" href={returnTo}><ArrowLeft aria-hidden="true"/>My Fleet</Link>}/>
    <form className="vehicle-registration-card" action="/api/fleet/drivers" method="post">
      <input type="hidden" name="returnTo" value={returnTo}/>
      <div className="form-grid">
        <div className="form-group full"><label htmlFor="driver-name">Driver name</label><input id="driver-name" name="name" autoComplete="name" required minLength={2} maxLength={100}/></div>
        <div className="form-group"><label htmlFor="driver-email">Email</label><input id="driver-email" name="email" type="email" autoComplete="email" required maxLength={254}/><small>The driver uses this email to receive their login code.</small></div>
        <div className="form-group"><label htmlFor="driver-phone">Contact phone</label><input id="driver-phone" name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={32}/></div>
      </div>
      <p className="meta">You can assign a truck before the driver verifies their email. Their first email-code login verifies it. Driver documents are optional.</p>
      <div className="vehicle-registration-actions"><Link className="button secondary" href={returnTo}>Cancel</Link><button className="button success"><UserPlus aria-hidden="true"/>Add driver</button></div>
    </form>
  </div>;
}
