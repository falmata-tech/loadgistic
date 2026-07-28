import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-loadgistic.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);
const repo=await import('../src/lib/repository.js');
const dbModule=await import('../src/lib/db.js');

test('seeded users and role workspaces exist',()=>{
 const shipper=repo.findUserByEmail('shipper@loadgistic.local');
 const transporter=repo.findUserByEmail('transporter@loadgistic.local');
 assert.equal(shipper.role,'SHIPPER');
 assert.equal(transporter.role,'TRANSPORTER');
 assert.ok(repo.getDashboard(shipper).actions.length>=2);
});

test('seeded pending application belongs only to an inactive tenantless applicant',()=>{
 const db=dbModule.getDb();
 const pending=db.prepare(`SELECT a.id,u.active,u.organization_id,u.provider_profile_id
   FROM applications a JOIN users u ON u.id=a.user_id
   WHERE a.id='app-pending' AND a.status='PENDING'`).get();
 assert.ok(pending);
 assert.equal(pending.active,0);
 assert.equal(pending.organization_id,null);
 assert.equal(pending.provider_profile_id,null);
 const activePending=db.prepare(`SELECT COUNT(*) AS n FROM applications a
   JOIN users u ON u.id=a.user_id WHERE a.status='PENDING' AND u.active=1`).get();
 assert.equal(activePending.n,0);
});

test('seeded assigned load has a chronological tracking history that satisfies its location mode',()=>{
 const shipper=repo.getUserById('user-shipper');
 const shipment=repo.getShipmentForUser(shipper,'shp-freight-active');
 assert.deepEqual(shipment.events.map(event=>event.status),['SENT','AGREED','ASSIGNED','IN_TRANSIT']);
 assert.ok(shipment.events.filter(event=>['ASSIGNED','IN_TRANSIT'].includes(event.status)).every(event=>event.location_area));
 assert.ok(shipment.events.every((event,index,events)=>index===0||new Date(event.created_at)>=new Date(events[index-1].created_at)));
});

test('member directory includes Businesses and transporters with authoritative facts',()=>{
 const providers=repo.listProviders('ALL');
 const fleet=providers.find(p=>p.type==='TRANSPORT_COMPANY');
 assert.equal(fleet.fleet_size,2);
 assert.equal(fleet.active_capacity_count,1);
 assert.ok(providers.some(p=>p.type==='INDEPENDENT_PROVIDER'));
 const directory=repo.listDirectoryProfiles('ALL');
 assert.ok(directory.some(profile=>profile.is_business&&profile.id==='org-shipper'));
 const business=repo.getPublicCompany('blue-nile-trading');
 assert.equal(business.is_business,true);
 assert.equal(business.operating_regions,'Addis Ababa; Adama; Dire Dawa');
 assert.equal(business.fleet_size,0);
 assert.equal(Object.hasOwn(business,'email'),false);
 assert.equal(Object.hasOwn(business,'phone'),false);
 const company=repo.getPublicCompany('blueline-transport');
 assert.equal(company.fleet_size,2);
 assert.equal(company.vehicles.length,2);
});

test('fleet dashboard compares saved Business regions with recorded corridors',()=>{
 const transporter=repo.getUserById('user-transporter');
 const coverage=repo.getFleetNetworkCoverage(transporter);
 assert.ok(coverage.corridors.includes('Addis Ababa ↔ Dire Dawa'));
 assert.equal(coverage.businesses.length,1);
 assert.equal(coverage.businesses[0].name,'Blue Nile Trading PLC');
 assert.ok(coverage.businesses[0].matched_places.includes('addis ababa'));
 assert.match(coverage.businesses[0].coverage_label,/recorded corridors/);
 assert.ok(coverage.routes.some(route=>route.origin==='Addis Ababa'&&route.destination==='Dire Dawa'));
});

