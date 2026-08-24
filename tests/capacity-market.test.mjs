import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-capacity-market.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);
const repo=await import('../src/lib/repository.js');
const {getDb}=await import('../src/lib/db.js');
const {capacityRoutePointMatch,serviceAreaGeometryMatch}=await import('../src/lib/route-matching.js');
const {distanceBetweenKm}=await import('../src/lib/domain.js');
const {DEMO_DELIVERY_ROUTES,DEMO_LOCAL_ROUTES,DEMO_ROAD_ROUTES,demoVehicleRangeClass,nearestDemoBase}=await import('../src/lib/demo-capacity-geography.js');

function allPublicCapacity(filters={}){
  const items=[];
  let cursor=null;
  do{
    const page=repo.listPublicCapacityCursor(filters,{pageSize:16,cursor});
    items.push(...page.items);
    cursor=page.nextCursor;
  }while(cursor);
  return items;
}

test('deterministic seed presents a busy supply-only market',()=>{
  const db=getDb();
  assert.equal(db.prepare('SELECT COUNT(*) n FROM shipments').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM partner_relationships').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM provider_profiles').get().n,21);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM organizations WHERE type='TRANSPORT_COMPANY'").get().n,9);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM company_pages WHERE published=1').get().n,30);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM company_pages WHERE profile_image_preset IS NOT NULL").get().n,30);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM capacities c WHERE c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')`).get().n,143);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name IN ('next_trips','recurring_service_areas')").get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM profile_routes').get().n,30);
  assert.equal(db.prepare(`SELECT MAX(n) AS maximum FROM (SELECT COUNT(*) AS n FROM profile_routes GROUP BY COALESCE(organization_id,provider_profile_id))`).get().maximum,1);
  const vehicleMix=db.prepare(`SELECT
      SUM(CASE WHEN vehicle.cargo_configuration IN ('Courier motorcycle','Courier car','Cargo van','Pickup truck','Pickup stake body','Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck') THEN 1 ELSE 0 END) AS small,
      SUM(CASE WHEN vehicle.cargo_configuration LIKE 'Light %' THEN 1 ELSE 0 END) AS light,
      SUM(CASE WHEN vehicle.cargo_configuration LIKE 'Medium %' THEN 1 ELSE 0 END) AS medium,
      SUM(CASE WHEN vehicle.cargo_configuration LIKE 'Heavy %' THEN 1 ELSE 0 END) AS heavy
    FROM capacities capacity
    JOIN vehicles vehicle ON vehicle.id=capacity.vehicle_id
    WHERE capacity.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=capacity.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
      AND COALESCE(capacity.market_status,capacity.status) IN ('EMPTY','PARTIAL')`).get();
  assert.deepEqual({...vehicleMix},{small:100,light:28,medium:13,heavy:2});
  for(const configuration of ['Courier motorcycle','Courier car','Cargo van','Pickup truck','Pickup stake body','Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck']){
    assert.ok(db.prepare('SELECT COUNT(*) n FROM vehicles WHERE active=1 AND cargo_configuration=?').get(configuration).n>0,configuration);
  }
  assert.ok(fs.existsSync(path.resolve('public/vehicle-configurations/courier-motorcycle.jpg')));
  assert.ok(fs.existsSync(path.resolve('public/vehicle-configurations/courier-car.jpg')));
  const regionalMarkets=db.prepare(`SELECT location_place_ref,
      COUNT(*) AS trucks,
      SUM(CASE WHEN COALESCE(market_status,status)='EMPTY' THEN 1 ELSE 0 END) AS empty_trucks,
      SUM(CASE WHEN COALESCE(market_status,status)='PARTIAL' THEN 1 ELSE 0 END) AS partial_trucks
    FROM capacities capacity
    WHERE capacity.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=capacity.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
      AND capacity.id LIKE 'cap-public-%'
    GROUP BY location_place_ref`).all();
  assert.equal(regionalMarkets.length,15);
  assert.ok(regionalMarkets.every(market=>market.trucks>=9&&market.empty_trucks>0&&market.partial_trucks>0));
});

