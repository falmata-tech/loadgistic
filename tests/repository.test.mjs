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

test('bounded result pages clamp size and keep deterministic page slices',()=>{
 const rows=Array.from({length:27},(_,index)=>({id:index+1}));
 const first=repo.paginateResults(rows,{page:1,pageSize:10});
 const third=repo.paginateResults(rows,{page:3,pageSize:10});
 assert.deepEqual(first.items.map(row=>row.id),[1,2,3,4,5,6,7,8,9,10]);
 assert.deepEqual(third.items.map(row=>row.id),[21,22,23,24,25,26,27]);
 assert.equal(third.total,27);
 assert.equal(third.pageCount,3);
 assert.equal(repo.paginateResults(rows,{page:99,pageSize:500}).pageSize,100);
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
 assert.equal(business.operating_regions,'Addis Ababa, Ethiopia; Adama, Ethiopia; Dire Dawa, Ethiopia');
 assert.equal(business.fleet_size,0);
 assert.equal(Object.hasOwn(business,'email'),false);
 assert.equal(Object.hasOwn(business,'phone'),false);
 const company=repo.getPublicCompany('blueline-transport');
 assert.equal(company.fleet_size,2);
 assert.equal(company.vehicles.length,2);
 assert.ok(company.vehicles.every(vehicle=>/^LG-TRK-[A-Z0-9]+$/.test(vehicle.platform_number)));
 assert.equal(new Set(company.vehicles.map(vehicle=>vehicle.platform_number)).size,company.vehicles.length);
 assert.ok(company.live_routes.some(route=>route.route_kind==='PLANNED'&&route.platform_number));
 const firstPage=repo.listDirectoryProfiles('ALL',{page:1,pageSize:2});
 const secondPage=repo.listDirectoryProfiles('ALL',{page:2,pageSize:2});
 assert.equal(firstPage.items.length,2);
 assert.equal(firstPage.items.some(first=>secondPage.items.some(second=>second.id===first.id)),false);
});

test('seeded low rating is private, excluded from reputation, and safely projected to administrators',()=>{
 const shipper=repo.getUserById('user-shipper');
 const receiver=repo.getUserById('user-receiver');
 const admin=repo.getUserById('user-admin');
 const subject=repo.getPublicCompany('fresh-foods-distribution');
 assert.equal(subject.review_count,0);
 assert.equal(repo.getShipmentForUser(receiver,'shp-freight-completed').business_reviews.length,0);
 const own=repo.getShipmentForUser(shipper,'shp-freight-completed').business_reviews;
 assert.equal(own.find(review=>review.id==='review-pending-demo').status,'PENDING');
 const queued=repo.listRatingModerationQueue(admin).find(review=>review.id==='review-pending-demo');
 assert.equal(queued.rating,2);
 assert.equal(queued.shipment_code,'LGX-F2007');
 for(const secret of ['receiver_phone','tracking_code_hash','tracking_token','file_path','location_lat','location_lng']){
  assert.equal(Object.hasOwn(queued,secret),false);
 }
});

test('fleet dashboard compares saved Business regions with Preferred and fresh truck routes',()=>{
 const transporter=repo.getUserById('user-transporter');
 const coverage=repo.getFleetNetworkCoverage(transporter);
 assert.ok(coverage.preferred_routes.includes('Addis Ababa, Ethiopia ↔ Dire Dawa, Ethiopia'));
 assert.equal(coverage.businesses.length,1);
 assert.equal(coverage.businesses[0].name,'Blue Nile Trading PLC');
 assert.ok(coverage.businesses[0].matched_places.includes('addis ababa ethiopia'));
 assert.match(coverage.businesses[0].coverage_label,/recorded routes/);
 assert.ok(coverage.routes.some(route=>route.origin==='Addis Ababa, Ethiopia'&&route.destination==='Dire Dawa, Ethiopia'));
 assert.ok(coverage.routes.some(route=>route.route_kind==='PLANNED'));
});