test('profile routes separate declarations, reported records, and tracked evidence',()=>{
 const shipper=repo.getUserById('user-shipper');
 const transporter=repo.getUserById('user-transporter');
 const business=repo.getPublicCompany('blue-nile-trading');
 const businessRoute=business.routes.find(route=>route.origin==='Addis Ababa'&&route.destination==='Dire Dawa');
 assert.ok(businessRoute.reported_count>=2);
 assert.ok(businessRoute.tracked_count>=1);
 assert.equal(businessRoute.evidence_label,'Tracked activity');
 const fleet=repo.getPublicCompany('blueline-transport');
 const fleetRoute=fleet.routes.find(route=>route.origin==='Addis Ababa'&&route.destination==='Dire Dawa');
 assert.ok(fleetRoute.reported_count>=1);
 assert.ok(fleetRoute.tracked_count>=1);
 const comparison=repo.getProfileRouteComparison(shipper,fleet);
 assert.ok(comparison.exact_count>=1);
 assert.match(comparison.evidence_label,/tracked/i);

 const own=repo.getOwnCompanyPage(shipper);
 repo.updateCompanyPage(shipper,{
   ...own,
   routes:[...own.routes.map(route=>({origin:route.origin,destination:route.destination})),{origin:'Addis Ababa',destination:'Unmapped Market'}],
   operatingRegions:own.operating_regions,
   contactPhone:own.contact_phone,
   contactEmail:own.contact_email,
   showContactPhoneOnLoads:Boolean(own.show_contact_phone_on_loads),
   published:true
 });
 const updated=repo.getPublicCompany('blue-nile-trading');
 const declaredOnly=updated.routes.find(route=>route.destination==='Unmapped Market');
 assert.equal(declaredOnly.reported_count,0);
 assert.equal(declaredOnly.tracked_count,0);
 assert.equal(declaredOnly.evidence_label,'Declared only');
 assert.throws(()=>repo.updateCompanyPage(transporter,{...repo.getOwnCompanyPage(transporter),routes:[{origin:'Adama',destination:'Adama'}]}),/ROUTE_LOCATIONS_MUST_DIFFER/);
});

test('company driver is assigned to one fleet truck and defaults to full owner-delegated authority',()=>{
 const owner=repo.getUserById('user-transporter');
 const driver=repo.getUserById('user-company-driver');
 const access=repo.getDriverAccess(driver);
 assert.equal(access.kind,'COMPANY');
 assert.equal(access.can_negotiate_loads,true);
 assert.deepEqual(repo.listOwnVehicles(driver).map(vehicle=>vehicle.id),['veh-trans-1']);
 const team=repo.listFleetDrivers(owner);
 assert.equal(team.length,1);
 assert.match(team[0].assigned_vehicles,/Isuzu FSR/);
 assert.throws(()=>repo.listFleetDrivers(driver),/FORBIDDEN/);
});

test('Load and Capacity Boards filter and rank by an owned route',()=>{
 const transporter=repo.getUserById('user-transporter');
 const loads=repo.listLoads(transporter,'ALL',{matchCapacityId:'cap-empty'});
 assert.ok(loads.length>1);
 assert.equal(loads[0].route_match_score,2);
 assert.equal(loads[0].destination,'Dire Dawa');
 assert.ok(loads.every((load,index)=>index===0||loads[index-1].route_match_score>=load.route_match_score));
 assert.ok(repo.listLoads(transporter,'ALL',{q:'beverage'}).every(load=>load.title.includes('Beverage')));

 const shipper=repo.getUserById('user-shipper');
 const capacity=repo.listMarketCapacity(shipper,{matchLoadId:'shp-freight-fixed'});
 assert.equal(capacity[0].route_match_score,2);
 assert.equal(capacity[0].destination,'Dire Dawa');
 assert.ok(repo.listMarketCapacity(shipper,{status:'PARTIAL'}).every(truck=>truck.status==='PARTIAL'));
});

test('Load Board can isolate the provider interests without adding them to Tracking',()=>{
 const driver=repo.getUserById('user-driver');
 repo.expressInterest(driver,'shp-freight-fixed','Interested view fixture');
 const interested=repo.listLoads(driver,'INTERESTED');
 assert.ok(interested.some(load=>load.id==='shp-freight-fixed'));
 assert.ok(interested.every(load=>load.interested));
 assert.equal(repo.listVisibleShipments(driver).some(load=>load.id==='shp-freight-fixed'),false);
});

test('shipper creates quote-requested open freight load',()=>{
 const user=repo.getUserById('user-shipper');
 const result=repo.createShipment(user,{title:'Test quote load',serviceMode:'FREIGHT',distributionMode:'OPEN_MARKET',priceMode:'QUOTE_REQUESTED',origin:'Addis Ababa',destination:'Jimma',cargoDescription:'Test goods',packageCount:'5',loadType:'PTL',pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10),trackingMode:'STATUS_ONLY'});
 const shipment=repo.getShipmentForUser(user,result.id);
 assert.equal(shipment.price_mode,'QUOTE_REQUESTED');
 assert.equal(shipment.operational_status,'POSTED');
 assert.equal(shipment.load_type,'PTL');
});