test('public capacity keeps Service areas Empty and publishes Partial only on routes',()=>{
  const all=[];
  let cursor=null;
  do {
    const page=repo.listPublicCapacityCursor({}, {pageSize:12,cursor});
    for(const item of page.items)assert.equal(all.some(existing=>existing.id===item.id),false);
    all.push(...page.items);
    cursor=page.nextCursor;
  } while(cursor);
  assert.equal(all.length,143);
  const visibleCurrent=all.filter(item=>item.current_signal_geometry_visible!==false);
  const privateFallbacks=all.filter(item=>item.current_signal_geometry_visible===false);
  assert.ok(privateFallbacks.length>0);
  assert.ok(privateFallbacks.every(item=>item.availability_geometry===null&&item.location_lat===null&&item.recurring_corridors.length===1));
  assert.ok(all.some(item=>item.status==='EMPTY'));
  assert.ok(all.some(item=>item.status==='PARTIAL'));
  assert.ok(all.every(item=>!Object.hasOwn(item,'available_percent')));
  assert.ok(visibleCurrent.some(item=>item.availability_geometry==='RADIUS'));
  assert.ok(visibleCurrent.some(item=>item.availability_geometry==='ROUTE'));
  assert.ok(visibleCurrent.some(item=>item.status==='EMPTY'&&item.availability_geometry==='RADIUS'));
  assert.ok(visibleCurrent.some(item=>item.status==='EMPTY'&&item.availability_geometry==='ROUTE'));
  assert.ok(visibleCurrent.some(item=>item.status==='PARTIAL'&&item.availability_geometry==='ROUTE'));
  assert.ok(visibleCurrent.every(item=>item.status!=='PARTIAL'||item.availability_geometry==='ROUTE'));
  assert.ok(all.every(item=>item.assigned_driver_first_name&&item.assigned_driver_phone));
  assert.ok(all.every(item=>['COMPANY_DRIVER','OWNER_OPERATOR','SELF_MANAGED_DRIVER'].includes(item.driver_kind)));
  assert.ok(all.every(item=>item.driver_verification_badges.length===2&&item.truck_verification_badges.length===1));
  assert.ok(all.some(item=>item.driver_verification_badges.every(badge=>badge.verified)));
  assert.ok(all.some(item=>item.driver_verification_badges.some(badge=>!badge.verified)));
  for(const item of visibleCurrent.filter(item=>item.availability_geometry==='ROUTE')){
    assert.ok(item.current_route_points.length>=2&&item.current_route_points.length<=5);
    assert.ok(item.current_route_points.every(point=>point.place_ref&&point.label&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)));
    assert.equal(new Set(item.current_route_points.map(point=>point.place_ref)).size,item.current_route_points.length);
  }
  for(const item of all.filter(item=>item.availability_geometry==='RADIUS')){
    assert.equal(item.status,'EMPTY');
    assert.ok(item.capacity_area_center_place_ref);
    assert.ok(Number.isFinite(item.capacity_area_center_lat));
    assert.ok(item.capacity_area_boundary.length>=3&&item.capacity_area_boundary.length<=5);
    assert.equal(new Set(item.capacity_area_boundary.map(point=>point.place_ref)).size,item.capacity_area_boundary.length);
    assert.equal(item.capacity_area_boundary.some(point=>point.place_ref===item.capacity_area_center_place_ref),false);
    assert.equal(serviceAreaGeometryMatch(
      {lat:item.capacity_area_center_lat,lng:item.capacity_area_center_lng},item.capacity_area_boundary,{searchRadiusKm:10}
    ).inside,true);
  }
  assert.ok(all.every(item=>item.next_trip===undefined));
  assert.ok(all.every(item=>item.recurring_corridors.length===1));
  const regularSignals=[...new Map(all.flatMap(item=>item.recurring_corridors).map(signal=>[signal.id,signal])).values()];
  assert.ok(regularSignals.some(signal=>signal.geometry==='ROUTE'));
  assert.ok(regularSignals.some(signal=>signal.geometry==='RADIUS'));
  for(const signal of regularSignals){
    if(signal.geometry==='ROUTE')assert.ok(signal.route_points.length>=2&&signal.route_points.length<=5);
    else{
      assert.ok(signal.area_center_place_ref&&Number.isFinite(signal.area_center_lat)&&Number.isFinite(signal.area_center_lng));
      assert.ok(signal.area_boundary.length>=3&&signal.area_boundary.length<=5);
      assert.equal(serviceAreaGeometryMatch({lat:signal.area_center_lat,lng:signal.area_center_lng},signal.area_boundary,{searchRadiusKm:5}).inside,true);
    }
  }
});

test('older Empty or Partial capacity remains visible with separate age labels',()=>{
  const db=getDb();
  const candidate=db.prepare(`SELECT id,expires_at,updated_at,location_updated_at FROM capacities
    WHERE COALESCE(market_status,status) IN ('EMPTY','PARTIAL') AND visibility='OPEN'
    ORDER BY updated_at DESC,id DESC LIMIT 1`).get();
  assert.ok(candidate);
  try{
    db.prepare('UPDATE capacities SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',candidate.id);
    db.prepare('UPDATE capacities SET updated_at=?,location_updated_at=? WHERE id=?')
      .run('2026-06-01T00:00:00.000Z','2026-07-01T00:00:00.000Z',candidate.id);
    const publicItem=repo.listPublicCapacityCursor({capacityId:candidate.id},{pageSize:12}).items[0];
    assert.ok(publicItem);
    assert.equal(publicItem.capacity_update_stage,'OLDER');
    assert.equal(publicItem.capacity_confirmation_needed,true);
    assert.match(publicItem.capacity_updated_label,/over a month ago/);
    assert.equal(publicItem.location_is_last_reported,true);
    const sharedItem=repo.listPublicCapacityCursor({capacityId:candidate.id},{pageSize:12,authorizedVehicleIds:[
      db.prepare('SELECT vehicle_id FROM capacities WHERE id=?').get(candidate.id).vehicle_id
    ]}).items[0];
    assert.ok(sharedItem);
    assert.equal(sharedItem.capacity_update_stage,'OLDER');
  }finally{
    db.prepare('UPDATE capacities SET expires_at=?,updated_at=?,location_updated_at=? WHERE id=?')
      .run(candidate.expires_at,candidate.updated_at,candidate.location_updated_at,candidate.id);
  }
});

