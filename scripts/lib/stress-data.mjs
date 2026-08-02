import path from 'node:path';
import { hashTrackingAccessCode, trackingAccessCode } from '../../src/lib/security.js';

export const STRESS_TABLES = Object.freeze([
  'users',
  'organizations',
  'memberships',
  'provider_profiles',
  'partner_relationships',
  'member_favorites',
  'company_pages',
  'vehicles',
  'drivers',
  'driver_permissions',
  'driver_vehicle_assignments',
  'profile_routes',
  'service_areas',
  'place_catalog',
  'capacities',
  'shipments',
  'shipment_events',
  'shipment_interests',
  'shipment_notes',
  'proof_files',
  'load_proof_requests',
  'load_proof_shares',
  'business_reviews',
  'verification_requests',
  'applications',
  'plans',
  'subscriptions',
  'payment_proofs',
  'notifications',
  'audit_logs',
  'support_agent_profiles',
  'support_conversations',
  'support_messages',
  'support_events'
]);

const LOCATIONS = Object.freeze([
  ['Addis Ababa, Ethiopia',9.03,38.74],
  ['Adama, Ethiopia',8.54,39.27],
  ['Hawassa, Ethiopia',7.06,38.48],
  ['Dire Dawa, Ethiopia',9.60,41.86],
  ['Mekelle, Ethiopia',13.50,39.47],
  ['Bahir Dar, Ethiopia',11.59,37.39],
  ['Gondar, Ethiopia',12.60,37.47],
  ['Jimma, Ethiopia',7.67,36.83],
  ['Dessie, Ethiopia',11.13,39.63],
  ['Shashamane, Ethiopia',7.20,38.59],
  ['Bishoftu, Ethiopia',8.75,38.99],
  ['Debre Birhan, Ethiopia',9.68,39.53],
  ['Nekemte, Ethiopia',9.09,36.55],
  ['Arba Minch, Ethiopia',6.04,37.55],
  ['Wolaita Sodo, Ethiopia',6.86,37.76],
  ['Asella, Ethiopia',7.95,39.13],
  ['Harar, Ethiopia',9.31,42.12],
  ['Jijiga, Ethiopia',9.35,42.80],
  ['Dilla, Ethiopia',6.41,38.31],
  ['Debre Markos, Ethiopia',10.34,37.72],
  ['Kombolcha, Ethiopia',11.08,39.74],
  ['Ambo, Ethiopia',8.98,37.85],
  ['Ziway, Ethiopia',7.93,38.72],
  ['Woldiya, Ethiopia',11.83,39.60]
]);

const CARGO_CONFIGURATIONS = Object.freeze([
  'Cargo van',
  'Mini Open Body Truck',
  'Mini Stake Body Truck',
  'Mini Box Truck',
  'Light Stake Body Truck',
  'Light Box Truck',
  'Medium Stake Body Truck',
  'Medium Box Truck',
  'Heavy Rigid Stake Body Truck',
  'Heavy Rigid Stake Body Truck + Trailer'
]);

const MAKES = Object.freeze([
  ['Isuzu','NPR'],
  ['Isuzu','FSR'],
  ['Sinotruk','HOWO TX'],
  ['Mitsubishi Fuso','Canter'],
  ['Hino','500'],
  ['Foton','Aumark'],
  ['Dongfeng','Captain'],
  ['Mercedes-Benz','Atego']
]);

const BUSINESS_PREFIXES = Object.freeze([
  'Abyssinia Coffee',
  'Rift Valley Foods',
  'Sheba Textiles',
  'Highland Honey',
  'Blue Nile Crafts',
  'Green Harvest',
  'Unity Leather',
  'Sunrise Milling',
  'Walia Furniture',
  'Ethio Spice',
  'Oromia Produce',
  'Sidama Roasters'
]);

const INDUSTRIES = Object.freeze([
  'Food processing',
  'Coffee',
  'Textiles',
  'Agriculture',
  'Furniture',
  'Leather goods',
  'Construction materials',
  'Wholesale distribution'
]);

const CARGO_DESCRIPTIONS = Object.freeze([
  'Palletized packaged foods',
  'Sealed roasted coffee cartons',
  'Woven baskets and home goods',
  'Bagged grain and flour',
  'Crated furniture components',
  'Stacked beverage cartons',
  'Leather workshop supplies',
  'Farm produce in ventilated crates',
  'Building materials on pallets',
  'Packaged spices and dry goods'
]);

const SHIPMENT_STATES = Object.freeze([
  'POSTED',
  'SENT',
  'CONTACTED',
  'AGREED',
  'ASSIGNED',
  'IN_TRANSIT',
  'ON_HOLD',
  'ISSUE',
  'DELIVERED',
  'COMPLETED',
  'DECLINED',
  'WITHDRAWN',
  'CANCELLED'
]);

const STATE_HISTORY = Object.freeze({
  POSTED:['POSTED'],
  SENT:['SENT'],
  CONTACTED:['POSTED','CONTACTED'],
  AGREED:['POSTED','CONTACTED','AGREED'],
  ASSIGNED:['POSTED','CONTACTED','AGREED','ASSIGNED'],
  IN_TRANSIT:['POSTED','CONTACTED','AGREED','ASSIGNED','IN_TRANSIT'],
  ON_HOLD:['POSTED','CONTACTED','AGREED','ASSIGNED','ON_HOLD'],
  ISSUE:['POSTED','CONTACTED','AGREED','ASSIGNED','IN_TRANSIT','ISSUE'],
  DELIVERED:['POSTED','CONTACTED','AGREED','ASSIGNED','IN_TRANSIT','DELIVERED'],
  COMPLETED:['POSTED','CONTACTED','AGREED','ASSIGNED','IN_TRANSIT','DELIVERED','COMPLETED'],
  DECLINED:['SENT','DECLINED'],
  WITHDRAWN:['POSTED','WITHDRAWN'],
  CANCELLED:['POSTED','CANCELLED']
});

function pad(value, width = 3) {
  return String(value).padStart(width,'0');
}

function hours(date, amount) {
  return new Date(date.getTime() + amount * 60 * 60 * 1000);
}

function days(date, amount) {
  return hours(date,amount * 24);
}

function subscriptionFixture(index, audience, now) {
  const variant = (index - 1) % 6;
  if (audience === 'BUSINESS' && variant === 5) {
    return {status:'SPONSORED',billingModel:'SPONSORED_FREE',startsAt:days(now,-90).toISOString(),endsAt:null};
  }
  if (variant === 1) {
    return {status:'TRIAL',billingModel:'FLAT_MONTHLY',startsAt:days(now,-2).toISOString(),endsAt:days(now,5).toISOString()};
  }
  if (variant === 3) {
    return {status:'PAYMENT_UNDER_REVIEW',billingModel:'FLAT_MONTHLY',startsAt:days(now,-38).toISOString(),endsAt:days(now,-8).toISOString()};
  }
  if (variant === 4) {
    return {status:'PAYMENT_REQUIRED',billingModel:'FLAT_MONTHLY',startsAt:days(now,-31).toISOString(),endsAt:days(now,-1).toISOString()};
  }
  return {status:'ACTIVE',billingModel:'FLAT_MONTHLY',startsAt:days(now,-10).toISOString(),endsAt:days(now,20).toISOString()};
}

function dateOnly(date) {
  return date.toISOString().slice(0,10);
}

function location(index) {
  return LOCATIONS[index % LOCATIONS.length];
}

function differentLocation(index, offset = 5) {
  return LOCATIONS[(index + offset) % LOCATIONS.length];
}

function normalizePlaceName(value) {
  return String(value).replace(/,\s*Ethiopia$/i,'').toLowerCase();
}

function insertNotification(db, id, userId, title, body, createdAt, read = false) {
  db.prepare(`INSERT INTO notifications (id,user_id,title,body,read_at,created_at)
    VALUES (?,?,?,?,?,?)`).run(id,userId,title,body,read ? createdAt : null,createdAt);
}

