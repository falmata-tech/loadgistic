import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-loadgistic.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);
const repo=await import('../src/lib/repository.js');
const dbModule=await import('../src/lib/db.js');
const routeRefs=(origin='Addis Ababa',destination='Hawassa')=>({
 originPlaceRef:`builtin:${origin.toLowerCase()}`,
 destinationPlaceRef:`builtin:${destination.toLowerCase()}`
});
const currentRouteRefs=(origin='Addis Ababa',destination='Adama')=>({
 currentOriginPlaceRef:`builtin:${origin.toLowerCase()}`,
 currentDestinationPlaceRef:`builtin:${destination.toLowerCase()}`
});
const locationRef=(place='Addis Ababa')=>({locationPlaceRef:`builtin:${place.toLowerCase()}`});

test('seeded users and role workspaces exist',()=>{
 const shipper=repo.findUserByEmail('shipper@loadgistic.local');
 const transporter=repo.findUserByEmail('transporter@loadgistic.local');
 assert.equal(shipper.role,'SHIPPER');
 assert.equal(transporter.role,'TRANSPORTER');
 assert.ok(repo.getDashboard(shipper).actions.length>=2);
});

test('anonymous marketplace preview is live and limited to an identity-safe whitelist',()=>{
 const preview=repo.listAnonymousMarketplacePreview(3);
 assert.ok(preview.shipments.length>0&&preview.shipments.length<=3);
 assert.ok(preview.trucks.length>0&&preview.trucks.length<=3);
 const shipmentKeys=['delivery_label','destination','distribution_mode','load_type','local_place_label','movement_scope','origin','pickup_label','posted_label','price_minor','price_mode','vehicle_category'];
 const truckKeys=['accepts_full_load','accepts_multi_drop','accepts_multi_pick','accepts_partial_load','available_again_date','available_percent','cargo_configuration','current_route_destination','current_route_origin','freshness','local_place_label','local_radius_km','location_area','location_precision_km','movement_scope','open_to_contract_lanes','origin','destination','planned_space_status','proof_available','status','travel_date','updated_label','vehicle_make','vehicle_model'];
 assert.deepEqual(Object.keys(preview.shipments[0]).sort(),shipmentKeys.sort());
 assert.deepEqual(Object.keys(preview.trucks[0]).sort(),truckKeys.sort());
 const serialized=JSON.stringify(preview);
 for(const privateValue of ['BlueLine Transport PLC','Blue Nile Trading PLC','shipper@loadgistic.local','+251'])assert.equal(serialized.includes(privateValue),false);
 assert.equal(/"(?:id|handle|phone|email|lat|lng|title|cargo_description|photo_path)"/.test(serialized),false);
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

test('seeded signup record belongs to an active workspace member',()=>{
 const db=dbModule.getDb();
 const signup=db.prepare(`SELECT a.id,u.active,u.organization_id,u.provider_profile_id
   FROM applications a JOIN users u ON u.id=a.user_id
   WHERE a.id='app-self-signup' AND a.status='APPROVED'`).get();
 assert.ok(signup);
 assert.equal(signup.active,1);
 assert.ok(signup.organization_id);
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

test('directory separates descriptive search from coordinate proximity',()=>{
 const db=dbModule.getDb();
 const original=db.prepare(`SELECT city,city_place_ref,city_lat,city_lng FROM organizations WHERE id='org-receiver'`).get();
 db.prepare(`UPDATE organizations SET city='A differently named base',city_place_ref='builtin:addis ababa',city_lat=9.03,city_lng=38.74
   WHERE id='org-receiver'`).run();
 try{
  const byText=repo.listDirectoryProfiles('BUSINESS',{q:'Adama',page:1,pageSize:20});
  assert.equal(byText.items.some(profile=>profile.id==='org-shipper'),false);
  const nearby=repo.listDirectoryProfiles('BUSINESS',{
   nearPlaceRef:'builtin:addis ababa',nearPlace:'Addis Ababa, Ethiopia',nearRadiusKm:'10',page:1,pageSize:20
  });
  assert.ok(nearby.items.some(profile=>profile.id==='org-receiver'));
  assert.ok(nearby.items.every(profile=>profile.location_distance_km<=10));
 }finally{
  db.prepare(`UPDATE organizations SET city=?,city_place_ref=?,city_lat=?,city_lng=? WHERE id='org-receiver'`)
    .run(original.city,original.city_place_ref,original.city_lat,original.city_lng);
 }
});

test('directory search matches public phone and owner name without account contacts',()=>{
 const db=dbModule.getDb();
 const profile=db.prepare(`SELECT cp.contact_phone,u.name AS owner_name,u.phone AS login_phone
   FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id
   JOIN memberships m ON m.organization_id=o.id AND m.membership_role='OWNER'
   JOIN users u ON u.id=m.user_id WHERE o.id='org-transporter' LIMIT 1`).get();
 assert.ok(repo.listDirectoryProfiles('TRANSPORT',{q:profile.contact_phone,page:1,pageSize:7}).items.some(item=>item.id==='org-transporter'));
 assert.ok(repo.listDirectoryProfiles('TRANSPORT',{q:profile.owner_name,page:1,pageSize:7}).items.some(item=>item.id==='org-transporter'));
 assert.equal(repo.listDirectoryProfiles('TRANSPORT',{q:profile.login_phone,page:1,pageSize:7}).items.length,0);
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
   routes:[...own.routes,{origin:'Addis Ababa',destination:'Gondar',...routeRefs('Addis Ababa','Gondar')}],
   operatingRegions:own.operating_regions,
   contactPhone:own.contact_phone,
   contactEmail:own.contact_email,
   showContactPhoneOnLoads:Boolean(own.show_contact_phone_on_loads),
   published:true
 });
 const updated=repo.getPublicCompany('blue-nile-trading');
 const declaredOnly=updated.routes.find(route=>route.destination==='Gondar, Ethiopia');
 assert.equal(declaredOnly.reported_count,0);
 assert.equal(declaredOnly.tracked_count,0);
 assert.equal(declaredOnly.evidence_label,'Declared only');
 assert.throws(()=>repo.updateCompanyPage(transporter,{...repo.getOwnCompanyPage(transporter),routes:[{origin:'Adama',destination:'Adama',...routeRefs('Adama','Adama')}]}),/ROUTE_LOCATIONS_MUST_DIFFER/);
});

test('company driver is assigned to one fleet truck and defaults to full owner-delegated authority',()=>{
 const owner=repo.getUserById('user-transporter');
 const driver=repo.getUserById('user-company-driver');
 const access=repo.getDriverAccess(driver);
 assert.equal(access.kind,'COMPANY');
 assert.equal(access.can_negotiate_loads,true);
 assert.deepEqual(repo.listOwnVehicles(driver).map(vehicle=>vehicle.id),['veh-trans-1']);
 const team=repo.listFleetDrivers(owner);
 assert.equal(team.length,2);
 assert.match(team.find(member=>member.id==='user-company-driver').assigned_vehicles,/Isuzu FSR/);
 assert.match(team.find(member=>member.id==='user-company-driver-2').assigned_vehicles,/Sinotruk HOWO TX/);
 assert.throws(()=>repo.listFleetDrivers(driver),/FORBIDDEN/);
});

test('fleet owner exclusively assigns and unassigns company drivers within the owned fleet',()=>{
 const db=dbModule.getDb();
 const owner=repo.getUserById('user-transporter');
 db.prepare(`INSERT INTO users (id,email,phone,password_hash,name,role,organization_id,active,created_at)
   SELECT 'user-company-driver-test','driver-assignment-test@loadgistic.local',phone,password_hash,'Test Driver','DRIVER',organization_id,1,created_at
   FROM users WHERE id='user-company-driver'`).run();
 db.prepare(`INSERT INTO drivers (id,organization_id,user_id,name,phone,license_verified,active)
   VALUES ('driver-company-test','org-transporter','user-company-driver-test','Test Driver','+251 900 111 222',0,1)`).run();
 try{
  repo.assignFleetDriverVehicle(owner,'user-company-driver-test','veh-trans-2');
  repo.assignFleetDriverVehicle(owner,'user-company-driver','veh-trans-2');
  const active=db.prepare(`SELECT driver_user_id,vehicle_id FROM driver_vehicle_assignments WHERE active=1 ORDER BY driver_user_id`).all();
  assert.ok(active.some(row=>row.driver_user_id==='user-company-driver'&&row.vehicle_id==='veh-trans-2'));
  assert.equal(active.some(row=>row.driver_user_id==='user-company-driver-test'),false);
  assert.equal(active.some(row=>row.driver_user_id==='user-company-driver'&&row.vehicle_id==='veh-trans-1'),false);
  repo.assignFleetDriverVehicle(owner,'user-company-driver','');
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM driver_vehicle_assignments WHERE driver_user_id='user-company-driver' AND active=1`).get().n,0);
  assert.throws(()=>repo.publishCapacity(owner,{vehicleId:'veh-trans-2',status:'EMPTY',acceptedLoads:'FTL',movementScope:'INTERCITY',locationArea:'Addis Ababa',...locationRef(),visibility:'OPEN'}),/DRIVER_REQUIRED_FOR_CAPACITY/);
  assert.throws(()=>repo.assignFleetDriverVehicle(owner,'user-company-driver','veh-driver-1'),/NOT_FOUND/);
  assert.ok(db.prepare(`SELECT id FROM audit_logs WHERE action='DRIVER_VEHICLE_ASSIGNED' AND entity_id='user-company-driver'`).get());
 } finally {
  repo.assignFleetDriverVehicle(owner,'user-company-driver','veh-trans-1');
  repo.assignFleetDriverVehicle(owner,'user-company-driver-2','veh-trans-2');
  db.prepare(`DELETE FROM users WHERE id='user-company-driver-test'`).run();
 }
});

test('shipment assignment accepts only a provider truck with its active Driver',()=>{
 const db=dbModule.getDb();
 const owner=repo.getUserById('user-transporter');
 const driver=repo.getUserById('user-company-driver');
 const before=db.prepare(`SELECT commercial_status,operational_status,receiver_first_name,receiver_phone,
   assigned_vehicle_id,assigned_driver_user_id,updated_at FROM shipments WHERE id='shp-transporter-direct'`).get();
 try{
  db.prepare(`UPDATE shipments SET commercial_status='AGREED',operational_status='AGREED',receiver_first_name='Almaz',
    receiver_phone='+251 900 123 456',assigned_vehicle_id=NULL,assigned_driver_user_id=NULL WHERE id='shp-transporter-direct'`).run();
  assert.throws(()=>repo.transitionShipment(owner,'shp-transporter-direct','ASSIGNED'),/SHIPMENT_VEHICLE_REQUIRED/);
  assert.throws(()=>repo.assignShipmentVehicle(owner,'shp-transporter-direct','veh-driver-1'),/INVALID_VEHICLE/);
  assert.deepEqual(repo.listShipmentAssignmentVehicles(driver,'shp-transporter-direct').map(vehicle=>vehicle.id),['veh-trans-1']);
  assert.throws(()=>repo.assignShipmentVehicle(driver,'shp-transporter-direct','veh-trans-2'),/INVALID_VEHICLE/);
  const assignment=repo.assignShipmentVehicle(owner,'shp-transporter-direct','veh-trans-1');
  assert.deepEqual(assignment,{vehicleId:'veh-trans-1',driverUserId:'user-company-driver'});
  repo.transitionShipment(owner,'shp-transporter-direct','ASSIGNED');
  const shipment=repo.getShipmentForUser(owner,'shp-transporter-direct');
  assert.match(shipment.assigned_vehicle_platform_number,/^LG-TRK-[A-Z0-9]+$/);
  assert.equal(shipment.assigned_driver_name,'Yonas Alemu');
 }finally{
  db.prepare(`UPDATE shipments SET commercial_status=?,operational_status=?,receiver_first_name=?,receiver_phone=?,
    assigned_vehicle_id=?,assigned_driver_user_id=?,updated_at=? WHERE id='shp-transporter-direct'`)
    .run(before.commercial_status,before.operational_status,before.receiver_first_name,before.receiver_phone,
      before.assigned_vehicle_id,before.assigned_driver_user_id,before.updated_at);
  db.prepare(`DELETE FROM shipment_events WHERE shipment_id='shp-transporter-direct' AND event_type='STATUS'`).run();
 }
});

test('Shipment and Truck Boards filter and rank by an owned route',()=>{
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

test('marketplace boards project approved trust evidence by owner, truck, and assigned driver',()=>{
 const shipper=repo.getUserById('user-shipper');
 const transporter=repo.getUserById('user-transporter');
 const shipment=repo.listLoads(transporter).find(load=>load.load_owner_organization_id==='org-shipper');
 assert.ok(shipment);
 assert.deepEqual(shipment.owner_verification_badges.map(badge=>[badge.type,badge.verified]),[
   ['IDENTITY',true],['BUSINESS_LICENSE',true]
 ]);
 const truck=repo.listCapacity(shipper).find(capacity=>capacity.vehicle_id==='veh-trans-1');
 assert.ok(truck);
 assert.ok(truck.owner_verification_badges.every(badge=>badge.verified));
 assert.deepEqual(truck.vehicle_verification_badges,[{type:'VEHICLE_AUTHORITY',verified:true}]);
 assert.equal(truck.assigned_driver_name,'Yonas Alemu');
 assert.deepEqual(truck.driver_verification_badges,[{type:'DRIVER_IDENTITY',verified:true}]);
});

test('Board geography uses endpoint coordinates, radii, direction, and obscured current areas',()=>{
 const transporter=repo.getUserById('user-transporter');
 const shipper=repo.getUserById('user-shipper');
 const db=dbModule.getDb();
 const original=db.prepare(`SELECT origin,destination FROM shipments WHERE id='shp-freight-target'`).get();
 db.prepare(`UPDATE shipments SET origin='Origin label changed',destination='Destination label changed' WHERE id='shp-freight-target'`).run();
 try{
  const loads=repo.listLoads(transporter,'ALL',{
   movementScope:'INTERCITY',
   originPlaceRef:'builtin:addis ababa',origin:'Addis Ababa, Ethiopia',originRadiusKm:'10',
   destinationPlaceRef:'builtin:hawassa',destination:'Hawassa, Ethiopia',destinationRadiusKm:'10',
   directionMode:'DIRECT'
  });
  assert.ok(loads.some(load=>load.id==='shp-freight-target'));
 }finally{
  db.prepare(`UPDATE shipments SET origin=?,destination=? WHERE id='shp-freight-target'`).run(original.origin,original.destination);
 }
 const direct=repo.listMarketCapacity(shipper,{
  movementScope:'INTERCITY',
  originPlaceRef:'builtin:addis ababa',origin:'Addis Ababa, Ethiopia',originRadiusKm:'10',
  destinationPlaceRef:'builtin:mekelle',destination:'Mekelle, Ethiopia',destinationRadiusKm:'10',
  directionMode:'DIRECT'
 });
 const either=repo.listMarketCapacity(shipper,{
  movementScope:'INTERCITY',
  originPlaceRef:'builtin:addis ababa',origin:'Addis Ababa, Ethiopia',originRadiusKm:'10',
  destinationPlaceRef:'builtin:mekelle',destination:'Mekelle, Ethiopia',destinationRadiusKm:'10',
  directionMode:'EITHER'
 });
 // Preferred Routes are authoritative matching candidates even when the truck's
 // dated partial route points in the reverse direction.
 assert.equal(direct.some(capacity=>capacity.id==='cap-partner-partial'),true);
 assert.equal(either.some(capacity=>capacity.id==='cap-partner-partial'),true);
 const nearCurrent=repo.listMarketCapacity(shipper,{
  currentAreaPlaceRef:'builtin:addis ababa',currentArea:'Addis Ababa, Ethiopia',
  currentAreaRadiusKm:'10',currentAreaMode:'REQUIRE'
 });
 assert.ok(nearCurrent.some(capacity=>capacity.id==='cap-empty'));
 assert.ok(nearCurrent.every(capacity=>capacity.current_area_match===1));
 assert.ok(nearCurrent.every(capacity=>!Object.hasOwn(capacity,'location_lat')&&!Object.hasOwn(capacity,'location_lng')));
});

test('provider interests remain in My Shipments without entering Tracking',()=>{
 const driver=repo.getUserById('user-driver');
 repo.expressInterest(driver,'shp-freight-fixed','Interested view fixture');
 const interested=repo.listLoads(driver,'INTERESTED');
 assert.ok(interested.some(load=>load.id==='shp-freight-fixed'));
 assert.ok(interested.every(load=>load.interested));
 const workspace=repo.listMyShipments(driver);
 assert.equal(workspace.find(load=>load.id==='shp-freight-fixed')?.workspace_stage,'INTERESTED');
 assert.equal(workspace.some(load=>load.id==='shp-freight-fixed'&&load.workspace_stage==='TRACKING'),false);
});

test('Shipment Board removes demand after two delivery-deadline grace days but keeps the owner record',()=>{
 const db=dbModule.getDb();
 const driver=repo.getUserById('user-driver');
 const shipper=repo.getUserById('user-shipper');
 const original=db.prepare('SELECT delivery_date FROM shipments WHERE id=?').get('shp-freight-fixed');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const dateOffset=days=>{const date=new Date(`${today}T12:00:00.000Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
 db.prepare('UPDATE shipments SET delivery_date=? WHERE id=?').run(dateOffset(-2),'shp-freight-fixed');
 assert.equal(repo.listLoads(driver).some(load=>load.id==='shp-freight-fixed'),true);
 assert.equal(repo.listOwnedLoads(shipper).find(load=>load.id==='shp-freight-fixed').board_deadline_state,'PAST_DUE');
 db.prepare('UPDATE shipments SET delivery_date=? WHERE id=?').run(dateOffset(-3),'shp-freight-fixed');
 assert.equal(repo.listLoads(driver).some(load=>load.id==='shp-freight-fixed'),false);
 assert.equal(repo.listOwnedLoads(shipper).find(load=>load.id==='shp-freight-fixed').board_deadline_state,'EXPIRED');
 db.prepare('UPDATE shipments SET delivery_date=? WHERE id=?').run(original.delivery_date,'shp-freight-fixed');
});

test('stale Empty or Partial stays on the Board with an old-update warning',()=>{
 const db=dbModule.getDb();
 const driver=repo.getUserById('user-driver');
 const shipper=repo.getUserById('user-shipper');
 const original=db.prepare('SELECT expires_at,updated_at FROM capacities WHERE id=?').get('cap-partial');
 db.prepare('UPDATE capacities SET expires_at=?,updated_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),new Date(Date.now()-48*60*60*1000).toISOString(),'cap-partial');
 const own=repo.listOwnCapacity(driver).find(capacity=>capacity.id==='cap-partial');
 assert.equal(own.freshness,'UPDATE_NEEDED');
 assert.equal(repo.listMarketCapacity(shipper).find(capacity=>capacity.id==='cap-partial').freshness,'UPDATE_NEEDED');
 db.prepare('UPDATE capacities SET expires_at=?,updated_at=? WHERE id=?').run(original.expires_at,original.updated_at,'cap-partial');
});

test('Busy requires future availability and leaves the Board after its ready date',()=>{
 const db=dbModule.getDb();
 const driver=repo.getUserById('user-driver');
 const shipper=repo.getUserById('user-shipper');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const tomorrow=new Date(`${today}T12:00:00.000Z`);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 const id=repo.publishCapacity(driver,{
  vehicleId:'veh-driver-1',
  status:'BUSY',
  movementScope:'BOTH',
  localPlaceRef:'builtin:addis ababa',
  localPlaceLabel:'Addis Ababa, Ethiopia',
  localRadiusKm:'25',
  availableAgainDate:tomorrow.toISOString().slice(0,10),
  visibility:'OPEN'
 });
 const busy=repo.listMarketCapacity(shipper).find(capacity=>capacity.id===id);
 assert.equal(busy.status,'BUSY');
 assert.equal(busy.available_percent,0);
 assert.ok(Array.isArray(busy.preferred_routes));
 db.prepare('UPDATE capacities SET available_again_date=? WHERE id=?').run('2020-01-01',id);
 assert.equal(repo.listMarketCapacity(shipper).some(capacity=>capacity.id===id),false);
});

test('shipper creates quote-requested open freight load',()=>{
 const user=repo.getUserById('user-shipper');
 const result=repo.createShipment(user,{title:'Test quote load',serviceMode:'FREIGHT',distributionMode:'OPEN_MARKET',priceMode:'QUOTE_REQUESTED',origin:'Addis Ababa',destination:'Jimma',...routeRefs('Addis Ababa','Jimma'),cargoDescription:'Test goods',packageCount:'5',loadType:'PTL',pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10),trackingMode:'STATUS_ONLY'});
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
  ...routeRefs('Dilla','Hawassa'),
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
  ...routeRefs('Addis Ababa','Adama'),
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
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'PARTIAL',availablePercent:'55',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',...locationRef(),visibility:'OPEN'}),/ROUTE_ENDPOINTS_REQUIRED/);
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'EMPTY',acceptedLoads:'FTL',locationArea:'Around Addis Ababa',...locationRef(),origin:'Addis Ababa',destination:'Hawassa',...routeRefs(),visibility:'OPEN'}),/PLANNED_ROUTE_DATE_REQUIRED/);
 const id=repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'PARTIAL',availablePercent:'55',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',approximateLat:'9',approximateLng:'38.5',locationPrecisionKm:'40',locationSource:'DEVICE_OBSCURED',currentRouteOrigin:'Addis Ababa',currentRouteDestination:'Adama',...currentRouteRefs(),origin:'Addis Ababa',destination:'Hawassa',...routeRefs(),travelDate:routeDate,plannedSpaceStatus:'PARTIAL',visibility:'OPEN',openToContractLanes:true,acceptsMultiStop:true});
 const rows=repo.listCapacity(user);
 assert.ok(rows.some(r=>r.id===id&&r.available_percent===55&&r.accepts_full_load===1&&r.accepts_partial_load===1&&r.location_area==='Around Addis Ababa, Ethiopia'&&r.location_source==='DEVICE_OBSCURED'&&r.location_precision_km===40&&r.current_route_date===null&&r.planned_space_status==='PARTIAL'&&r.open_to_contract_lanes===1&&r.accepts_multi_pick===1&&r.accepts_multi_drop===1));
 const audit=dbModule.getDb().prepare(`SELECT details FROM audit_logs WHERE entity_id=?`).get(id);
 assert.equal(audit.details.includes('38.5'),false);
 const offDutyId=repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'OFF_DUTY',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'});
 const publicRows=repo.listPublicCapacity();
 assert.equal(publicRows.some(r=>r.id===offDutyId),false);
});

