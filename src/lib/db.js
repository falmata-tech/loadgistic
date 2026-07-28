import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { trackingAccessCode, hashPassword, hashTrackingAccessCode, randomId } from './security.js';

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
      phone TEXT,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','SHIPPER','RECEIVER','TRANSPORTER','DRIVER')),
      organization_id TEXT,
      provider_profile_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      handle TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER','TRANSPORT_COMPANY')),
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
      status TEXT NOT NULL DEFAULT 'FAVORITE',
      requested_by_side TEXT,
      business_favorite INTEGER NOT NULL DEFAULT 0,
      provider_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      responded_at TEXT,
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
      operating_regions TEXT,
      contact_phone TEXT,
      show_contact_phone_on_loads INTEGER NOT NULL DEFAULT 0,
      contact_email TEXT,
      published INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ((organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (organization_id IS NULL AND provider_profile_id IS NOT NULL))
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
      user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      phone TEXT,
      license_verified INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS driver_permissions (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      can_browse_load_board INTEGER NOT NULL DEFAULT 1,
      can_contact_businesses INTEGER NOT NULL DEFAULT 1,
      can_negotiate_loads INTEGER NOT NULL DEFAULT 1,
      can_manage_capacity INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT REFERENCES users(id),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
      id TEXT PRIMARY KEY,
      driver_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      assigned_by TEXT REFERENCES users(id),
      assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(driver_user_id, vehicle_id)
    );

    CREATE TABLE IF NOT EXISTS profile_routes (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ((organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE INDEX IF NOT EXISTS idx_profile_routes_organization ON profile_routes(organization_id);
    CREATE INDEX IF NOT EXISTS idx_profile_routes_provider ON profile_routes(provider_profile_id);

    CREATE TABLE IF NOT EXISTS capacities (
      id TEXT PRIMARY KEY,
      provider_organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('EMPTY','PARTIAL','OFF_DUTY')),
      available_percent INTEGER NOT NULL CHECK(available_percent BETWEEN 0 AND 100),
      origin TEXT,
      destination TEXT,
      corridor TEXT,
      travel_date TEXT,
      next_available TEXT,
      visibility TEXT NOT NULL CHECK(visibility IN ('PRIVATE','SAVED_PARTNERS','DIRECT_TO_SELECTED_BUSINESS','OPEN')),
      photo_path TEXT,
      location_lat REAL,
      location_lng REAL,
      location_precision_km INTEGER,
      location_source TEXT,
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
      service_mode TEXT NOT NULL CHECK(service_mode='FREIGHT'),
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
      receiver_first_name TEXT,
      receiver_phone TEXT,
      pickup_date TEXT NOT NULL,
      delivery_date TEXT,
      commercial_status TEXT NOT NULL,
      operational_status TEXT NOT NULL,
      tracking_mode TEXT NOT NULL CHECK(tracking_mode IN ('STATUS_ONLY','LOCATION_AND_STATUS')),
      tracking_token TEXT UNIQUE,
      tracking_code_hash TEXT UNIQUE,
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
      location_area TEXT,
      location_lat REAL,
      location_lng REAL,
      location_precision_km INTEGER,
      location_source TEXT,
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
      created_by TEXT REFERENCES users(id),
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

    CREATE TABLE IF NOT EXISTS load_proof_requests (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      interest_id TEXT NOT NULL UNIQUE REFERENCES shipment_interests(id) ON DELETE CASCADE,
      requested_at TEXT NOT NULL,
      fulfilled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS load_proof_shares (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      interest_id TEXT NOT NULL REFERENCES shipment_interests(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      note TEXT,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_load_proof_share_access ON load_proof_shares(interest_id, expires_at, revoked_at);

    CREATE TABLE IF NOT EXISTS business_reviews (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      reviewer_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      subject_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      note TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE(shipment_id, reviewer_organization_id, subject_organization_id),
      CHECK(reviewer_organization_id <> subject_organization_id)
    );

    CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY,
      subject_type TEXT NOT NULL CHECK(subject_type IN ('ORGANIZATION','PROVIDER_PROFILE','DRIVER','VEHICLE')),
      subject_id TEXT NOT NULL,
      verification_type TEXT NOT NULL CHECK(verification_type IN ('IDENTITY','BUSINESS_LICENSE','DRIVER_IDENTITY','VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION')),
      document_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','MORE_INFO','REJECTED')),
      submitted_by TEXT NOT NULL REFERENCES users(id),
      reviewed_by TEXT REFERENCES users(id),
      review_note TEXT,
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_verification_subject ON verification_requests(subject_type, subject_id, verification_type, status);

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
  const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
  if (!userColumns.has('phone')) db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  const driverColumns = new Set(db.prepare('PRAGMA table_info(drivers)').all().map(column => column.name));
  if (!driverColumns.has('user_id')) db.exec('ALTER TABLE drivers ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL');
  const relationshipColumns = new Set(db.prepare('PRAGMA table_info(partner_relationships)').all().map(column => column.name));
  for (const [name, definition] of [
    ['requested_by_side','TEXT'],
    ['business_favorite','INTEGER NOT NULL DEFAULT 0'],
    ['provider_favorite','INTEGER NOT NULL DEFAULT 0'],
    ['updated_at','TEXT'],
    ['responded_at','TEXT']
  ]) {
    if (!relationshipColumns.has(name)) db.exec(`ALTER TABLE partner_relationships ADD COLUMN ${name} ${definition}`);
  }
  db.exec(`UPDATE partner_relationships
    SET status=CASE WHEN status='SAVED' THEN 'CONNECTED' ELSE status END,
        business_favorite=CASE WHEN status IN ('SAVED','CONNECTED') THEN 1 ELSE business_favorite END,
        provider_favorite=CASE WHEN status IN ('SAVED','CONNECTED') THEN 1 ELSE provider_favorite END,
        updated_at=COALESCE(updated_at,created_at)`);

  const capacityColumns = new Set(db.prepare('PRAGMA table_info(capacities)').all().map(column => column.name));
  const additiveCapacityColumns = [
    ['location_area', 'TEXT'],
    ['location_updated_at', 'TEXT'],
    ['location_lat', 'REAL'],
    ['location_lng', 'REAL'],
    ['location_precision_km', 'INTEGER'],
    ['location_source', 'TEXT'],
    ['accepts_full_load', 'INTEGER NOT NULL DEFAULT 1'],
    ['accepts_partial_load', 'INTEGER NOT NULL DEFAULT 0'],
    ['open_to_contract_lanes', 'INTEGER NOT NULL DEFAULT 0'],
    ['accepts_multi_stop', 'INTEGER NOT NULL DEFAULT 0'],
    ['proof_recorded_at', 'TEXT']
  ];
  for (const [name, definition] of additiveCapacityColumns) {
    if (!capacityColumns.has(name)) db.exec(`ALTER TABLE capacities ADD COLUMN ${name} ${definition}`);
  }
  const vehicleColumns = new Set(db.prepare('PRAGMA table_info(vehicles)').all().map(column => column.name));
  for (const [name, definition] of [['make','TEXT'],['model','TEXT'],['cargo_configuration','TEXT']]) {
    if (!vehicleColumns.has(name)) db.exec(`ALTER TABLE vehicles ADD COLUMN ${name} ${definition}`);
  }
  const companyPageColumns = new Set(db.prepare('PRAGMA table_info(company_pages)').all().map(column => column.name));
  if (!companyPageColumns.has('operating_regions')) {
    db.exec('ALTER TABLE company_pages ADD COLUMN operating_regions TEXT');
  }
  if (!companyPageColumns.has('show_contact_phone_on_loads')) {
    db.exec('ALTER TABLE company_pages ADD COLUMN show_contact_phone_on_loads INTEGER NOT NULL DEFAULT 0');
  }
  const shipmentColumns = new Set(db.prepare('PRAGMA table_info(shipments)').all().map(column => column.name));
  for (const [name, definition] of [['receiver_first_name','TEXT'],['receiver_phone','TEXT'],['tracking_code_hash','TEXT']]) {
    if (!shipmentColumns.has(name)) db.exec(`ALTER TABLE shipments ADD COLUMN ${name} ${definition}`);
  }
  for (const shipment of db.prepare(`SELECT id FROM shipments WHERE tracking_code_hash IS NULL OR trim(tracking_code_hash)=''`).all()) {
    db.prepare('UPDATE shipments SET tracking_code_hash=? WHERE id=?')
      .run(hashTrackingAccessCode(trackingAccessCode(shipment.id)),shipment.id);
  }
  db.prepare('UPDATE shipments SET tracking_token=NULL WHERE tracking_token IS NOT NULL').run();
  const interestColumns = new Set(db.prepare('PRAGMA table_info(shipment_interests)').all().map(column => column.name));
  if (!interestColumns.has('created_by')) db.exec('ALTER TABLE shipment_interests ADD COLUMN created_by TEXT REFERENCES users(id)');
  const shipmentEventColumns = new Set(db.prepare('PRAGMA table_info(shipment_events)').all().map(column => column.name));
  for (const [name, definition] of [['location_area','TEXT'],['location_lat','REAL'],['location_lng','REAL'],['location_precision_km','INTEGER'],['location_source','TEXT']]) {
    if (!shipmentEventColumns.has(name)) db.exec(`ALTER TABLE shipment_events ADD COLUMN ${name} ${definition}`);
  }
  db.exec(`
    UPDATE vehicles SET make='Isuzu',model='FSR',cargo_configuration='Medium Box Truck',category='Medium Box Truck' WHERE id='veh-trans-1';
    UPDATE vehicles SET make='Sinotruk',model='HOWO TX',cargo_configuration='Heavy Rigid Stake Body Truck',category='Heavy Rigid Stake Body Truck' WHERE id='veh-trans-2';
    UPDATE vehicles SET make='Isuzu',model='NPR',cargo_configuration='Light Stake Body Truck',category='Light Stake Body Truck' WHERE id='veh-driver-1';
    UPDATE shipments SET vehicle_category='Medium Box Truck' WHERE vehicle_category IN ('20 Ton Truck','Dry cargo box');
    UPDATE shipments SET vehicle_category='Heavy Rigid Stake Body Truck' WHERE vehicle_category IN ('10 Ton Truck','High-side cargo body');
    UPDATE provider_profiles SET vehicle_type='Light Stake Body Truck' WHERE vehicle_type IN ('10 Ton Truck','20 Ton Truck','High-side cargo body');
    UPDATE capacities SET location_area='Around ' || origin WHERE (location_area IS NULL OR trim(location_area)='') AND origin IS NOT NULL;
    UPDATE capacities SET location_updated_at=updated_at WHERE location_updated_at IS NULL AND location_area IS NOT NULL;
    UPDATE shipments SET receiver_first_name='Marta',receiver_phone='+251 911 222 222' WHERE id='shp-freight-active' AND operational_status IN ('ASSIGNED','IN_TRANSIT','ARRIVED','DELIVERED','COMPLETED');
  `);
  db.exec(`UPDATE shipments SET load_type='FTL' WHERE load_type='FULL_LOAD'; UPDATE shipments SET load_type='PTL' WHERE load_type='SHARED_CAPACITY';`);
  const routePages = db.prepare(`SELECT organization_id,provider_profile_id,corridors FROM company_pages
    WHERE trim(COALESCE(corridors,''))<>'' AND NOT EXISTS (
      SELECT 1 FROM profile_routes r
      WHERE r.organization_id=company_pages.organization_id OR r.provider_profile_id=company_pages.provider_profile_id
    )`).all();
  const insertRoute = db.prepare(`INSERT INTO profile_routes
    (id,organization_id,provider_profile_id,origin,destination,created_by,created_at) VALUES (?,?,?,?,?,NULL,?)`);
  for (const page of routePages) {
    for (const label of String(page.corridors).split(/[;\n]/).map(value => value.trim()).filter(Boolean)) {
      const endpoints = label.split(/\s*(?:↔|→|<->|->)\s*/).map(value => value.trim()).filter(Boolean);
      if (endpoints.length === 2 && endpoints[0].toLowerCase() !== endpoints[1].toLowerCase()) {
        insertRoute.run(randomId('route-'),page.organization_id,page.provider_profile_id,endpoints[0],endpoints[1],new Date().toISOString());
      }
    }
  }
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
    ['user-transporter','transporter@loadgistic.local','Samuel Tesfaye','TRANSPORTER',orgs.transporter.id,null],
    ['user-company-driver','company-driver@loadgistic.local','Yonas Alemu','DRIVER',orgs.transporter.id,null],
    ['user-driver','driver@loadgistic.local','Abebe Kebede','DRIVER',null,'provider-driver',1],
    ['user-applicant','pending-applicant@fixtures.loadgistic.test','Liya Bekele','RECEIVER',null,null,0]
  ];
  const insertUser = db.prepare(`INSERT INTO users
    (id,email,phone,password_hash,name,role,organization_id,provider_profile_id,active,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const user of users) insertUser.run(user[0],user[1],'+251 900 000 000',passwordHash,user[2],user[3],user[4],user[5],user[6] ?? 1,iso);

  const insertMembership = db.prepare('INSERT INTO memberships (id,user_id,organization_id,membership_role) VALUES (?,?,?,?)');
  insertMembership.run(randomId('mem-'),'user-shipper',orgs.shipper.id,'OWNER');
  insertMembership.run(randomId('mem-'),'user-receiver',orgs.receiver.id,'OWNER');
  insertMembership.run(randomId('mem-'),'user-transporter',orgs.transporter.id,'OWNER');
  insertMembership.run(randomId('mem-'),'user-company-driver',orgs.transporter.id,'DRIVER');

  db.prepare(`INSERT INTO provider_profiles
    (id,user_id,business_name,handle,verified_identity,verified_license,vehicle_documents_verified,vehicle_type,corridors,phone,city,about,public_visibility,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('provider-driver','user-driver','Abebe Owner-Operator','abebe-owner-operator',1,1,1,'Light Stake Body Truck','Addis Ababa ↔ Dire Dawa; Addis Ababa ↔ Hawassa','+251 911 234 567','Addis Ababa','Independent owner-operator serving business shippers on major Ethiopian corridors.','PUBLIC',iso);

  db.prepare(`INSERT INTO partner_relationships
    (id,owner_organization_id,provider_organization_id,provider_profile_id,status,requested_by_side,business_favorite,provider_favorite,created_at,updated_at,responded_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run('partner-1',orgs.shipper.id,orgs.transporter.id,null,'CONNECTED','BUSINESS',1,1,iso,iso,iso);

  const insertPage = db.prepare(`INSERT INTO company_pages
    (id,organization_id,provider_profile_id,headline,about,services,corridors,operating_regions,contact_phone,show_contact_phone_on_loads,contact_email,published,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insertPage.run('page-shipper',orgs.shipper.id,null,'Locally made goods for regional buyers','Small manufacturer using trusted freight partners for B2B shipping.','Woven home goods; packaged products','Addis Ababa; Dire Dawa; Hawassa','Addis Ababa; Adama; Dire Dawa','+251 911 111 111',1,'logistics@blue-nile.local',1,iso);
  insertPage.run('page-receiver',orgs.receiver.id,null,'Reliable receiving operations','Distribution business receiving goods from enterprise suppliers.','Food distribution; wholesale receiving','Hawassa; Addis Ababa','Hawassa; Shashamane; Addis Ababa','+251 911 222 222',0,'receiving@fresh-foods.local',1,iso);
  insertPage.run('page-transporter',orgs.transporter.id,null,'Road freight for Ethiopian businesses','Transport company serving business freight on major domestic corridors.','Full-load and shared-capacity freight','Addis Ababa ↔ Dire Dawa; Addis Ababa ↔ Mekelle; Addis Ababa ↔ Hawassa','Addis Ababa; Dire Dawa; Mekelle; Hawassa','+251 911 444 444',0,'dispatch@blueline.local',1,iso);
  insertPage.run('page-driver',null,'provider-driver','Independent freight capacity','Owner-operated truck available for direct and open B2B loads.','Full-load and partial-capacity freight','Addis Ababa ↔ Dire Dawa; Addis Ababa ↔ Hawassa','Addis Ababa; Dire Dawa; Hawassa','+251 911 234 567',0,'abebe@owneroperator.local',1,iso);

  const vehicleInsert = db.prepare(`INSERT INTO vehicles (id,organization_id,provider_profile_id,label,category,plate,active,make,model,cargo_configuration) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  vehicleInsert.run('veh-trans-1',orgs.transporter.id,null,'Truck 01','Medium Box Truck','AA-3-10001',1,'Isuzu','FSR','Medium Box Truck');
  vehicleInsert.run('veh-trans-2',orgs.transporter.id,null,'Truck 02','Heavy Rigid Stake Body Truck','AA-3-10002',1,'Sinotruk','HOWO TX','Heavy Rigid Stake Body Truck');
  vehicleInsert.run('veh-driver-1',null,'provider-driver','My truck','Light Stake Body Truck','AA-2-44001',1,'Isuzu','NPR','Light Stake Body Truck');
  db.prepare(`INSERT INTO drivers (id,organization_id,user_id,name,phone,license_verified,active) VALUES (?,?,?,?,?,?,?)`)
    .run('driver-company-1',orgs.transporter.id,'user-company-driver','Yonas Alemu','+251 911 555 001',1,1);
  db.prepare(`INSERT INTO driver_permissions
    (user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,updated_by,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run('user-company-driver',1,1,1,1,'user-transporter',iso);
  db.prepare(`INSERT INTO driver_vehicle_assignments
    (id,driver_user_id,vehicle_id,assigned_by,assigned_at,active) VALUES (?,?,?,?,?,1)`)
    .run('driver-vehicle-company-1','user-company-driver','veh-trans-1','user-transporter',iso);

  const profileRouteInsert = db.prepare(`INSERT INTO profile_routes
    (id,organization_id,provider_profile_id,origin,destination,created_by,created_at) VALUES (?,?,?,?,?,?,?)`);
  const seededRoutes = [
    ['route-shipper-dire-dawa',orgs.shipper.id,null,'Addis Ababa','Dire Dawa','user-shipper'],
    ['route-shipper-hawassa',orgs.shipper.id,null,'Addis Ababa','Hawassa','user-shipper'],
    ['route-receiver-addis',orgs.receiver.id,null,'Hawassa','Addis Ababa','user-receiver'],
    ['route-transporter-dire-dawa',orgs.transporter.id,null,'Addis Ababa','Dire Dawa','user-transporter'],
    ['route-transporter-mekelle',orgs.transporter.id,null,'Addis Ababa','Mekelle','user-transporter'],
    ['route-transporter-hawassa',orgs.transporter.id,null,'Addis Ababa','Hawassa','user-transporter'],
    ['route-driver-dire-dawa',null,'provider-driver','Addis Ababa','Dire Dawa','user-driver'],
    ['route-driver-hawassa',null,'provider-driver','Addis Ababa','Hawassa','user-driver']
  ];
  for (const route of seededRoutes) profileRouteInsert.run(...route,iso);

  const capacityInsert = db.prepare(`INSERT INTO capacities
    (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  capacityInsert.run('cap-empty',orgs.transporter.id,null,'veh-trans-1','EMPTY',100,'Addis Ababa','Dire Dawa','Addis Ababa ↔ Dire Dawa',tomorrow,'Today 16:00','OPEN',null,'user-transporter',iso,expiresFresh,'Around Addis Ababa',iso,9,38.5,40,'DEVICE_OBSCURED');
  capacityInsert.run('cap-partial',null,'provider-driver','veh-driver-1','PARTIAL',40,'Addis Ababa','Hawassa','Addis Ababa ↔ Hawassa',dayAfter,'Tomorrow 08:00','OPEN',null,'user-driver',new Date(now.getTime()-13*60*60*1000).toISOString(),expiresStale,'Around Addis Ababa',new Date(now.getTime()-13*60*60*1000).toISOString(),9,38.5,40,'DEVICE_OBSCURED');
  capacityInsert.run('cap-partner-partial',orgs.transporter.id,null,'veh-trans-2','PARTIAL',25,'Mekelle','Addis Ababa','Mekelle ↔ Addis Ababa',dayAfter,'After current delivery','SAVED_PARTNERS',null,'user-transporter',iso,expiresFresh,'Around Mekelle',iso,13.5,39.5,40,'DEVICE_OBSCURED');

  const shipmentInsert = db.prepare(`INSERT INTO shipments
    (id,code,title,service_mode,distribution_mode,price_mode,price_minor,target_price_minor,shipper_organization_id,receiver_organization_id,provider_organization_id,provider_profile_id,origin,destination,cargo_description,package_count,estimated_weight,vehicle_category,load_type,receiver_first_name,receiver_phone,pickup_date,delivery_date,commercial_status,operational_status,tracking_mode,tracking_code_hash,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const seededShipments = [
    ['shp-freight-fixed','LGX-F2001','Beverage load to Dire Dawa','FREIGHT','OPEN_MARKET','FIXED_PRICE',4850000,null,orgs.shipper.id,orgs.receiver.id,null,null,'Addis Ababa','Dire Dawa','Palletized beverages',120,18000,'Medium Box Truck','FTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-freight-quote','LGX-F2002','Construction materials to Mekelle','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.shipper.id,null,null,null,'Addis Ababa','Mekelle','Bagged building materials',400,20000,'Heavy Rigid Stake Body Truck','FTL',null,null,dayAfter,null,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-freight-target','LGX-F2003','Packaged food to Hawassa','FREIGHT','SAVED_PARTNERS','TARGET_PRICE',null,3500000,orgs.shipper.id,orgs.receiver.id,null,null,'Addis Ababa','Hawassa','Packaged food cartons',250,9000,'Medium Box Truck','PTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-freight-active','LGX-F2004','Industrial supplies to Dire Dawa','FREIGHT','DIRECT_TO_PROVIDER','FIXED_PRICE',5200000,null,orgs.shipper.id,orgs.receiver.id,orgs.transporter.id,null,'Addis Ababa','Dire Dawa','Industrial supplies',80,19000,'Heavy Rigid Stake Body Truck','FTL','Marta','+251 911 222 222',tomorrow,dayAfter,'AGREED','IN_TRANSIT','LOCATION_AND_STATUS','user-shipper']
  ];
  for (const s of seededShipments) {
    const createdBy = s.at(-1);
    shipmentInsert.run(...s.slice(0,-1),hashTrackingAccessCode(trackingAccessCode(s[0])),createdBy,iso,iso);
  }

  const eventInsert = db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,created_by,public,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  for (const s of seededShipments) {
    if (s[0] !== 'shp-freight-active') eventInsert.run(randomId('evt-'),s[0],s[24],'CREATED','Shipment created in Loadgistic',s[26],1,iso);
  }
  eventInsert.run(randomId('evt-'),'shp-freight-active','SENT','CREATED','Direct request sent by Blue Nile Trading','user-shipper',1,new Date(now.getTime()-6*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-freight-active','AGREED','STATUS','Business and transporter agreed to the shipment','user-transporter',1,new Date(now.getTime()-5*60*60*1000).toISOString());
  db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,location_area,location_precision_km,location_source,created_by,public,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(randomId('evt-'),'shp-freight-active','ASSIGNED','STATUS','Truck and driver assigned','Around Addis Ababa',null,'MANUAL_GENERAL_AREA','user-transporter',1,new Date(now.getTime()-3*60*60*1000).toISOString());
  db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,public,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(randomId('evt-'),'shp-freight-active','IN_TRANSIT','STATUS','Truck departed Addis Ababa','Around Addis Ababa',9,38.5,40,'DEVICE_OBSCURED','user-transporter',1,new Date(now.getTime()-90*60*1000).toISOString());

  const verificationInsert = db.prepare(`INSERT INTO verification_requests
    (id,subject_type,subject_id,verification_type,document_name,file_path,original_name,mime_type,status,submitted_by,reviewed_by,review_note,submitted_at,reviewed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const demoDocument = path.resolve(process.cwd(),'public/vehicle-configurations/cargo-van.jpg');
  const seededVerifications = [
    ['verification-business-id','ORGANIZATION',orgs.shipper.id,'IDENTITY','Owner national identity','user-shipper'],
    ['verification-business-license','ORGANIZATION',orgs.shipper.id,'BUSINESS_LICENSE','Business license','user-shipper'],
    ['verification-receiver-id','ORGANIZATION',orgs.receiver.id,'IDENTITY','Owner national identity','user-receiver'],
    ['verification-transporter-id','ORGANIZATION',orgs.transporter.id,'IDENTITY','Owner national identity','user-transporter'],
    ['verification-transporter-license','ORGANIZATION',orgs.transporter.id,'BUSINESS_LICENSE','Transport business license','user-transporter'],
    ['verification-driver-id','PROVIDER_PROFILE','provider-driver','IDENTITY','National identity','user-driver'],
    ['verification-driver-license','PROVIDER_PROFILE','provider-driver','DRIVER_IDENTITY','Driver license','user-driver'],
    ['verification-truck-1','VEHICLE','veh-trans-1','VEHICLE_OWNERSHIP','Vehicle ownership','user-transporter'],
    ['verification-truck-driver','VEHICLE','veh-driver-1','VEHICLE_OWNERSHIP','Vehicle ownership','user-driver']
  ];
  for (const item of seededVerifications) {
    verificationInsert.run(item[0],item[1],item[2],item[3],item[4],demoDocument,'Demo verification record.jpg','image/jpeg','APPROVED',item[5],'user-admin','Approved demo fixture',iso,iso);
  }

  const planInsert = db.prepare('INSERT INTO plans (id,code,name,audience,active) VALUES (?,?,?,?,1)');
  planInsert.run('plan-business','BUSINESS_CAPACITY','Business Capacity','BUSINESS');
  planInsert.run('plan-transport','FLEET_DEMAND','Fleet Transporter Demand','TRANSPORTER');
  planInsert.run('plan-solo','SELF_MANAGED_DRIVER','Self-managed Driver Demand','DRIVER');
  const subInsert = db.prepare(`INSERT INTO subscriptions (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at) VALUES (?,?,?,?,?,?,?,?)`);
  subInsert.run('sub-shipper',orgs.shipper.id,null,'plan-business','ACTIVE','FLAT_MONTHLY',iso,null);
  subInsert.run('sub-transporter',orgs.transporter.id,null,'plan-transport','ACTIVE','FLAT_MONTHLY',iso,null);
  subInsert.run('sub-driver',null,'provider-driver','plan-solo','ACTIVE','FLAT_MONTHLY',iso,null);

  db.prepare(`INSERT INTO applications (id,user_id,business_name,application_type,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run('app-pending','user-applicant','Hawassa Retail Distribution PLC','ENTERPRISE_RECEIVER','PENDING','Confirm business registration document',iso,iso);

  const notify = db.prepare(`INSERT INTO notifications (id,user_id,title,body,read_at,created_at) VALUES (?,?,?,?,?,?)`);
  notify.run(randomId('ntf-'),'user-transporter','New open freight load','A fixed-price load is available from Addis Ababa to Dire Dawa.',null,iso);
}