test('demo capacity geography stays near each truck and follows concise road sequences',()=>{
  for(const route of Object.values(DEMO_DELIVERY_ROUTES)){
    const legs=route.points.slice(1).map((point,index)=>distanceBetweenKm(route.points[index],point));
    assert.ok(legs.every(distance=>distance!==null&&distance<=30),`${route.key} contains a delivery leg longer than 30 km`);
    assert.ok(legs.reduce((sum,distance)=>sum+distance,0)<=30,`${route.key} exceeds the 30 km delivery range`);
  }
  for(const route of Object.values(DEMO_LOCAL_ROUTES)){
    const legs=route.points.slice(1).map((point,index)=>distanceBetweenKm(route.points[index],point));
    assert.ok(legs.every(distance=>distance!==null&&distance<=80),`${route.key} contains a local leg longer than 80 km`);
    assert.ok(legs.reduce((sum,distance)=>sum+distance,0)<=100,`${route.key} exceeds the 100 km local-route range`);
  }
  for(const route of Object.values(DEMO_ROAD_ROUTES)){
    assert.ok(route.points.length>=2&&route.points.length<=5,route.key);
    assert.equal(new Set(route.points.map(point=>point.place_ref)).size,route.points.length,route.key);
  }
  const capacities=getDb().prepare(`SELECT capacity.id,capacity.availability_geometry,capacity.location_place_ref,capacity.location_lat,capacity.location_lng,vehicle.cargo_configuration,
    current_route_points_json,capacity_area_center_place_ref,capacity_area_center_lat,capacity_area_center_lng,capacity_area_boundary_json
    FROM capacities capacity JOIN vehicles vehicle ON vehicle.id=capacity.vehicle_id
    WHERE capacity.id LIKE 'cap-public-%' OR capacity.id IN ('cap-empty','cap-partial','cap-partner-partial') ORDER BY capacity.id`).all();
  for(const capacity of capacities){
    const current={lat:Number(capacity.location_lat),lng:Number(capacity.location_lng)};
    const base=nearestDemoBase({place_ref:capacity.location_place_ref,...current});
    const delivery=demoVehicleRangeClass(capacity)==='DELIVERY';
    if(capacity.availability_geometry==='ROUTE'){
      const points=JSON.parse(capacity.current_route_points_json);
      assert.ok(points.some(point=>point.place_ref===base.place.place_ref),`${capacity.id} route omits ${base.place.label}`);
      assert.ok(Math.min(...points.map(point=>distanceBetweenKm(current,point)))<30,`${capacity.id} route is not near its truck`);
      if(delivery){
        const total=points.slice(1).reduce((sum,point,index)=>sum+distanceBetweenKm(points[index],point),0);
        assert.ok(total<=30,`${capacity.id} local-delivery route exceeds 30 km`);
      }
    }else{
      const boundary=JSON.parse(capacity.capacity_area_boundary_json);
      assert.equal(capacity.capacity_area_center_place_ref,base.place.place_ref,`${capacity.id} area center is unrelated`);
      assert.equal(serviceAreaGeometryMatch(current,boundary,{searchRadiusKm:5}).inside,true,`${capacity.id} truck is outside its Service area`);
      if(delivery)assert.ok(boundary.every(point=>distanceBetweenKm(base.place,point)<=30),`${capacity.id} local-delivery area exceeds 30 km`);
    }
  }
  const regularRoutes=getDb().prepare(`SELECT route.id,route.geometry,route.route_points_json,route.area_center_place_ref,route.area_center_lat,route.area_center_lng,route.area_boundary_json,
      COALESCE((SELECT capacity.location_place_ref FROM capacities capacity WHERE capacity.provider_organization_id=route.organization_id OR capacity.provider_profile_id=route.provider_profile_id ORDER BY capacity.updated_at DESC,capacity.id DESC LIMIT 1),organization.city_place_ref,profile.city_place_ref) AS location_place_ref,
      COALESCE((SELECT capacity.location_lat FROM capacities capacity WHERE capacity.provider_organization_id=route.organization_id OR capacity.provider_profile_id=route.provider_profile_id ORDER BY capacity.updated_at DESC,capacity.id DESC LIMIT 1),organization.city_lat,profile.city_lat) AS location_lat,
      COALESCE((SELECT capacity.location_lng FROM capacities capacity WHERE capacity.provider_organization_id=route.organization_id OR capacity.provider_profile_id=route.provider_profile_id ORDER BY capacity.updated_at DESC,capacity.id DESC LIMIT 1),organization.city_lng,profile.city_lng) AS location_lng
    FROM profile_routes route
    LEFT JOIN organizations organization ON organization.id=route.organization_id
    LEFT JOIN provider_profiles profile ON profile.id=route.provider_profile_id
    WHERE route.organization_id IN (SELECT id FROM organizations WHERE type='TRANSPORT_COMPANY') OR route.provider_profile_id IS NOT NULL`).all();
  for(const route of regularRoutes){
    const current={lat:Number(route.location_lat),lng:Number(route.location_lng)};
    const base=nearestDemoBase(current);
    if(route.geometry==='ROUTE'){
      const points=JSON.parse(route.route_points_json);
      assert.ok(points.length>=2&&points.length<=5,route.id);
      assert.ok(points.some(point=>point.place_ref===base.place.place_ref),`${route.id} is unrelated to ${base.place.label}`);
      assert.ok(Math.min(...points.map(point=>distanceBetweenKm(current,point)))<80,`${route.id} is too far from its provider's current truck`);
    }else{
      const boundary=JSON.parse(route.area_boundary_json);
      assert.equal(route.area_center_place_ref,base.place.place_ref,`${route.id} area center is unrelated`);
      assert.equal(serviceAreaGeometryMatch(current,boundary,{searchRadiusKm:25}).matched,true,`${route.id} regular Service area is too far from its provider's current truck`);
    }
  }
});

