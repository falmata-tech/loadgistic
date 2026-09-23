
import {Text} from '@/components/localization';
import Link from 'next/link';
import {Mail,UserPlus,UserRound} from 'lucide-react';
import type {FleetInvitation} from '@/lib/fleet-driver-management';

export function FleetInvitations({invitations,returnTo}:{invitations:FleetInvitation[];returnTo:string}){
  return <div className="fleet-invitations">
    <Link className="button success small" href={`/app/fleet/drivers/new?returnTo=${encodeURIComponent(returnTo)}`}><UserPlus aria-hidden="true"/><Text message="Add driver"/></Link>
    {invitations.length?<details open><summary><Text message="Pending invitations ("/>{invitations.length})</summary><div className="list">{invitations.map(invitation=><article className="fleet-invitation-row" key={invitation.id}>
      <div><strong>{invitation.driver_name}</strong><span>{invitation.email}</span><small>{invitation.email_sent_at?<Text message="Email sent · Awaiting acceptance"/>:<Text message="Email not delivered · Awaiting acceptance"/>}</small></div>
      <form action="/api/fleet/invitations" method="post"><input type="hidden" name="invitationId" value={invitation.id}/><input type="hidden" name="returnTo" value={returnTo}/><button className="button secondary small" name="action" value="resend"><Mail aria-hidden="true"/><Text message="Retry email"/></button><button className="button secondary small" name="action" value="cancel"><Text message="Cancel invitation"/></button></form>
    </article>)}</div></details>:null}
  </div>;
}

export function FleetDriverContact({id,name,phone,returnTo}:{id:string;name:string;phone:string|null;returnTo:string}){
  return <div className="fleet-driver-contact-tools">
    <details><summary><UserRound aria-hidden="true"/><Text message="Edit contact"/></summary>
      <form method="post" action={`/api/fleet/drivers/${id}/contact`} className="form-grid">
        <input type="hidden" name="returnTo" value={returnTo}/>
        <div className="form-group"><label htmlFor={`contact-name-${id}`}><Text message="Driver name"/></label><input id={`contact-name-${id}`} name="name" defaultValue={name} required minLength={2} maxLength={100}/></div>
        <div className="form-group"><label htmlFor={`contact-phone-${id}`}><Text message="Contact phone"/></label><input id={`contact-phone-${id}`} name="phone" type="tel" defaultValue={phone||''} required minLength={7} maxLength={32}/></div>
        <button className="button secondary"><Text message="Save contact"/></button>
      </form>
    </details>
    <details><summary><Text message="Remove from fleet"/></summary>
      <form method="post" action={`/api/fleet/drivers/${id}/contact`}>
        <input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="action" value="remove"/>
        <p><Text message="This ends the driver’s current truck assignment and access to your fleet. Shipment and document history is kept."/></p>
        <label className="fleet-remove-confirm"><input type="checkbox" name="confirm" required/><Text message="I confirm removal from this fleet."/></label>
        <button className="button danger"><Text message="Remove driver"/></button>
      </form>
    </details>
  </div>;
}
