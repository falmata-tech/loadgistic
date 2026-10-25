'use client';
import React from 'react';
import {Network,Search,Truck} from 'lucide-react';
import {Text} from './localization';
import {WorkspaceTaskDialog} from './workspace-task-dialog';
import {CapacityBusinessShare,RemoveBusinessCapacityShare} from './capacity-business-share';
import {CapacityAccountShare,RemoveAccountCapacityShare,type AccountVehicleGrant} from './capacity-account-share';
import {capacitySharingLabel} from '@/lib/capacity-sharing';
import type {AccountConnection} from '@/lib/account-directory';
import styles from './vehicle-sharing-board.module.css';

type BusinessGrant={id:string;name:string;handle:string;city:string|null;revision:number;revoked_at:string|null};
export type SharingVehicle={id:string;platform_number:string;make:string;model:string;cargo_configuration:string;driver_name:string|null;sharing_mode:string;business_grants?:BusinessGrant[];account_grants?:AccountVehicleGrant[]};
export function VehicleSharingBoard({vehicles,connections}:{vehicles:SharingVehicle[];connections:AccountConnection[]}){
 const [selectedId,setSelectedId]=React.useState(vehicles[0]?.id||''),[query,setQuery]=React.useState('');
 const matches=vehicles.filter(vehicle=>`${vehicle.platform_number} ${vehicle.make} ${vehicle.model} ${vehicle.driver_name||''}`.toLowerCase().includes(query.trim().toLowerCase()));
 const selected=matches.find(vehicle=>vehicle.id===selectedId)||matches[0];
 const businessGrants=selected?.business_grants?.filter(grant=>!grant.revoked_at)||[];
 const accountGrants=selected?.account_grants?.filter(grant=>grant.effective)||[];
 return <div className={styles.board}>
  <aside className={styles.picker}><h2><Text message="Choose a vehicle"/></h2><label className={styles.search}><Search aria-hidden="true"/><span className="sr-only"><Text message="Find a vehicle"/></span><input aria-label="Find a vehicle" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Number, model or driver" maxLength={80}/></label>
   <div className={styles.list}>{matches.map(vehicle=><button className={styles.choice} type="button" key={vehicle.id} aria-pressed={selected?.id===vehicle.id} onClick={()=>setSelectedId(vehicle.id)}><strong>{vehicle.platform_number}</strong><span>{vehicle.make} {vehicle.model}</span></button>)}{!matches.length?<p className={styles.empty}><Text message="No vehicles match this search."/></p>:null}</div>
  </aside>
  {selected?<article className={styles.detail}><header className={styles.head}><Truck aria-hidden="true"/><div><h2>{selected.make} {selected.model}</h2><p>{selected.platform_number}{selected.driver_name?` · ${selected.driver_name}`:''}</p><p>{selected.cargo_configuration} · <Text message={capacitySharingLabel(selected.sharing_mode)}/></p></div></header>
   <div className={styles.actions}><WorkspaceTaskDialog title="Share vehicle" triggerLabel="Share with connection" triggerClassName="button small" icon={<Network aria-hidden="true"/>}><CapacityAccountShare vehicleId={selected.id} connections={connections} grants={selected.account_grants||[]}/></WorkspaceTaskDialog><WorkspaceTaskDialog title="Share with shipper or broker" triggerLabel="Find shipper or broker"><CapacityBusinessShare vehicleId={selected.id}/></WorkspaceTaskDialog></div>
   <section className={styles.section}><h3><Text message="Who can see this vehicle"/></h3>{!businessGrants.length&&!accountGrants.length?<p className={styles.empty}><Text message="No private access is active for this vehicle."/></p>:null}
    {accountGrants.map(grant=><div className={styles.grant} key={grant.id}><div><strong>{grant.recipient_name}</strong><span><Text message="Network connection"/></span></div><RemoveAccountCapacityShare grant={grant}/></div>)}
    {businessGrants.map(grant=><div className={styles.grant} key={grant.id}><div><strong>{grant.name}</strong><span>@{grant.handle}{grant.city?` · ${grant.city}`:''}</span></div><RemoveBusinessCapacityShare grantId={grant.id} revision={grant.revision}/></div>)}
   </section>
  </article>:null}
 </div>;
}