test('provider may publish one regular Service area or multi-city Capacity route',()=>{
  const owner=repo.findUserByEmail('transporter@loadgistic.local');
  const original=repo.listOwnRecurringCorridors(owner);
  assert.equal(original.length,1);
  const routePlaces=[{label:'Jimma, Ethiopia',placeRef:'builtin:jimma'},{label:'Addis Ababa, Ethiopia',placeRef:'builtin:addis ababa'},{label:'Hawassa, Ethiopia',placeRef:'builtin:hawassa'}];
  assert.throws(()=>repo.addRecurringCorridor(owner,{geometry:'ROUTE',routePlaces}),/REGULAR_CAPACITY_LIMIT/);
  assert.throws(()=>getDb().prepare(`INSERT INTO profile_routes (id,organization_id,provider_profile_id,origin,destination,created_by,created_at) VALUES ('third-direct-corridor',?,NULL,'Jimma, Ethiopia','Hawassa, Ethiopia',?,?)`).run(owner.organization_id,owner.id,new Date().toISOString()),/REGULAR_CAPACITY_LIMIT/);
  repo.removeRecurringCorridor(owner,original[0].id);
  const id=repo.addRecurringCorridor(owner,{geometry:'ROUTE',routePlaces});
  const route=repo.listOwnRecurringCorridors(owner).find(signal=>signal.id===id);
  assert.equal(route.geometry,'ROUTE');
  assert.deepEqual(route.route_points.map(point=>point.label),['Jimma, Ethiopia','Addis Ababa, Ethiopia','Hawassa, Ethiopia']);
  assert.throws(()=>repo.addRecurringCorridor(owner,{geometry:'ROUTE',routePlaces:[...routePlaces].reverse()}),/REGULAR_CAPACITY_LIMIT/);
  assert.equal(repo.listOwnRecurringCorridors(owner).length,1);
  repo.removeRecurringCorridor(owner,id);
  const areaId=repo.addRecurringCorridor(owner,{geometry:'RADIUS',areaCenter:'Addis Ababa, Ethiopia',areaCenterPlaceRef:'builtin:addis ababa',areaBoundaryPlaces:[
    {label:'Holeta, Ethiopia',placeRef:'builtin:holeta'},{label:'Sululta, Ethiopia',placeRef:'builtin:sululta'},{label:'Bishoftu, Ethiopia',placeRef:'builtin:bishoftu'}
  ]});
  const area=repo.listOwnRecurringCorridors(owner).find(signal=>signal.id===areaId);
  assert.equal(area.geometry,'RADIUS');
  assert.equal(area.area_center_label,'Addis Ababa, Ethiopia');
  assert.equal(area.area_boundary.length,3);
  assert.throws(()=>repo.addRecurringCorridor(owner,{geometry:'ROUTE',routePlaces}),/REGULAR_CAPACITY_LIMIT/);
});

