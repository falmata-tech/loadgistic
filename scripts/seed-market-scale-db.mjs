const target=process.env.DATABASE_PATH||'/tmp/loadgistic-market-scale.db';
if(process.env.NODE_ENV==='production')throw new Error('Market scale data is development-only.');
if(!target.includes('stress')&&!target.includes('scale')&&!target.startsWith('/tmp/'))throw new Error('DATABASE_PATH_MUST_BE_DISPOSABLE');
process.env.DATABASE_PATH=target;

const {resetDb,closeDb}=await import('../src/lib/db.js');

const requested=Number(process.env.MARKET_SCALE_TRUCKS||5_000);
if(!Number.isInteger(requested)||requested<1_000||requested>20_000)throw new Error('MARKET_SCALE_TRUCKS_MUST_BE_1000_TO_20000');
const trucksPerProvider=10;
const providerCount=Math.ceil(requested/trucksPerProvider);
const places=[
  ['Addis Ababa',9.03,38.74],['Adama',8.54,39.27],['Hawassa',7.06,38.48],['Dire Dawa',9.60,41.86],
  ['Mekelle',13.50,39.47],['Bahir Dar',11.59,37.39],['Gondar',12.60,37.47],['Jimma',7.67,36.83],
  ['Dessie',11.13,39.63],['Shashamane',7.20,38.59],['Bishoftu',8.75,38.99],['Debre Birhan',9.68,39.53],
  ['Nekemte',9.09,36.55],['Arba Minch',6.04,37.55],['Wolaita Sodo',6.86,37.76],['Asella',7.95,39.13],
  ['Harar',9.31,42.12],['Jijiga',9.35,42.80],['Dilla',6.41,38.31],['Debre Markos',10.34,37.72],
  ['Kombolcha',11.08,39.74],['Ambo',8.98,37.85],['Batu',7.93,38.72],['Woldiya',11.83,39.60]
];
const localConfigurations=['Courier motorcycle','Courier car','Cargo van','Pickup truck','Pickup stake body','Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck'];
const widerConfigurations=['Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck'];
const db=resetDb();
const passwordHash=db.prepare("SELECT password_hash FROM users WHERE id='user-transporter'").get()?.password_hash;
if(!passwordHash)throw new Error('BASE_FIXTURE_REQUIRED');
const now=Date.now();
const expiresAt=new Date(now+7*24*60*60*1000).toISOString();
const user=db.prepare(`INSERT INTO users (id,email,phone,password_hash,name,role,organization_id,active,created_at)
  VALUES (?,?,?,?,?,'TRANSPORTER',?,1,?)`);
const organization=db.prepare(`INSERT INTO organizations (id,name,handle,type,verified,description,phone,city,public_visibility,created_at)
  VALUES (?,?,?,'TRANSPORT_COMPANY',0,?,?,?,'PUBLIC',?)`);
const membership=db.prepare(`INSERT INTO memberships (id,user_id,organization_id,membership_role) VALUES (?,?,?,'OWNER')`);
const page=db.prepare(`INSERT INTO company_pages
  (id,organization_id,headline,about,services,corridors,operating_regions,contact_phone,published,updated_at,show_contact_phone,base_region_code)
  VALUES (?,?,?,?,?,?,?,?,1,?,1,?)`);
const vehicle=db.prepare(`INSERT INTO vehicles (id,organization_id,platform_number,label,category,active,make,model,cargo_configuration)
  VALUES (?,?,?,?,?,1,?,?,?)`);