test('profile routes separate declarations, reported records, and tracked evidence',()=>{
 const shipper=repo.getUserById('user-shipper');
 const transporter=repo.getUserById('user-transporter');
 const business=repo.getPublicCompany('blue-nile-trading');
 const businessRoute=business.routes.find(route=>route.origin==='Addis Ababa, Ethiopia'&&route.destination==='Dire Dawa, Ethiopia');
 assert.ok(businessRoute.reported_count>=2);
 assert.ok(businessRoute.tracked_count>=1);
 assert.equal(businessRoute.evidence_label,'Tracked activity');
 const fleet=repo.getPublicCompany('blueline-transport');
 const fleetRoute=fleet.routes.find(route=>route.origin==='Addis Ababa, Ethiopia'&&route.destination==='Dire Dawa, Ethiopia');
 assert.ok(fleetRoute.reported_count>=1);
 assert.ok(fleetRoute.tracked_count>=1);
 const comparison=repo.getProfileRouteComparison(shipper,fleet);
 assert.ok(comparison.exact_count>=1);
 assert.ok(comparison.area_overlap_count>=1);
 assert.ok(comparison.viewer_areas.some(area=>area.place_label==='Addis Ababa, Ethiopia'));
 assert.ok(comparison.target_areas.some(area=>area.place_label==='Addis Ababa, Ethiopia'));
 assert.match(comparison.evidence_label,/tracked/i);
 const providerComparison=repo.getProfileRouteComparison(transporter,business);
 assert.ok(providerComparison.viewer_routes.some(route=>route.route_kind==='PROFILE'));
 assert.ok(providerComparison.viewer_routes.some(route=>route.route_kind==='PLANNED'));
 const ownProviderRoutes=repo.getOwnCompanyPage(transporter).map_routes;
 assert.ok(ownProviderRoutes.every(route=>providerComparison.viewer_routes.some(viewerRoute=>viewerRoute.id===route.id)));

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
 const declaredOnly=updated.routes.find(route=>route.destination==='Unmapped Market, Ethiopia');
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
 assert.equal(loads[0].destination,'Dire Dawa, Ethiopia');
 assert.ok(loads.every((load,index)=>index===0||loads[index-1].route_match_score>=load.route_match_score));
 assert.ok(repo.listLoads(transporter,'ALL',{q:'beverage'}).every(load=>load.title.includes('Beverage')));
 assert.ok(repo.listLoads(transporter,'ALL',{priceMode:'QUOTE_REQUESTED'}).every(load=>load.price_mode==='QUOTE_REQUESTED'));
 const priced=repo.listLoads(transporter,'ALL',{minPriceEtb:'48000',maxPriceEtb:'49000'});
 assert.ok(priced.length>=1);
 assert.ok(priced.every(load=>(load.price_minor||load.target_price_minor)>=4_800_000&&(load.price_minor||load.target_price_minor)<=4_900_000));
 const routeOptions=repo.listOwnTruckRouteOptions(transporter);
 assert.equal(routeOptions[0].id,'ALL_ACTIVE');
 assert.ok(routeOptions.some(route=>route.id==='cap-empty'&&route.source_label==='Planned route'&&route.route_date));
 assert.equal(repo.listLoads(transporter,'ALL',{matchCapacityId:'ALL_ACTIVE'})[0].route_match_score,2);

 const shipper=repo.getUserById('user-shipper');
 const capacity=repo.listMarketCapacity(shipper,{matchLoadId:'shp-freight-fixed'});
 assert.equal(capacity[0].route_match_score,2);
 assert.equal(capacity[0].destination,'Dire Dawa, Ethiopia');
 assert.ok(repo.listMarketCapacity(shipper,{status:'PARTIAL'}).every(truck=>truck.status==='PARTIAL'));
 assert.ok(repo.listMarketCapacity(shipper,{minAvailable:'100'}).every(truck=>truck.available_percent===100));
 assert.ok(repo.listMarketCapacity(shipper,{stopOption:'DIRECT_ONLY'}).every(truck=>!truck.accepts_multi_pick&&!truck.accepts_multi_drop));
 assert.ok(repo.listMarketCapacity(shipper,{visibility:'SAVED_PARTNERS'}).every(truck=>truck.visibility==='SAVED_PARTNERS'));
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

test('local loads use a structured locality and keep exact points out of the marketplace',()=>{
 const shipper=repo.getUserById('user-shipper');
 const driver=repo.getUserById('user-driver');
 const pickupDate=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const result=repo.createShipment(shipper,{
  title:'Local maker delivery',
  serviceMode:'FREIGHT',
  distributionMode:'OPEN_MARKET',
  priceMode:'QUOTE_REQUESTED',
  movementScope:'LOCAL',
  localPlaceRef:'builtin:addis ababa',
  localPlaceLabel:'Addis Ababa, Ethiopia',
  pickupAreaLabel:'Bole',
  dropoffAreaLabel:'Saris',
  pickupLat:'9.014',
  pickupLng:'38.781',
  dropoffLat:'8.958',
  dropoffLng:'38.742',
  cargoDescription:'Packed artisan goods',
  loadType:'PTL',
  pickupDate,
  trackingMode:'STATUS_ONLY'
 });
 const stored=dbModule.getDb().prepare('SELECT * FROM shipments WHERE id=?').get(result.id);
 assert.equal(stored.movement_scope,'LOCAL');
 assert.equal(stored.origin,'Addis Ababa, Ethiopia');
 assert.equal(stored.pickup_lat,9.014);
 const ownerView=repo.getShipmentForUser(shipper,result.id);
 assert.equal(ownerView.pickup_lat,9.014);
 const marketDetail=repo.getShipmentForUser(driver,result.id);
 assert.equal(Object.hasOwn(marketDetail,'pickup_lat'),false);
 assert.equal(Object.hasOwn(marketDetail,'dropoff_lng'),false);
 const board=repo.listLoadsPage(driver,'ALL',{movementScope:'LOCAL',localPlaceRef:'builtin:addis ababa'},{page:1,pageSize:5});
 assert.ok(board.items.some(load=>load.id===result.id));
 assert.ok(board.items.every(load=>!Object.hasOwn(load,'pickup_lat')&&!Object.hasOwn(load,'dropoff_lng')));
});

test('road freight creation rejects a missing FTL or PTL requirement',()=>{
 const user=repo.getUserById('user-shipper');
 assert.throws(()=>repo.createShipment(user,{title:'Missing load type',serviceMode:'FREIGHT',distributionMode:'OPEN_MARKET',priceMode:'QUOTE_REQUESTED',origin:'Addis Ababa',destination:'Jimma',cargoDescription:'Test goods',pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10)}),/FREIGHT_LOAD_TYPE_REQUIRED/);
});

test('receiver-owned load keeps owner separate from an external shipper',()=>{
 const receiver=repo.getUserById('user-receiver');
 const result=repo.createShipment(receiver,{
  title:'Inbound workshop materials',
  serviceMode:'FREIGHT',
  distributionMode:'OPEN_MARKET',
  priceMode:'QUOTE_REQUESTED',
  ownerPartyRole:'RECEIVER',
  counterpartyType:'EXTERNAL',
  externalCounterpartyName:'Dilla Craft Cooperative',
  externalCounterpartyPhone:'+251 900 111 222',
  origin:'Dilla',
  destination:'Hawassa',
  cargoDescription:'Packed workshop materials',
  loadType:'PTL',
  pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10),
  trackingMode:'STATUS_ONLY'
 });
 const stored=dbModule.getDb().prepare('SELECT * FROM shipments WHERE id=?').get(result.id);
 assert.equal(stored.load_owner_organization_id,receiver.organization_id);
 assert.equal(stored.load_owner_party_role,'RECEIVER');
 assert.equal(stored.external_shipper_name,'Dilla Craft Cooperative');
 const visible=repo.getShipmentForUser(receiver,result.id);
 assert.equal(visible.shipper_name,'Dilla Craft Cooperative');
 assert.equal(visible.load_owner_name,receiver.organization_name);
});