test('public projections expose only provider-selected contacts',()=>{
  const provider=repo.getPublicProvider('blueline-transport');
  const account=repo.findUserByEmail('transporter@loadgistic.local');
  assert.ok(provider);
  assert.equal(provider.handle,'blueline-transport');
  assert.ok(account.phone);
  assert.ok(provider.contact_phone);
  assert.notEqual(provider.contact_phone,account.phone);
  assert.ok(Array.isArray(provider.capacities));
  assert.ok(Array.isArray(provider.trucks));
  assert.equal(provider.trucks.length,getDb().prepare(`SELECT COUNT(*) n FROM vehicles WHERE active=1 AND organization_id=?`).get(provider.provider_organization_id).n);
  assert.ok(provider.trucks.some(truck=>truck.capacity));
  assert.ok(provider.trucks.every(truck=>Object.hasOwn(truck,'platform_number')&&Object.hasOwn(truck,'cargo_configuration')));
  assert.ok(provider.trucks.filter(truck=>truck.capacity).every(truck=>['EMPTY','PARTIAL'].includes(truck.capacity.status)));
  assert.ok(provider.trucks.filter(truck=>truck.capacity).every(truck=>truck.capacity.id&&truck.capacity.vehicle_id===undefined&&truck.capacity.provider_organization_id===undefined&&truck.capacity.provider_profile_id===undefined));
  assert.ok(provider.provider_kind_label);
  assert.equal(provider.profile_image_url,'/marketing/transporters/blueline-transport.png');
  const serialized=JSON.stringify(provider);
  for(const privateKey of ['password_hash','code_hash','shipper_email','receiver_email'])assert.equal(serialized.includes(privateKey),false);
  const hidden=getDb().prepare(`SELECT COALESCE(o.handle,p.handle) handle FROM company_pages cp LEFT JOIN organizations o ON o.id=cp.organization_id LEFT JOIN provider_profiles p ON p.id=cp.provider_profile_id WHERE cp.published=1 AND cp.show_contact_email=0 LIMIT 1`).get();
  if(hidden)assert.equal(repo.getPublicProvider(hidden.handle).contact_email,null);
  const hiddenPhone=getDb().prepare(`SELECT COALESCE(o.handle,p.handle) handle FROM company_pages cp LEFT JOIN organizations o ON o.id=cp.organization_id LEFT JOIN provider_profiles p ON p.id=cp.provider_profile_id WHERE cp.published=1 AND cp.show_contact_phone=0 LIMIT 1`).get();
  if(hiddenPhone)assert.equal(repo.getPublicProvider(hiddenPhone.handle).contact_phone,null);
});

test('independent transporter profiles separate operating model from truck evidence',()=>{
  const handles=getDb().prepare(`SELECT p.handle FROM company_pages cp JOIN provider_profiles p ON p.id=cp.provider_profile_id WHERE cp.published=1 ORDER BY p.handle`).all();
  assert.ok(handles.length>0);
  const transporters=handles.map(row=>repo.getPublicProvider(row.handle));
  assert.ok(transporters.every(item=>['Owner-operator','Self-managed driver'].includes(item.provider_kind_label)));
  assert.ok(transporters.every(item=>item.verification_badges.some(badge=>['VEHICLE_OWNERSHIP','TRUCK_AUTHORIZATION'].includes(badge.type))));
  assert.ok(transporters.some(item=>item.verification_badges.some(badge=>badge.type==='VEHICLE_OWNERSHIP'&&badge.verified)));
  assert.ok(transporters.some(item=>item.verification_badges.some(badge=>badge.type==='TRUCK_AUTHORIZATION'&&badge.verified)));
});

test('provider-name search returns only that provider’s current trucks',()=>{
  const result=repo.listPublicCapacityCursor({q:'BlueLine Transport PLC'},{pageSize:50});
  assert.ok(result.items.length>0);
  assert.ok(result.items.every(item=>item.provider_name==='BlueLine Transport PLC'));
  assert.ok(result.items.every(item=>['EMPTY','PARTIAL'].includes(item.status)));
});

test('platform-number search returns the matching public truck without private plate data',()=>{
  const candidate=repo.listPublicCapacityCursor({},{pageSize:50}).items.find(item=>item.platform_number);
  assert.ok(candidate);
  const result=repo.listPublicCapacityCursor({q:candidate.platform_number},{pageSize:50});
  assert.ok(result.items.length>0);
  assert.ok(result.items.every(item=>item.platform_number===candidate.platform_number));
  assert.equal(JSON.stringify(result).includes('plate_number'),false);
});

test('featured transporter handle filter returns that transporter even when names are similar',()=>{
  const result=repo.listPublicCapacityCursor({q:'transport',provider:'blueline-transport'},{pageSize:50});
  assert.ok(result.items.length>0);
  assert.ok(result.items.every(item=>item.provider_handle==='blueline-transport'));
});

test('public truck filters combine safe truck facts with Service area overlap',()=>{
  const candidate=repo.listPublicCapacityCursor({geometry:'RADIUS'},{pageSize:50}).items.find(item=>item.capacity_area_center_place_ref);
  assert.ok(candidate);
  const result=repo.listPublicCapacityCursor({
    geometry:'RADIUS',currentAreaPlaceRef:candidate.capacity_area_center_place_ref,currentArea:candidate.capacity_area_center_label,currentAreaRadiusKm:'10',
    vehicleCategory:candidate.cargo_configuration
  },{pageSize:50});
  assert.ok(result.items.length>0);
  assert.ok(result.items.every(item=>item.availability_geometry==='RADIUS'||item.recurring_corridors.some(signal=>signal.geometry==='RADIUS')));
  assert.ok(result.items.every(item=>item.cargo_configuration===candidate.cargo_configuration));
  assert.ok(result.items.every(item=>item.geographic_match_label?.includes('Service area')));
});

test('public capacity ignores the retired remaining-space percentage filter',()=>{
  const withoutRetiredFilter=repo.listPublicCapacityCursor({status:'PARTIAL'},{pageSize:50});
  const withRetiredFilter=repo.listPublicCapacityCursor({status:'PARTIAL',minAvailable:'100'},{pageSize:50});
  assert.deepEqual(withRetiredFilter.items.map(item=>item.id),withoutRetiredFilter.items.map(item=>item.id));
});