test('local capacity can publish without an intercity route and is filterable by locality',()=>{
 const driver=repo.getUserById('user-driver');
 const shipper=repo.getUserById('user-shipper');
 assert.throws(()=>repo.publishCapacity(driver,{
  vehicleId:'veh-driver-1',
  status:'PARTIAL',
  availablePercent:'50',
  acceptedLoads:'BOTH',
  movementScope:'LOCAL',
  localPlaceRef:'builtin:addis ababa',
  localPlaceLabel:'Addis Ababa, Ethiopia',
  localRadiusKm:'25',
  visibility:'OPEN'
 }),/LOCAL_CAPACITY_MUST_BE_EMPTY/);
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
 assert.ok(localPage.items.filter(capacity=>capacity.movement_scope==='LOCAL').every(capacity=>capacity.status==='EMPTY'&&capacity.available_percent===100));
});

test('admin operations inventory is bounded and omits sensitive fields',()=>{
 const admin=repo.getUserById('user-admin');
 const trucks=repo.getAdminOperations(admin,'LG-TRK',{view:'TRUCKS'});
 assert.equal(trucks.view,'TRUCKS');
 assert.ok(trucks.items.length>=3);
 assert.ok(trucks.items.every(vehicle=>vehicle.platform_number));
 const capacity=repo.getAdminOperations(admin,'',{view:'CAPACITY'});
 assert.ok(capacity.items.every(row=>!Object.hasOwn(row,'location_lat')&&!Object.hasOwn(row,'photo_path')));
 const users=repo.getAdminOperations(admin,'',{view:'USERS'});
 assert.ok(users.items.every(user=>!Object.hasOwn(user,'password_hash')));
 const network=repo.getAdminOperations(admin,'',{view:'NETWORK'});
 const routes=repo.getAdminOperations(admin,'',{view:'ROUTES'});
 const drivers=repo.getAdminOperations(admin,'',{view:'DRIVERS'});
 const subscriptions=repo.getAdminOperations(admin,'',{view:'SUBSCRIPTIONS'});
 assert.ok(network.items.length&&routes.items.length&&drivers.items.length&&subscriptions.items.length);
 assert.ok(network.items.every(row=>row.owner_name&&row.target_name));
 assert.ok(routes.items.every(row=>row.owner_name&&row.origin));

 const db=dbModule.getDb();
 db.prepare(`INSERT INTO profile_routes (id,organization_id,origin,destination,created_by,created_at)
   VALUES ('route-admin-test','org-shipper','Test Origin','Test Destination','user-shipper',CURRENT_TIMESTAMP)`).run();
 repo.moderateAdminRecord(admin,'PROFILE_ROUTE','route-admin-test','REMOVE');
 assert.equal(db.prepare("SELECT 1 FROM profile_routes WHERE id='route-admin-test'").get(),undefined);
 assert.ok(db.prepare("SELECT 1 FROM audit_logs WHERE action='ADMIN_RECORD_MODERATED' AND entity_id='route-admin-test'").get());

 repo.updateFleetDriverPermissions(admin,'user-company-driver',{canBrowseLoadBoard:false,canContactBusinesses:false,canNegotiateLoads:false,canManageCapacity:false});
 assert.equal(repo.getDriverAccess(repo.getUserById('user-company-driver')).can_manage_capacity,false);
 repo.updateFleetDriverPermissions(admin,'user-company-driver',{canBrowseLoadBoard:true,canContactBusinesses:true,canNegotiateLoads:true,canManageCapacity:true});

 db.prepare(`INSERT INTO subscriptions (id,organization_id,plan_id,status,billing_model,starts_at,ends_at,updated_at)
   VALUES ('sub-admin-test','org-receiver','plan-business','TRIAL','FLAT_MONTHLY',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run();
 repo.moderateAdminRecord(admin,'SUBSCRIPTION','sub-admin-test','PAID');
 assert.equal(db.prepare("SELECT status FROM subscriptions WHERE id='sub-admin-test'").get().status,'ACTIVE');
 repo.moderateAdminRecord(admin,'SUBSCRIPTION','sub-admin-test','EXPIRE');
 assert.equal(db.prepare("SELECT status FROM subscriptions WHERE id='sub-admin-test'").get().status,'EXPIRED');
 db.prepare("DELETE FROM subscriptions WHERE id='sub-admin-test'").run();
});

test('provider Truck Board returns one identity-safe operational card per competing truck',()=>{
 const driver=repo.getUserById('user-driver');
 const result=repo.listProviderCapacityBoardPage(driver,{},{page:1,pageSize:12});
 assert.ok(result.total>0);
 const safeKeys=['accepts_full_load','accepts_multi_drop','accepts_multi_pick','accepts_partial_load','available_again_date','available_percent','cargo_configuration','current_route_destination','current_route_origin','destination','freshness','local_place_label','local_radius_km','location_area','location_updated_at','movement_scope','open_to_contract_lanes','origin','planned_space_status','preferred_routes_label','proof_available','proof_recorded_at','status','travel_date','updated_at'];
 assert.ok(result.items.every(row=>Object.keys(row).every(key=>safeKeys.includes(key))));
 assert.ok(result.items.every(row=>row.cargo_configuration&&row.status));
 const serialized=JSON.stringify(result);
 for(const privateValue of ['BlueLine Transport PLC','LG-TRK-','Isuzu','NPR','+251','cap-empty','veh-trans'])assert.equal(serialized.includes(privateValue),false);
 assert.throws(()=>repo.listMarketCapacity(driver),/FORBIDDEN/);
 assert.equal(repo.getCapacityForUser(driver,'cap-empty'),null);
});

test('saved relationship capacity is visible only to the related business',()=>{
 const shipper=repo.getUserById('user-shipper');
 const receiver=repo.getUserById('user-receiver');
 const shipperRows=repo.listCapacity(shipper);
 const receiverRows=repo.listCapacity(receiver);
 assert.ok(shipperRows.some(r=>r.id==='cap-partner-partial'&&r.relationshipVisible));
 assert.equal(receiverRows.some(r=>r.id==='cap-partner-partial'),false);
});


test('signup immediately provisions an unverified workspace trial and keeps account phone private',()=>{
 const appId=repo.createBusinessApplication({name:'Test Applicant',businessName:'Test Freight PLC',email:'test-applicant@loadgistic.local',phone:'+251 911 700 100',password:'StrongPass123!',applicationType:'TRANSPORT_COMPANY',notes:'Local test'});
 const signup=repo.getApplicationStatus('test-applicant@loadgistic.local');
 assert.equal(signup.id,appId);
 assert.equal(signup.status,'APPROVED');
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
 const approvedEvidence=dbModule.getDb().prepare(`SELECT COUNT(*) AS n FROM verification_requests
   WHERE subject_type='ORGANIZATION' AND subject_id=? AND status='APPROVED'`).get(hydrated.organization_id);
 assert.equal(approvedEvidence.n,0);
});

test('administrator can sponsor a qualifying Business but not a transport provider',()=>{
 const admin=repo.getUserById('user-admin');
 repo.createBusinessApplication({name:'Sponsored Applicant',businessName:'Sponsored Workshop PLC',email:'sponsored-applicant@loadgistic.local',phone:'+251 911 700 101',password:'StrongPass123!',applicationType:'ENTERPRISE_SHIPPER',notes:'Qualifying starting Business'});
 const business=repo.findUserByEmail('sponsored-applicant@loadgistic.local');
 repo.grantSponsoredBusinessAccess(admin,business.organization_id);
 const billing=repo.getBillingSummary(repo.getUserById(business.id));
 assert.equal(billing.subscription.status,'SPONSORED');
 assert.equal(billing.subscription.ends_at,null);
 assert.equal(billing.access.granted,true);
 assert.throws(()=>repo.submitPaymentProof(repo.getUserById(business.id),'100','NOT-NEEDED'),/PAYMENT_NOT_REQUIRED/);

 repo.createBusinessApplication({name:'Provider Applicant',businessName:'Provider Fleet PLC',email:'provider-sponsor-test@loadgistic.local',phone:'+251 911 700 102',password:'StrongPass123!',applicationType:'TRANSPORT_COMPANY',notes:'Cannot be sponsored'});
 const provider=repo.findUserByEmail('provider-sponsor-test@loadgistic.local');
 assert.throws(()=>repo.grantSponsoredBusinessAccess(admin,provider.organization_id),/SPONSORED_ACCESS_BUSINESS_ONLY/);
 assert.equal(repo.getApplicationStatus('provider-sponsor-test@loadgistic.local').status,'APPROVED');
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

test('native support assigns safely, isolates customers, requeues, and stays available when billing is limited',()=>{
 const admin=repo.getUserById('user-admin');
 const support=repo.getUserById('user-support');
 const shipper=repo.getUserById('user-shipper');
 const receiver=repo.getUserById('user-receiver');
 const transporter=repo.getUserById('user-transporter');
 const expired=repo.getUserById('user-expired');
 assert.equal(support.role,'SUPPORT');
 assert.equal(repo.getWorkspaceAccess(support).granted,true);

 const conversationId=repo.createSupportConversation(shipper,{category:'PAYMENT',body:'Please review my payment status.'});
 assert.equal(repo.getOpenMemberSupportConversation(shipper).id,conversationId);
 assert.match(repo.listMemberSupportConversations(shipper,{page:1,pageSize:10}).items[0].last_message_preview,/review my payment/);
 assert.throws(()=>repo.createSupportConversation(shipper,{category:'ACCOUNT',body:'Duplicate open request.'}),/SUPPORT_CONVERSATION_ALREADY_OPEN/);
 const assigned=repo.getSupportConversation(support,conversationId,{markRead:false});
 assert.equal(assigned.status,'OPEN');
 assert.equal(assigned.assigned_agent_user_id,support.id);
 assert.equal(Object.hasOwn(assigned,'email'),false);
 assert.equal(Object.hasOwn(assigned,'phone'),false);
 assert.throws(()=>repo.getSupportConversation(receiver,conversationId),/NOT_FOUND/);
 repo.sendSupportMessage(support,conversationId,'Your payment is being reviewed.');
 assert.match(repo.getSupportConversation(shipper,conversationId,{markRead:false}).messages.at(-1).body,/being reviewed/);
 assert.throws(()=>repo.closeSupportConversation(shipper,conversationId),/FORBIDDEN/);
 repo.closeSupportConversation(support,conversationId);
 assert.equal(repo.getOpenMemberSupportConversation(shipper),null);
 assert.throws(()=>repo.sendSupportMessage(shipper,conversationId,'One more thing'),/SUPPORT_CONVERSATION_CLOSED/);

 const transporterConversationId=repo.createSupportConversation(transporter,{category:'CAPACITY',body:'My fleet capacity chat must stay visible.'});
 repo.sendSupportMessage(transporter,transporterConversationId,'This is a second BlueLine message.');
 const transporterConversation=repo.getOpenMemberSupportConversation(transporter);
 assert.equal(transporterConversation.id,transporterConversationId);
 assert.match(transporterConversation.last_message_preview,/second BlueLine message/);
 assert.equal(repo.getSupportConversation(transporter,transporterConversationId,{markRead:false}).messages.length,2);
 repo.closeSupportConversation(support,transporterConversationId);

 repo.updateSupportAgent(admin,support.id,{active:true,available:true,maxOpenConversations:1});
 const waitingId=repo.createSupportConversation(shipper,{category:'CAPACITY',body:'I need help publishing capacity.'});
 assert.equal(repo.getSupportConversation(shipper,waitingId,{markRead:false}).status,'WAITING');
 repo.closeSupportConversation(support,'support-demo-open');
 assert.equal(repo.getSupportConversation(support,waitingId,{markRead:false}).status,'OPEN');

 const expiredId=repo.createSupportConversation(expired,{category:'ACCOUNT',body:'My plan expired and I need help.'});
 assert.ok(repo.getSupportConversation(expired,expiredId,{markRead:false}));
 assert.equal(repo.getWorkspaceAccess(expired).granted,false);
 const receiverId=repo.createSupportConversation(receiver,{category:'OTHER',body:'A newer waiting request.'});
 const createdId=repo.createSupportAgent(admin,{
  name:'Support Test Agent',
  email:'support-test@loadgistic.local',
  password:'SupportPass123!',
  maxOpenConversations:'2'
 });
 const secondSupport=repo.getUserById(createdId);
 assert.throws(()=>repo.claimSupportConversation(secondSupport,receiverId),/SUPPORT_CONVERSATION_NOT_WAITING/);
 const waiting=repo.listSupportInbox(secondSupport,'WAITING',{page:1,pageSize:10});
 assert.deepEqual(waiting.items.slice(0,2).map(item=>item.id),[expiredId,receiverId]);
 assert.ok(repo.listSupportAgents(admin,{page:1,pageSize:20}).items.some(agent=>agent.user_id===createdId));
 assert.throws(()=>repo.listSupportAgents(shipper),/FORBIDDEN/);

 repo.updateSupportAgent(admin,support.id,{active:true,available:true,maxOpenConversations:2,canManageCustomers:true,canManageSupport:true});
 const customerTeamMember=repo.getUserById(support.id);
 assert.ok(repo.getAdminOperations(customerTeamMember,'',{view:'WORKSPACES',page:1,pageSize:5}).items.length);
 assert.throws(()=>repo.getAdminOperations(customerTeamMember,'',{view:'TRUCKS'}),/FORBIDDEN/);
 assert.throws(()=>repo.listVerificationRequests(customerTeamMember,{page:1,pageSize:5}),/FORBIDDEN/);
 assert.throws(()=>repo.setAdminRecordActive(customerTeamMember,'USER',admin.id,false),/FORBIDDEN/);

 repo.updateSupportAgent(admin,support.id,{active:true,available:false,maxOpenConversations:2,canManageCustomers:false,canManageOperations:true,canManageTrust:false,canManageBilling:false,canManageSupport:false});
 const operationsTeamMember=repo.getUserById(support.id);
 assert.ok(repo.getAdminOperations(operationsTeamMember,'',{view:'TRUCKS',page:1,pageSize:5}).items.length);
 assert.throws(()=>repo.getAdminOperations(operationsTeamMember,'',{view:'USERS'}),/FORBIDDEN/);
 assert.throws(()=>repo.listSupportInbox(operationsTeamMember,'ASSIGNED',{page:1,pageSize:5}),/FORBIDDEN/);
});

test.after(()=>{dbModule.closeDb();for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);});