test('Business favorites rank first in bounded member search',()=>{
 const receiver=repo.getUserById('user-receiver');
 const shipper=repo.getUserById('user-shipper');
 repo.setBusinessFavorite(receiver,shipper.organization_id,true);
 const results=repo.searchDirectory(receiver,'Blue','BUSINESS',20);
 assert.equal(results[0].id,shipper.organization_id);
 assert.equal(results[0].is_favorite,1);
 assert.equal(repo.getNetworkState(receiver,'org',shipper.organization_id).connect_eligible,false);
});

test('place search falls back locally and compatible PTL loads form a virtual pool',()=>{
 const driver=repo.getUserById('user-driver');
 const shipper=repo.getUserById('user-shipper');
 const addis=repo.searchPlaces('Add',20).find(place=>place.name==='Addis Ababa');
 assert.equal(addis?.display_name,'Addis Ababa, Ethiopia');
 assert.equal(addis?.country_code,'ET');
 const pickupDate=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const ids=['one','two'].map((suffix,index)=>repo.createShipment(shipper,{
  title:`Pool fixture ${suffix}`,
  serviceMode:'FREIGHT',
  distributionMode:'OPEN_MARKET',
  priceMode:'QUOTE_REQUESTED',
  origin:'Addis Ababa',
  destination:'Adama',
  cargoDescription:'Shareable packed goods',
  loadType:'PTL',
  pickupDate,
  trackingMode:'STATUS_ONLY'
 }).id);
 const group=repo.listPooledLoads(driver).find(pool=>ids.every(id=>pool.members.some(load=>load.id===id)));
 assert.ok(group);
 assert.equal(repo.getPooledLoad(driver,group.id).id,group.id);
 assert.ok(ids.every(id=>dbModule.getDb().prepare('SELECT operational_status FROM shipments WHERE id=?').get(id).operational_status==='POSTED'));
});