const capacity=db.prepare(`INSERT INTO capacities
  (id,provider_organization_id,vehicle_id,status,available_percent,visibility,updated_by,updated_at,expires_at,movement_scope,
   availability_geometry,location_area,location_lat,location_lng,location_precision_km,location_source,location_updated_at,
   market_status,current_route_points_json,capacity_area_center_place_ref,capacity_area_center_label,capacity_area_center_lat,
   capacity_area_center_lng,capacity_area_boundary_json,accepts_full_load,accepts_partial_load,accepts_multi_pick,accepts_multi_drop)
  VALUES (?,?,?,?,?,'OPEN',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const regular=db.prepare(`INSERT INTO profile_routes
  (id,organization_id,origin,destination,geometry,route_points_json,created_by,created_at)
  VALUES (?,?,?,?, 'ROUTE',?,?,?)`);

db.exec('BEGIN IMMEDIATE');
try{
  for(let providerIndex=0;providerIndex<providerCount;providerIndex+=1){
    const providerNumber=String(providerIndex+1).padStart(4,'0');
    const orgId=`scale-org-${providerNumber}`,userId=`scale-user-${providerNumber}`;
    const [city,baseLat,baseLng]=places[providerIndex%places.length];
    const [nextCity,nextLat,nextLng]=places[(providerIndex+1)%places.length];
    const createdAt=new Date(now-providerIndex*1_000).toISOString();
    organization.run(orgId,`Scale Transporter ${providerNumber}`,`scale-transporter-${providerNumber}`,'Synthetic supply-only scale fixture',`+251900${providerNumber.padStart(6,'0')}`,`${city}, Ethiopia`,createdAt);
    user.run(userId,`scale-${providerNumber}@loadgistic.invalid`,null,passwordHash,`Scale Owner ${providerNumber}`,orgId,createdAt);
    membership.run(`scale-membership-${providerNumber}`,userId,orgId);
    page.run(`scale-page-${providerNumber}`,orgId,`Local and regional capacity from ${city}`,'Synthetic scale-audit profile.','Road freight capacity',`${city} ↔ ${nextCity}`,`${city}, Ethiopia`,`+251900${providerNumber.padStart(6,'0')}`,createdAt,'SCALE');
    const regularPoints=JSON.stringify([
      {place_ref:`scale:${city.toLowerCase().replaceAll(' ','-')}`,label:`${city}, Ethiopia`,lat:baseLat,lng:baseLng},
      {place_ref:`scale:${nextCity.toLowerCase().replaceAll(' ','-')}`,label:`${nextCity}, Ethiopia`,lat:nextLat,lng:nextLng}
    ]);
    regular.run(`scale-regular-${providerNumber}`,orgId,`${city}, Ethiopia`,`${nextCity}, Ethiopia`,regularPoints,userId,createdAt);
    for(let truckIndex=0;truckIndex<trucksPerProvider;truckIndex+=1){
      const globalIndex=providerIndex*trucksPerProvider+truckIndex;
      if(globalIndex>=requested)break;
      const suffix=String(globalIndex+1).padStart(6,'0');
      const vehicleId=`scale-vehicle-${suffix}`;
      const isLocal=globalIndex%10<7;
      const configuration=isLocal?localConfigurations[globalIndex%localConfigurations.length]:widerConfigurations[globalIndex%widerConfigurations.length];
      const status=globalIndex%3===0?'PARTIAL':'EMPTY';
      const geometry=status==='PARTIAL'||globalIndex%2===0?'ROUTE':'RADIUS';
      const jitterLat=((globalIndex%17)-8)*0.004;
      const jitterLng=((globalIndex%19)-9)*0.004;
      const lat=baseLat+jitterLat,lng=baseLng+jitterLng;
      const updatedAt=new Date(now-globalIndex*250).toISOString();
      vehicle.run(vehicleId,orgId,`LG-SCALE-${suffix}`,`${configuration} ${suffix}`,configuration,'Scale','Vehicle',configuration);
      const currentPoints=geometry==='ROUTE'?JSON.stringify([
        {place_ref:`scale:${city.toLowerCase().replaceAll(' ','-')}`,label:`${city}, Ethiopia`,lat,lng},
        {place_ref:`scale:${city.toLowerCase().replaceAll(' ','-')}:edge`,label:`${city} edge, Ethiopia`,lat:lat+0.08,lng:lng+0.08}
      ]):'[]';
      const boundary=geometry==='RADIUS'?JSON.stringify([
        {place_ref:`scale:${city}:nw`,label:`${city} northwest, Ethiopia`,lat:lat+0.08,lng:lng-0.08},
        {place_ref:`scale:${city}:e`,label:`${city} east, Ethiopia`,lat,lng:lng+0.1},
        {place_ref:`scale:${city}:s`,label:`${city} south, Ethiopia`,lat:lat-0.08,lng:lng-0.04}
      ]):'[]';
      capacity.run(`scale-capacity-${suffix}`,orgId,vehicleId,status,status==='EMPTY'?100:50,userId,updatedAt,expiresAt,'BOTH',geometry,
        `Around ${city}, Ethiopia`,lat,lng,5,'DEVICE_OBSCURED',updatedAt,status,currentPoints,
        geometry==='RADIUS'?`scale:${city.toLowerCase().replaceAll(' ','-')}`:null,geometry==='RADIUS'?`${city}, Ethiopia`:null,
        geometry==='RADIUS'?lat:null,geometry==='RADIUS'?lng:null,boundary,status==='EMPTY'?1:0,status==='PARTIAL'?1:0,0,0);
    }
  }
  db.exec('COMMIT');
}catch(error){db.exec('ROLLBACK');throw error;}

const counts={
  providers:db.prepare("SELECT COUNT(*) n FROM organizations WHERE id LIKE 'scale-org-%'").get().n,
  trucks:db.prepare("SELECT COUNT(*) n FROM vehicles WHERE id LIKE 'scale-vehicle-%'").get().n,
  capacities:db.prepare("SELECT COUNT(*) n FROM capacities WHERE id LIKE 'scale-capacity-%'").get().n
};
console.log(JSON.stringify({database:target,synthetic:true,...counts},null,2));
closeDb();