test('road freight creation rejects a missing FTL or PTL requirement',()=>{
 const user=repo.getUserById('user-shipper');
 assert.throws(()=>repo.createShipment(user,{title:'Missing load type',serviceMode:'FREIGHT',distributionMode:'OPEN_MARKET',priceMode:'QUOTE_REQUESTED',origin:'Addis Ababa',destination:'Jimma',cargoDescription:'Test goods',pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10)}),/FREIGHT_LOAD_TYPE_REQUIRED/);
});

test('capacity update enforces partial percentage and expires old vehicle record',()=>{
 const user=repo.getUserById('user-driver');
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'PARTIAL',availablePercent:'',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'}),/CAPACITY_PERCENT_REQUIRED/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'FULL',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'}),/INVALID_CAPACITY_STATUS/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'EMPTY',acceptedLoads:'',locationArea:'Around Addis Ababa',visibility:'OPEN'}),/ACCEPTED_LOADS_REQUIRED/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'EMPTY',acceptedLoads:'FTL',locationArea:'',visibility:'OPEN'}),/CAPACITY_AREA_REQUIRED/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'EMPTY',acceptedLoads:'FTL',locationArea:'Around Addis Ababa',visibility:'OPEN',locationSource:'DEVICE_OBSCURED',approximateLat:'9',approximateLng:'38.5',locationPrecisionKm:'5'}),/INVALID_APPROXIMATE_LOCATION/);
 const id=repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'PARTIAL',availablePercent:'55',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',approximateLat:'9',approximateLng:'38.5',locationPrecisionKm:'40',locationSource:'DEVICE_OBSCURED',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN',openToContractLanes:true,acceptsMultiStop:true});
 const rows=repo.listCapacity(user);
 assert.ok(rows.some(r=>r.id===id&&r.available_percent===55&&r.accepts_full_load===1&&r.accepts_partial_load===1&&r.location_area==='Around Addis Ababa'&&r.location_source==='DEVICE_OBSCURED'&&r.location_precision_km===40&&r.open_to_contract_lanes===1&&r.accepts_multi_stop===1));
 const audit=dbModule.getDb().prepare(`SELECT details FROM audit_logs WHERE entity_id=?`).get(id);
 assert.equal(audit.details.includes('38.5'),false);
 const offDutyId=repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'OFF_DUTY',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'});
 const publicRows=repo.listPublicCapacity();
 assert.equal(publicRows.some(r=>r.id===offDutyId),false);
});

test('provider Capacity Board excludes own trucks and does not expose photo paths',()=>{
 const driver=repo.getUserById('user-driver');
 const rows=repo.listMarketCapacity(driver);
 assert.equal(rows.some(row=>row.provider_profile_id===driver.provider_profile_id),false);
 assert.ok(rows.every(row=>!Object.hasOwn(row,'photo_path')));
});

test('saved relationship capacity is visible only to the related business',()=>{
 const shipper=repo.getUserById('user-shipper');
 const receiver=repo.getUserById('user-receiver');
 const shipperRows=repo.listCapacity(shipper);
 const receiverRows=repo.listCapacity(receiver);
 assert.ok(shipperRows.some(r=>r.id==='cap-partner-partial'&&r.relationshipVisible));
 assert.equal(receiverRows.some(r=>r.id==='cap-partner-partial'),false);
});


test('business application approval provisions a workspace and keeps account phone private',()=>{
 const appId=repo.createBusinessApplication({name:'Test Applicant',businessName:'Test Freight PLC',email:'test-applicant@loadgistic.local',phone:'+251 911 700 100',password:'StrongPass123!',applicationType:'TRANSPORT_COMPANY',notes:'Local test'});
 const pending=repo.getApplicationStatus('test-applicant@loadgistic.local');
 assert.equal(pending.status,'PENDING');
 const admin=repo.getUserById('user-admin');
 repo.reviewApplication(admin,appId,'APPROVED','Verified in local test');
 const user=repo.findUserByEmail('test-applicant@loadgistic.local');
 assert.equal(user.active,1);
 assert.equal(user.phone,'+251 911 700 100');
 const hydrated=repo.getUserById(user.id);
 assert.ok(hydrated.organization_id);
 const billing=repo.getBillingSummary(hydrated);
 assert.equal(billing.subscription.status,'PAYMENT_UNDER_REVIEW');
});

test('manual payment proof can be submitted and approved',()=>{
 const user=repo.getUserById('user-shipper');
 const proofId=repo.submitPaymentProof(user,'1200','LOCAL-REF-1');
 const admin=repo.getUserById('user-admin');
 repo.reviewPaymentProof(admin,proofId,'APPROVED');
 const proofs=repo.listPaymentProofs(admin);
 assert.equal(proofs.find(p=>p.id===proofId).status,'APPROVED');
});

test.after(()=>{dbModule.closeDb();for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);});