test('Service area filter matches a regular area when current capacity is a route',()=>{
  const candidate=repo.listPublicCapacityCursor({},{pageSize:50}).items.find(item=>item.availability_geometry==='ROUTE'&&item.recurring_corridors.some(signal=>signal.geometry==='RADIUS'));
  assert.ok(candidate);
  const regularArea=candidate.recurring_corridors.find(signal=>signal.geometry==='RADIUS');
  const place=regularArea.area_boundary[1];
  const result=repo.listPublicCapacityCursor({geometry:'RADIUS',currentAreaPlaceRef:place.place_ref,currentArea:place.label,currentAreaRadiusKm:'10'},{pageSize:50});
  assert.ok(result.items.some(item=>item.id===candidate.id));
  assert.ok(result.items.some(item=>item.id===candidate.id&&item.geographic_match_label.startsWith('Regular Service area reaches')));
});

test('public route filter matches a selected freight path against current or regular corridors',()=>{
  const routeSignal=allPublicCapacity({geometry:'ROUTE'}).find(item=>item.current_route_points.length>=3);
  assert.ok(routeSignal);
  const originPoint=routeSignal.current_route_points[1];
  const destinationPoint=routeSignal.current_route_points[2];
  const result=repo.listPublicCapacityCursor({
    geometry:'ROUTE',originPlaceRef:originPoint.place_ref,origin:originPoint.label,originRadiusKm:'10',
    destinationPlaceRef:destinationPoint.place_ref,destination:destinationPoint.label,destinationRadiusKm:'10',directionMode:'DIRECT'
  },{pageSize:50});
  assert.ok(result.items.some(item=>item.id===routeSignal.id));
  assert.ok(result.items.every(item=>item.geographic_match_label));
  assert.ok(result.items.find(item=>item.id===routeSignal.id)?.geographic_match_label?.includes('aligns'));
});

test('either Capacity-route endpoint filters independently without hidden required fields',()=>{
  const routeSignal=allPublicCapacity({geometry:'ROUTE'}).find(item=>item.current_route_points.length>=3);
  assert.ok(routeSignal);
  const point=routeSignal.current_route_points[1];
  assert.equal(capacityRoutePointMatch(point,routeSignal.current_route_points,{radiusKm:10}).matched,true);
  const originOnly=allPublicCapacity({geometry:'ROUTE',originPlaceRef:point.place_ref,origin:point.label,originRadiusKm:'10'});
  assert.ok(originOnly.some(item=>item.id===routeSignal.id));
  assert.ok(originOnly.every(item=>item.geographic_match_label));
  assert.ok(originOnly.find(item=>item.id===routeSignal.id)?.geographic_match_label?.includes('passes within'));
  const destinationOnly=allPublicCapacity({geometry:'ROUTE',destinationPlaceRef:point.place_ref,destination:point.label,destinationRadiusKm:'10'});
  assert.ok(destinationOnly.some(item=>item.id===routeSignal.id));
  assert.ok(destinationOnly.every(item=>item.geographic_match_label));
  assert.ok(destinationOnly.find(item=>item.id===routeSignal.id)?.geographic_match_label?.includes('passes within'));
});

test('built-in place references remain authoritative when display text is stale',()=>{
  const routeSignal=allPublicCapacity({geometry:'ROUTE'}).find(item=>item.current_route_points.some(point=>point.place_ref.startsWith('builtin:')));
  assert.ok(routeSignal);
  const point=routeSignal.current_route_points.find(candidate=>candidate.place_ref.startsWith('builtin:'));
  const canonical=allPublicCapacity({geometry:'ROUTE',originPlaceRef:point.place_ref,origin:point.label,originRadiusKm:'10'});
  const staleLabel=allPublicCapacity({geometry:'ROUTE',originPlaceRef:point.place_ref,origin:'Outdated display text, Ethiopia',originRadiusKm:'10'});
  assert.deepEqual(staleLabel.map(item=>item.id),canonical.map(item=>item.id));
});

test('every stored Service-area point remains directly filterable',()=>{
  const areaSignal=allPublicCapacity({status:'EMPTY',geometry:'RADIUS'}).find(item=>item.capacity_area_boundary.some(point=>/^builtin:.* edge$/.test(point.place_ref)));
  assert.ok(areaSignal);
  const point=areaSignal.capacity_area_boundary.find(candidate=>/^builtin:.* edge$/.test(candidate.place_ref));
  const result=allPublicCapacity({geometry:'RADIUS',currentAreaPlaceRef:point.place_ref,currentArea:point.label,currentAreaRadiusKm:'10'});
  assert.ok(result.some(item=>item.id===areaSignal.id));
});