test('capacity update enforces partial percentage and expires old vehicle record',()=>{
 const user=repo.getUserById('user-driver');
 const routeDate=new Date(Date.now()+2*86_400_000).toISOString().slice(0,10);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'PARTIAL',availablePercent:'',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'}),/CAPACITY_PERCENT_REQUIRED/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'FULL',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'}),/INVALID_CAPACITY_STATUS/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'EMPTY',acceptedLoads:'',locationArea:'Around Addis Ababa',visibility:'OPEN'}),/ACCEPTED_LOADS_REQUIRED/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'EMPTY',acceptedLoads:'FTL',locationArea:'',visibility:'OPEN'}),/CAPACITY_AREA_REQUIRED/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'EMPTY',acceptedLoads:'FTL',locationArea:'Around Addis Ababa',visibility:'OPEN',locationSource:'DEVICE_OBSCURED',approximateLat:'9',approximateLng:'38.5',locationPrecisionKm:'5'}),/INVALID_APPROXIMATE_LOCATION/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'PARTIAL',availablePercent:'55',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',currentRouteOrigin:'Addis Ababa',currentRouteDestination:'Adama',visibility:'OPEN'}),/CURRENT_ROUTE_DATE_REQUIRED/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'EMPTY',acceptedLoads:'FTL',locationArea:'Around Addis Ababa',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'}),/PLANNED_ROUTE_DATE_REQUIRED/);
 const id=repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'PARTIAL',availablePercent:'55',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',approximateLat:'9',approximateLng:'38.5',locationPrecisionKm:'40',locationSource:'DEVICE_OBSCURED',currentRouteOrigin:'Addis Ababa',currentRouteDestination:'Adama',currentRouteDate:routeDate,origin:'Addis Ababa',destination:'Hawassa',travelDate:routeDate,plannedSpaceStatus:'PARTIAL',visibility:'OPEN',openToContractLanes:true,acceptsMultiStop:true});
 const rows=repo.listCapacity(user);
 assert.ok(rows.some(r=>r.id===id&&r.available_percent===55&&r.accepts_full_load===1&&r.accepts_partial_load===1&&r.location_area==='Around Addis Ababa, Ethiopia'&&r.location_source==='DEVICE_OBSCURED'&&r.location_precision_km===40&&r.current_route_date===routeDate&&r.planned_space_status==='PARTIAL'&&r.open_to_contract_lanes===1&&r.accepts_multi_pick===1&&r.accepts_multi_drop===1));
 const audit=dbModule.getDb().prepare(`SELECT details FROM audit_logs WHERE entity_id=?`).get(id);
 assert.equal(audit.details.includes('38.5'),false);
 const offDutyId=repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'OFF_DUTY',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'});
 const publicRows=repo.listPublicCapacity();
 assert.equal(publicRows.some(r=>r.id===offDutyId),false);
});

