import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, randomId, opaqueToken } from './security.js';

let database;

function dbPath() {
  const configured = process.env.DATABASE_PATH || './data/loadgistic.db';
  return path.resolve(process.cwd(), configured);
}

export function getDb() {
  if (database) return database;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  database = new DatabaseSync(file);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(database);
  seed(database);
  return database;
}

export function closeDb() {
  if (database) {
    database.close();
    database = undefined;
  }
}

export function resetDb() {
  closeDb();
  const file = dbPath();
  if (fs.existsSync(file)) fs.rmSync(file);
  if (fs.existsSync(`${file}-wal`)) fs.rmSync(`${file}-wal`);
  if (fs.existsSync(`${file}-shm`)) fs.rmSync(`${file}-shm`);
  return getDb();
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','SHIPPER','RECEIVER','PARCEL','TRANSPORTER','DRIVER')),
      organization_id TEXT,
      provider_profile_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      handle TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER','PARCEL_OPERATOR','TRANSPORT_COMPANY')),
      verified INTEGER NOT NULL DEFAULT 0,
      industry TEXT,
      description TEXT,
      phone TEXT,
      email TEXT,
      city TEXT,
      public_visibility TEXT NOT NULL DEFAULT 'PUBLIC',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      membership_role TEXT NOT NULL DEFAULT 'OWNER',
      UNIQUE(user_id, organization_id)
    );

    CREATE TABLE IF NOT EXISTS provider_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      business_name TEXT NOT NULL,
      handle TEXT NOT NULL UNIQUE,
      verified_identity INTEGER NOT NULL DEFAULT 0,
      verified_license INTEGER NOT NULL DEFAULT 0,
      vehicle_documents_verified INTEGER NOT NULL DEFAULT 0,
      vehicle_type TEXT,
      corridors TEXT,
      phone TEXT,
      city TEXT,
      about TEXT,
      public_visibility TEXT NOT NULL DEFAULT 'PUBLIC',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS partner_relationships (
      id TEXT PRIMARY KEY,
      owner_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      provider_organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'SAVED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ((provider_organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (provider_organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE TABLE IF NOT EXISTS company_pages (
      id TEXT PRIMARY KEY,
      organization_id TEXT UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT UNIQUE REFERENCES provider_profiles(id) ON DELETE CASCADE,
      headline TEXT,
      about TEXT,
      services TEXT,
      corridors TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      published INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ((organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      details TEXT,
      phone TEXT,
      accepts_dropoff INTEGER NOT NULL DEFAULT 0,
      receiver_pickup INTEGER NOT NULL DEFAULT 0,
      supports_transfer INTEGER NOT NULL DEFAULT 0,
      direct_delivery INTEGER NOT NULL DEFAULT 0,
      business_hours TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS parcel_routes (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      origin_location_id TEXT NOT NULL REFERENCES locations(id),
      destination_location_id TEXT NOT NULL REFERENCES locations(id),
      service_days TEXT,
      estimated_time TEXT,
      branch_dropoff INTEGER NOT NULL DEFAULT 0,
      receiver_pickup INTEGER NOT NULL DEFAULT 0,
      direct_delivery INTEGER NOT NULL DEFAULT 0,
      public_visibility INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      category TEXT NOT NULL,
      plate TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      CHECK ((organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      license_verified INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS capacities (
      id TEXT PRIMARY KEY,
      provider_organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('EMPTY','PARTIAL','FULL')),
      available_percent INTEGER NOT NULL CHECK(available_percent BETWEEN 0 AND 100),
      origin TEXT,
      destination TEXT,
      corridor TEXT,
      travel_date TEXT,
      next_available TEXT,
      visibility TEXT NOT NULL CHECK(visibility IN ('PRIVATE','SAVED_PARTNERS','DIRECT_TO_SELECTED_BUSINESS','OPEN')),
      photo_path TEXT,
      updated_by TEXT NOT NULL REFERENCES users(id),
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      CHECK ((provider_organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (provider_organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE INDEX IF NOT EXISTS idx_capacity_expires ON capacities(expires_at);
    CREATE INDEX IF NOT EXISTS idx_capacity_visibility ON capacities(visibility, expires_at);

    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      service_mode TEXT NOT NULL CHECK(service_mode IN ('PARCEL','FREIGHT')),
      distribution_mode TEXT NOT NULL CHECK(distribution_mode IN ('DIRECT_TO_PROVIDER','SAVED_PARTNERS','OPEN_MARKET')),
      price_mode TEXT NOT NULL CHECK(price_mode IN ('FIXED_PRICE','QUOTE_REQUESTED','TARGET_PRICE')),
      price_minor INTEGER,
      target_price_minor INTEGER,
      shipper_organization_id TEXT NOT NULL REFERENCES organizations(id),
      receiver_organization_id TEXT REFERENCES organizations(id),
      provider_organization_id TEXT REFERENCES organizations(id),
      provider_profile_id TEXT REFERENCES provider_profiles(id),
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      cargo_description TEXT NOT NULL,
      package_count INTEGER NOT NULL DEFAULT 1,
      estimated_weight REAL,
      vehicle_category TEXT,
      load_type TEXT,
      pickup_date TEXT NOT NULL,
      delivery_date TEXT,
      commercial_status TEXT NOT NULL,
      operational_status TEXT NOT NULL,
      tracking_mode TEXT NOT NULL CHECK(tracking_mode IN ('NONE','STATUS_ONLY','LOCATION_AND_PROOF')),
      tracking_token TEXT UNIQUE,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shipments_mode_status ON shipments(service_mode, commercial_status, operational_status);
    CREATE INDEX IF NOT EXISTS idx_shipments_parties ON shipments(shipper_organization_id, receiver_organization_id, provider_organization_id);

    CREATE TABLE IF NOT EXISTS shipment_events (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      event_type TEXT NOT NULL,
      note TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      public INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shipment_interests (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      provider_organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'INTERESTED',
      note TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(shipment_id, provider_organization_id, provider_profile_id)
    );

    CREATE TABLE IF NOT EXISTS shipment_notes (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      author_user_id TEXT NOT NULL REFERENCES users(id),
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proof_files (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      proof_type TEXT NOT NULL CHECK(proof_type IN ('LOADING','DELIVERY','ISSUE')),
      file_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      note TEXT,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      business_name TEXT NOT NULL,
      application_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','MORE_INFO','REJECTED')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      audience TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      provider_profile_id TEXT REFERENCES provider_profiles(id),
      plan_id TEXT NOT NULL REFERENCES plans(id),
      status TEXT NOT NULL,
      billing_model TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      CHECK ((organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE TABLE IF NOT EXISTS payment_proofs (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
      amount_minor INTEGER NOT NULL,
      reference TEXT,
      file_path TEXT,
      status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED','MORE_INFO')),
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT REFERENCES users(id),
      organization_id TEXT REFERENCES organizations(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (count > 0) return;

  const now = new Date();
  const iso = now.toISOString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expiresFresh = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const expiresStale = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const passwordHash = hashPassword('Loadgistic123!');

  const orgs = {
    shipper: { id: 'org-shipper', name: 'Blue Nile Trading PLC', handle: 'blue-nile-trading', type: 'ENTERPRISE_SHIPPER', city: 'Addis Ababa' },
    receiver: { id: 'org-receiver', name: 'Fresh Foods Distribution PLC', handle: 'fresh-foods-distribution', type: 'ENTERPRISE_RECEIVER', city: 'Hawassa' },
    parcel: { id: 'org-parcel', name: 'Addis Parcel Services', handle: 'addis-parcel-services', type: 'PARCEL_OPERATOR', city: 'Addis Ababa' },
    transporter: { id: 'org-transporter', name: 'BlueLine Transport PLC', handle: 'blueline-transport', type: 'TRANSPORT_COMPANY', city: 'Addis Ababa' }
  };

  const insertOrg = db.prepare(`INSERT INTO organizations
    (id,name,handle,type,verified,industry,description,phone,email,city,public_visibility,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const org of Object.values(orgs)) {
    insertOrg.run(org.id, org.name, org.handle, org.type, 1,
      org.type.includes('ENTERPRISE') ? 'Trade and Distribution' : 'Logistics',
      `${org.name} uses Loadgistic for simple B2B logistics operations across Ethiopia.`,
      '+251 911 000 000', `contact@${org.handle}.local`, org.city, 'PUBLIC', iso);
  }

  const users = [
    ['user-admin','admin@loadgistic.local','Platform Administrator','ADMIN',null,null],
    ['user-shipper','shipper@loadgistic.local','Selam Tesfaye','SHIPPER',orgs.shipper.id,null],
    ['user-receiver','receiver@loadgistic.local','Marta Alemu','RECEIVER',orgs.receiver.id,null],
    ['user-parcel','parcel@loadgistic.local','Dawit Bekele','PARCEL',orgs.parcel.id,null],
    ['user-transporter','transporter@loadgistic.local','Samuel Tesfaye','TRANSPORTER',orgs.transporter.id,null],
    ['user-driver','driver@loadgistic.local','Abebe Kebede','DRIVER',null,'provider-driver',1],
    ['user-applicant','pending-applicant@fixtures.loadgistic.test','Liya Bekele','RECEIVER',null,null,0]
  ];
  const insertUser = db.prepare(`INSERT INTO users
    (id,email,password_hash,name,role,organization_id,provider_profile_id,active,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const user of users) insertUser.run(user[0],user[1],passwordHash,user[2],user[3],user[4],user[5],user[6] ?? 1,iso);

  const insertMembership = db.prepare('INSERT INTO memberships (id,user_id,organization_id,membership_role) VALUES (?,?,?,?)');
  insertMembership.run(randomId('mem-'),'user-shipper',orgs.shipper.id,'OWNER');
  insertMembership.run(randomId('mem-'),'user-receiver',orgs.receiver.id,'OWNER');
  insertMembership.run(randomId('mem-'),'user-parcel',orgs.parcel.id,'OWNER');
  insertMembership.run(randomId('mem-'),'user-transporter',orgs.transporter.id,'OWNER');

  db.prepare(`INSERT INTO provider_profiles
    (id,user_id,business_name,handle,verified_identity,verified_license,vehicle_documents_verified,vehicle_type,corridors,phone,city,about,public_visibility,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('provider-driver','user-driver','Abebe Owner-Operator','abebe-owner-operator',1,1,1,'10 Ton Truck','Addis Ababa ↔ Dire Dawa; Addis Ababa ↔ Hawassa','+251 911 234 567','Addis Ababa','Independent owner-operator serving business shippers on major Ethiopian corridors.','PUBLIC',iso);

  db.prepare(`INSERT INTO partner_relationships (id,owner_organization_id,provider_organization_id,provider_profile_id,status,created_at) VALUES (?,?,?,?,?,?)`)
    .run('partner-1',orgs.shipper.id,orgs.transporter.id,null,'SAVED',iso);
  db.prepare(`INSERT INTO partner_relationships (id,owner_organization_id,provider_organization_id,provider_profile_id,status,created_at) VALUES (?,?,?,?,?,?)`)
    .run('partner-2',orgs.shipper.id,orgs.parcel.id,null,'SAVED',iso);

  const insertPage = db.prepare(`INSERT INTO company_pages
    (id,organization_id,provider_profile_id,headline,about,services,corridors,contact_phone,contact_email,published,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  insertPage.run('page-shipper',orgs.shipper.id,null,'Business shipments across Ethiopia','Importer and distributor using parcel and freight partners for B2B shipping.','Parcel requests; freight loads','Addis Ababa; Dire Dawa; Hawassa','+251 911 111 111','logistics@blue-nile.local',1,iso);
  insertPage.run('page-receiver',orgs.receiver.id,null,'Reliable receiving operations','Distribution business receiving goods from enterprise suppliers.','Business receiving; branch distribution','Hawassa; Addis Ababa','+251 911 222 222','receiving@fresh-foods.local',1,iso);
  insertPage.run('page-parcel',orgs.parcel.id,null,'Simple B2B parcel delivery','Parcel pickup, intercity movement, branch pickup, and direct delivery for business customers.','Pickup; branch drop-off; receiver pickup; direct delivery','Addis Ababa → Hawassa; Addis Ababa → Dire Dawa','+251 911 333 333','ops@addis-parcel.local',1,iso);
  insertPage.run('page-transporter',orgs.transporter.id,null,'Road freight for Ethiopian enterprises','Transport company serving business freight on major domestic corridors.','Full-load and shared-capacity freight','Addis Ababa ↔ Dire Dawa; Addis Ababa ↔ Mekelle; Addis Ababa ↔ Hawassa','+251 911 444 444','dispatch@blueline.local',1,iso);
  insertPage.run('page-driver',null,'provider-driver','Independent freight capacity','Owner-operated truck available for direct and open B2B loads.','Full-load and partial-capacity freight','Addis Ababa ↔ Dire Dawa; Addis Ababa ↔ Hawassa','+251 911 234 567','abebe@owneroperator.local',1,iso);

  const locInsert = db.prepare(`INSERT INTO locations
    (id,organization_id,name,city,details,phone,accepts_dropoff,receiver_pickup,supports_transfer,direct_delivery,business_hours,active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  locInsert.run('loc-addis',orgs.parcel.id,'Addis Main Center','Addis Ababa','Bole, near cargo terminal','+251 911 333 100',1,1,1,1,'Mon-Sat 8:00-18:00',1);
  locInsert.run('loc-hawassa',orgs.parcel.id,'Hawassa Pickup Center','Hawassa','Near Piazza','+251 911 333 200',1,1,1,1,'Mon-Sat 8:00-18:00',1);
  locInsert.run('loc-dire',orgs.parcel.id,'Dire Dawa Center','Dire Dawa','Sabian area','+251 911 333 300',1,1,1,1,'Mon-Sat 8:00-18:00',1);
  db.prepare(`INSERT INTO parcel_routes
    (id,organization_id,origin_location_id,destination_location_id,service_days,estimated_time,branch_dropoff,receiver_pickup,direct_delivery,public_visibility,active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run('route-addis-hawassa',orgs.parcel.id,'loc-addis','loc-hawassa','Mon-Sat','1 day',1,1,1,1,1);
  db.prepare(`INSERT INTO parcel_routes
    (id,organization_id,origin_location_id,destination_location_id,service_days,estimated_time,branch_dropoff,receiver_pickup,direct_delivery,public_visibility,active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run('route-addis-dire',orgs.parcel.id,'loc-addis','loc-dire','Tue, Thu, Sat','1-2 days',1,1,1,1,1);

  const vehicleInsert = db.prepare(`INSERT INTO vehicles (id,organization_id,provider_profile_id,label,category,plate,active) VALUES (?,?,?,?,?,?,?)`);
  vehicleInsert.run('veh-trans-1',orgs.transporter.id,null,'BlueLine Truck 01','20 Ton Truck','AA-3-10001',1);
  vehicleInsert.run('veh-trans-2',orgs.transporter.id,null,'BlueLine Truck 02','10 Ton Truck','AA-3-10002',1);
  vehicleInsert.run('veh-driver-1',null,'provider-driver','Abebe Truck','10 Ton Truck','AA-2-44001',1);
  db.prepare(`INSERT INTO drivers (id,organization_id,name,phone,license_verified,active) VALUES (?,?,?,?,?,?)`)
    .run('driver-company-1',orgs.transporter.id,'Yonas Alemu','+251 911 555 001',1,1);

  const capacityInsert = db.prepare(`INSERT INTO capacities
    (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  capacityInsert.run('cap-empty',orgs.transporter.id,null,'veh-trans-1','EMPTY',100,'Addis Ababa','Dire Dawa','Addis Ababa → Dire Dawa',tomorrow,'Today 16:00','OPEN',null,'user-transporter',iso,expiresFresh);
  capacityInsert.run('cap-partial',null,'provider-driver','veh-driver-1','PARTIAL',40,'Addis Ababa','Hawassa','Addis Ababa → Hawassa',dayAfter,'Tomorrow 08:00','OPEN',null,'user-driver',new Date(now.getTime()-13*60*60*1000).toISOString(),expiresStale);
  capacityInsert.run('cap-full',orgs.transporter.id,null,'veh-trans-2','FULL',0,'Mekelle','Addis Ababa','Mekelle → Addis Ababa',dayAfter,'After current trip','SAVED_PARTNERS',null,'user-transporter',iso,expiresFresh);

  const shipmentInsert = db.prepare(`INSERT INTO shipments
    (id,code,title,service_mode,distribution_mode,price_mode,price_minor,target_price_minor,shipper_organization_id,receiver_organization_id,provider_organization_id,provider_profile_id,origin,destination,cargo_description,package_count,estimated_weight,vehicle_category,load_type,pickup_date,delivery_date,commercial_status,operational_status,tracking_mode,tracking_token,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const seededShipments = [
    ['shp-parcel-new','LGX-P1001','Wholesale cartons to Hawassa','PARCEL','DIRECT_TO_PROVIDER','QUOTE_REQUESTED',null,null,orgs.shipper.id,orgs.receiver.id,orgs.parcel.id,null,'Addis Ababa','Hawassa','4 cartons of retail goods',4,48,null,null,tomorrow,dayAfter,'SENT','NEW','STATUS_ONLY',opaqueToken(),'user-shipper'],
    ['shp-parcel-route','LGX-P1002','Documents to Dire Dawa branch','PARCEL','DIRECT_TO_PROVIDER','FIXED_PRICE',250000,null,orgs.shipper.id,orgs.receiver.id,orgs.parcel.id,null,'Addis Ababa','Dire Dawa','Business documents',1,1.2,null,null,tomorrow,dayAfter,'AGREED','IN_ROUTE','STATUS_ONLY',opaqueToken(),'user-shipper'],
    ['shp-freight-fixed','LGX-F2001','Beverage load to Dire Dawa','FREIGHT','OPEN_MARKET','FIXED_PRICE',4850000,null,orgs.shipper.id,orgs.receiver.id,null,null,'Addis Ababa','Dire Dawa','Palletized beverages',120,18000,'20 Ton Truck','FULL_LOAD',tomorrow,dayAfter,'POSTED','POSTED','NONE',null,'user-shipper'],
    ['shp-freight-quote','LGX-F2002','Construction materials to Mekelle','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.shipper.id,null,null,null,'Addis Ababa','Mekelle','Bagged building materials',400,20000,'20 Ton Truck','FULL_LOAD',dayAfter,null,'POSTED','POSTED','NONE',null,'user-shipper'],
    ['shp-freight-target','LGX-F2003','Packaged food to Hawassa','FREIGHT','SAVED_PARTNERS','TARGET_PRICE',null,3500000,orgs.shipper.id,orgs.receiver.id,null,null,'Addis Ababa','Hawassa','Packaged food cartons',250,9000,'10 Ton Truck','SHARED_CAPACITY',tomorrow,dayAfter,'POSTED','POSTED','NONE',null,'user-shipper'],
    ['shp-freight-active','LGX-F2004','Industrial supplies to Dire Dawa','FREIGHT','DIRECT_TO_PROVIDER','FIXED_PRICE',5200000,null,orgs.shipper.id,orgs.receiver.id,orgs.transporter.id,null,'Addis Ababa','Dire Dawa','Industrial supplies',80,19000,'20 Ton Truck','FULL_LOAD',tomorrow,dayAfter,'AGREED','IN_TRANSIT','LOCATION_AND_PROOF',opaqueToken(),'user-shipper']
  ];
  for (const s of seededShipments) shipmentInsert.run(...s, iso, iso);

  const eventInsert = db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,created_by,public,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  for (const s of seededShipments) {
    eventInsert.run(randomId('evt-'),s[0],s[22],'CREATED','Shipment created in Loadgistic',s[25],1,iso);
  }
  eventInsert.run(randomId('evt-'),'shp-parcel-route','CONTACTED','STATUS','Parcel company contacted the business','user-parcel',1,new Date(now.getTime()-3*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-parcel-route','COLLECTED','STATUS','Shipment collected from sender','user-parcel',1,new Date(now.getTime()-2*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-parcel-route','IN_ROUTE','STATUS','Shipment is moving to Dire Dawa','user-parcel',1,new Date(now.getTime()-60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-freight-active','IN_TRANSIT','STATUS','Truck departed Addis Ababa','user-transporter',1,new Date(now.getTime()-90*60*1000).toISOString());

  const planInsert = db.prepare('INSERT INTO plans (id,code,name,audience,active) VALUES (?,?,?,?,1)');
  planInsert.run('plan-business','BUSINESS_BASIC','Business Basic','ENTERPRISE');
  planInsert.run('plan-parcel','PARCEL_FLOW','Parcel Flow','PARCEL');
  planInsert.run('plan-transport','TRANSPORT_STANDARD','Transport Standard','TRANSPORTER');
  planInsert.run('plan-solo','SOLO_PROVIDER','Solo Provider','DRIVER');
  const subInsert = db.prepare(`INSERT INTO subscriptions (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at) VALUES (?,?,?,?,?,?,?,?)`);
  subInsert.run('sub-shipper',orgs.shipper.id,null,'plan-business','ACTIVE','FLAT_MONTHLY',iso,null);
  subInsert.run('sub-parcel',orgs.parcel.id,null,'plan-parcel','ACTIVE','PER_TRANSACTION',iso,null);
  subInsert.run('sub-transporter',orgs.transporter.id,null,'plan-transport','ACTIVE','FLAT_MONTHLY',iso,null);
  subInsert.run('sub-driver',null,'provider-driver','plan-solo','ACTIVE','FLAT_MONTHLY',iso,null);

  db.prepare(`INSERT INTO applications (id,user_id,business_name,application_type,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run('app-pending','user-applicant','Hawassa Retail Distribution PLC','ENTERPRISE_RECEIVER','PENDING','Confirm business registration document',iso,iso);

  const notify = db.prepare(`INSERT INTO notifications (id,user_id,title,body,read_at,created_at) VALUES (?,?,?,?,?,?)`);
  notify.run(randomId('ntf-'),'user-parcel','New B2B parcel request','Blue Nile Trading PLC sent LGX-P1001.',null,iso);
  notify.run(randomId('ntf-'),'user-transporter','New open freight load','A fixed-price load is available from Addis Ababa to Dire Dawa.',null,iso);
}