test('shipment endpoints also match eligible Empty Service areas without ranking',()=>{
  const areaSignal=allPublicCapacity({status:'EMPTY',geometry:'RADIUS'}).find(item=>item.capacity_area_boundary.length>=3&&item.recurring_corridors.some(signal=>signal.geometry==='RADIUS'));
  assert.ok(areaSignal);
  const originPoint={place_ref:areaSignal.capacity_area_center_place_ref,label:areaSignal.capacity_area_center_label};
  const destinationPoint=originPoint;
  const both=allPublicCapacity({
    originPlaceRef:originPoint.place_ref,origin:originPoint.label,originRadiusKm:'10',
    destinationPlaceRef:destinationPoint.place_ref,destination:destinationPoint.label,destinationRadiusKm:'10',directionMode:'DIRECT'
  });
  assert.ok(both.some(item=>item.id===areaSignal.id));
  assert.match(both.find(item=>item.id===areaSignal.id).geographic_match_label,/Service area covers both shipment endpoints/);
  const originOnly=allPublicCapacity({originPlaceRef:originPoint.place_ref,origin:originPoint.label,originRadiusKm:'10'});
  assert.ok(originOnly.some(item=>item.id===areaSignal.id));
  assert.match(originOnly.find(item=>item.id===areaSignal.id).geographic_match_label,/Service area reaches/);
});

test('route filter evaluates every regular-route segment even when current availability is a Service area',()=>{
  const radiusSignal=allPublicCapacity({geometry:'RADIUS'}).find(item=>item.recurring_corridors.some(route=>route.route_points.length>=3));
  assert.ok(radiusSignal);
  const route=radiusSignal.recurring_corridors.find(signal=>signal.route_points.length>=3);
  const originPoint=route.route_points[1];
  const destinationPoint=route.route_points[2];
  const result=allPublicCapacity({
    geometry:'ROUTE',originPlaceRef:originPoint.place_ref,origin:originPoint.label,originRadiusKm:'10',
    destinationPlaceRef:destinationPoint.place_ref,destination:destinationPoint.label,destinationRadiusKm:'10',directionMode:'EITHER'
  });
  assert.ok(result.some(item=>item.id===radiusSignal.id));
  assert.ok(result.some(item=>item.id===radiusSignal.id&&item.geographic_match_label.startsWith('Regular capacity route aligns')));
});

test('text search covers current and regular route cities plus Service area boundary cities',()=>{
  const items=allPublicCapacity();
  const routeSignal=items.find(item=>item.current_route_points.length>=3);
  const areaSignal=items.find(item=>item.capacity_area_boundary.length>=3);
  const regularAreaSignal=items.find(item=>item.recurring_corridors.some(signal=>signal.geometry==='RADIUS'&&signal.area_boundary.length>=3));
  assert.ok(routeSignal&&areaSignal&&regularAreaSignal);
  const routeQuery=routeSignal.current_route_points[1].label.split(',')[0];
  const areaQuery=areaSignal.capacity_area_boundary[1].label.split(',')[0];
  assert.ok(allPublicCapacity({q:routeQuery}).some(item=>item.id===routeSignal.id));
  assert.ok(allPublicCapacity({q:areaQuery}).some(item=>item.id===areaSignal.id));
  const regular=items.find(item=>item.recurring_corridors.some(route=>route.route_points.length>=3));
  assert.ok(regular);
  const regularQuery=regular.recurring_corridors[0].route_points[1].label.split(',')[0];
  assert.ok(allPublicCapacity({q:regularQuery}).some(item=>item.provider_handle===regular.provider_handle));
  const regularAreaQuery=regularAreaSignal.recurring_corridors[0].area_boundary[1].label.split(',')[0];
  assert.ok(allPublicCapacity({q:regularAreaQuery}).some(item=>item.provider_handle===regularAreaSignal.provider_handle));
});

test('anonymous proximity is optional and exact visitor coordinates are not returned',()=>{
  const nearby=repo.listPublicCapacityCursor({nearLat:9.03,nearLng:38.74,nearRadiusKm:20},{pageSize:16});
  assert.ok(nearby.items.length>0);
  assert.ok(nearby.items.every(item=>Number.isFinite(item.possible_distance_min_km)&&Number.isFinite(item.possible_distance_max_km)));
  assert.equal(JSON.stringify(nearby).includes('nearLat'),false);
  assert.equal(JSON.stringify(nearby).includes('nearLng'),false);
});