test('local capacity can publish without an intercity route and is filterable by locality',()=>{
 const driver=repo.getUserById('user-driver');
 const shipper=repo.getUserById('user-shipper');
 const id=repo.publishCapacity(driver,{
  vehicleId:'veh-driver-1',
  status:'EMPTY',
  acceptedLoads:'BOTH',
  movementScope:'LOCAL',
  localPlaceRef:'builtin:addis ababa',
  localPlaceLabel:'Addis Ababa, Ethiopia',
  localRadiusKm:'25',
  visibility:'OPEN'
 });
 const own=repo.getCapacityForUser(driver,id);
 assert.equal(own.movement_scope,'LOCAL');
 assert.equal(own.local_radius_km,25);
 assert.equal(own.origin,null);
 const localPage=repo.listMarketCapacityPage(shipper,{movementScope:'LOCAL',localPlaceRef:'builtin:addis ababa'},{page:1,pageSize:10});
 assert.ok(localPage.items.some(capacity=>capacity.id===id));
 assert.ok(localPage.items.every(capacity=>['LOCAL','BOTH'].includes(capacity.movement_scope)));
});

test('admin operations inventory is bounded and omits sensitive fields',()=>{
 const admin=repo.getUserById('user-admin');
 const operations=repo.getAdminOperations(admin,'LG-TRK');
 assert.ok(operations.vehicles.length>=3);
 assert.ok(operations.vehicles.every(vehicle=>vehicle.platform_number));
 assert.ok(operations.capacities.every(capacity=>!Object.hasOwn(capacity,'location_lat')&&!Object.hasOwn(capacity,'photo_path')));
 assert.ok(operations.users.every(user=>!Object.hasOwn(user,'password_hash')));
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
 assert.equal(billing.subscription.status,'TRIAL');
 assert.equal(billing.access.granted,true);
 const trialLength=new Date(billing.subscription.ends_at).getTime()-new Date(billing.subscription.starts_at).getTime();
 assert.equal(trialLength,7*86_400_000);
});

test('administrator can sponsor a qualifying Business but not a transport provider',()=>{
 const admin=repo.getUserById('user-admin');
 const businessId=repo.createBusinessApplication({name:'Sponsored Applicant',businessName:'Sponsored Workshop PLC',email:'sponsored-applicant@loadgistic.local',phone:'+251 911 700 101',password:'StrongPass123!',applicationType:'ENTERPRISE_SHIPPER',notes:'Qualifying starting Business'});
 repo.reviewApplication(admin,businessId,'APPROVED','Approved for support',{sponsoredFree:true});
 const business=repo.findUserByEmail('sponsored-applicant@loadgistic.local');
 const billing=repo.getBillingSummary(repo.getUserById(business.id));
 assert.equal(billing.subscription.status,'SPONSORED');
 assert.equal(billing.subscription.ends_at,null);
 assert.equal(billing.access.granted,true);
 assert.throws(()=>repo.submitPaymentProof(repo.getUserById(business.id),'100','NOT-NEEDED'),/PAYMENT_NOT_REQUIRED/);

 const providerId=repo.createBusinessApplication({name:'Provider Applicant',businessName:'Provider Fleet PLC',email:'provider-sponsor-test@loadgistic.local',phone:'+251 911 700 102',password:'StrongPass123!',applicationType:'TRANSPORT_COMPANY',notes:'Cannot be sponsored'});
 assert.throws(()=>repo.reviewApplication(admin,providerId,'APPROVED','Invalid sponsorship',{sponsoredFree:true}),/SPONSORED_ACCESS_BUSINESS_ONLY/);
 assert.equal(repo.getApplicationStatus('provider-sponsor-test@loadgistic.local').status,'PENDING');
});

test('manual payment proof can be submitted and approved',()=>{
 const user=repo.getUserById('user-shipper');
 const proofId=repo.submitPaymentProof(user,'1200','LOCAL-REF-1');
 const admin=repo.getUserById('user-admin');
 repo.reviewPaymentProof(admin,proofId,'APPROVED');
 const proofs=repo.listPaymentProofs(admin);
 assert.equal(proofs.find(p=>p.id===proofId).status,'APPROVED');
 const billing=repo.getBillingSummary(user);
 assert.equal(billing.subscription.status,'ACTIVE');
 const paidLength=new Date(billing.subscription.ends_at).getTime()-new Date(billing.subscription.starts_at).getTime();
 assert.equal(paidLength,30*86_400_000);
});

test.after(()=>{dbModule.closeDb();for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);});