function insertAudit(db, id, actorUserId, organizationId, action, entityType, entityId, details, createdAt) {
  db.prepare(`INSERT INTO audit_logs
    (id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(id,actorUserId,organizationId,action,entityType,entityId,JSON.stringify(details),createdAt);
}

export function stressProfile(scale = 1) {
  const value = Number(scale);
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('STRESS_SCALE_MUST_BE_1_TO_5');
  return Object.freeze({
    scale:value,
    businesses:80 * value,
    fleetTransporters:20 * value,
    fleetTrucksPerTransporter:6,
    companyDriversPerTransporter:6,
    selfManagedDrivers:40 * value,
    applicants:30 * value,
    extraAdmins:5,
    loads:520 * value
  });
}

export function populateStressData(db, { scale = 1 } = {}) {
  const profile = stressProfile(scale);
  const now = new Date();
  const timestamp = now.toISOString();
  const demoFile = path.resolve(process.cwd(),'public/vehicle-configurations/cargo-van.jpg');
  const passwordHash = db.prepare(`SELECT password_hash FROM users WHERE id='user-shipper'`).get()?.password_hash;
  if (!passwordHash) throw new Error('BASE_FIXTURE_REQUIRED');

  const businesses = [];
  const fleets = [];
  const selfManaged = [];
  const vehicles = [];
  const subscriptions = [];
  const ownersByOrganization = new Map();

  db.exec('BEGIN IMMEDIATE');
  try {
    const userInsert = db.prepare(`INSERT INTO users
      (id,email,phone,password_hash,name,role,organization_id,provider_profile_id,active,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const organizationInsert = db.prepare(`INSERT INTO organizations
      (id,name,handle,type,verified,industry,description,phone,email,city,public_visibility,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const membershipInsert = db.prepare(`INSERT INTO memberships
      (id,user_id,organization_id,membership_role) VALUES (?,?,?,'OWNER')`);
    const pageInsert = db.prepare(`INSERT INTO company_pages
      (id,organization_id,provider_profile_id,headline,about,services,corridors,operating_regions,contact_phone,show_contact_phone_on_loads,contact_email,published,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const routeInsert = db.prepare(`INSERT INTO profile_routes
      (id,organization_id,provider_profile_id,origin,destination,created_by,created_at)
      VALUES (?,?,?,?,?,?,?)`);
    const subscriptionInsert = db.prepare(`INSERT INTO subscriptions
      (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`);

    for (let index = 1; index <= profile.businesses; index += 1) {
      const suffix = pad(index);
      const organizationId = `stress-org-business-${suffix}`;
      const userId = `stress-user-business-${suffix}`;
      const type = index % 2 ? 'ENTERPRISE_SHIPPER' : 'ENTERPRISE_RECEIVER';
      const role = index % 2 ? 'SHIPPER' : 'RECEIVER';
      const [city] = location(index);
      const [secondCity] = differentLocation(index,3);
      const [thirdCity] = differentLocation(index,7);
      const name = `${BUSINESS_PREFIXES[index % BUSINESS_PREFIXES.length]} ${suffix} PLC`;
      const handle = `stress-business-${suffix}`;
      organizationInsert.run(
        organizationId,name,handle,type,index % 4 === 0 ? 0 : 1,
        INDUSTRIES[index % INDUSTRIES.length],
        `A local ${INDUSTRIES[index % INDUSTRIES.length].toLowerCase()} Business moving Ethiopian road freight.`,
        `+251 911 ${pad(index,3)} ${pad(index + 100,3)}`,
        `public-${suffix}@stress.loadgistic.local`,
        city,'PUBLIC',timestamp
      );
      userInsert.run(
        userId,`business-${suffix}@stress.loadgistic.local`,
        `+251 922 ${pad(index,3)} ${pad(index + 200,3)}`,
        passwordHash,`${name} Owner`,role,organizationId,null,index % 31 === 0 ? 0 : 1,timestamp
      );
      membershipInsert.run(`stress-membership-business-${suffix}`,userId,organizationId);
      pageInsert.run(
        `stress-page-business-${suffix}`,organizationId,null,
        `${INDUSTRIES[index % INDUSTRIES.length]} made for regional markets`,
        `Produces and distributes goods from ${city}.`,
        `${INDUSTRIES[index % INDUSTRIES.length]}; wholesale Business freight`,
        `${city} ↔ ${secondCity}; ${city} ↔ ${thirdCity}`,
        `${city}; ${secondCity}; ${thirdCity}`,
        `+251 933 ${pad(index,3)} ${pad(index + 300,3)}`,
        index % 3 === 0 ? 1 : 0,
        `logistics-${suffix}@stress.loadgistic.local`,
        index % 17 === 0 ? 0 : 1,timestamp
      );
      for (let routeIndex = 0; routeIndex < 2; routeIndex += 1) {
        const [destination] = differentLocation(index,routeIndex * 4 + 3);
        routeInsert.run(`stress-route-business-${suffix}-${routeIndex + 1}`,organizationId,null,city,destination,userId,timestamp);
      }
      const subscriptionId = `stress-sub-business-${suffix}`;
      const access=subscriptionFixture(index,'BUSINESS',now);
      subscriptionInsert.run(subscriptionId,organizationId,null,'plan-business',access.status,access.billingModel,access.startsAt,access.endsAt,timestamp);
      subscriptions.push({id:subscriptionId,ownerId:organizationId,ownerType:'ORGANIZATION',plan:'Business Capacity'});
      businesses.push({id:organizationId,userId,name,handle,role,city});
      ownersByOrganization.set(organizationId,userId);
    }

    const vehicleInsert = db.prepare(`INSERT INTO vehicles
      (id,organization_id,provider_profile_id,platform_number,label,category,plate,active,make,model,cargo_configuration)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const driverInsert = db.prepare(`INSERT INTO drivers
      (id,organization_id,user_id,name,phone,license_verified,active) VALUES (?,?,?,?,?,?,?)`);
    const permissionInsert = db.prepare(`INSERT INTO driver_permissions
      (user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,updated_by,updated_at)
      VALUES (?,?,?,?,?,?,?)`);
    const assignmentInsert = db.prepare(`INSERT INTO driver_vehicle_assignments
      (id,driver_user_id,vehicle_id,assigned_by,assigned_at,active) VALUES (?,?,?,?,?,?)`);

    for (let fleetIndex = 1; fleetIndex <= profile.fleetTransporters; fleetIndex += 1) {
      const suffix = pad(fleetIndex);
      const organizationId = `stress-org-fleet-${suffix}`;
      const ownerId = `stress-user-fleet-${suffix}`;
      const [city] = location(fleetIndex + 4);
      const name = `Horizon Freight ${suffix} PLC`;
      organizationInsert.run(
        organizationId,name,`stress-fleet-${suffix}`,'TRANSPORT_COMPANY',fleetIndex % 5 === 0 ? 0 : 1,
        'Road freight',`Multi-truck road-freight operator based in ${city}.`,
        `+251 944 ${pad(fleetIndex,3)} ${pad(fleetIndex + 400,3)}`,
        `dispatch-${suffix}@stress.loadgistic.local`,city,'PUBLIC',timestamp
      );
      userInsert.run(
        ownerId,`fleet-${suffix}@stress.loadgistic.local`,
        `+251 955 ${pad(fleetIndex,3)} ${pad(fleetIndex + 500,3)}`,
        passwordHash,`${name} Owner`,'TRANSPORTER',organizationId,null,1,timestamp
      );
      membershipInsert.run(`stress-membership-fleet-${suffix}`,ownerId,organizationId);
      ownersByOrganization.set(organizationId,ownerId);
      const routeLabels = [];
      for (let routeIndex = 0; routeIndex < 3; routeIndex += 1) {
        const [destination] = differentLocation(fleetIndex + 4,routeIndex * 5 + 2);
        routeInsert.run(`stress-route-fleet-${suffix}-${routeIndex + 1}`,organizationId,null,city,destination,ownerId,timestamp);
        routeLabels.push(`${city} ↔ ${destination}`);
      }
      pageInsert.run(
        `stress-page-fleet-${suffix}`,organizationId,null,
        'Road freight capacity for Ethiopian Businesses',
        `Fleet operator serving manufacturers, growers, and distributors from ${city}.`,
        'FTL; PTL; direct and multi-stop freight',
        routeLabels.join('; '),routeLabels.map(value=>value.split(' ↔ ')[1]).join('; '),
        `+251 966 ${pad(fleetIndex,3)} ${pad(fleetIndex + 600,3)}`,
        fleetIndex % 2,`operations-${suffix}@stress.loadgistic.local`,1,timestamp
      );
      const subscriptionId = `stress-sub-fleet-${suffix}`;
      const access=subscriptionFixture(fleetIndex,'TRANSPORTER',now);
      subscriptionInsert.run(subscriptionId,organizationId,null,'plan-transport',access.status,access.billingModel,access.startsAt,access.endsAt,timestamp);
      subscriptions.push({id:subscriptionId,ownerId:organizationId,ownerType:'ORGANIZATION',plan:'Fleet Transporter Demand'});

      const driverUserIds = [];
      for (let driverIndex = 1; driverIndex <= profile.companyDriversPerTransporter; driverIndex += 1) {
        const driverUserId = `stress-user-fleet-${suffix}-driver-${driverIndex}`;
        driverUserIds.push(driverUserId);
        userInsert.run(
          driverUserId,`fleet-${suffix}-driver-${driverIndex}@stress.loadgistic.local`,
          `+251 977 ${pad(fleetIndex,3)} ${pad(driverIndex,3)}`,
          passwordHash,`Driver ${driverIndex} · ${name}`,'DRIVER',organizationId,null,1,timestamp
        );
        driverInsert.run(
          `stress-driver-fleet-${suffix}-${driverIndex}`,organizationId,driverUserId,
          `Driver ${driverIndex} · ${name}`,`+251 977 ${pad(fleetIndex,3)} ${pad(driverIndex,3)}`,
          driverIndex % 3 === 0 ? 0 : 1,1
        );
        permissionInsert.run(
          driverUserId,driverIndex === 3 ? 0 : 1,driverIndex === 2 ? 0 : 1,
          driverIndex === 2 ? 0 : 1,driverIndex === 3 ? 0 : 1,ownerId,timestamp
        );
      }

      const fleetVehicles = [];
      for (let truckIndex = 1; truckIndex <= profile.fleetTrucksPerTransporter; truckIndex += 1) {
        const vehicleId = `stress-vehicle-fleet-${suffix}-${truckIndex}`;
        const [make,model] = MAKES[(fleetIndex + truckIndex) % MAKES.length];
        const cargo = CARGO_CONFIGURATIONS[(fleetIndex * 2 + truckIndex) % CARGO_CONFIGURATIONS.length];
        const active = truckIndex === profile.fleetTrucksPerTransporter && fleetIndex % 4 === 0 ? 0 : 1;
        vehicleInsert.run(
          vehicleId,organizationId,null,
          `LG-TRK-S${pad(fleetIndex,3)}${pad(truckIndex,2)}`,
          `Truck ${pad(truckIndex,2)}`,cargo,
          `ET-${pad(fleetIndex,3)}-${pad(truckIndex,3)}`,active,make,model,cargo
        );
        const assignedDriverUserId = driverUserIds[truckIndex - 1]||null;
        if(assignedDriverUserId)assignmentInsert.run(
          `stress-assignment-fleet-${suffix}-${truckIndex}`,assignedDriverUserId,vehicleId,ownerId,
          days(now,-120 + truckIndex).toISOString(),active
        );
        const vehicle = {id:vehicleId,organizationId,providerProfileId:null,ownerUserId:ownerId,driverUserId:assignedDriverUserId||ownerId,assignedDriverUserId,active,index:vehicles.length + 1};
        vehicles.push(vehicle);
        fleetVehicles.push(vehicle);
      }
      fleets.push({id:organizationId,userId:ownerId,name,city,vehicles:fleetVehicles});
    }

    const providerInsert = db.prepare(`INSERT INTO provider_profiles
      (id,user_id,business_name,handle,verified_identity,verified_license,vehicle_documents_verified,vehicle_type,corridors,phone,city,about,public_visibility,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    for (let driverIndex = 1; driverIndex <= profile.selfManagedDrivers; driverIndex += 1) {
      const suffix = pad(driverIndex);
      const userId = `stress-user-driver-${suffix}`;
      const providerId = `stress-provider-driver-${suffix}`;
      const vehicleId = `stress-vehicle-driver-${suffix}`;
      const [city] = location(driverIndex + 8);
      const [destination] = differentLocation(driverIndex + 8,5);
      const [make,model] = MAKES[driverIndex % MAKES.length];
      const cargo = CARGO_CONFIGURATIONS[(driverIndex + 3) % CARGO_CONFIGURATIONS.length];
      const name = `Owner Operator ${suffix}`;
      userInsert.run(
        userId,`driver-${suffix}@stress.loadgistic.local`,
        `+251 988 ${pad(driverIndex,3)} ${pad(driverIndex + 700,3)}`,
        passwordHash,name,'DRIVER',null,providerId,driverIndex % 29 === 0 ? 0 : 1,timestamp
      );
      providerInsert.run(
        providerId,userId,name,`stress-driver-${suffix}`,
        driverIndex % 4 === 0 ? 0 : 1,driverIndex % 5 === 0 ? 0 : 1,driverIndex % 6 === 0 ? 0 : 1,
        cargo,`${city} ↔ ${destination}`,
        `+251 999 ${pad(driverIndex,3)} ${pad(driverIndex + 800,3)}`,city,
        `Self-managed driver serving Business freight around ${city}.`,'PUBLIC',timestamp
      );
      pageInsert.run(
        `stress-page-driver-${suffix}`,null,providerId,'Independent road-freight capacity',
        `Owner-operated truck serving Businesses from ${city}.`,'FTL; PTL',
        `${city} ↔ ${destination}`,`${city}; ${destination}`,
        `+251 900 ${pad(driverIndex,3)} ${pad(driverIndex + 900,3)}`,0,
        `owner-${suffix}@stress.loadgistic.local`,1,timestamp
      );
      for (let routeIndex = 0; routeIndex < 2; routeIndex += 1) {
        const [routeDestination] = differentLocation(driverIndex + 8,routeIndex * 6 + 4);
        routeInsert.run(`stress-route-driver-${suffix}-${routeIndex + 1}`,null,providerId,city,routeDestination,userId,timestamp);
      }
      vehicleInsert.run(
        vehicleId,null,providerId,`LG-TRK-D${pad(driverIndex,5)}`,'My truck',cargo,
        `ET-D-${pad(driverIndex,4)}`,driverIndex % 17 === 0 ? 0 : 1,make,model,cargo
      );
      const subscriptionId = `stress-sub-driver-${suffix}`;
      const access=subscriptionFixture(driverIndex,'DRIVER',now);
      subscriptionInsert.run(subscriptionId,null,providerId,'plan-solo',access.status,access.billingModel,access.startsAt,access.endsAt,timestamp);
      subscriptions.push({id:subscriptionId,ownerId:providerId,ownerType:'PROVIDER_PROFILE',plan:'Self-managed Driver Demand'});
      const vehicle = {id:vehicleId,organizationId:null,providerProfileId:providerId,ownerUserId:userId,driverUserId:userId,active:driverIndex % 17 === 0 ? 0 : 1,index:vehicles.length + 1};
      vehicles.push(vehicle);
      selfManaged.push({id:providerId,userId,name,city,vehicle});
    }

    for (let adminIndex = 1; adminIndex <= profile.extraAdmins; adminIndex += 1) {
      const suffix = pad(adminIndex,2);
      userInsert.run(
        `stress-user-admin-${suffix}`,`admin-${suffix}@stress.loadgistic.local`,null,passwordHash,
        `Platform Administrator ${suffix}`,'ADMIN',null,null,1,timestamp
      );
    }

    const applicationInsert = db.prepare(`INSERT INTO applications
      (id,user_id,business_name,application_type,status,sponsored_free,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    for (let applicantIndex = 1; applicantIndex <= profile.applicants; applicantIndex += 1) {
      const suffix = pad(applicantIndex);
      const business=businesses[(applicantIndex-1)%businesses.length];
      const applicationType=business.role==='SHIPPER'?'ENTERPRISE_SHIPPER':'ENTERPRISE_RECEIVER';
      const userId=`stress-user-signup-${suffix}`;
      userInsert.run(
        userId,`signup-${suffix}@stress.loadgistic.local`,null,passwordHash,
        `Signup Member ${suffix}`,business.role,business.id,null,1,days(now,-applicantIndex).toISOString()
      );
      db.prepare(`INSERT INTO memberships (id,user_id,organization_id,membership_role) VALUES (?,?,?,'MEMBER')`)
        .run(`stress-membership-signup-${suffix}`,userId,business.id);
      applicationInsert.run(
        `stress-application-${suffix}`,userId,business.name,applicationType,'APPROVED',0,
        'Workspace created by self-service signup.',days(now,-applicantIndex).toISOString(),days(now,-applicantIndex).toISOString()
      );
    }
    for (let approvedIndex = 0; approvedIndex < Math.min(10,businesses.length); approvedIndex += 1) {
      const business = businesses[approvedIndex];
      applicationInsert.run(
        `stress-application-approved-${pad(approvedIndex + 1)}`,business.userId,business.name,
        business.role === 'SHIPPER' ? 'ENTERPRISE_SHIPPER' : 'ENTERPRISE_RECEIVER','APPROVED',approvedIndex === 5 ? 1 : 0,
        'Workspace created by self-service signup.',days(now,-180 - approvedIndex).toISOString(),days(now,-180 - approvedIndex).toISOString()
      );
    }

    for (let placeIndex = 0; placeIndex < LOCATIONS.length; placeIndex += 1) {
      const [displayName,latitude,longitude] = LOCATIONS[placeIndex];
      const name = displayName.replace(/,\s*Ethiopia$/,'');
      db.prepare(`INSERT OR IGNORE INTO place_catalog
        (id,name,normalized_name,alternate_names,place_type,latitude,longitude,population,wikidata_id,osm_type,osm_id,source,updated_at,country_name,country_code)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(
          `stress-place-${pad(placeIndex + 1)}`,name,normalizePlaceName(displayName),null,
          placeIndex < 12 ? 'city' : 'town',latitude,longitude,100000 + placeIndex * 17000,
          null,'node',`stress-${placeIndex + 1}`,'stress-fixture',timestamp,'Ethiopia','ET'
        );
    }

    const serviceAreaInsert=db.prepare(`INSERT INTO service_areas
      (id,organization_id,provider_profile_id,place_ref,place_label,center_lat,center_lng,radius_km,created_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    for(const [businessOffset,business] of businesses.entries()){
      const businessIndex=businessOffset+1;
      const placeIndex=(businessIndex-1)%LOCATIONS.length;
      const [placeLabel,lat,lng]=LOCATIONS[placeIndex];
      serviceAreaInsert.run(`stress-area-business-${pad(businessIndex)}`,business.id,null,`stress-place-${pad(placeIndex+1)}`,placeLabel,lat,lng,[10,25,40,60][businessIndex%4],business.userId,timestamp);
    }
    for(const [fleetOffset,fleet] of fleets.entries()){
      const fleetIndex=fleetOffset+1;
      const placeIndex=(fleetIndex*3)%LOCATIONS.length;
      const [placeLabel,lat,lng]=LOCATIONS[placeIndex];
      serviceAreaInsert.run(`stress-area-fleet-${pad(fleetIndex)}`,fleet.id,null,`stress-place-${pad(placeIndex+1)}`,placeLabel,lat,lng,[25,40,60,100][fleetIndex%4],fleet.userId,timestamp);
    }
    for(const [providerOffset,provider] of selfManaged.entries()){
      const providerIndex=providerOffset+1;
      const placeIndex=(providerIndex*5)%LOCATIONS.length;
      const [placeLabel,lat,lng]=LOCATIONS[placeIndex];
      serviceAreaInsert.run(`stress-area-driver-${pad(providerIndex)}`,null,provider.id,`stress-place-${pad(placeIndex+1)}`,placeLabel,lat,lng,[10,25,40][providerIndex%3],provider.userId,timestamp);
    }

    const capacityInsert = db.prepare(`INSERT INTO capacities
      (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,proof_recorded_at,current_route_origin,current_route_destination,current_route_date,planned_space_status,accepts_multi_pick,accepts_multi_drop)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const vehicle of vehicles) {
      const [origin,latitude,longitude] = location(vehicle.index);
      const [destination] = differentLocation(vehicle.index,6);
      const historicalStatus = vehicle.index % 2 ? 'PARTIAL' : 'EMPTY';
      const historicalPercent = historicalStatus === 'PARTIAL' ? 25 + (vehicle.index % 3) * 20 : 100;
      capacityInsert.run(
        `stress-capacity-history-${pad(vehicle.index,4)}`,vehicle.organizationId,vehicle.providerProfileId,vehicle.id,
        historicalStatus,historicalPercent,origin,destination,`${origin} ↔ ${destination}`,
        dateOnly(days(now,-3)),'Historical capacity','OPEN',null,vehicle.ownerUserId,
        days(now,-4).toISOString(),days(now,-3).toISOString(),`Around ${origin}`,
        days(now,-4).toISOString(),latitude,longitude,40,'DEVICE_OBSCURED',1,
        historicalStatus === 'PARTIAL' ? 1 : 0,vehicle.index % 3 === 0 ? 1 : 0,
        vehicle.index % 4 === 0 ? 1 : 0,null,
        historicalStatus === 'PARTIAL' ? origin : null,historicalStatus === 'PARTIAL' ? destination : null,
        historicalStatus === 'PARTIAL' ? dateOnly(days(now,-3)) : null,
        historicalStatus === 'PARTIAL' ? 'PARTIAL' : 'FULL',
        vehicle.index % 4 === 0 ? 1 : 0,vehicle.index % 5 === 0 ? 1 : 0
      );
      const latestStatus = !vehicle.active || (vehicle.organizationId&&!vehicle.assignedDriverUserId) || vehicle.index % 7 === 0 ? 'OFF_DUTY' : vehicle.index % 3 === 0 ? 'PARTIAL' : 'EMPTY';
      const latestPercent = latestStatus === 'OFF_DUTY' ? 0 : latestStatus === 'PARTIAL' ? 20 + (vehicle.index % 4) * 20 : 100;
      const visibility = ['OPEN','SAVED_PARTNERS','PRIVATE','DIRECT_TO_SELECTED_BUSINESS'][vehicle.index % 4];
      const updatedAt = vehicle.index % 11 === 0 ? hours(now,-18).toISOString() : hours(now,-(vehicle.index % 6)).toISOString();
      const expiresAt = vehicle.index % 13 === 0 ? hours(now,-1).toISOString() : hours(now,24 - (vehicle.index % 8)).toISOString();
      const hasDeviceLocation = vehicle.ownerUserId === vehicle.driverUserId && latestStatus !== 'OFF_DUTY';
      capacityInsert.run(
        `stress-capacity-latest-${pad(vehicle.index,4)}`,vehicle.organizationId,vehicle.providerProfileId,vehicle.id,
        latestStatus,latestPercent,
        latestStatus === 'OFF_DUTY' ? null : origin,latestStatus === 'OFF_DUTY' ? null : destination,
        latestStatus === 'OFF_DUTY' ? null : `${origin} ↔ ${destination}`,
        latestStatus === 'OFF_DUTY' ? null : dateOnly(days(now,1 + vehicle.index % 6)),
        latestStatus === 'OFF_DUTY' ? null : 'Available after current stop',
        visibility,vehicle.index % 9 === 0 ? demoFile : null,vehicle.driverUserId,
        updatedAt,expiresAt,latestStatus === 'OFF_DUTY' ? null : `Around ${origin}`,
        latestStatus === 'OFF_DUTY' ? null : updatedAt,
        hasDeviceLocation ? latitude : null,hasDeviceLocation ? longitude : null,
        hasDeviceLocation ? 40 : null,hasDeviceLocation ? 'DEVICE_OBSCURED' : latestStatus === 'OFF_DUTY' ? null : 'MANUAL_GENERAL_AREA',
        latestStatus === 'OFF_DUTY' ? 0 : 1,latestStatus === 'PARTIAL' || vehicle.index % 4 === 0 ? 1 : 0,
        vehicle.index % 3 === 0 ? 1 : 0,vehicle.index % 4 === 0 || vehicle.index % 5 === 0 ? 1 : 0,
        vehicle.index % 9 === 0 ? updatedAt : null,
        latestStatus === 'PARTIAL' ? origin : null,latestStatus === 'PARTIAL' ? destination : null,
        latestStatus === 'PARTIAL' ? dateOnly(days(now,vehicle.index % 3)) : null,
        latestStatus === 'OFF_DUTY' ? null : vehicle.index % 2 ? 'PARTIAL' : 'FULL',
        vehicle.index % 4 === 0 ? 1 : 0,vehicle.index % 5 === 0 ? 1 : 0
      );
      if(latestStatus!=='OFF_DUTY'&&vehicle.index%3!==2){
        const movementScope=vehicle.index%3===0?'LOCAL':'BOTH';
        const capacityId=`stress-capacity-latest-${pad(vehicle.index,4)}`;
        if(movementScope==='LOCAL'){
          db.prepare(`UPDATE capacities SET status='EMPTY',available_percent=100,
            origin=NULL,destination=NULL,corridor=NULL,travel_date=NULL,planned_space_status=NULL,
            current_route_origin=NULL,current_route_destination=NULL,current_route_date=NULL,
            location_lat=NULL,location_lng=NULL,location_precision_km=NULL,location_source='MANUAL_GENERAL_AREA'
            WHERE id=?`).run(capacityId);
        }
        db.prepare(`UPDATE capacities SET movement_scope=?,local_place_ref=?,local_place_label=?,
          local_center_lat=?,local_center_lng=?,local_radius_km=? WHERE id=?`)
          .run(movementScope,`stress-place-${pad((vehicle.index-1)%LOCATIONS.length+1)}`,origin,latitude,longitude,[10,25,40,60][vehicle.index%4],capacityId);
      }
    }

    const relationshipInsert = db.prepare(`INSERT INTO partner_relationships
      (id,owner_organization_id,provider_organization_id,provider_profile_id,status,requested_by_side,business_favorite,provider_favorite,created_at,updated_at,responded_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const relationshipCount = Math.max(240 * profile.scale,businesses.length * 2);
    const relationshipPairs = new Set();
    const addRelationship = ({id,business,provider,providerKind,status,requestedBy,businessFavorite,providerFavorite,ageDays}) => {
      const pairKey = `${business.id}:${providerKind}:${provider.id}`;
      if (relationshipPairs.has(pairKey)) return false;
      relationshipPairs.add(pairKey);
      relationshipInsert.run(
        id,business.id,providerKind === 'FLEET' ? provider.id : null,providerKind === 'DRIVER' ? provider.id : null,
        status,requestedBy,businessFavorite ? 1 : 0,providerFavorite ? 1 : 0,
        days(now,-ageDays).toISOString(),days(now,-Math.max(0,ageDays - 1)).toISOString(),
        ['CONNECTED','DECLINED'].includes(status) ? days(now,-Math.max(0,ageDays - 2)).toISOString() : null
      );
      return true;
    };
    const networkCohort = [
      {id:'stress-network-business-001-fleet-001',business:businesses[0],provider:fleets[0],providerKind:'FLEET',status:'CONNECTED',requestedBy:'BUSINESS',businessFavorite:true,providerFavorite:true,ageDays:1},
      {id:'stress-network-business-001-driver-001',business:businesses[0],provider:selfManaged[0],providerKind:'DRIVER',status:'CONNECTED',requestedBy:'PROVIDER',businessFavorite:true,providerFavorite:true,ageDays:2},
      {id:'stress-network-business-001-fleet-002',business:businesses[0],provider:fleets[1],providerKind:'FLEET',status:'PENDING',requestedBy:'BUSINESS',businessFavorite:true,providerFavorite:false,ageDays:1},
      {id:'stress-network-business-001-driver-002',business:businesses[0],provider:selfManaged[1],providerKind:'DRIVER',status:'FAVORITE',requestedBy:'BUSINESS',businessFavorite:true,providerFavorite:false,ageDays:1},
      {id:'stress-network-business-002-fleet-001',business:businesses[1],provider:fleets[0],providerKind:'FLEET',status:'CONNECTED',requestedBy:'PROVIDER',businessFavorite:true,providerFavorite:true,ageDays:2},
      {id:'stress-network-business-003-fleet-001',business:businesses[2],provider:fleets[0],providerKind:'FLEET',status:'PENDING',requestedBy:'BUSINESS',businessFavorite:true,providerFavorite:false,ageDays:1},
      {id:'stress-network-business-006-fleet-001',business:businesses[5],provider:fleets[0],providerKind:'FLEET',status:'PENDING',requestedBy:'PROVIDER',businessFavorite:false,providerFavorite:true,ageDays:1},
      {id:'stress-network-business-007-fleet-001',business:businesses[6],provider:fleets[0],providerKind:'FLEET',status:'DECLINED',requestedBy:'BUSINESS',businessFavorite:true,providerFavorite:false,ageDays:2}
    ];
    let insertedRelationships = 0;
    for (const relationship of networkCohort) {
      if (addRelationship(relationship)) insertedRelationships += 1;
    }
    let relationshipCursor = 1;
    while (insertedRelationships < relationshipCount) {
      const business = businesses[(relationshipCursor - 1) % businesses.length];
      const useFleet = relationshipCursor % 3 !== 0;
      const round = Math.floor((relationshipCursor - 1) / businesses.length);
      const provider = useFleet
        ? fleets[(relationshipCursor * 7 + round) % fleets.length]
        : selfManaged[(relationshipCursor * 11 + round) % selfManaged.length];
      const statuses = ['FAVORITE','PENDING','CONNECTED','DECLINED'];
      const status = statuses[(relationshipCursor - 1) % statuses.length];
      if (addRelationship({
        id:`stress-relationship-${pad(relationshipCursor,4)}`,
        business,
        provider,
        providerKind:useFleet ? 'FLEET' : 'DRIVER',
        status,
        requestedBy:relationshipCursor % 2 ? 'BUSINESS' : 'PROVIDER',
        businessFavorite:status === 'CONNECTED' || relationshipCursor % 3 === 0,
        providerFavorite:status === 'CONNECTED' || relationshipCursor % 5 === 0,
        ageDays:1 + relationshipCursor % 90
      })) insertedRelationships += 1;
      relationshipCursor += 1;
    }

    const favoriteInsert = db.prepare(`INSERT INTO member_favorites
      (id,owner_organization_id,target_organization_id,created_by,created_at)
      VALUES (?,?,?,?,?)`);
    for (let index = 1; index <= businesses.length; index += 1) {
      const owner = businesses[index - 1];
      const target = businesses[(index + 6) % businesses.length];
      favoriteInsert.run(`stress-business-favorite-${pad(index)}`,owner.id,target.id,owner.userId,days(now,-index % 45).toISOString());
    }

    const shipmentInsert = db.prepare(`INSERT INTO shipments
      (id,code,title,service_mode,distribution_mode,price_mode,price_minor,target_price_minor,shipper_organization_id,receiver_organization_id,provider_organization_id,provider_profile_id,assigned_vehicle_id,assigned_driver_user_id,origin,destination,cargo_description,package_count,estimated_weight,vehicle_category,load_type,receiver_first_name,receiver_phone,pickup_date,delivery_date,commercial_status,operational_status,tracking_mode,tracking_code_hash,load_owner_organization_id,load_owner_party_role,external_shipper_name,external_shipper_phone,external_receiver_name,external_receiver_phone,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const eventInsert = db.prepare(`INSERT INTO shipment_events
      (id,shipment_id,status,event_type,note,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,public,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const interestInsert = db.prepare(`INSERT INTO shipment_interests
      (id,shipment_id,provider_organization_id,provider_profile_id,status,note,created_by,created_at)
      VALUES (?,?,?,?,?,?,?,?)`);
    const noteInsert = db.prepare(`INSERT INTO shipment_notes
      (id,shipment_id,author_user_id,note,created_at) VALUES (?,?,?,?,?)`);
    const proofInsert = db.prepare(`INSERT INTO proof_files
      (id,shipment_id,proof_type,file_path,original_name,mime_type,note,uploaded_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    const requestInsert = db.prepare(`INSERT INTO load_proof_requests
      (id,shipment_id,interest_id,requested_at,fulfilled_at) VALUES (?,?,?,?,?)`);
    const shareInsert = db.prepare(`INSERT INTO load_proof_shares
      (id,shipment_id,interest_id,file_path,original_name,mime_type,note,uploaded_by,created_at,expires_at,revoked_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const reviewInsert = db.prepare(`INSERT INTO business_reviews
      (id,shipment_id,reviewer_organization_id,subject_organization_id,rating,note,status,created_by,created_at,reviewed_by,review_note,reviewed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const generatedShipments = [];
    const localShipmentUpdate=db.prepare(`UPDATE shipments SET movement_scope='LOCAL',local_place_ref=?,local_place_label=?,
      local_center_lat=?,local_center_lng=?,pickup_area_label=?,dropoff_area_label=?,pickup_lat=?,pickup_lng=?,dropoff_lat=?,dropoff_lng=?
      WHERE id=?`);

    for (let index = 1; index <= profile.loads; index += 1) {
      const suffix = pad(index,5);
      const shipmentId = `stress-shipment-${suffix}`;
      const code = `LGX-S${suffix}`;
      const state = SHIPMENT_STATES[(index - 1) % SHIPMENT_STATES.length];
      const loadType = index % 3 === 0 ? 'FTL' : 'PTL';
      const distributionMode = ['OPEN_MARKET','SAVED_PARTNERS','DIRECT_TO_PROVIDER'][(index - 1) % 3];
      const priceMode = ['FIXED_PRICE','TARGET_PRICE','QUOTE_REQUESTED'][(index - 1) % 3];
      const owner = businesses[(index - 1) % businesses.length];
      const counterpart = businesses[(index + 10) % businesses.length];
      const ownerPartyRole = index % 5 === 0 ? 'RECEIVER' : 'SHIPPER';
      const usesExternalReceiver = ownerPartyRole === 'SHIPPER' && index % 17 === 0;
      const shipper = ownerPartyRole === 'SHIPPER' ? owner : counterpart;
      const receiver = ownerPartyRole === 'RECEIVER' ? owner : usesExternalReceiver ? null : counterpart;
      const useFleet = index % 4 !== 0;
      const provider = useFleet ? fleets[index % fleets.length] : selfManaged[index % selfManaged.length];
      const hasProvider = distributionMode === 'DIRECT_TO_PROVIDER' || ['AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED'].includes(state);
      const [origin] = location(index);
      const [destination] = differentLocation(index,4 + index % 7);
      const createdAt = days(now,-(index % 120) - 2).toISOString();
      const updatedAt = hours(now,-(index % 72)).toISOString();
      const needsReceiverContact = ['AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED'].includes(state);
      const assignedVehicle = needsReceiverContact
        ? useFleet ? provider.vehicles.find(vehicle=>vehicle.active&&vehicle.assignedDriverUserId) : provider.vehicle
        : null;
      const trackingMode = index % 2 ? 'STATUS_ONLY' : 'LOCATION_AND_STATUS';
      const vehicleCategory = CARGO_CONFIGURATIONS[index % CARGO_CONFIGURATIONS.length];
      const title = `${CARGO_DESCRIPTIONS[index % CARGO_DESCRIPTIONS.length]} to ${destination.replace(', Ethiopia','')}`;
      shipmentInsert.run(
        shipmentId,code,title,'FREIGHT',distributionMode,priceMode,
        priceMode === 'FIXED_PRICE' ? 1_500_000 + index * 12_500 : null,
        priceMode === 'TARGET_PRICE' ? 1_250_000 + index * 10_000 : null,
        shipper.id,receiver?.id || null,
        hasProvider && useFleet ? provider.id : null,hasProvider && !useFleet ? provider.id : null,
        assignedVehicle?.id||null,assignedVehicle?.assignedDriverUserId||assignedVehicle?.driverUserId||null,
        origin,destination,CARGO_DESCRIPTIONS[index % CARGO_DESCRIPTIONS.length],
        1 + index % 240,null,vehicleCategory,loadType,
        needsReceiverContact ? `Receiver ${index % 40 + 1}` : null,
        needsReceiverContact ? `+251 911 ${pad(index % 900,3)} ${pad((index + 111) % 900,3)}` : null,
        dateOnly(days(now,1 + index % 12)),dateOnly(days(now,2 + index % 18)),
        state,state,trackingMode,hashTrackingAccessCode(trackingAccessCode(shipmentId)),
        owner.id,ownerPartyRole,
        null,null,usesExternalReceiver ? `External Receiver ${suffix}` : null,
        usesExternalReceiver ? `+251 922 ${pad(index % 900,3)} ${pad((index + 222) % 900,3)}` : null,
        owner.userId,createdAt,updatedAt
      );
      if(index%5===0){
        const placeIndex=(index-1)%LOCATIONS.length;
        const [localLabel,localLat,localLng]=LOCATIONS[placeIndex];
        localShipmentUpdate.run(
          `stress-place-${pad(placeIndex+1)}`,localLabel,localLat,localLng,
          `Local pickup area ${index%12+1}`,`Local drop-off area ${(index+4)%12+1}`,
          index%10===0?localLat+.015:null,index%10===0?localLng+.015:null,
          index%10===0?localLat-.012:null,index%10===0?localLng-.012:null,
          shipmentId
        );
      }

      const history = STATE_HISTORY[state];
      for (let eventIndex = 0; eventIndex < history.length; eventIndex += 1) {
        const eventState = history[eventIndex];
        const providerActor = ['ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED'].includes(eventState);
        const eventActor = providerActor && hasProvider ? provider.userId : owner.userId;
        const hasLocation = providerActor && trackingMode === 'LOCATION_AND_STATUS';
        const [,latitude,longitude] = location(index + eventIndex);
        eventInsert.run(
          `stress-event-${suffix}-${pad(eventIndex + 1,2)}`,shipmentId,eventState,
          eventIndex === 0 ? 'CREATED' : eventState === 'IN_TRANSIT' && index % 6 === 0 ? 'LOCATION' : 'STATUS',
          `${eventState.replaceAll('_',' ')} update for ${code}.`,
          hasLocation ? `Around ${location(index + eventIndex)[0]}` : null,
          hasLocation ? latitude : null,hasLocation ? longitude : null,
          hasLocation ? (loadType === 'FTL' ? 20 : 40) : null,
          hasLocation ? 'DEVICE_OBSCURED' : null,eventActor,1,
          hours(new Date(createdAt),eventIndex * 8).toISOString()
        );
      }

      const interestIds = [];
      const interestCount = distributionMode === 'DIRECT_TO_PROVIDER' ? 1 : 2 + index % 3;
      for (let interestIndex = 0; interestIndex < interestCount; interestIndex += 1) {
        const interestedUseFleet = (index + interestIndex) % 3 !== 0;
        const interestedProvider = interestedUseFleet
          ? fleets[(index + interestIndex * 3 + 1) % fleets.length]
          : selfManaged[(index + interestIndex * 5 + 1) % selfManaged.length];
        const interestId = `stress-interest-${suffix}-${interestIndex + 1}`;
        interestInsert.run(
          interestId,shipmentId,interestedUseFleet ? interestedProvider.id : null,
          interestedUseFleet ? null : interestedProvider.id,'INTERESTED',
          `Available to discuss ${loadType} capacity on this route.`,interestedProvider.userId,
          hours(new Date(createdAt),12 + interestIndex).toISOString()
        );
        interestIds.push(interestId);
      }

      if (index % 4 === 0) {
        noteInsert.run(`stress-note-${suffix}`,shipmentId,owner.userId,'Confirm loading access and Business receiving hours.',hours(new Date(createdAt),18).toISOString());
      }
      if (index % 7 === 0 && hasProvider) {
        const proofTypes = ['LOADING','DELIVERY','ISSUE'];
        proofInsert.run(
          `stress-proof-${suffix}`,shipmentId,proofTypes[index % proofTypes.length],demoFile,
          `stress-proof-${suffix}.jpg`,'image/jpeg','Development fixture proof.',provider.userId,updatedAt
        );
      }
      if (index % 9 === 0 && interestIds.length) {
        const requestId = `stress-load-proof-request-${suffix}`;
        const interestId = interestIds[0];
        const fulfilled = index % 18 === 0;
        requestInsert.run(requestId,shipmentId,interestId,hours(new Date(createdAt),20).toISOString(),fulfilled ? hours(new Date(createdAt),22).toISOString() : null);
        if (fulfilled) {
          shareInsert.run(
            `stress-load-proof-share-${suffix}`,shipmentId,interestId,demoFile,
            `stress-load-size-${suffix}.jpg`,'image/jpeg','Temporary pallet and shipment-size evidence.',
            owner.userId,hours(new Date(createdAt),22).toISOString(),hours(now,index % 27 === 0 ? -1 : 48).toISOString(),
            index % 36 === 0 ? hours(now,-2).toISOString() : null
          );
        }
      }

      if (state === 'COMPLETED' && receiver) {
        const reviewPatterns = [
          {rating:5,status:'PUBLISHED'},
          {rating:4,status:'PUBLISHED'},
          {rating:3,status:'PENDING'},
          {rating:2,status:'DISMISSED'},
          {rating:1,status:'PUBLISHED'}
        ];
        const reviewPattern = reviewPatterns[index % reviewPatterns.length];
        const reviewed = reviewPattern.status !== 'PENDING' && reviewPattern.rating < 4;
        reviewInsert.run(
          `stress-review-${suffix}-shipper`,shipmentId,shipper.id,receiver.id,
          reviewPattern.rating,reviewPattern.rating < 4 ? 'Delivery experience requires administrator review.' : 'Reliable Business partner.',
          reviewPattern.status,shipper.userId,updatedAt,reviewed ? 'user-admin' : null,
          reviewed ? 'Reviewed against the shipment timeline and participant records.' : null,reviewed ? hours(new Date(updatedAt),2).toISOString() : null
        );
        reviewInsert.run(
          `stress-review-${suffix}-receiver`,shipmentId,receiver.id,shipper.id,
          index % 2 ? 5 : 4,'Clear shipment information and receiving coordination.','PUBLISHED',
          receiver.userId,updatedAt,null,null,null
        );
      }
      generatedShipments.push({id:shipmentId,code,state,owner,receiver,provider,hasProvider});
    }

    const cohortLoads = [
      {
        id:'stress-network-load-partners',
        code:'LGX-NET-PARTNERS',
        title:'Partners-only coffee cartons to Hawassa',
        distributionMode:'SAVED_PARTNERS',
        priceMode:'QUOTE_REQUESTED',
        priceMinor:null,
        targetPriceMinor:null,
        provider:null,
        providerKind:null,
        state:'POSTED',
        loadType:'PTL',
        cargo:'Sealed coffee cartons shared only with Connected transport partners',
        vehicleCategory:'Light Box Truck'
      },
      {
        id:'stress-network-load-direct-fleet',
        code:'LGX-NET-DIRECT-FLEET',
        title:'Direct flour request for Horizon Freight 001',
        distributionMode:'DIRECT_TO_PROVIDER',
        priceMode:'TARGET_PRICE',
        priceMinor:null,
        targetPriceMinor:3_200_000,
        provider:fleets[0],
        providerKind:'FLEET',
        state:'SENT',
        loadType:'FTL',
        cargo:'Bagged flour assigned as a direct negotiation request',
        vehicleCategory:'Medium Stake Body Truck'
      },
      {
        id:'stress-network-load-direct-driver',
        code:'LGX-NET-DIRECT-DRIVER',
        title:'Direct furniture request for Owner Operator 001',
        distributionMode:'DIRECT_TO_PROVIDER',
        priceMode:'FIXED_PRICE',
        priceMinor:2_450_000,
        targetPriceMinor:null,
        provider:selfManaged[0],
        providerKind:'DRIVER',
        state:'SENT',
        loadType:'PTL',
        cargo:'Crated furniture components addressed to one self-managed driver',
        vehicleCategory:'Mini Box Truck'
      }
    ];
    for (let index = 0; index < cohortLoads.length; index += 1) {
      const fixture = cohortLoads[index];
      const owner = businesses[0];
      const receiver = businesses[1];
      const createdAt = hours(now,-(index + 1)).toISOString();
      shipmentInsert.run(
        fixture.id,fixture.code,fixture.title,'FREIGHT',fixture.distributionMode,
        fixture.priceMode,fixture.priceMinor,fixture.targetPriceMinor,
        owner.id,receiver.id,
        fixture.providerKind === 'FLEET' ? fixture.provider.id : null,
        fixture.providerKind === 'DRIVER' ? fixture.provider.id : null,
        null,null,
        'Addis Ababa, Ethiopia','Hawassa, Ethiopia',fixture.cargo,
        12 + index * 6,null,fixture.vehicleCategory,fixture.loadType,
        null,null,dateOnly(days(now,2 + index)),dateOnly(days(now,4 + index)),
        fixture.state,fixture.state,'STATUS_ONLY',
        hashTrackingAccessCode(trackingAccessCode(fixture.id)),
        owner.id,'SHIPPER',null,null,null,null,owner.userId,createdAt,createdAt
      );
      eventInsert.run(
        `stress-event-network-${index + 1}`,fixture.id,fixture.state,'CREATED',
        fixture.distributionMode === 'SAVED_PARTNERS'
          ? 'Load shared with Connected transport partners.'
          : 'Direct request sent to one transport provider.',
        null,null,null,null,null,owner.userId,1,createdAt
      );
      generatedShipments.push({
        id:fixture.id,
        code:fixture.code,
        state:fixture.state,
        owner,
        receiver,
        provider:fixture.provider,
        hasProvider:Boolean(fixture.provider)
      });
    }

    const sharedLoadFixtures=[];
    const poolCorridors=[
      {key:'south-addis-adama',origin:['Addis Ababa, Ethiopia','Addis Ababa, Ethiopia','Bishoftu, Ethiopia'],destination:['Adama, Ethiopia','Adama, Ethiopia','Adama, Ethiopia'],day:20,cargo:['Packaged workshop tools','Palletized flour bags','Crated furniture parts']},
      {key:'sidama-hawassa-dilla',origin:['Hawassa, Ethiopia','Shashamane, Ethiopia','Hawassa, Ethiopia'],destination:['Dilla, Ethiopia','Dilla, Ethiopia','Dilla, Ethiopia'],day:24,cargo:['Roasted coffee cartons','Woven producer baskets','Packed agricultural inputs']},
      {key:'north-mekelle-woldiya',origin:['Mekelle, Ethiopia','Mekelle, Ethiopia','Mekelle, Ethiopia'],destination:['Woldiya, Ethiopia','Woldiya, Ethiopia','Woldiya, Ethiopia'],day:28,cargo:['Textile rolls','Packaged spare parts','Dry food cartons']},
      {key:'northwest-bahir-gondar',origin:['Bahir Dar, Ethiopia','Bahir Dar, Ethiopia','Bahir Dar, Ethiopia'],destination:['Gondar, Ethiopia','Gondar, Ethiopia','Gondar, Ethiopia'],day:32,cargo:['Artisan home goods','Sealed honey cartons','Leather workshop supplies']}
    ];
    for(const [groupIndex,group] of poolCorridors.entries()){
      for(let memberIndex=0;memberIndex<group.origin.length;memberIndex+=1){
        sharedLoadFixtures.push({
          key:`pool-${group.key}-${memberIndex+1}`,
          title:`Pool candidate ${group.cargo[memberIndex]}`,
          origin:group.origin[memberIndex],
          destination:group.destination[memberIndex],
          loadType:'PTL',
          pickupDay:group.day+(memberIndex%2),
          deliveryDay:group.day+2+(memberIndex%2),
          cargo:group.cargo[memberIndex],
          vehicleCategory:CARGO_CONFIGURATIONS[(groupIndex*2+memberIndex)%CARGO_CONFIGURATIONS.length]
        });
      }
    }
    const alongRouteCorridors=[
      {
        key:'south',
        day:40,
        stops:['Addis Ababa, Ethiopia','Bishoftu, Ethiopia','Adama, Ethiopia','Ziway, Ethiopia','Shashamane, Ethiopia','Hawassa, Ethiopia','Dilla, Ethiopia']
      },
      {
        key:'east',
        day:52,
        stops:['Addis Ababa, Ethiopia','Adama, Ethiopia','Dire Dawa, Ethiopia','Harar, Ethiopia','Jijiga, Ethiopia']
      },
      {
        key:'north',
        day:64,
        stops:['Addis Ababa, Ethiopia','Debre Birhan, Ethiopia','Kombolcha, Ethiopia','Dessie, Ethiopia','Woldiya, Ethiopia','Mekelle, Ethiopia']
      },
      {
        key:'northwest',
        day:76,
        stops:['Addis Ababa, Ethiopia','Debre Markos, Ethiopia','Bahir Dar, Ethiopia','Gondar, Ethiopia']
      }
    ];
    for(const [corridorIndex,corridor] of alongRouteCorridors.entries()){
      for(let legIndex=0;legIndex<corridor.stops.length-1;legIndex+=1){
        const loadType=legIndex%3===0?'FTL':'PTL';
        sharedLoadFixtures.push({
          key:`route-${corridor.key}-${legIndex+1}`,
          title:`${corridor.key[0].toUpperCase()+corridor.key.slice(1)} corridor leg ${legIndex+1}`,
          origin:corridor.stops[legIndex],
          destination:corridor.stops[legIndex+1],
          loadType,
          pickupDay:corridor.day+legIndex*2,
          deliveryDay:corridor.day+legIndex*2+1,
          cargo:CARGO_DESCRIPTIONS[(corridorIndex*3+legIndex)%CARGO_DESCRIPTIONS.length],
          vehicleCategory:CARGO_CONFIGURATIONS[(corridorIndex*2+legIndex+3)%CARGO_CONFIGURATIONS.length]
        });
      }
    }
    for(const [fixtureIndex,fixture] of sharedLoadFixtures.entries()){
      const suffix=pad(fixtureIndex+1,3);
      const shipmentId=`stress-shared-${fixture.key}`;
      const owner=businesses[fixtureIndex%businesses.length];
      const receiver=businesses[(fixtureIndex+13)%businesses.length];
      const createdAt=hours(now,-(fixtureIndex%18)-1).toISOString();
      shipmentInsert.run(
        shipmentId,`LGX-SHARED-${suffix}`,fixture.title,'FREIGHT','OPEN_MARKET',
        fixtureIndex%2?'TARGET_PRICE':'QUOTE_REQUESTED',null,
        fixtureIndex%2?1_800_000+fixtureIndex*50_000:null,
        owner.id,receiver.id,null,null,null,null,
        fixture.origin,fixture.destination,fixture.cargo,
        4+fixtureIndex%22,null,fixture.vehicleCategory,fixture.loadType,
        null,null,dateOnly(days(now,fixture.pickupDay)),dateOnly(days(now,fixture.deliveryDay)),
        'POSTED','POSTED','STATUS_ONLY',hashTrackingAccessCode(trackingAccessCode(shipmentId)),
        owner.id,'SHIPPER',null,null,null,null,owner.userId,createdAt,createdAt
      );
      eventInsert.run(
        `stress-event-shared-${suffix}`,shipmentId,'POSTED','CREATED',
        fixture.key.startsWith('pool-')
          ? 'Deterministic PTL pooling example.'
          : 'Deterministic along-route example.',
        null,null,null,null,null,owner.userId,1,createdAt
      );
      generatedShipments.push({
        id:shipmentId,
        code:`LGX-SHARED-${suffix}`,
        state:'POSTED',
        owner,
        receiver,
        provider:null,
        hasProvider:false
      });
    }

    const verificationInsert = db.prepare(`INSERT INTO verification_requests
      (id,subject_type,subject_id,verification_type,document_name,file_path,original_name,mime_type,status,submitted_by,reviewed_by,review_note,submitted_at,reviewed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let verificationIndex = 0;
    const addVerification = (subjectType,subjectId,verificationType,submittedBy,label) => {
      verificationIndex += 1;
      const statuses = ['PENDING','APPROVED','MORE_INFO','REJECTED'];
      const status = statuses[(verificationIndex - 1) % statuses.length];
      const reviewed = status !== 'PENDING';
      verificationInsert.run(
        `stress-verification-${pad(verificationIndex,5)}`,subjectType,subjectId,verificationType,label,
        demoFile,`${label.toLowerCase().replaceAll(' ','-')}.jpg`,'image/jpeg',status,submittedBy,
        reviewed ? 'user-admin' : null,reviewed ? `Development ${status.toLowerCase()} review.` : null,
        days(now,-verificationIndex % 120).toISOString(),reviewed ? days(now,-verificationIndex % 100).toISOString() : null
      );
    };
    for (const business of businesses) {
      addVerification('ORGANIZATION',business.id,'IDENTITY',business.userId,'Owner national identity');
      addVerification('ORGANIZATION',business.id,'BUSINESS_LICENSE',business.userId,'Business license');
    }
    for (const fleet of fleets) {
      addVerification('ORGANIZATION',fleet.id,'IDENTITY',fleet.userId,'Owner national identity');
      addVerification('ORGANIZATION',fleet.id,'BUSINESS_LICENSE',fleet.userId,'Transport business license');
      for (const vehicle of fleet.vehicles) {
        addVerification('VEHICLE',vehicle.id,vehicle.index % 2 ? 'VEHICLE_OWNERSHIP' : 'VEHICLE_AUTHORIZATION',fleet.userId,'Vehicle authority document');
      }
    }
    for (const driver of selfManaged) {
      addVerification('PROVIDER_PROFILE',driver.id,'IDENTITY',driver.userId,'National identity');
      addVerification('PROVIDER_PROFILE',driver.id,'DRIVER_IDENTITY',driver.userId,'Driver license');
      addVerification('VEHICLE',driver.vehicle.id,'VEHICLE_OWNERSHIP',driver.userId,'Vehicle ownership');
    }
    for (const fleet of fleets) {
      for (let driverIndex = 1; driverIndex <= profile.companyDriversPerTransporter; driverIndex += 1) {
        addVerification('DRIVER',`stress-driver-fleet-${pad(Number(fleet.id.split('-').at(-1)))}-${driverIndex}`,'DRIVER_IDENTITY',`stress-user-fleet-${pad(Number(fleet.id.split('-').at(-1)))}-driver-${driverIndex}`,'Company driver identity');
      }
    }

    const paymentInsert = db.prepare(`INSERT INTO payment_proofs
      (id,subscription_id,amount_minor,reference,file_path,status,submitted_at,reviewed_at)
      VALUES (?,?,?,?,?,?,?,?)`);
    const paymentStatuses = ['PENDING','APPROVED','REJECTED','MORE_INFO'];
    for (let index = 0; index < subscriptions.length; index += 1) {
      const subscription = subscriptions[index];
      const status = paymentStatuses[index % paymentStatuses.length];
      paymentInsert.run(
        `stress-payment-${pad(index + 1,5)}`,subscription.id,
        subscription.ownerType === 'ORGANIZATION' ? 250_000 + index * 250 : 150_000 + index * 200,
        `STRESS-${pad(index + 1,5)}`,index % 3 === 0 ? demoFile : null,status,
        days(now,-index % 90).toISOString(),status === 'PENDING' ? null : days(now,-index % 60).toISOString()
      );
    }

    const generatedUsers = db.prepare(`SELECT id,organization_id FROM users WHERE id LIKE 'stress-user-%' ORDER BY id`).all();
    for (let index = 0; index < generatedUsers.length; index += 1) {
      const user = generatedUsers[index];
      const createdAt = hours(now,-index % 168).toISOString();
      insertNotification(db,`stress-notification-${pad(index + 1,5)}-1`,user.id,'Welcome to the stress-test workspace','This deterministic record supports dense UI testing.',createdAt,index % 2 === 0);
      insertNotification(db,`stress-notification-${pad(index + 1,5)}-2`,user.id,index % 3 === 0 ? 'Load activity update' : 'Account review update','Open the relevant workspace page to review current records.',createdAt,index % 4 === 0);
      insertAudit(
        db,`stress-audit-user-${pad(index + 1,5)}`,user.id,user.organization_id,
        'STRESS_FIXTURE_ACTIVITY','user',user.id,{fixture:true,sequence:index + 1},createdAt
      );
    }
    const supportConversationInsert=db.prepare(`INSERT INTO support_conversations
      (id,customer_user_id,assigned_agent_user_id,category,status,created_at,updated_at,last_message_at,
       assigned_at,customer_last_read_at,agent_last_read_at,closed_at,closed_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const supportMessageInsert=db.prepare(`INSERT INTO support_messages
      (id,conversation_id,sender_user_id,body,created_at) VALUES (?,?,?,?,?)`);
    const supportEventInsert=db.prepare(`INSERT INTO support_events
      (id,conversation_id,actor_user_id,event_type,details,created_at) VALUES (?,?,?,?,?,?)`);
    const supportCategories=['ACCOUNT','PAYMENT','VERIFICATION','LOAD_TRACKING','CAPACITY','OTHER'];
    for(let index=1;index<=Math.min(profile.businesses,60);index+=1){
      const suffix=pad(index);
      const conversationId=`stress-support-${suffix}`;
      const customerId=`stress-user-business-${suffix}`;
      const status=index<=3?'OPEN':index<=15?'WAITING':'CLOSED';
      const assigned=status==='WAITING'?null:'user-support';
      const createdAt=hours(now,-index*3).toISOString();
      const updatedAt=hours(now,-index).toISOString();
      const closedAt=status==='CLOSED'?updatedAt:null;
      supportConversationInsert.run(
        conversationId,customerId,assigned,supportCategories[index%supportCategories.length],status,
        createdAt,updatedAt,updatedAt,assigned?createdAt:null,createdAt,
        assigned?updatedAt:null,closedAt,status==='CLOSED'?'user-support':null
      );
      supportMessageInsert.run(
        `${conversationId}-message-1`,conversationId,customerId,
        `Stress support request ${suffix}. This message exercises the customer queue safely.`,createdAt
      );
      if(assigned)supportMessageInsert.run(
        `${conversationId}-message-2`,conversationId,'user-support',
        status==='CLOSED'?'This request was resolved.':'I am reviewing this request now.',updatedAt
      );
      supportEventInsert.run(
        `${conversationId}-event-1`,conversationId,customerId,'CREATED',
        JSON.stringify({fixture:true}),createdAt
      );
      if(assigned)supportEventInsert.run(
        `${conversationId}-event-2`,conversationId,'user-support',status==='CLOSED'?'CLOSED':'ASSIGNED',
        JSON.stringify({fixture:true}),updatedAt
      );
    }
    for (let index = 0; index < generatedShipments.length; index += 1) {
      const shipment = generatedShipments[index];
      insertAudit(
        db,`stress-audit-load-${pad(index + 1,5)}`,shipment.owner.userId,shipment.owner.id,
        'SHIPMENT_FIXTURE_CREATED','shipment',shipment.id,{fixture:true,state:shipment.state,code:shipment.code},
        hours(now,-index % 240).toISOString()
      );
    }

    const updateOrganizationPlace=db.prepare(`UPDATE organizations
      SET city_place_ref=?,city_lat=?,city_lng=? WHERE id LIKE 'stress-%' AND city=?`);
    const updateProviderPlace=db.prepare(`UPDATE provider_profiles
      SET city_place_ref=?,city_lat=?,city_lng=? WHERE id LIKE 'stress-%' AND city=?`);
    const updateRouteOrigin=db.prepare(`UPDATE profile_routes
      SET origin_place_ref=?,origin_lat=?,origin_lng=? WHERE id LIKE 'stress-%' AND origin=?`);
    const updateRouteDestination=db.prepare(`UPDATE profile_routes
      SET destination_place_ref=?,destination_lat=?,destination_lng=? WHERE id LIKE 'stress-%' AND destination=?`);
    const updateShipmentOrigin=db.prepare(`UPDATE shipments
      SET origin_place_ref=?,origin_lat=?,origin_lng=? WHERE id LIKE 'stress-%' AND origin=? AND movement_scope='INTERCITY'`);
    const updateShipmentDestination=db.prepare(`UPDATE shipments
      SET destination_place_ref=?,destination_lat=?,destination_lng=? WHERE id LIKE 'stress-%' AND destination=? AND movement_scope='INTERCITY'`);
    const updateCapacityOrigin=db.prepare(`UPDATE capacities SET
      origin_place_ref=?,origin_lat=?,origin_lng=?,
      location_place_ref=COALESCE(location_place_ref,?),
      location_lat=COALESCE(location_lat,?),location_lng=COALESCE(location_lng,?),
      location_precision_km=COALESCE(location_precision_km,40)
      WHERE id LIKE 'stress-%' AND origin=?`);
    const updateCapacityDestination=db.prepare(`UPDATE capacities
      SET destination_place_ref=?,destination_lat=?,destination_lng=? WHERE id LIKE 'stress-%' AND destination=?`);
    const updateCurrentOrigin=db.prepare(`UPDATE capacities
      SET current_origin_place_ref=?,current_origin_lat=?,current_origin_lng=? WHERE id LIKE 'stress-%' AND current_route_origin=?`);
    const updateCurrentDestination=db.prepare(`UPDATE capacities
      SET current_destination_place_ref=?,current_destination_lat=?,current_destination_lng=? WHERE id LIKE 'stress-%' AND current_route_destination=?`);
    for(const [index,[label,lat,lng]] of LOCATIONS.entries()){
      const placeRef=`stress-place-${pad(index+1)}`;
      updateOrganizationPlace.run(placeRef,lat,lng,label);
      updateProviderPlace.run(placeRef,lat,lng,label);
      updateRouteOrigin.run(placeRef,lat,lng,label);
      updateRouteDestination.run(placeRef,lat,lng,label);
      updateShipmentOrigin.run(placeRef,lat,lng,label);
      updateShipmentDestination.run(placeRef,lat,lng,label);
      updateCapacityOrigin.run(placeRef,lat,lng,placeRef,lat,lng,label);
      updateCapacityDestination.run(placeRef,lat,lng,label);
      updateCurrentOrigin.run(placeRef,lat,lng,label);
      updateCurrentDestination.run(placeRef,lat,lng,label);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getStressDataReport(db,{profile});
}

function distinctValues(db, table, column, where = '') {
  return db.prepare(`SELECT DISTINCT ${column} AS value FROM ${table} ${where} ORDER BY ${column}`).all().map(row=>row.value);
}

export function getStressDataReport(db, { profile = null } = {}) {
  const counts = Object.fromEntries(STRESS_TABLES.map(table=>[
    table,
    db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n
  ]));
  const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all();
  return {
    profile,
    counts,
    foreignKeyViolations,
    coverage:{
      userRoles:distinctValues(db,'users','role'),
      shipmentStates:distinctValues(db,'shipments','operational_status'),
      priceModes:distinctValues(db,'shipments','price_mode'),
      distributionModes:distinctValues(db,'shipments','distribution_mode'),
      loadTypes:distinctValues(db,'shipments','load_type','WHERE load_type IS NOT NULL'),
      shipmentMovementScopes:distinctValues(db,'shipments','movement_scope'),
      capacityStates:distinctValues(db,'capacities','status'),
      capacityVisibility:distinctValues(db,'capacities','visibility'),
      capacityMovementScopes:distinctValues(db,'capacities','movement_scope'),
      relationshipStates:distinctValues(db,'partner_relationships','status'),
      verificationStates:distinctValues(db,'verification_requests','status'),
      applicationStates:distinctValues(db,'applications','status'),
      subscriptionStates:distinctValues(db,'subscriptions','status'),
      paymentStates:distinctValues(db,'payment_proofs','status'),
      ratingStates:distinctValues(db,'business_reviews','status')
    }
  };
}

export function assertStressDataIntegrity(db, report = getStressDataReport(db)) {
  if (report.foreignKeyViolations.length) throw new Error(`STRESS_FOREIGN_KEY_VIOLATIONS:${report.foreignKeyViolations.length}`);
  const emptyTables = STRESS_TABLES.filter(table=>report.counts[table] < 1);
  if (emptyTables.length) throw new Error(`STRESS_EMPTY_TABLES:${emptyTables.join(',')}`);

  const invalidVehicleScopes = db.prepare(`SELECT COUNT(*) AS n FROM vehicles
    WHERE (organization_id IS NULL)=(provider_profile_id IS NULL)`).get().n;
  if (invalidVehicleScopes) throw new Error(`STRESS_INVALID_VEHICLE_SCOPES:${invalidVehicleScopes}`);

  const invalidCapacityScopes = db.prepare(`SELECT COUNT(*) AS n FROM capacities c
    JOIN vehicles v ON v.id=c.vehicle_id
    WHERE c.provider_organization_id IS NOT v.organization_id
      OR c.provider_profile_id IS NOT v.provider_profile_id`).get().n;
  if (invalidCapacityScopes) throw new Error(`STRESS_INVALID_CAPACITY_SCOPES:${invalidCapacityScopes}`);

  const invalidLocalCapacity = db.prepare(`SELECT COUNT(*) AS n FROM capacities
    WHERE movement_scope='LOCAL' AND status='PARTIAL'`).get().n;
  if (invalidLocalCapacity) throw new Error(`STRESS_INVALID_LOCAL_CAPACITY:${invalidLocalCapacity}`);

  const crossFleetAssignments = db.prepare(`SELECT COUNT(*) AS n FROM driver_vehicle_assignments a
    JOIN users u ON u.id=a.driver_user_id JOIN vehicles v ON v.id=a.vehicle_id
    WHERE u.organization_id IS NULL OR u.organization_id IS NOT v.organization_id`).get().n;
  if (crossFleetAssignments) throw new Error(`STRESS_CROSS_FLEET_ASSIGNMENTS:${crossFleetAssignments}`);

  const unstructuredRoutes=db.prepare(`SELECT
    (SELECT COUNT(*) FROM profile_routes WHERE id LIKE 'stress-%' AND
      (origin_place_ref IS NULL OR origin_lat IS NULL OR origin_lng IS NULL OR destination_place_ref IS NULL OR destination_lat IS NULL OR destination_lng IS NULL))
    +(SELECT COUNT(*) FROM shipments WHERE id LIKE 'stress-%' AND movement_scope='INTERCITY' AND
      (origin_place_ref IS NULL OR origin_lat IS NULL OR origin_lng IS NULL OR destination_place_ref IS NULL OR destination_lat IS NULL OR destination_lng IS NULL))
    +(SELECT COUNT(*) FROM capacities WHERE id LIKE 'stress-%' AND status IN ('EMPTY','PARTIAL') AND movement_scope IN ('INTERCITY','BOTH') AND
      (origin_place_ref IS NULL OR origin_lat IS NULL OR origin_lng IS NULL OR destination_place_ref IS NULL OR destination_lat IS NULL OR destination_lng IS NULL))
    AS n`).get().n;
  if(unstructuredRoutes)throw new Error(`STRESS_UNSTRUCTURED_ROUTES:${unstructuredRoutes}`);

  const invalidReviews = db.prepare(`SELECT COUNT(*) AS n FROM business_reviews r
    JOIN shipments s ON s.id=r.shipment_id
    WHERE s.operational_status<>'COMPLETED'
      OR r.reviewer_organization_id=r.subject_organization_id
      OR r.reviewer_organization_id NOT IN (s.shipper_organization_id,s.receiver_organization_id)
      OR r.subject_organization_id NOT IN (s.shipper_organization_id,s.receiver_organization_id)`).get().n;
  if (invalidReviews) throw new Error(`STRESS_INVALID_REVIEWS:${invalidReviews}`);

  const requiredCoverage = {
    userRoles:['ADMIN','SHIPPER','RECEIVER','TRANSPORTER','DRIVER','SUPPORT'],
    shipmentStates:SHIPMENT_STATES,
    priceModes:['FIXED_PRICE','QUOTE_REQUESTED','TARGET_PRICE'],
    distributionModes:['DIRECT_TO_PROVIDER','OPEN_MARKET','SAVED_PARTNERS'],
    loadTypes:['FTL','PTL'],
    shipmentMovementScopes:['INTERCITY','LOCAL'],
    capacityStates:['EMPTY','OFF_DUTY','PARTIAL'],
    capacityVisibility:['DIRECT_TO_SELECTED_BUSINESS','OPEN','PRIVATE','SAVED_PARTNERS'],
    capacityMovementScopes:['BOTH','INTERCITY','LOCAL'],
    relationshipStates:['CONNECTED','DECLINED','FAVORITE','PENDING'],
    verificationStates:['APPROVED','MORE_INFO','PENDING','REJECTED'],
    applicationStates:['APPROVED'],
    subscriptionStates:['ACTIVE','PAYMENT_REQUIRED','PAYMENT_UNDER_REVIEW','SPONSORED','TRIAL'],
    paymentStates:['APPROVED','MORE_INFO','PENDING','REJECTED'],
    ratingStates:['DISMISSED','PENDING','PUBLISHED']
  };
  for (const [key,expected] of Object.entries(requiredCoverage)) {
    const actual = new Set(report.coverage[key]);
    const missing = expected.filter(value=>!actual.has(value));
    if (missing.length) throw new Error(`STRESS_MISSING_${key.toUpperCase()}:${missing.join(',')}`);
  }

  const freshness = db.prepare(`SELECT
    SUM(CASE WHEN expires_at>? AND status IN ('EMPTY','PARTIAL') THEN 1 ELSE 0 END) AS fresh,
    SUM(CASE WHEN expires_at<=? THEN 1 ELSE 0 END) AS expired,
    SUM(CASE WHEN updated_at<? AND expires_at>? AND status IN ('EMPTY','PARTIAL') THEN 1 ELSE 0 END) AS stale
    FROM capacities`).get(new Date().toISOString(),new Date().toISOString(),hours(new Date(),-12).toISOString(),new Date().toISOString());
  if (!freshness.fresh || !freshness.expired || !freshness.stale) throw new Error('STRESS_MISSING_CAPACITY_FRESHNESS_VARIANTS');

  return {
    ok:true,
    tables:STRESS_TABLES.length,
    totalRows:Object.values(report.counts).reduce((sum,count)=>sum + Number(count),0),
    foreignKeyViolations:0
  };
}
