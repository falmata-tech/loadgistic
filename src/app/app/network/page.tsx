import {Mail,Network,ShieldCheck,Truck,UserRound} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {listPrivateCapacityNetwork} from '@/lib/repository.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';

export default async function PrivateCapacityNetworkPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['TRANSPORTER','DRIVER']);
  const query=await searchParams;
  const vehicles:any[]=listPrivateCapacityNetwork(user);
  return <div className="page private-capacity-network">
    <PageHeader icon={Network} title="Network" subtitle="Control who can see each truck’s current capacity and approximate location."/>
    <Flash error={query.error} success={query.success}/>
    <aside className="permission-note"><ShieldCheck aria-hidden="true"/><div><strong>Truck-specific access</strong><span>People you approve see the same location radius chosen by the Driver. Remove access at any time.</span></div></aside>
    <div className="network-truck-list">{vehicles.map(vehicle=>{const active=vehicle.grants.filter((grant:any)=>!grant.revoked_at);const loadgistic=active.find((grant:any)=>grant.audience_type==='LOADGISTIC');return <section className="card network-truck-card" key={vehicle.id}>
      <header><Truck aria-hidden="true"/><div><small>{vehicle.platform_number}</small><h2>{vehicle.make} {vehicle.model}</h2><p>{vehicle.cargo_configuration}{vehicle.driver_name?` · Driver ${vehicle.driver_name}`:''}</p></div></header>
      <form action="/api/capacity-network" method="post" className="network-add-contact"><input type="hidden" name="action" value="GRANT"/><input type="hidden" name="vehicleId" value={vehicle.id}/><label><Mail aria-hidden="true"/><span>Share with an email</span><input name="email" type="email" autoComplete="email" placeholder="name@example.com" required/></label><button className="button small">Add access</button></form>
      <form action="/api/capacity-network" method="post" className="network-platform-share"><input type="hidden" name="action" value="LOADGISTIC"/><input type="hidden" name="vehicleId" value={vehicle.id}/><input type="hidden" name="enabled" value={loadgistic?'':'on'}/><div><ShieldCheck aria-hidden="true"/><span><strong>Share with Loadgistic</strong><small>Lets our Assisted matching team consider this truck when a visitor asks for help.</small></span></div><button className={`button small ${loadgistic?'secondary':''}`}>{loadgistic?'Stop sharing':'Share'}</button></form>
      <div className="network-access-list"><h3>Capacity access</h3>{active.filter((grant:any)=>grant.audience_type==='EMAIL').map((grant:any)=><article key={grant.id}><UserRound aria-hidden="true"/><div><strong>{grant.recipient_email}</strong><span>Added by {grant.created_by_name} · Recipient verifies this email when opening Shared capacity</span></div><form action="/api/capacity-network" method="post"><input type="hidden" name="action" value="REVOKE"/><input type="hidden" name="grantId" value={grant.id}/><button className="button danger small">Remove</button></form></article>)}{!active.some((grant:any)=>grant.audience_type==='EMAIL')?<p className="meta">No email access has been added for this truck.</p>:null}</div>
    </section>})}</div>
    {!vehicles.length?<div className="empty-state"><Truck aria-hidden="true"/><strong>No available trucks</strong><span>Add or assign an active truck before sharing capacity.</span></div>:null}
  </div>;
}
