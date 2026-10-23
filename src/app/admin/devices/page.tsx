import Link from 'next/link';
import {Satellite,ArrowLeft,Plus} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {PageHeader} from '@/components/page-header';
import {Text} from '@/components/localization';
import {AdminDeviceProvision} from '@/components/admin-device-provision';
import {Pagination} from '@/components/pagination';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import {getAdminDemoFixtureChoices,getAdminProviderDevices,searchAdminTransportProviders} from '@/lib/telematics.js';
import {readSyntheticGatewayDevice} from '@/lib/telematics-gateway-registration.js';
import {gpsDeviceDisplayLabel} from '@/lib/demo-admin-spare.js';
export default async function AdminDevices({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['ADMIN']),query=await searchParams;
 const searchTerm=String(query.q||'').trim().slice(0,120);
 const data=searchTerm?await searchAdminTransportProviders(user,searchTerm,Number(query.page)||1,8):null;
 const owners=(data?.items||[]).map(row=>({id:row.id,name:row.name,kind:row.record_kind}));
 const selectedKind:'ORGANIZATION'|'PROVIDER_PROFILE'|null=query.kind==='ORGANIZATION'||query.kind==='PROVIDER_PROFILE'?query.kind:null;
 const selected=query.owner&&selectedKind?await getAdminProviderDevices(user,query.owner,selectedKind,Number(query.devicePage)||1):null;
 const selectedOwner=selected&&selectedKind?{id:selected.owner.id,name:selected.owner.name,kind:selectedKind}:null;
 const fixtureChoices=selectedOwner&&process.env.TELEMATICS_DEMO_GATEWAY_ID?await getAdminDemoFixtureChoices(user,selectedOwner.id,selectedOwner.kind):[];
 const demoFixtures=await Promise.all(fixtureChoices.map(async fixture=>({imei:fixture.imei,label:fixture.label,linked:fixture.linked,
  ready:!fixture.linked&&(fixture.registration==='CREATE'||await readSyntheticGatewayDevice(process.env.TELEMATICS_DEMO_GATEWAY_ID!,fixture.imei).then(()=>true).catch(()=>false))})));
 const remainingOwners=owners.filter(owner=>owner.id!==selected?.owner.id);
 const ownerPath=(id:string,kind:string,devicePage?:number)=>`/admin/devices?${new URLSearchParams({...(query.q?{q:query.q}:{}),...(query.page?{page:query.page}:{}),owner:id,kind,...(devicePage?{devicePage:String(devicePage)}:{})})}`;
 return <div className="page"><PageHeader icon={Satellite} title={<Text message="Fleet GPS devices"/>} action={<Link href="/admin/operations?view=TRUCKS" className="button secondary small"><ArrowLeft size={16}/><Text message="Vehicles"/></Link>}/><form method="get" className="board-filter-bar"><label><Text message="Find transport provider"/><input name="q" maxLength={120} defaultValue={query.q||''}/></label><button className="button secondary"><Text message="Search"/></button></form>
  {selected?<section className="stack" aria-label={`${selected.owner.name} GPS devices`}><h2 style={{fontSize:'1.2rem',lineHeight:1.3,margin:0}}>{selected.owner.name}</h2>
   <WorkspaceTaskDialog title="Add GPS device" triggerLabel="Add GPS device" triggerClassName="button" icon={<Plus aria-hidden="true"/>}><AdminDeviceProvision owners={selectedOwner?[selectedOwner]:[]} selectedOwnerId={selected.owner.id} gatewayId={process.env.TELEMATICS_DEFAULT_GATEWAY_ID===process.env.TELEMATICS_DEMO_GATEWAY_ID?'':process.env.TELEMATICS_DEFAULT_GATEWAY_ID||''} demoGatewayId={process.env.TELEMATICS_DEMO_GATEWAY_ID||''} demoFixtures={demoFixtures} syntheticOnlyLocal={process.env.TELEMATICS_LOCAL_SYNTHETIC_ONLY==='true'} query={searchTerm} providerPage={data?.pagination.page||1}/></WorkspaceTaskDialog>
   {selected.items.length?<div className="form-grid">{selected.items.map(device=><details className="card" key={device.id}><summary><strong>{gpsDeviceDisplayLabel(device)}</strong>{device.synthetic&&!gpsDeviceDisplayLabel(device).toLowerCase().includes('demo')?<span className="meta"> · <Text message="Demo GPS device"/></span>:null}<span className="meta" style={{display:'block',margin:'0.25rem 0 0 1.2rem'}}>{device.assignedVehicleLabel?<><Text message="Assigned vehicle"/>: {device.assignedVehicleLabel}</>:<Text message="Not assigned to a vehicle"/>}</span></summary><p className="meta">{device.last_seen_at?<><Text message="Last report"/>: <time dateTime={device.last_seen_at}>{new Date(device.last_seen_at).toLocaleString()}</time></>:<Text message="No GPS report yet."/>}</p></details>)}</div>:<p><Text message="No GPS devices linked to this provider yet."/></p>}
   <p className="meta"><Text message="The provider assigns devices to vehicles in Fleet."/></p>
   {selected.pageCount>1?<nav aria-label="Device pages"><span>{selected.page} / {selected.pageCount}</span>{selected.page>1?<Link className="button secondary small" href={ownerPath(selected.owner.id,selectedKind!,selected.page-1)}><Text message="Previous"/></Link>:null}{selected.page<selected.pageCount?<Link className="button secondary small" href={ownerPath(selected.owner.id,selectedKind!,selected.page+1)}><Text message="Next"/></Link>:null}</nav>:null}</section>:null}
  {!selected&&!data?<p className="meta"><Text message="Search by provider name to add or review GPS devices."/></p>:null}
  {data?<>{remainingOwners.length?<nav className="form-grid" aria-label="Transport providers">{remainingOwners.map(owner=><Link key={owner.id} href={ownerPath(owner.id,owner.kind)} className="button secondary small">{owner.name}</Link>)}</nav>:!selected?<p className="meta"><Text message="No transport providers found."/></p>:null}
   {!selected||data.pagination.pageCount>1?<Pagination path="/admin/devices" query={{q:searchTerm}} page={data.pagination.page} pageCount={data.pagination.pageCount} total={data.pagination.total}/>:null}</>:null}
 </div>;
}
