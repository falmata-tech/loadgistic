import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getDashboard, listFleetDrivers, listOwnCapacity, listOwnVehicles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { relativeTime } from '@/lib/ui';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { CapacityForm } from '@/components/capacity-form';
import { Flash } from '@/components/flash';

export default async function FleetPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(); if(user.role!=='TRANSPORTER') redirect('/app/home'); const query=await searchParams;
 const data:any=getDashboard(user); const vehicles:any[]=listOwnVehicles(user); const capacities:any[]=listOwnCapacity(user); const drivers:any[]=listFleetDrivers(user); const latest=new Map(); for(const item of capacities)if(!latest.has(item.vehicle_id))latest.set(item.vehicle_id,item);
 const vehicleOptions=vehicles.map(vehicle=>({id:String(vehicle.id),label:String(vehicle.label),make:String(vehicle.make||''),model:String(vehicle.model||''),cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''),plate:String(vehicle.plate||''),current:latest.get(vehicle.id)||null}));
 return <div className="page"><PageHeader title="My Fleet" subtitle="Manage every registered truck and keep its market capacity current." action={<Link href="#capacity-update" className="button">Update a truck</Link>}/>
 <Flash error={query.error} success={query.success}/>
 <section className="stats">{Object.entries(data.counts).map(([label,value])=><div className="stat" key={label}><span className="meta">{label}</span><strong>{String(value)}</strong></div>)}</section>
 <section className="card"><div className="page-header compact-header"><div><h2>Trucks</h2><p className="page-subtitle">Latest company-owned capacity signal by truck.</p></div></div><div className="list">{vehicles.map(vehicle=>{const cap:any=latest.get(vehicle.id);return <div className="list-row fleet-truck-row" key={vehicle.id}><Image className="truck-thumbnail" src={vehicleConfigurationImage(vehicle.cargo_configuration||vehicle.category)} alt="" width={96} height={96}/><div><strong>{vehicle.make} · {vehicle.model}</strong><div className="meta">{vehicle.cargo_configuration||vehicle.category} · {vehicle.plate||'Plate not recorded'}</div></div><div><strong>{cap?.location_area||'Location not updated'}</strong><div className="meta">{cap?.location_updated_at?relativeTime(cap.location_updated_at):'No location timestamp'}</div></div><div>{cap?<StatusPill status={cap.status}/>:<span className="status expired">Not published</span>}</div><Link href={`/app/fleet?vehicle=${vehicle.id}#capacity-update`} className="button secondary small">Update</Link></div>})}</div></section>
 <section className="card fleet-team"><div className="page-header compact-header"><div><h2>Driver access</h2><p className="page-subtitle">Drivers can work with Businesses unless you turn off a capability. Duty On and Off always remains available for assigned trucks.</p></div></div><div className="fleet-driver-list">{drivers.map(driver=><form action={`/api/fleet/drivers/${driver.id}/permissions`} method="post" className="fleet-driver-permissions" key={driver.id}><div className="fleet-driver-identity"><strong>{driver.name}</strong><span>{driver.assigned_vehicles||'No truck assigned'}</span><small>{driver.email}</small></div><div className="permission-toggles"><label><input type="checkbox" name="canBrowseLoadBoard" defaultChecked={Boolean(driver.can_browse_load_board)}/><span>Load Board</span></label><label><input type="checkbox" name="canContactBusinesses" defaultChecked={Boolean(driver.can_contact_businesses)}/><span>Business contact</span></label><label><input type="checkbox" name="canNegotiateLoads" defaultChecked={Boolean(driver.can_negotiate_loads)}/><span>Load agreements</span></label><label><input type="checkbox" name="canManageCapacity" defaultChecked={Boolean(driver.can_manage_capacity)}/><span>Rich capacity</span></label></div><button className="button secondary small">Save access</button></form>)}</div>{!drivers.length?<div className="empty-state">No company driver login is connected to this fleet.</div>:null}</section>
 <section id="capacity-update" className="fleet-capacity-editor"><div className="section-title"><h2>Update truck capacity</h2><p className="page-subtitle">Select one real truck. Its latest status and route are loaded into the controls.</p></div><CapacityForm vehicles={vehicleOptions} initialVehicleId={query.vehicle}/></section>
 </div>;
}
