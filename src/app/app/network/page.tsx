import {CapacityBusinessShare,RemoveBusinessCapacityShare} from '@/components/capacity-business-share';
import {NetworkViews} from '@/components/business-directory';

import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import {capacitySharingLabel} from '@/lib/capacity-sharing';
import {Text} from '@/components/localization';
import {Network,ShieldCheck,Truck,UserRound} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {listPrivateCapacityNetwork} from '@/lib/private-capacity.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {FleetSetupEmpty} from '@/components/fleet-setup-empty';
import {providerWorkspaceCapabilities} from '@/lib/provider-workspace.js';

export default async function PrivateCapacityNetworkPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['TRANSPORTER','DRIVER']);
  const query=await searchParams;
  const vehicles:any[]=await listPrivateCapacityNetwork(user);
  return <div className="page private-capacity-network">
    <PageHeader icon={Network} title={<Text message="Network"/>}/>
    <Flash error={query.error} success={query.success}/>
    <NetworkViews>
    <aside className="permission-note"><ShieldCheck aria-hidden="true"/><div><strong><Text message="Vehicle-specific access"/></strong><span><Text message="Shared contacts see the vehicle’s published location area. Remove access at any time."/></span></div></aside>
    <div className="network-truck-list">{vehicles.map(vehicle=>{const active=vehicle.grants.filter((grant:any)=>!grant.revoked_at);return <section className="card network-truck-card" key={vehicle.id}>
      <header><Truck aria-hidden="true"/><div><small>{vehicle.platform_number}</small><h2>{vehicle.make} {vehicle.model}</h2><p>{vehicle.cargo_configuration}{vehicle.driver_name?` · Driver ${vehicle.driver_name}`:''}</p></div></header>
      <p><Text message={capacitySharingLabel(vehicle.sharing_mode)}/></p><p className="meta"><Text message="Saved contacts get access only when the vehicle’s sharing setting allows them."/></p>
      <WorkspaceTaskDialog title="Add access" triggerLabel="Add access"><CapacityBusinessShare vehicleId={vehicle.id} exclusiveEmail={vehicle.sharing_mode==='EXCLUSIVE'?vehicle.exclusive_email:undefined}/></WorkspaceTaskDialog>
      <div className="network-access-list"><h3><Text message="Shared contacts"/></h3>{active.filter((grant:any)=>grant.audience_type==='EMAIL').map((grant:any)=><article key={grant.id}><UserRound aria-hidden="true"/><div><strong>{grant.recipient_name||grant.recipient_email}</strong>{grant.recipient_name?<span>{grant.recipient_email}</span>:null}<span><Text message="Added by "/>{grant.created_by_name}<Text message=" · Recipient verifies this email when opening Private capacity"/></span><WorkspaceTaskDialog title="Person or company name" triggerLabel="Edit name"><form action="/api/capacity-network" method="post"><input type="hidden" name="action" value="NAME"/><input type="hidden" name="grantId" value={grant.id}/><label><Text message="Person or company name"/><input name="name" defaultValue={grant.recipient_name||''} required maxLength={100}/></label><button className="button small"><Text message="Save name"/></button></form></WorkspaceTaskDialog></div><form action="/api/capacity-network" method="post"><input type="hidden" name="action" value="REVOKE"/><input type="hidden" name="grantId" value={grant.id}/><button className="button danger small"><Text message="Remove"/></button></form></article>)}{!active.some((grant:any)=>grant.audience_type==='EMAIL')?<p className="meta"><Text message="No email access has been added for this vehicle."/></p>:null}</div>
      {(vehicle.business_grants||[]).some((grant:any)=>!grant.revoked_at)?<div className="network-access-list"><h3><Text message="Shared businesses"/></h3>{vehicle.business_grants.filter((grant:any)=>!grant.revoked_at).map((grant:any)=><article key={grant.id}><Network aria-hidden="true"/><div><strong>{grant.name}</strong><span>@{grant.handle}{grant.city?` · ${grant.city}`:''}</span><span><Text message="Their permitted team members can view these signals."/></span></div><RemoveBusinessCapacityShare grantId={grant.id} revision={grant.revision}/></article>)}</div>:null}
    </section>})}</div>
    {!vehicles.length?<FleetSetupEmpty companyDriver={user.driver_kind==='COMPANY'} fleetOwner={providerWorkspaceCapabilities(user).canManageFleet}/>:null}
    </NetworkViews>
  </div>;
}