test('Driver location refresh persists an obscured point without changing capacity facts',()=>{
  const driver=repo.findUserByEmail('driver@loadgistic.local');
  const owner=repo.findUserByEmail('transporter@loadgistic.local');
  const vehicle=repo.listOwnVehicles(driver)[0];
  const before=repo.listOwnCapacity(driver).find(item=>item.vehicle_id===vehicle.id);
  const result=repo.refreshCapacityLocation(driver,{vehicleId:vehicle.id,approximateLat:9.11,approximateLng:38.81,locationPrecisionKm:3,locationSource:'DEVICE_OBSCURED'});
  const after=repo.listOwnCapacity(driver).find(item=>item.vehicle_id===vehicle.id);
  assert.equal(after.id,before.id);
  assert.equal(after.status,before.status);
  assert.equal(after.available_percent,before.available_percent);
  assert.equal(after.location_lat,9.11);
  assert.equal(after.location_lng,38.81);
  assert.equal(after.location_precision_km,3);
  assert.equal(after.location_updated_at,result.locationUpdatedAt);
  assert.equal(getDb().prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='CAPACITY_LOCATION_REFRESHED' AND entity_id=?").get(before.id).n,1);
  assert.throws(()=>repo.refreshCapacityLocation(owner,{vehicleId:vehicle.id,approximateLat:9.11,approximateLng:38.81,locationPrecisionKm:3,locationSource:'DEVICE_OBSCURED'}),/DEVICE_LOCATION_DRIVER_ONLY/);
  const companyDriver=repo.findUserByEmail('company-driver@loadgistic.local');
  const assignedVehicle=repo.listOwnVehicles(companyDriver)[0];
  const companyResult=repo.refreshCapacityLocation(companyDriver,{vehicleId:assignedVehicle.id,approximateLat:9.04,approximateLng:38.73,locationPrecisionKm:5,locationSource:'DEVICE_OBSCURED'});
  assert.equal(companyResult.vehicleId,assignedVehicle.id);
});

test('Partial capacity rejects Service-area publication and contradictory public filters',()=>{
  const driver=repo.findUserByEmail('driver@loadgistic.local');
  const vehicle=repo.listOwnVehicles(driver)[0];
  assert.throws(()=>repo.publishCapacity(driver,{vehicleId:vehicle.id,status:'PARTIAL',availablePercent:40,acceptedLoads:'PTL',availabilityGeometry:'RADIUS'}),/PARTIAL_CAPACITY_ROUTE_REQUIRED/);
  assert.equal(repo.listPublicCapacityCursor({status:'PARTIAL',geometry:'RADIUS'},{pageSize:16}).items.length,0);
});

test('provider-only signup keeps fleet, owner-operator, and self-managed Driver roles distinct',()=>{
  assert.throws(()=>repo.createBusinessApplication({name:'Demand User',businessName:'Demand Company',email:'demand@example.test',phone:'+251900000001',password:'StrongPass123!',applicationType:'ENTERPRISE_SHIPPER'}),/INVALID_APPLICATION_TYPE/);
  assert.throws(()=>repo.createBusinessApplication({name:'Legacy Operator',businessName:'Legacy Operator Transport',email:'legacy-operator@example.test',phone:'+251900000002',password:'StrongPass123!',applicationType:'INDEPENDENT_PROVIDER'}),/INVALID_APPLICATION_TYPE/);

  const ownerId=repo.createBusinessApplication({name:'New Owner',businessName:'New Owner Transport',email:'owner-operator@example.test',phone:'+251900000003',password:'StrongPass123!',applicationType:'OWNER_OPERATOR'});
  assert.ok(ownerId);
  const owner=repo.getUserById(repo.findUserByEmail('owner-operator@example.test').id);
  assert.equal(owner.role,'DRIVER');
  assert.equal(owner.provider_operating_model,'OWNER_OPERATOR');
  assert.ok(owner.provider_profile_id);
  getDb().prepare(`INSERT INTO vehicles (id,provider_profile_id,platform_number,label,category,active) VALUES (?,?,?,?,?,1)`)
    .run('test-owner-truck',owner.provider_profile_id,'LG-TRK-OWNER-1','Owner truck','Mini Truck');
  const ownerCenter=repo.getVerificationCenter(owner);
  assert.equal(ownerCenter.subjects.find(subject=>subject.subject_type==='PROVIDER_PROFILE').type,'Owner-operator');
  assert.ok(ownerCenter.subjects.find(subject=>subject.subject_id==='test-owner-truck').allowed_types.includes('VEHICLE_OWNERSHIP'));
  assert.equal(ownerCenter.subjects.some(subject=>subject.allowed_types.includes('VEHICLE_AUTHORIZATION')),false);

  const managedId=repo.createBusinessApplication({name:'New Managed Driver',businessName:'New Managed Driver Transport',email:'managed-driver@example.test',phone:'+251900000004',password:'StrongPass123!',applicationType:'SELF_MANAGED_DRIVER'});
  assert.ok(managedId);
  const managed=repo.getUserById(repo.findUserByEmail('managed-driver@example.test').id);
  assert.equal(managed.role,'DRIVER');
  assert.equal(managed.provider_operating_model,'SELF_MANAGED_DRIVER');
  getDb().prepare(`INSERT INTO vehicles (id,provider_profile_id,platform_number,label,category,active) VALUES (?,?,?,?,?,1)`)
    .run('test-managed-truck',managed.provider_profile_id,'LG-TRK-MANAGED-1','Authorized truck','Cargo Van');
  const managedCenter=repo.getVerificationCenter(managed);
  assert.equal(managedCenter.subjects.find(subject=>subject.subject_type==='PROVIDER_PROFILE').type,'Self-managed driver');
  assert.ok(managedCenter.subjects.find(subject=>subject.subject_type==='PROVIDER_PROFILE').allowed_types.includes('VEHICLE_AUTHORIZATION'));
  assert.equal(managedCenter.subjects.some(subject=>subject.allowed_types.includes('VEHICLE_OWNERSHIP')),false);

  const companyDriver=repo.getUserById(repo.findUserByEmail('company-driver@loadgistic.local').id);
  assert.equal(companyDriver.provider_operating_model,'COMPANY_DRIVER');
  assert.ok(repo.getVerificationCenter(companyDriver).subjects[0].type.includes(`Company driver · ${companyDriver.organization_name}`));
});
