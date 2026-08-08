import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { trackingAccessCode, hashPassword, hashTrackingAccessCode, randomId } from './security.js';
import { distanceBetweenKm } from './domain.js';
import { getPlaceCoordinate as getBuiltInPlaceCoordinate } from './ethiopia-places.js';
import { placeLabel, placeLocalName, qualifyAreaLabel, qualifyCorridorList, qualifyPlaceList } from './place-labels.js';

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
  database.function('geo_distance_km',{deterministic:true},(lat1,lng1,lat2,lng2) =>
    distanceBetweenKm({lat:lat1,lng:lng1},{lat:lat2,lng:lng2})
  );
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(database);
  seed(database);
  runDataMigrationOnce(database,'ethiopia-place-qualification-v2',qualifyExistingEthiopiaData);
  runDataMigrationOnce(database,'structured-route-geography-v1',backfillStructuredGeography);
  runDataMigrationOnce(database,'local-capacity-empty-v1',normalizeLocalCapacity);
  runDataMigrationOnce(database,'tracking-proof-types-v1',expandTrackingProofTypes);
  runDataMigrationOnce(database,'retire-busy-dated-contract-capacity-v1',retireLegacyCapacityModes);
  runDataMigrationOnce(database,'normalize-capacity-geometry-v1',normalizeCapacityGeometry);
  runDataMigrationOnce(database,'purge-legacy-demand-fixtures-v1',purgeLegacyDemandFixtures);
  runDataMigrationOnce(database,'seed-public-capacity-market-v1',seedPublicCapacityMarket);
  runDataMigrationOnce(database,'partial-route-recurring-areas-v1',enforcePartialRoutesAndSeedRecurringAreas);
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
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','SUPPORT','SHIPPER','RECEIVER','TRANSPORTER','DRIVER')),
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

    CREATE TABLE IF NOT EXISTS member_favorites (
      id TEXT PRIMARY KEY,
      owner_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      target_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE(owner_organization_id,target_organization_id),
      CHECK(owner_organization_id<>target_organization_id)
    );

    CREATE INDEX IF NOT EXISTS idx_member_favorites_owner ON member_favorites(owner_organization_id,created_at);

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
      platform_number TEXT UNIQUE,
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_vehicle_active_driver
      ON driver_vehicle_assignments(driver_user_id) WHERE active=1;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_vehicle_active_vehicle
      ON driver_vehicle_assignments(vehicle_id) WHERE active=1;

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

    CREATE TABLE IF NOT EXISTS service_areas (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      place_ref TEXT NOT NULL,
      place_label TEXT NOT NULL,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      radius_km INTEGER NOT NULL CHECK(radius_km BETWEEN 5 AND 100),
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ((organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE INDEX IF NOT EXISTS idx_service_areas_organization ON service_areas(organization_id);
    CREATE INDEX IF NOT EXISTS idx_service_areas_provider ON service_areas(provider_profile_id);
    CREATE INDEX IF NOT EXISTS idx_service_areas_place ON service_areas(place_ref);

    CREATE TABLE IF NOT EXISTS place_catalog (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      alternate_names TEXT,
      place_type TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      population INTEGER,
      wikidata_id TEXT,
      osm_type TEXT,
      osm_id TEXT,
      source TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      parent_place_id TEXT,
      parent_name TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_place_catalog_name ON place_catalog(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_place_catalog_type_name ON place_catalog(place_type, normalized_name);

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
      movement_scope TEXT NOT NULL DEFAULT 'INTERCITY' CHECK(movement_scope IN ('LOCAL','INTERCITY','BOTH')),
      local_place_ref TEXT,
      local_place_label TEXT,
      local_center_lat REAL,
      local_center_lng REAL,
      local_radius_km INTEGER CHECK(local_radius_km IS NULL OR local_radius_km BETWEEN 5 AND 100),
      CHECK(movement_scope <> 'LOCAL' OR status IN ('EMPTY','OFF_DUTY')),
      CHECK ((provider_organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (provider_organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE INDEX IF NOT EXISTS idx_capacity_expires ON capacities(expires_at);
    CREATE INDEX IF NOT EXISTS idx_capacity_visibility ON capacities(visibility, expires_at);

    CREATE TABLE IF NOT EXISTS next_trips (
      id TEXT PRIMARY KEY,
      provider_organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
      origin TEXT NOT NULL,
      origin_place_ref TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      destination TEXT NOT NULL,
      destination_place_ref TEXT NOT NULL,
      destination_lat REAL NOT NULL,
      destination_lng REAL NOT NULL,
      travel_date TEXT,
      space_status TEXT NOT NULL CHECK(space_status IN ('EMPTY','PARTIAL')),
      available_percent INTEGER NOT NULL CHECK(available_percent BETWEEN 5 AND 100),
      published INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL REFERENCES users(id),
      updated_at TEXT NOT NULL,
      CHECK ((provider_organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (provider_organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE INDEX IF NOT EXISTS idx_next_trips_public ON next_trips(published,travel_date,updated_at DESC);

    CREATE TABLE IF NOT EXISTS recurring_service_areas (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      place_ref TEXT NOT NULL,
      place_label TEXT NOT NULL,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      radius_km INTEGER NOT NULL CHECK(radius_km BETWEEN 5 AND 500),
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ((organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE INDEX IF NOT EXISTS idx_recurring_service_areas_organization ON recurring_service_areas(organization_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_service_areas_provider ON recurring_service_areas(provider_profile_id);

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
      assigned_vehicle_id TEXT REFERENCES vehicles(id),
      assigned_driver_user_id TEXT REFERENCES users(id),
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
      ,movement_scope TEXT NOT NULL DEFAULT 'INTERCITY' CHECK(movement_scope IN ('LOCAL','INTERCITY'))
      ,local_place_ref TEXT
      ,local_place_label TEXT
      ,local_center_lat REAL
      ,local_center_lng REAL
      ,pickup_area_label TEXT
      ,dropoff_area_label TEXT
      ,pickup_lat REAL
      ,pickup_lng REAL
      ,dropoff_lat REAL
      ,dropoff_lng REAL
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
      proof_type TEXT NOT NULL CHECK(proof_type IN ('LOADING','TRANSIT','UNLOADING','DELIVERY','ISSUE')),
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
      status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK(status IN ('PENDING','PUBLISHED','DISMISSED')),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      reviewed_by TEXT REFERENCES users(id),
      review_note TEXT,
      reviewed_at TEXT,
      UNIQUE(shipment_id, reviewer_organization_id, subject_organization_id),
      CHECK(reviewer_organization_id <> subject_organization_id)
    );

    CREATE INDEX IF NOT EXISTS idx_business_reviews_status ON business_reviews(status, created_at);

    CREATE TABLE IF NOT EXISTS provider_shipments (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      provider_organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      assigned_vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
      assigned_driver_user_id TEXT NOT NULL REFERENCES users(id),
      origin TEXT NOT NULL,
      origin_place_ref TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      destination TEXT NOT NULL,
      destination_place_ref TEXT NOT NULL,
      destination_lat REAL NOT NULL,
      destination_lng REAL NOT NULL,
      cargo_summary TEXT NOT NULL,
      shipper_email TEXT NOT NULL,
      receiver_email TEXT NOT NULL,
      expected_pickup_date TEXT,
      expected_delivery_date TEXT,
      tracking_mode TEXT NOT NULL CHECK(tracking_mode IN ('STATUS_ONLY','LOCATION_AND_STATUS')),
      operational_status TEXT NOT NULL CHECK(operational_status IN ('CREATED','LOADING','IN_TRANSIT','UNLOADING','COMPLETED','ISSUE')),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      guest_expires_at TEXT,
      CHECK ((provider_organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (provider_organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE INDEX IF NOT EXISTS idx_provider_shipments_owner ON provider_shipments(provider_organization_id,provider_profile_id,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_provider_shipments_guest_expiry ON provider_shipments(guest_expires_at,operational_status);

    CREATE TABLE IF NOT EXISTS provider_shipment_events (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES provider_shipments(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      proof_path TEXT,
      proof_original_name TEXT,
      proof_mime_type TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_provider_shipment_events_order ON provider_shipment_events(shipment_id,created_at,id);

    CREATE TABLE IF NOT EXISTS shipment_party_grants (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES provider_shipments(id) ON DELETE CASCADE,
      party_role TEXT NOT NULL CHECK(party_role IN ('SHIPPER','RECEIVER')),
      code_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(shipment_id,party_role)
    );

    CREATE INDEX IF NOT EXISTS idx_shipment_party_grants_expiry ON shipment_party_grants(expires_at,revoked_at);

    CREATE TABLE IF NOT EXISTS email_deliveries (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES provider_shipments(id) ON DELETE CASCADE,
      party_role TEXT NOT NULL CHECK(party_role IN ('SHIPPER','RECEIVER')),
      delivery_kind TEXT NOT NULL CHECK(delivery_kind IN ('TRACKING_ACCESS','COMPLETION')),
      recipient_email TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('PENDING','SENT','FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_attempt_at TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_email_deliveries_retry ON email_deliveries(status,next_attempt_at,created_at);

    CREATE TABLE IF NOT EXISTS provider_reviews (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL UNIQUE REFERENCES provider_shipments(id) ON DELETE CASCADE,
      provider_organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      note TEXT,
      status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK(status IN ('PUBLISHED','REMOVED')),
      dispute_status TEXT NOT NULL DEFAULT 'NONE' CHECK(dispute_status IN ('NONE','PENDING','UPHELD','REMOVED')),
      dispute_reason TEXT,
      disputed_at TEXT,
      reviewed_by TEXT REFERENCES users(id),
      review_note TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      CHECK ((provider_organization_id IS NOT NULL AND provider_profile_id IS NULL) OR (provider_organization_id IS NULL AND provider_profile_id IS NOT NULL))
    );

    CREATE INDEX IF NOT EXISTS idx_provider_reviews_public ON provider_reviews(provider_organization_id,provider_profile_id,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_provider_reviews_dispute ON provider_reviews(dispute_status,created_at);

    CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY,
      subject_type TEXT NOT NULL CHECK(subject_type IN ('ORGANIZATION','PROVIDER_PROFILE','DRIVER','VEHICLE')),
      subject_id TEXT NOT NULL,
      verification_type TEXT NOT NULL CHECK(verification_type IN ('IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS','DRIVER_IDENTITY','VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION')),
      related_vehicle_id TEXT REFERENCES vehicles(id),
      expires_on TEXT,
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
      sponsored_free INTEGER NOT NULL DEFAULT 0,
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
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    CREATE TABLE IF NOT EXISTS support_agent_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      active INTEGER NOT NULL DEFAULT 1,
      available INTEGER NOT NULL DEFAULT 1,
      max_open_conversations INTEGER NOT NULL DEFAULT 3 CHECK(max_open_conversations BETWEEN 1 AND 20),
      can_manage_customers INTEGER NOT NULL DEFAULT 0,
      can_manage_operations INTEGER NOT NULL DEFAULT 0,
      can_manage_trust INTEGER NOT NULL DEFAULT 0,
      can_manage_billing INTEGER NOT NULL DEFAULT 0,
      can_manage_support INTEGER NOT NULL DEFAULT 1,
      last_assigned_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_conversations (
      id TEXT PRIMARY KEY,
      customer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_agent_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      category TEXT NOT NULL CHECK(category IN ('ACCOUNT','PAYMENT','VERIFICATION','LOAD_TRACKING','CAPACITY','OTHER')),
      status TEXT NOT NULL CHECK(status IN ('WAITING','OPEN','CLOSED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_message_at TEXT NOT NULL,
      assigned_at TEXT,
      customer_last_read_at TEXT,
      agent_last_read_at TEXT,
      closed_at TEXT,
      closed_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS support_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
      sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_events (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
      actor_user_id TEXT REFERENCES users(id),
      event_type TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);
  ensureSupportRoleSchema(db);
  ensureVerificationTrustSchema(db);
  const supportConversationColumns=new Set(db.prepare('PRAGMA table_info(support_conversations)').all().map(column=>column.name));
  if(!supportConversationColumns.has('customer_last_read_at'))db.exec('ALTER TABLE support_conversations ADD COLUMN customer_last_read_at TEXT');
  if(!supportConversationColumns.has('agent_last_read_at'))db.exec('ALTER TABLE support_conversations ADD COLUMN agent_last_read_at TEXT');
  const supportAgentColumns=new Set(db.prepare('PRAGMA table_info(support_agent_profiles)').all().map(column=>column.name));
  for(const [name,definition] of [
    ['can_manage_customers','INTEGER NOT NULL DEFAULT 0'],
    ['can_manage_operations','INTEGER NOT NULL DEFAULT 0'],
    ['can_manage_trust','INTEGER NOT NULL DEFAULT 0'],
    ['can_manage_billing','INTEGER NOT NULL DEFAULT 0'],
    ['can_manage_support','INTEGER NOT NULL DEFAULT 1']
  ])if(!supportAgentColumns.has(name))db.exec(`ALTER TABLE support_agent_profiles ADD COLUMN ${name} ${definition}`);
  const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name));
  if (!userColumns.has('phone')) db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  const organizationColumns = new Set(db.prepare('PRAGMA table_info(organizations)').all().map(column => column.name));
  for (const [name,definition] of [
    ['city_place_ref','TEXT'],['city_lat','REAL'],['city_lng','REAL']
  ]) if(!organizationColumns.has(name))db.exec(`ALTER TABLE organizations ADD COLUMN ${name} ${definition}`);
  const providerProfileColumns = new Set(db.prepare('PRAGMA table_info(provider_profiles)').all().map(column => column.name));
  for (const [name,definition] of [
    ['city_place_ref','TEXT'],['city_lat','REAL'],['city_lng','REAL']
  ]) if(!providerProfileColumns.has(name))db.exec(`ALTER TABLE provider_profiles ADD COLUMN ${name} ${definition}`);
  const profileRouteColumns = new Set(db.prepare('PRAGMA table_info(profile_routes)').all().map(column => column.name));
  for (const [name,definition] of [
    ['origin_place_ref','TEXT'],['origin_lat','REAL'],['origin_lng','REAL'],
    ['destination_place_ref','TEXT'],['destination_lat','REAL'],['destination_lng','REAL']
    ,['assigned_vehicle_id','TEXT REFERENCES vehicles(id)']
    ,['assigned_driver_user_id','TEXT REFERENCES users(id)']
  ]) if(!profileRouteColumns.has(name))db.exec(`ALTER TABLE profile_routes ADD COLUMN ${name} ${definition}`);
  const placeColumns = new Set(db.prepare('PRAGMA table_info(place_catalog)').all().map(column => column.name));
  if (!placeColumns.has('country_name')) db.exec("ALTER TABLE place_catalog ADD COLUMN country_name TEXT NOT NULL DEFAULT 'Ethiopia'");
  if (!placeColumns.has('country_code')) db.exec("ALTER TABLE place_catalog ADD COLUMN country_code TEXT NOT NULL DEFAULT 'ET'");
  if (!placeColumns.has('parent_place_id')) db.exec('ALTER TABLE place_catalog ADD COLUMN parent_place_id TEXT');
  if (!placeColumns.has('parent_name')) db.exec('ALTER TABLE place_catalog ADD COLUMN parent_name TEXT');
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
    ['availability_geometry','TEXT'],
    ['work_radius_km','INTEGER'],
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
    ['proof_recorded_at', 'TEXT'],
    ['current_route_origin','TEXT'],
    ['current_route_destination','TEXT'],
    ['current_route_date','TEXT'],
    ['planned_space_status','TEXT'],
    ['accepts_multi_pick','INTEGER NOT NULL DEFAULT 0'],
    ['accepts_multi_drop','INTEGER NOT NULL DEFAULT 0'],
    ['movement_scope',"TEXT NOT NULL DEFAULT 'INTERCITY'"],
    ['local_place_ref','TEXT'],
    ['local_place_label','TEXT'],
    ['local_center_lat','REAL'],
    ['local_center_lng','REAL'],
    ['local_radius_km','INTEGER'],
    ['origin_place_ref','TEXT'],['origin_lat','REAL'],['origin_lng','REAL'],
    ['destination_place_ref','TEXT'],['destination_lat','REAL'],['destination_lng','REAL'],
    ['current_origin_place_ref','TEXT'],['current_origin_lat','REAL'],['current_origin_lng','REAL'],
    ['current_destination_place_ref','TEXT'],['current_destination_lat','REAL'],['current_destination_lng','REAL'],
    ['location_place_ref','TEXT'],
    ['market_status','TEXT'],
    ['available_again_date','TEXT'],
    ['available_again_place_ref','TEXT'],
    ['available_again_place_label','TEXT'],
    ['available_again_lat','REAL'],
    ['available_again_lng','REAL']
  ];
  for (const [name, definition] of additiveCapacityColumns) {
    if (!capacityColumns.has(name)) db.exec(`ALTER TABLE capacities ADD COLUMN ${name} ${definition}`);
  }
  db.exec(`UPDATE capacities SET
    market_status=COALESCE(market_status,status),
    availability_geometry=COALESCE(availability_geometry,CASE
      WHEN COALESCE(current_route_origin,origin) IS NOT NULL AND COALESCE(current_route_destination,destination) IS NOT NULL THEN 'ROUTE'
      WHEN COALESCE(market_status,status) IN ('EMPTY','PARTIAL') THEN 'RADIUS'
      ELSE NULL END),
    accepts_multi_pick=CASE WHEN accepts_multi_stop=1 THEN 1 ELSE accepts_multi_pick END,
    accepts_multi_drop=CASE WHEN accepts_multi_stop=1 THEN 1 ELSE accepts_multi_drop END`);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS enforce_local_capacity_status_insert
    BEFORE INSERT ON capacities
    WHEN NEW.movement_scope='LOCAL' AND NEW.status='PARTIAL'
    BEGIN
      SELECT RAISE(ABORT,'LOCAL_CAPACITY_MUST_BE_EMPTY');
    END;
    CREATE TRIGGER IF NOT EXISTS enforce_local_capacity_status_update
    BEFORE UPDATE OF movement_scope,status ON capacities
    WHEN NEW.movement_scope='LOCAL' AND NEW.status='PARTIAL'
    BEGIN
      SELECT RAISE(ABORT,'LOCAL_CAPACITY_MUST_BE_EMPTY');
    END;
  `);
  const vehicleColumns = new Set(db.prepare('PRAGMA table_info(vehicles)').all().map(column => column.name));
  for (const [name, definition] of [['make','TEXT'],['model','TEXT'],['cargo_configuration','TEXT'],['platform_number','TEXT']]) {
    if (!vehicleColumns.has(name)) db.exec(`ALTER TABLE vehicles ADD COLUMN ${name} ${definition}`);
  }
  const vehiclesWithoutPlatformNumber = db.prepare(`SELECT rowid,id FROM vehicles
    WHERE platform_number IS NULL OR trim(platform_number)='' ORDER BY rowid`).all();
  const assignPlatformNumber = db.prepare('UPDATE vehicles SET platform_number=? WHERE id=?');
  for (const vehicle of vehiclesWithoutPlatformNumber) {
    assignPlatformNumber.run(`LG-TRK-${String(vehicle.rowid).padStart(6,'0')}`,vehicle.id);
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_platform_number ON vehicles(platform_number);
    CREATE TRIGGER IF NOT EXISTS assign_vehicle_platform_number
    AFTER INSERT ON vehicles
    WHEN NEW.platform_number IS NULL OR trim(NEW.platform_number)=''
    BEGIN
      UPDATE vehicles
      SET platform_number='LG-TRK-' || upper(substr(hex(randomblob(5)),1,10))
      WHERE id=NEW.id;
    END;
  `);
  const companyPageColumns = new Set(db.prepare('PRAGMA table_info(company_pages)').all().map(column => column.name));
  if (!companyPageColumns.has('operating_regions')) {
    db.exec('ALTER TABLE company_pages ADD COLUMN operating_regions TEXT');
  }
  if (!companyPageColumns.has('show_contact_phone_on_loads')) {
    db.exec('ALTER TABLE company_pages ADD COLUMN show_contact_phone_on_loads INTEGER NOT NULL DEFAULT 0');
  }
  for (const [name,definition] of [
    ['theme_primary',"TEXT NOT NULL DEFAULT '#075985'"],
    ['theme_accent',"TEXT NOT NULL DEFAULT '#f97316'"],
    ['contact_whatsapp','TEXT'],
    ['contact_website','TEXT'],
    ['show_contact_phone','INTEGER NOT NULL DEFAULT 0'],
    ['show_contact_whatsapp','INTEGER NOT NULL DEFAULT 0'],
    ['show_contact_email','INTEGER NOT NULL DEFAULT 0'],
    ['show_contact_website','INTEGER NOT NULL DEFAULT 0'],
    ['youtube_video_id','TEXT']
  ]) if(!companyPageColumns.has(name))db.exec(`ALTER TABLE company_pages ADD COLUMN ${name} ${definition}`);
  const applicationColumns = new Set(db.prepare('PRAGMA table_info(applications)').all().map(column => column.name));
  if (!applicationColumns.has('sponsored_free')) {
    db.exec('ALTER TABLE applications ADD COLUMN sponsored_free INTEGER NOT NULL DEFAULT 0');
  }
  const subscriptionColumns = new Set(db.prepare('PRAGMA table_info(subscriptions)').all().map(column => column.name));
  if (!subscriptionColumns.has('updated_at')) {
    db.exec('ALTER TABLE subscriptions ADD COLUMN updated_at TEXT');
  }
  const paymentProofColumns = new Set(db.prepare('PRAGMA table_info(payment_proofs)').all().map(column => column.name));
  if (!paymentProofColumns.has('original_name')) db.exec('ALTER TABLE payment_proofs ADD COLUMN original_name TEXT');
  if (!paymentProofColumns.has('mime_type')) db.exec('ALTER TABLE payment_proofs ADD COLUMN mime_type TEXT');
  db.exec(`
    UPDATE subscriptions
    SET ends_at=strftime('%Y-%m-%dT%H:%M:%fZ',starts_at,'+30 days')
    WHERE status='ACTIVE' AND ends_at IS NULL;
    UPDATE subscriptions SET updated_at=COALESCE(updated_at,starts_at);
  `);
  const shipmentColumns = new Set(db.prepare('PRAGMA table_info(shipments)').all().map(column => column.name));
  for (const [name, definition] of [
    ['receiver_first_name','TEXT'],
    ['receiver_phone','TEXT'],
    ['tracking_code_hash','TEXT'],
    ['load_owner_organization_id','TEXT REFERENCES organizations(id)'],
    ['load_owner_party_role',"TEXT CHECK(load_owner_party_role IN ('SHIPPER','RECEIVER'))"],
    ['external_shipper_name','TEXT'],
    ['external_shipper_phone','TEXT'],
    ['external_receiver_name','TEXT'],
    ['external_receiver_phone','TEXT'],
    ['movement_scope',"TEXT NOT NULL DEFAULT 'INTERCITY'"],
    ['local_place_ref','TEXT'],
    ['local_place_label','TEXT'],
    ['local_center_lat','REAL'],
    ['local_center_lng','REAL'],
    ['pickup_area_label','TEXT'],
    ['dropoff_area_label','TEXT'],
    ['pickup_lat','REAL'],
    ['pickup_lng','REAL'],
    ['dropoff_lat','REAL'],
    ['dropoff_lng','REAL'],
    ['origin_place_ref','TEXT'],['origin_lat','REAL'],['origin_lng','REAL'],
    ['destination_place_ref','TEXT'],['destination_lat','REAL'],['destination_lng','REAL']
  ]) {
    if (!shipmentColumns.has(name)) db.exec(`ALTER TABLE shipments ADD COLUMN ${name} ${definition}`);
  }
  db.exec(`UPDATE shipments SET
    load_owner_organization_id=COALESCE(load_owner_organization_id,shipper_organization_id),
    load_owner_party_role=COALESCE(load_owner_party_role,'SHIPPER'),
    movement_scope=COALESCE(movement_scope,'INTERCITY')`);
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
  const businessReviewColumns = new Set(db.prepare('PRAGMA table_info(business_reviews)').all().map(column => column.name));
  for (const [name, definition] of [
    ['status',"TEXT NOT NULL DEFAULT 'PUBLISHED'"],
    ['reviewed_by','TEXT REFERENCES users(id)'],
    ['review_note','TEXT'],
    ['reviewed_at','TEXT']
  ]) {
    if (!businessReviewColumns.has(name)) db.exec(`ALTER TABLE business_reviews ADD COLUMN ${name} ${definition}`);
  }
  db.exec(`
    UPDATE business_reviews SET status='PUBLISHED' WHERE status IS NULL OR trim(status)='';
    CREATE INDEX IF NOT EXISTS idx_business_reviews_status ON business_reviews(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_relationship_business_status ON partner_relationships(owner_organization_id,status,provider_organization_id,provider_profile_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_organization_active ON vehicles(organization_id,active);
    CREATE INDEX IF NOT EXISTS idx_vehicle_provider_active ON vehicles(provider_profile_id,active);
    CREATE INDEX IF NOT EXISTS idx_capacity_vehicle_latest ON capacities(vehicle_id,updated_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS idx_capacity_market ON capacities(visibility,status,expires_at,movement_scope);
    CREATE INDEX IF NOT EXISTS idx_capacity_market_status ON capacities(visibility,market_status,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_capacity_busy_date ON capacities(market_status,available_again_date);
    CREATE INDEX IF NOT EXISTS idx_capacity_organization ON capacities(provider_organization_id,expires_at);
    CREATE INDEX IF NOT EXISTS idx_capacity_provider ON capacities(provider_profile_id,expires_at);
    CREATE INDEX IF NOT EXISTS idx_capacity_local_place ON capacities(local_place_ref,movement_scope,expires_at);
    CREATE INDEX IF NOT EXISTS idx_capacity_planned_origin_geo ON capacities(origin_lat,origin_lng,expires_at);
    CREATE INDEX IF NOT EXISTS idx_capacity_current_origin_geo ON capacities(current_origin_lat,current_origin_lng,expires_at);
    CREATE INDEX IF NOT EXISTS idx_shipment_board ON shipments(operational_status,movement_scope,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shipment_local_place ON shipments(local_place_ref,movement_scope,operational_status);
    CREATE INDEX IF NOT EXISTS idx_shipment_origin_geo ON shipments(origin_lat,origin_lng,operational_status);
    CREATE INDEX IF NOT EXISTS idx_profile_route_origin_geo ON profile_routes(origin_lat,origin_lng);
    CREATE INDEX IF NOT EXISTS idx_organization_city_geo ON organizations(city_lat,city_lng);
    CREATE INDEX IF NOT EXISTS idx_provider_city_geo ON provider_profiles(city_lat,city_lng);
    CREATE INDEX IF NOT EXISTS idx_shipment_owner ON shipments(load_owner_organization_id,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shipment_assigned_vehicle ON shipments(assigned_vehicle_id,operational_status);
    CREATE INDEX IF NOT EXISTS idx_shipment_assigned_driver ON shipments(assigned_driver_user_id,operational_status);
    CREATE INDEX IF NOT EXISTS idx_shipment_events_load ON shipment_events(shipment_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_shipment_interests_load_provider ON shipment_interests(shipment_id,provider_organization_id,provider_profile_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_support_customer_open ON support_conversations(customer_user_id)
      WHERE status IN ('WAITING','OPEN');
    CREATE INDEX IF NOT EXISTS idx_support_queue ON support_conversations(status,created_at,id);
    CREATE INDEX IF NOT EXISTS idx_support_agent_open ON support_conversations(assigned_agent_user_id,status,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_support_customer_history ON support_conversations(customer_user_id,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_support_messages_recent ON support_messages(conversation_id,created_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS idx_support_events_conversation ON support_events(conversation_id,created_at,id);
  `);
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
    UPDATE shipments SET assigned_vehicle_id='veh-trans-1',assigned_driver_user_id='user-company-driver'
      WHERE id IN ('shp-freight-active','shp-freight-completed')
        AND provider_organization_id='org-transporter'
        AND assigned_vehicle_id IS NULL;
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

function ensureVerificationTrustSchema(db) {
  const definition=String(db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='verification_requests'`).get()?.sql||'');
  const columns=new Set(db.prepare('PRAGMA table_info(verification_requests)').all().map(column=>column.name));
  if(definition.includes("'BUSINESS_ADDRESS'")&&columns.has('related_vehicle_id')&&columns.has('expires_on'))return;
  db.exec('PRAGMA foreign_keys=OFF; PRAGMA legacy_alter_table=ON;');
  try {
    db.exec(`
      BEGIN IMMEDIATE;
      ALTER TABLE verification_requests RENAME TO verification_requests_before_trust_badges;
      CREATE TABLE verification_requests (
        id TEXT PRIMARY KEY,
        subject_type TEXT NOT NULL CHECK(subject_type IN ('ORGANIZATION','PROVIDER_PROFILE','DRIVER','VEHICLE')),
        subject_id TEXT NOT NULL,
        verification_type TEXT NOT NULL CHECK(verification_type IN ('IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS','DRIVER_IDENTITY','VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION')),
        related_vehicle_id TEXT REFERENCES vehicles(id),
        expires_on TEXT,
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
      INSERT INTO verification_requests
        (id,subject_type,subject_id,verification_type,document_name,file_path,original_name,mime_type,status,submitted_by,reviewed_by,review_note,submitted_at,reviewed_at)
        SELECT id,subject_type,subject_id,verification_type,document_name,file_path,original_name,mime_type,status,submitted_by,reviewed_by,review_note,submitted_at,reviewed_at
        FROM verification_requests_before_trust_badges;
      UPDATE verification_requests
      SET subject_id=(SELECT d.user_id FROM drivers d WHERE d.id=verification_requests.subject_id)
      WHERE subject_type='DRIVER'
        AND EXISTS(SELECT 1 FROM drivers d WHERE d.id=verification_requests.subject_id AND d.user_id IS NOT NULL);
      DROP TABLE verification_requests_before_trust_badges;
      CREATE INDEX idx_verification_subject ON verification_requests(subject_type,subject_id,verification_type,status);
      CREATE INDEX idx_verification_vehicle_pair ON verification_requests(subject_type,subject_id,related_vehicle_id,verification_type,status,expires_on);
      COMMIT;
    `);
  } catch(error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  } finally {
    db.exec('PRAGMA legacy_alter_table=OFF; PRAGMA foreign_keys=ON;');
  }
  const violations=db.prepare('PRAGMA foreign_key_check').all();
  if(violations.length)throw new Error('VERIFICATION_TRUST_MIGRATION_FOREIGN_KEY_FAILURE');
}

function ensureSupportRoleSchema(db) {
  const schema=String(db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get()?.sql||'');
  if(schema.includes("'SUPPORT'"))return;
  db.exec('PRAGMA foreign_keys=OFF; PRAGMA legacy_alter_table=ON;');
  try {
    db.exec(`
      BEGIN IMMEDIATE;
      ALTER TABLE users RENAME TO users_before_support_role;
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('ADMIN','SUPPORT','SHIPPER','RECEIVER','TRANSPORTER','DRIVER')),
        organization_id TEXT,
        provider_profile_id TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users (id,email,phone,password_hash,name,role,organization_id,provider_profile_id,active,created_at)
        SELECT id,email,phone,password_hash,name,role,organization_id,provider_profile_id,active,created_at
        FROM users_before_support_role;
      DROP TABLE users_before_support_role;
      COMMIT;
    `);
  } catch(error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  } finally {
    db.exec('PRAGMA legacy_alter_table=OFF; PRAGMA foreign_keys=ON;');
  }
  const violations=db.prepare('PRAGMA foreign_key_check').all();
  if(violations.length)throw new Error('SUPPORT_ROLE_MIGRATION_FOREIGN_KEY_FAILURE');
}

function runDataMigrationOnce(db,key,migration) {
  if(db.prepare('SELECT 1 FROM schema_meta WHERE key=?').get(key))return;
  migration(db);
  db.prepare(`INSERT INTO schema_meta (key,value,updated_at) VALUES (?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
    .run(key,'complete',new Date().toISOString());
}

function expandTrackingProofTypes(db) {
  const definition=db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='proof_files'`).get()?.sql||'';
  if(definition.includes("'TRANSIT'")&&definition.includes("'UNLOADING'"))return;
  db.exec(`
    BEGIN IMMEDIATE;
    ALTER TABLE proof_files RENAME TO proof_files_before_tracking_actions;
    CREATE TABLE proof_files (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      proof_type TEXT NOT NULL CHECK(proof_type IN ('LOADING','TRANSIT','UNLOADING','DELIVERY','ISSUE')),
      file_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      note TEXT,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    INSERT INTO proof_files SELECT * FROM proof_files_before_tracking_actions;
    DROP TABLE proof_files_before_tracking_actions;
    COMMIT;
  `);
}

function normalizedPlaceName(value) {
  return String(placeLocalName(value)||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

function resolveStoredPlace(db,label) {
  const normalized=normalizedPlaceName(label);
  if(!normalized)return null;
  const matches=db.prepare(`SELECT id,latitude,longitude FROM place_catalog
    WHERE normalized_name=? ORDER BY COALESCE(population,0) DESC,id LIMIT 2`).all(normalized);
  if(matches.length===1)return {place_ref:matches[0].id,lat:matches[0].latitude,lng:matches[0].longitude};
  const builtIn=getBuiltInPlaceCoordinate(label);
  return builtIn?{place_ref:`builtin:${normalized}`,lat:builtIn.lat,lng:builtIn.lng}:null;
}

function backfillStructuredGeography(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const table of ['organizations','provider_profiles']){
      const rows=db.prepare(`SELECT id,city FROM ${table}
        WHERE city IS NOT NULL AND trim(city)<>'' AND (city_lat IS NULL OR city_lng IS NULL)`).all();
      const update=db.prepare(`UPDATE ${table} SET city_place_ref=?,city_lat=?,city_lng=? WHERE id=?`);
      for(const row of rows){
        const place=resolveStoredPlace(db,row.city);
        if(place)update.run(place.place_ref,place.lat,place.lng,row.id);
      }
    }
    const routeTables=[
      {table:'profile_routes',where:'1=1',pairs:[['origin','origin'],['destination','destination']]},
      {table:'shipments',where:"movement_scope='INTERCITY'",pairs:[['origin','origin'],['destination','destination']]},
      {table:'capacities',where:"movement_scope IN ('INTERCITY','BOTH')",pairs:[
        ['origin','origin'],['destination','destination'],
        ['current_route_origin','current_origin'],['current_route_destination','current_destination']
      ]}
    ];
    for(const definition of routeTables){
      const columns=definition.pairs.flatMap(([label,prefix])=>[
        label,`${prefix}_place_ref`,`${prefix}_lat`,`${prefix}_lng`
      ]).join(',');
      const rows=db.prepare(`SELECT id,${columns} FROM ${definition.table} WHERE ${definition.where}`).all();
      for(const row of rows){
        const assignments=[];
        const values=[];
        for(const [label,prefix] of definition.pairs){
          if(!row[label]||(row[`${prefix}_lat`]!=null&&row[`${prefix}_lng`]!=null))continue;
          const place=resolveStoredPlace(db,row[label]);
          if(!place)continue;
          assignments.push(`${prefix}_place_ref=?`,`${prefix}_lat=?`,`${prefix}_lng=?`);
          values.push(place.place_ref,place.lat,place.lng);
        }
        if(assignments.length)db.prepare(`UPDATE ${definition.table} SET ${assignments.join(',')} WHERE id=?`).run(...values,row.id);
      }
    }
    const manualAreas=db.prepare(`SELECT id,location_area FROM capacities
      WHERE location_source='MANUAL_GENERAL_AREA' AND location_area IS NOT NULL
        AND (location_lat IS NULL OR location_lng IS NULL)`).all();
    const updateArea=db.prepare(`UPDATE capacities SET location_place_ref=?,location_lat=?,location_lng=?,
      location_precision_km=COALESCE(location_precision_km,40) WHERE id=?`);
    for(const row of manualAreas){
      const place=resolveStoredPlace(db,String(row.location_area).replace(/^around\s+/i,''));
      if(place)updateArea.run(place.place_ref,place.lat,place.lng,row.id);
    }
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function normalizeLocalCapacity(db) {
  db.prepare(`UPDATE capacities SET
    status=CASE WHEN status='PARTIAL' THEN 'EMPTY' ELSE status END,
    available_percent=CASE WHEN status='PARTIAL' THEN 100 ELSE available_percent END,
    origin=NULL,destination=NULL,corridor=NULL,travel_date=NULL,planned_space_status=NULL,
    origin_place_ref=NULL,origin_lat=NULL,origin_lng=NULL,
    destination_place_ref=NULL,destination_lat=NULL,destination_lng=NULL,
    current_route_origin=NULL,current_route_destination=NULL,current_route_date=NULL,
    current_origin_place_ref=NULL,current_origin_lat=NULL,current_origin_lng=NULL,
    current_destination_place_ref=NULL,current_destination_lat=NULL,current_destination_lng=NULL,
    location_place_ref=NULL,location_lat=NULL,location_lng=NULL,location_precision_km=NULL,
    location_source=CASE WHEN status='OFF_DUTY' THEN NULL ELSE 'MANUAL_GENERAL_AREA' END
    WHERE movement_scope='LOCAL'`).run();
}

function retireLegacyCapacityModes(db) {
  db.prepare(`UPDATE capacities SET
    status=CASE WHEN status='BUSY' THEN 'OFF_DUTY' ELSE status END,
    market_status=CASE WHEN market_status='BUSY' THEN 'OFF_DUTY' ELSE market_status END,
    available_percent=CASE WHEN status='BUSY' OR market_status='BUSY' THEN 0 ELSE available_percent END,
    accepts_full_load=CASE WHEN status='BUSY' OR market_status='BUSY' THEN 0 ELSE accepts_full_load END,
    accepts_partial_load=CASE WHEN status='BUSY' OR market_status='BUSY' THEN 0 ELSE accepts_partial_load END,
    accepts_multi_pick=CASE WHEN status='BUSY' OR market_status='BUSY' THEN 0 ELSE accepts_multi_pick END,
    accepts_multi_drop=CASE WHEN status='BUSY' OR market_status='BUSY' THEN 0 ELSE accepts_multi_drop END,
    accepts_multi_stop=CASE WHEN status='BUSY' OR market_status='BUSY' THEN 0 ELSE accepts_multi_stop END,
    origin=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE origin END,
    destination=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE destination END,
    corridor=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE corridor END,
    origin_place_ref=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE origin_place_ref END,
    origin_lat=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE origin_lat END,
    origin_lng=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE origin_lng END,
    destination_place_ref=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE destination_place_ref END,
    destination_lat=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE destination_lat END,
    destination_lng=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE destination_lng END,
    current_route_origin=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE current_route_origin END,
    current_route_destination=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE current_route_destination END,
    location_area=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE location_area END,
    location_updated_at=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE location_updated_at END,
    location_lat=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE location_lat END,
    location_lng=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE location_lng END,
    location_precision_km=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE location_precision_km END,
    location_source=CASE WHEN status='BUSY' OR market_status='BUSY' THEN NULL ELSE location_source END,
    travel_date=CASE WHEN COALESCE(market_status,status)='EMPTY' THEN travel_date ELSE NULL END,open_to_contract_lanes=0,
    available_again_date=NULL,available_again_place_ref=NULL,available_again_place_label=NULL,
    available_again_lat=NULL,available_again_lng=NULL`).run();
}

function normalizeCapacityGeometry(db) {
  db.prepare(`UPDATE capacities SET
    current_route_origin=COALESCE(current_route_origin,origin),
    current_route_destination=COALESCE(current_route_destination,destination),
    current_origin_place_ref=COALESCE(current_origin_place_ref,origin_place_ref),
    current_origin_lat=COALESCE(current_origin_lat,origin_lat),
    current_origin_lng=COALESCE(current_origin_lng,origin_lng),
    current_destination_place_ref=COALESCE(current_destination_place_ref,destination_place_ref),
    current_destination_lat=COALESCE(current_destination_lat,destination_lat),
    current_destination_lng=COALESCE(current_destination_lng,destination_lng),
    travel_date=NULL
    WHERE availability_geometry='ROUTE'
      AND COALESCE(market_status,status) IN ('EMPTY','PARTIAL')
      AND origin IS NOT NULL AND destination IS NOT NULL`).run();
  db.prepare(`UPDATE capacities SET availability_geometry='RADIUS'
    WHERE availability_geometry='ROUTE' AND (
      current_route_origin IS NULL OR current_route_destination IS NULL OR
      current_origin_lat IS NULL OR current_origin_lng IS NULL OR
      current_destination_lat IS NULL OR current_destination_lng IS NULL
    )`).run();
}

function purgeLegacyDemandFixtures(db) {
  db.exec(`
    BEGIN IMMEDIATE;
    DELETE FROM shipments;
    DELETE FROM partner_relationships;
    DELETE FROM member_favorites;
    DELETE FROM business_reviews;

    DELETE FROM payment_proofs WHERE subscription_id IN (
      SELECT s.id FROM subscriptions s JOIN organizations o ON o.id=s.organization_id
      WHERE o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM subscriptions WHERE organization_id IN (
      SELECT id FROM organizations WHERE type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM support_conversations WHERE customer_user_id IN (
      SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id
      WHERE o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM verification_requests WHERE subject_id IN (
      SELECT id FROM organizations WHERE type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    ) OR submitted_by IN (
      SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id
      WHERE o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM applications WHERE user_id IN (
      SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id
      WHERE o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM notifications WHERE user_id IN (
      SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id
      WHERE o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM audit_logs WHERE organization_id IN (
      SELECT id FROM organizations WHERE type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    ) OR actor_user_id IN (
      SELECT u.id FROM users u JOIN organizations o ON o.id=u.organization_id
      WHERE o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM service_areas WHERE organization_id IN (
      SELECT id FROM organizations WHERE type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM profile_routes WHERE organization_id IN (
      SELECT id FROM organizations WHERE type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM company_pages WHERE organization_id IN (
      SELECT id FROM organizations WHERE type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM memberships WHERE organization_id IN (
      SELECT id FROM organizations WHERE type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM users WHERE organization_id IN (
      SELECT id FROM organizations WHERE type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
    );
    DELETE FROM organizations WHERE type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER');
    COMMIT;
  `);
}

function seedPublicCapacityMarket(db) {
  const now=new Date();
  const iso=now.toISOString();
  const expiresAt=new Date(now.getTime()+7*86_400_000).toISOString();
  const subscriptionEnd=new Date(now.getTime()+30*86_400_000).toISOString();
  const passwordHash=hashPassword('Loadgistic123!');
  const places=[
    {name:'Addis Ababa, Ethiopia',ref:'builtin:addis ababa',lat:9.03,lng:38.74},
    {name:'Adama, Ethiopia',ref:'builtin:adama',lat:8.54,lng:39.27},
    {name:'Hawassa, Ethiopia',ref:'builtin:hawassa',lat:7.05,lng:38.47},
    {name:'Dire Dawa, Ethiopia',ref:'builtin:dire dawa',lat:9.60,lng:41.85},
    {name:'Bahir Dar, Ethiopia',ref:'builtin:bahir dar',lat:11.59,lng:37.39},
    {name:'Mekelle, Ethiopia',ref:'builtin:mekelle',lat:13.50,lng:39.47},
    {name:'Jimma, Ethiopia',ref:'builtin:jimma',lat:7.67,lng:36.83},
    {name:'Gondar, Ethiopia',ref:'builtin:gondar',lat:12.60,lng:37.47},
    {name:'Dessie, Ethiopia',ref:'builtin:dessie',lat:11.13,lng:39.63},
    {name:'Shashamane, Ethiopia',ref:'builtin:shashamane',lat:7.20,lng:38.60},
    {name:'Debre Birhan, Ethiopia',ref:'builtin:debre birhan',lat:9.68,lng:39.53},
    {name:'Kombolcha, Ethiopia',ref:'builtin:kombolcha',lat:11.08,lng:39.74}
  ];
  const themes=[['#075985','#f97316'],['#166534','#f59e0b'],['#6d28d9','#22d3ee'],['#9f1239','#fbbf24'],['#0f766e','#fb7185'],['#1d4ed8','#f97316'],['#7c2d12','#38bdf8'],['#4338ca','#facc15']];
  const trucks=[['Isuzu','FSR','Medium Box Truck'],['Sinotruk','HOWO TX','Heavy Rigid Stake Body Truck'],['Isuzu','NPR','Light Stake Body Truck'],['Fuso','FJ','Medium Stake Body Truck'],['Hino','500','Heavy Box Truck'],['FAW','J6L','Curtain Side Truck']];
  const companyNames=['Sheger Freight Network','Rift Valley Haulage','Abyssinia Road Cargo','Awash Fleet Services','Highland Transit Ethiopia','Blue River Logistics','Walia Freight Lines','Merkato Cargo Fleet'];
  const ownerNames=['Abel Tesfaye','Bethlehem Bekele','Dawit Mekonnen','Eden Alemu','Fikru Desta','Genet Tadesse','Henok Girma','Iman Mohammed','Kalkidan Assefa','Liya Kebede','Mulugeta Solomon','Nebiyu Haile','Rahel Worku','Samuel Getachew','Tigist Abebe','Yared Demissie','Zelalem Tesema','Saron Yohannes','Mustefa Ali','Biruk Amare'];

  const insertUser=db.prepare(`INSERT OR IGNORE INTO users (id,email,phone,password_hash,name,role,organization_id,provider_profile_id,active,created_at) VALUES (?,?,?,?,?,?,?,?,1,?)`);
  const insertOrg=db.prepare(`INSERT OR IGNORE INTO organizations (id,name,handle,type,verified,industry,description,phone,email,city,public_visibility,created_at,city_place_ref,city_lat,city_lng) VALUES (?,?,?,'TRANSPORT_COMPANY',0,'Road freight',?,?,?,?,'PUBLIC',?,?,?,?)`);
  const insertMember=db.prepare(`INSERT OR IGNORE INTO memberships (id,user_id,organization_id,membership_role) VALUES (?,?,?,?)`);
  const insertProfile=db.prepare(`INSERT OR IGNORE INTO provider_profiles (id,user_id,business_name,handle,verified_identity,verified_license,vehicle_documents_verified,vehicle_type,corridors,phone,city,about,public_visibility,created_at,city_place_ref,city_lat,city_lng) VALUES (?,?,?,?,0,0,0,?,?,?,?,?,'PUBLIC',?,?,?,?)`);
  const insertPage=db.prepare(`INSERT OR IGNORE INTO company_pages (id,organization_id,provider_profile_id,headline,about,services,corridors,operating_regions,contact_phone,show_contact_phone_on_loads,contact_email,published,updated_at,theme_primary,theme_accent,contact_whatsapp,contact_website,show_contact_phone,show_contact_whatsapp,show_contact_email,show_contact_website,youtube_video_id) VALUES (?,?,?,?,?,?,?,?,?,0,?,1,?,?,?,?,?,1,1,1,1,NULL)`);
  const insertVehicle=db.prepare(`INSERT OR IGNORE INTO vehicles (id,organization_id,provider_profile_id,platform_number,label,category,plate,active,make,model,cargo_configuration) VALUES (?,?,?,?,?,?,?,1,?,?,?)`);
  const insertDriver=db.prepare(`INSERT OR IGNORE INTO drivers (id,organization_id,user_id,name,phone,license_verified,active) VALUES (?,?,?,?,?,0,1)`);
  const insertPermission=db.prepare(`INSERT OR IGNORE INTO driver_permissions (user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,updated_by,updated_at) VALUES (?,0,0,0,1,?,?)`);
  const insertAssignment=db.prepare(`INSERT OR IGNORE INTO driver_vehicle_assignments (id,driver_user_id,vehicle_id,assigned_by,assigned_at,active) VALUES (?,?,?,?,?,1)`);
  const insertSubscription=db.prepare(`INSERT OR IGNORE INTO subscriptions (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at,updated_at) VALUES (?,?,?,?,'ACTIVE','FLAT_MONTHLY',?,?,?)`);
  const insertRoute=db.prepare(`INSERT OR IGNORE INTO profile_routes (id,organization_id,provider_profile_id,origin,destination,created_by,created_at,origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertCapacity=db.prepare(`INSERT OR IGNORE INTO capacities
    (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,location_lat,location_lng,location_precision_km,location_source,updated_by,updated_at,expires_at,movement_scope,location_area,location_place_ref,location_updated_at,accepts_full_load,accepts_partial_load,accepts_multi_pick,accepts_multi_drop,current_route_origin,current_route_destination,current_origin_place_ref,current_origin_lat,current_origin_lng,current_destination_place_ref,current_destination_lat,current_destination_lng,market_status,availability_geometry)
    VALUES (?,?,?,?,?,?,?,?,NULL,NULL,NULL,'OPEN',NULL,?,?,?,'DEVICE_OBSCURED',?,?,?,'BOTH',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertTrip=db.prepare(`INSERT OR IGNORE INTO next_trips (id,provider_organization_id,provider_profile_id,vehicle_id,origin,origin_place_ref,origin_lat,origin_lng,destination,destination_place_ref,destination_lat,destination_lng,travel_date,space_status,available_percent,published,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`);

  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare(`UPDATE company_pages SET show_contact_phone=CASE WHEN trim(COALESCE(contact_phone,''))<>'' THEN 1 ELSE 0 END,
      show_contact_email=CASE WHEN trim(COALESCE(contact_email,''))<>'' THEN 1 ELSE 0 END,
      contact_whatsapp=COALESCE(contact_whatsapp,contact_phone),show_contact_whatsapp=CASE WHEN trim(COALESCE(contact_phone,''))<>'' THEN 1 ELSE 0 END,
      theme_primary=COALESCE(theme_primary,'#075985'),theme_accent=COALESCE(theme_accent,'#f97316')
      WHERE organization_id IN (SELECT id FROM organizations WHERE type='TRANSPORT_COMPANY') OR provider_profile_id IS NOT NULL`).run();
    let capacityNumber=100;
    const addSignals=(owner,userId,vehicleId,index)=>{
      const home=places[index%places.length];
      const destination=places[(index*3+3)%places.length];
      const status=index%4===0?'EMPTY':'PARTIAL';
      const geometry=status==='PARTIAL'?'ROUTE':index%8===0?'RADIUS':'ROUTE';
      const percent=status==='EMPTY'?100:[25,40,55,70,85][index%5];
      const privacy=[3,5,10,20,40][index%5];
      const offset=((index%7)-3)*0.012;
      const routeOrigin=geometry==='ROUTE'?home:null;
      const routeDestination=geometry==='ROUTE'?destination:null;
      const capId=`cap-public-${capacityNumber++}`;
      insertCapacity.run(capId,owner.organizationId,owner.profileId,vehicleId,status,percent,null,null,home.lat+offset,home.lng-offset,privacy,userId,iso,expiresAt,`Around ${home.name}`,home.ref,iso,status==='EMPTY'?1:0,status==='PARTIAL'?1:0,index%3===1?1:0,index%4===1?1:0,routeOrigin?.name||null,routeDestination?.name||null,routeOrigin?.ref||null,routeOrigin?.lat||null,routeOrigin?.lng||null,routeDestination?.ref||null,routeDestination?.lat||null,routeDestination?.lng||null,status,geometry);
      db.prepare('UPDATE capacities SET work_radius_km=? WHERE id=?').run([15,25,40,60,100,150,250][index%7],capId);
      const tripOrigin=places[(index+1)%places.length],tripDestination=places[(index+5)%places.length];
      const travelDate=index%3===0?null:new Date(now.getTime()+((index%7)+1)*86_400_000).toISOString().slice(0,10);
      insertTrip.run(`trip-public-${vehicleId}`,owner.organizationId,owner.profileId,vehicleId,tripOrigin.name,tripOrigin.ref,tripOrigin.lat,tripOrigin.lng,tripDestination.name,tripDestination.ref,tripDestination.lat,tripDestination.lng,travelDate,index%2?'PARTIAL':'EMPTY',index%2?50:100,userId,iso);
    };

    companyNames.forEach((name,index)=>{
      const suffix=String(index+1).padStart(2,'0');const orgId=`org-public-fleet-${suffix}`,ownerId=`user-public-fleet-${suffix}`,driverId=`user-public-fleet-driver-${suffix}`,handle=`${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${suffix}`,home=places[index%places.length],theme=themes[index%themes.length];
      insertOrg.run(orgId,name,handle,`${name} publishes current truck capacity and operates provider-owned shipment tracking.`,`+2519117${suffix}000`,`dispatch@${handle}.local`,home.name,iso,home.ref,home.lat,home.lng);
      insertUser.run(ownerId,`owner-${suffix}@providers.loadgistic.test`,`+2519117${suffix}001`,passwordHash,`${name} Owner`,'TRANSPORTER',orgId,null,iso);
      insertUser.run(driverId,`driver-${suffix}@providers.loadgistic.test`,`+2519117${suffix}002`,passwordHash,`${name} Driver`,'DRIVER',orgId,null,iso);
      insertMember.run(`mem-public-owner-${suffix}`,ownerId,orgId,'OWNER');insertMember.run(`mem-public-driver-${suffix}`,driverId,orgId,'DRIVER');
      insertPage.run(`page-public-fleet-${suffix}`,orgId,null,'Reliable freight capacity for growing Ethiopian trade',`${name} is a demo fleet profile showing how transport companies can present current capacity, planned trips, and recurring corridors.`,`Full truckload; partial cargo space; regional road freight`,'',home.name,`+2519117${suffix}000`,`dispatch@${handle}.local`,iso,theme[0],theme[1],`+2519117${suffix}000`,`https://example.com/${handle}`);
      insertDriver.run(`driver-public-${suffix}`,orgId,driverId,`${name} Driver`,`+2519117${suffix}002`);insertPermission.run(driverId,ownerId,iso);
      insertSubscription.run(`sub-public-fleet-${suffix}`,orgId,null,'plan-transport',iso,subscriptionEnd,iso);
      for(let truckIndex=0;truckIndex<3;truckIndex++){
        const vehicle=trucks[(index+truckIndex)%trucks.length],vehicleId=`veh-public-fleet-${suffix}-${truckIndex+1}`,platform=`LG-TRK-F${suffix}${truckIndex+1}`;
        insertVehicle.run(vehicleId,orgId,null,platform,`Truck ${truckIndex+1}`,vehicle[2],`DEMO-F${suffix}-${truckIndex+1}`,vehicle[0],vehicle[1],vehicle[2]);
        insertAssignment.run(`assign-public-${suffix}-${truckIndex+1}`,driverId,vehicleId,ownerId,iso);
        addSignals({organizationId:orgId,profileId:null},driverId,vehicleId,index*3+truckIndex);
      }
      for(let routeIndex=0;routeIndex<2;routeIndex++){const origin=places[(index+routeIndex)%places.length],destination=places[(index+routeIndex+4)%places.length];insertRoute.run(`route-public-fleet-${suffix}-${routeIndex}`,orgId,null,origin.name,destination.name,ownerId,iso,origin.ref,origin.lat,origin.lng,destination.ref,destination.lat,destination.lng);}
    });

    ownerNames.forEach((person,index)=>{
      const suffix=String(index+1).padStart(2,'0'),profileId=`profile-public-owner-${suffix}`,userId=`user-public-owner-${suffix}`,handle=`${person.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-transport`,home=places[index%places.length],theme=themes[(index+3)%themes.length],vehicle=trucks[(index+2)%trucks.length],vehicleId=`veh-public-owner-${suffix}`;
      insertUser.run(userId,`owner-operator-${suffix}@providers.loadgistic.test`,`+2519228${suffix}000`,passwordHash,person,'DRIVER',null,profileId,iso);
      insertProfile.run(profileId,userId,`${person} Owner-Operator`,handle,vehicle[2],'',`+2519228${suffix}000`,home.name,`${person} is a demo self-managed owner-operator profile serving producers and businesses with directly managed truck capacity.`,iso,home.ref,home.lat,home.lng);
      insertPage.run(`page-public-owner-${suffix}`,null,profileId,'Owner-operated capacity with direct accountability',`${person} operates and manages this truck directly, publishes current availability, and keeps provider-side shipment history.`,`Owner-operated road freight; partial cargo space; regional routes`,'',home.name,`+2519228${suffix}000`,`contact@${handle}.local`,iso,theme[0],theme[1],`+2519228${suffix}000`,`https://example.com/${handle}`);
      insertVehicle.run(vehicleId,null,profileId,`LG-TRK-O${suffix}`,`${person.split(' ')[0]}'s truck`,vehicle[2],`DEMO-O${suffix}`,vehicle[0],vehicle[1],vehicle[2]);
      insertSubscription.run(`sub-public-owner-${suffix}`,null,profileId,'plan-solo',iso,subscriptionEnd,iso);
      addSignals({organizationId:null,profileId},userId,vehicleId,index+24);
      for(let routeIndex=0;routeIndex<2;routeIndex++){const origin=places[(index+routeIndex+2)%places.length],destination=places[(index+routeIndex+7)%places.length];insertRoute.run(`route-public-owner-${suffix}-${routeIndex}`,null,profileId,origin.name,destination.name,userId,iso,origin.ref,origin.lat,origin.lng,destination.ref,destination.lat,destination.lng);}
    });
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}

function enforcePartialRoutesAndSeedRecurringAreas(db) {
  db.exec(`
    UPDATE capacities SET
      availability_geometry='ROUTE',work_radius_km=NULL,
      current_route_origin=(SELECT t.origin FROM next_trips t WHERE t.vehicle_id=capacities.vehicle_id),
      current_origin_place_ref=(SELECT t.origin_place_ref FROM next_trips t WHERE t.vehicle_id=capacities.vehicle_id),
      current_origin_lat=(SELECT t.origin_lat FROM next_trips t WHERE t.vehicle_id=capacities.vehicle_id),
      current_origin_lng=(SELECT t.origin_lng FROM next_trips t WHERE t.vehicle_id=capacities.vehicle_id),
      current_route_destination=(SELECT t.destination FROM next_trips t WHERE t.vehicle_id=capacities.vehicle_id),
      current_destination_place_ref=(SELECT t.destination_place_ref FROM next_trips t WHERE t.vehicle_id=capacities.vehicle_id),
      current_destination_lat=(SELECT t.destination_lat FROM next_trips t WHERE t.vehicle_id=capacities.vehicle_id),
      current_destination_lng=(SELECT t.destination_lng FROM next_trips t WHERE t.vehicle_id=capacities.vehicle_id)
    WHERE COALESCE(market_status,status)='PARTIAL' AND availability_geometry='RADIUS'
      AND EXISTS (SELECT 1 FROM next_trips t WHERE t.vehicle_id=capacities.vehicle_id);

    UPDATE capacities SET status='OFF_DUTY',market_status='OFF_DUTY',available_percent=0,
      availability_geometry=NULL,work_radius_km=NULL
    WHERE COALESCE(market_status,status)='PARTIAL' AND availability_geometry<>'ROUTE';
  `);
  const providers=db.prepare(`SELECT cp.id,cp.organization_id,cp.provider_profile_id,
      COALESCE(o.city_place_ref,p.city_place_ref) place_ref,
      COALESCE(o.city,p.city) place_label,COALESCE(o.city_lat,p.city_lat) center_lat,
      COALESCE(o.city_lng,p.city_lng) center_lng,
      COALESCE((SELECT m.user_id FROM memberships m WHERE m.organization_id=o.id AND m.membership_role='OWNER' LIMIT 1),p.user_id) created_by
    FROM company_pages cp LEFT JOIN organizations o ON o.id=cp.organization_id
    LEFT JOIN provider_profiles p ON p.id=cp.provider_profile_id
    WHERE cp.published=1 AND COALESCE(o.city_place_ref,p.city_place_ref) IS NOT NULL`).all();
  const insert=db.prepare(`INSERT OR IGNORE INTO recurring_service_areas
    (id,organization_id,provider_profile_id,place_ref,place_label,center_lat,center_lng,radius_km,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const radii=[25,40,60,100,150,250,500];
  const createdAt=new Date().toISOString();
  providers.forEach((provider,index)=>insert.run(`recurring-area-${provider.id}`,provider.organization_id,provider.provider_profile_id,provider.place_ref,placeLabel(provider.place_label),provider.center_lat,provider.center_lng,radii[index%radii.length],provider.created_by,createdAt));
}

function qualifyExistingEthiopiaData(db) {
  const qualifySimpleColumns = [
    ['organizations','city'],
    ['provider_profiles','city'],
    ['profile_routes','origin'],
    ['profile_routes','destination'],
    ['shipments','origin'],
    ['shipments','destination'],
    ['capacities','origin'],
    ['capacities','destination'],
    ['capacities','current_route_origin'],
    ['capacities','current_route_destination']
  ];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [table,column] of qualifySimpleColumns) {
      const rows=db.prepare(`SELECT id,${column} AS value FROM ${table} WHERE ${column} IS NOT NULL AND trim(${column})<>''`).all();
      const update=db.prepare(`UPDATE ${table} SET ${column}=? WHERE id=?`);
      for(const row of rows) {
        const qualified=placeLabel(row.value);
        if(qualified!==row.value)update.run(qualified,row.id);
      }
    }
    for (const [table,column] of [['capacities','location_area'],['shipment_events','location_area']]) {
      const rows=db.prepare(`SELECT id,${column} AS value FROM ${table} WHERE ${column} IS NOT NULL AND trim(${column})<>''`).all();
      const update=db.prepare(`UPDATE ${table} SET ${column}=? WHERE id=?`);
      for(const row of rows) {
        const qualified=qualifyAreaLabel(row.value);
        if(qualified!==row.value)update.run(qualified,row.id);
      }
    }
    const pages=db.prepare('SELECT id,corridors,operating_regions FROM company_pages').all();
    const updatePage=db.prepare('UPDATE company_pages SET corridors=?,operating_regions=? WHERE id=?');
    for(const page of pages) {
      const corridors=qualifyCorridorList(page.corridors);
      const regions=qualifyPlaceList(page.operating_regions);
      if(corridors!==page.corridors||regions!==page.operating_regions)updatePage.run(corridors,regions,page.id);
    }
    const profiles=db.prepare('SELECT id,corridors FROM provider_profiles').all();
    const updateProfile=db.prepare('UPDATE provider_profiles SET corridors=? WHERE id=?');
    for(const profile of profiles) {
      const corridors=qualifyCorridorList(profile.corridors);
      if(corridors!==profile.corridors)updateProfile.run(corridors,profile.id);
    }
    const capacities=db.prepare('SELECT id,origin,destination,corridor FROM capacities').all();
    const updateCapacity=db.prepare('UPDATE capacities SET corridor=? WHERE id=?');
    for(const capacity of capacities) {
      const corridor=capacity.origin&&capacity.destination?`${capacity.origin} ↔ ${capacity.destination}`:null;
      if(corridor!==capacity.corridor)updateCapacity.run(corridor,capacity.id);
    }
    db.prepare(`UPDATE capacities
      SET planned_space_status=CASE WHEN status='PARTIAL' THEN 'PARTIAL' ELSE 'FULL' END
      WHERE status IN ('EMPTY','PARTIAL') AND origin IS NOT NULL AND destination IS NOT NULL
        AND (planned_space_status IS NULL OR trim(planned_space_status)='')`).run();
    db.prepare("UPDATE place_catalog SET country_name='Ethiopia',country_code='ET' WHERE country_name IS NULL OR trim(country_name)='' OR country_code IS NULL OR trim(country_code)=''").run();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (count > 0) return;

  const now = new Date();
  const iso = now.toISOString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayThree = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayFour = new Date(now.getTime() + 96 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayFive = new Date(now.getTime() + 120 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expiresFresh = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const passwordHash = hashPassword('Loadgistic123!');

  const orgs = {
    shipper: { id: 'org-shipper', name: 'Blue Nile Trading PLC', handle: 'blue-nile-trading', type: 'ENTERPRISE_SHIPPER', city: 'Addis Ababa' },
    receiver: { id: 'org-receiver', name: 'Fresh Foods Distribution PLC', handle: 'fresh-foods-distribution', type: 'ENTERPRISE_RECEIVER', city: 'Hawassa' },
    transporter: { id: 'org-transporter', name: 'BlueLine Transport PLC', handle: 'blueline-transport', type: 'TRANSPORT_COMPANY', city: 'Addis Ababa' },
    expired: { id: 'org-expired', name: 'Expired Trial Workshop', handle: 'expired-trial-workshop', type: 'ENTERPRISE_SHIPPER', city: 'Adama' }
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
    ['user-support','support@loadgistic.local','Hana Support','SUPPORT',null,null],
    ['user-shipper','shipper@loadgistic.local','Selam Tesfaye','SHIPPER',orgs.shipper.id,null],
    ['user-receiver','receiver@loadgistic.local','Marta Alemu','RECEIVER',orgs.receiver.id,null],
    ['user-transporter','transporter@loadgistic.local','Samuel Tesfaye','TRANSPORTER',orgs.transporter.id,null],
    ['user-company-driver','company-driver@loadgistic.local','Yonas Alemu','DRIVER',orgs.transporter.id,null],
    ['user-company-driver-2','company-driver-2@loadgistic.local','Dawit Bekele','DRIVER',orgs.transporter.id,null],
    ['user-driver','driver@loadgistic.local','Abebe Kebede','DRIVER',null,'provider-driver',1],
    ['user-applicant','signup-member@fixtures.loadgistic.test','Liya Bekele','RECEIVER',orgs.receiver.id,null,1],
    ['user-expired','expired@loadgistic.local','Meron Desta','SHIPPER',orgs.expired.id,null]
  ];
  const insertUser = db.prepare(`INSERT INTO users
    (id,email,phone,password_hash,name,role,organization_id,provider_profile_id,active,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const user of users) insertUser.run(user[0],user[1],'+251 900 000 000',passwordHash,user[2],user[3],user[4],user[5],user[6] ?? 1,iso);

  db.prepare(`INSERT INTO support_agent_profiles
    (user_id,active,available,max_open_conversations,last_assigned_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run('user-support',1,1,3,iso,iso,iso);

  const insertMembership = db.prepare('INSERT INTO memberships (id,user_id,organization_id,membership_role) VALUES (?,?,?,?)');
  insertMembership.run(randomId('mem-'),'user-shipper',orgs.shipper.id,'OWNER');
  insertMembership.run(randomId('mem-'),'user-receiver',orgs.receiver.id,'OWNER');
  insertMembership.run(randomId('mem-'),'user-transporter',orgs.transporter.id,'OWNER');
  insertMembership.run(randomId('mem-'),'user-company-driver',orgs.transporter.id,'DRIVER');
  insertMembership.run(randomId('mem-'),'user-company-driver-2',orgs.transporter.id,'DRIVER');
  insertMembership.run(randomId('mem-'),'user-applicant',orgs.receiver.id,'MEMBER');
  insertMembership.run(randomId('mem-'),'user-expired',orgs.expired.id,'OWNER');

  db.prepare(`INSERT INTO provider_profiles
    (id,user_id,business_name,handle,verified_identity,verified_license,vehicle_documents_verified,vehicle_type,corridors,phone,city,about,public_visibility,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('provider-driver','user-driver','Abebe Owner-Operator','abebe-owner-operator',1,1,1,'Light Stake Body Truck','Addis Ababa ↔ Dire Dawa; Addis Ababa ↔ Hawassa','+251 911 234 567','Addis Ababa','Independent owner-operator serving business shippers on major Ethiopian corridors.','PUBLIC',iso);

  const relationshipInsert=db.prepare(`INSERT INTO partner_relationships
    (id,owner_organization_id,provider_organization_id,provider_profile_id,status,requested_by_side,business_favorite,provider_favorite,created_at,updated_at,responded_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  relationshipInsert.run('partner-1',orgs.shipper.id,orgs.transporter.id,null,'CONNECTED','BUSINESS',1,1,iso,iso,iso);
  relationshipInsert.run('partner-2',orgs.shipper.id,null,'provider-driver','CONNECTED','PROVIDER',1,1,iso,iso,iso);
  relationshipInsert.run('partner-3',orgs.receiver.id,orgs.transporter.id,null,'PENDING','BUSINESS',1,0,iso,iso,null);
  db.prepare(`INSERT INTO member_favorites (id,owner_organization_id,target_organization_id,created_by,created_at) VALUES (?,?,?,?,?)`)
    .run('favorite-blue-nile-fresh-foods',orgs.shipper.id,orgs.receiver.id,'user-shipper',iso);

  const insertPage = db.prepare(`INSERT INTO company_pages
    (id,organization_id,provider_profile_id,headline,about,services,corridors,operating_regions,contact_phone,show_contact_phone_on_loads,contact_email,published,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insertPage.run('page-shipper',orgs.shipper.id,null,'Locally made goods for regional buyers','Small manufacturer using trusted freight partners for B2B shipping.','Woven home goods; packaged products','Addis Ababa; Dire Dawa; Hawassa','Addis Ababa; Adama; Dire Dawa','+251 911 111 111',1,'logistics@blue-nile.local',1,iso);
  insertPage.run('page-receiver',orgs.receiver.id,null,'Reliable receiving operations','Distribution business receiving goods from enterprise suppliers.','Food distribution; wholesale receiving','Hawassa; Addis Ababa','Hawassa; Shashamane; Addis Ababa','+251 911 222 222',0,'receiving@fresh-foods.local',1,iso);
  insertPage.run('page-transporter',orgs.transporter.id,null,'Road freight for Ethiopian businesses','Transport company serving business freight on major domestic corridors.','FTL and shared-capacity freight','Addis Ababa ↔ Dire Dawa; Addis Ababa ↔ Mekelle; Addis Ababa ↔ Hawassa','Addis Ababa; Dire Dawa; Mekelle; Hawassa','+251 911 444 444',0,'dispatch@blueline.local',1,iso);
  insertPage.run('page-driver',null,'provider-driver','Independent freight capacity','Owner-operated truck available for direct and open B2B shipments.','FTL and partial-capacity freight','Addis Ababa ↔ Dire Dawa; Addis Ababa ↔ Hawassa','Addis Ababa; Dire Dawa; Hawassa','+251 911 234 567',0,'abebe@owneroperator.local',1,iso);

  const vehicleInsert = db.prepare(`INSERT INTO vehicles (id,organization_id,provider_profile_id,label,category,plate,active,make,model,cargo_configuration) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  vehicleInsert.run('veh-trans-1',orgs.transporter.id,null,'Truck 01','Medium Box Truck','AA-3-10001',1,'Isuzu','FSR','Medium Box Truck');
  vehicleInsert.run('veh-trans-2',orgs.transporter.id,null,'Truck 02','Heavy Rigid Stake Body Truck','AA-3-10002',1,'Sinotruk','HOWO TX','Heavy Rigid Stake Body Truck');
  vehicleInsert.run('veh-driver-1',null,'provider-driver','My truck','Light Stake Body Truck','AA-2-44001',1,'Isuzu','NPR','Light Stake Body Truck');
  db.prepare(`INSERT INTO drivers (id,organization_id,user_id,name,phone,license_verified,active) VALUES (?,?,?,?,?,?,?)`)
    .run('driver-company-1',orgs.transporter.id,'user-company-driver','Yonas Alemu','+251 911 555 001',1,1);
  db.prepare(`INSERT INTO drivers (id,organization_id,user_id,name,phone,license_verified,active) VALUES (?,?,?,?,?,?,?)`)
    .run('driver-company-2',orgs.transporter.id,'user-company-driver-2','Dawit Bekele','+251 911 555 002',1,1);
  db.prepare(`INSERT INTO driver_permissions
    (user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,updated_by,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run('user-company-driver',1,1,1,1,'user-transporter',iso);
  db.prepare(`INSERT INTO driver_permissions
    (user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,updated_by,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run('user-company-driver-2',1,1,1,1,'user-transporter',iso);
  db.prepare(`INSERT INTO driver_vehicle_assignments
    (id,driver_user_id,vehicle_id,assigned_by,assigned_at,active) VALUES (?,?,?,?,?,1)`)
    .run('driver-vehicle-company-1','user-company-driver','veh-trans-1','user-transporter',iso);
  db.prepare(`INSERT INTO driver_vehicle_assignments
    (id,driver_user_id,vehicle_id,assigned_by,assigned_at,active) VALUES (?,?,?,?,?,1)`)
    .run('driver-vehicle-company-2','user-company-driver-2','veh-trans-2','user-transporter',iso);

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
  const serviceAreaInsert=db.prepare(`INSERT INTO service_areas
    (id,organization_id,provider_profile_id,place_ref,place_label,center_lat,center_lng,radius_km,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  serviceAreaInsert.run('area-shipper-addis',orgs.shipper.id,null,'builtin:addis ababa','Addis Ababa, Ethiopia',9.03,38.74,40,'user-shipper',iso);
  serviceAreaInsert.run('area-receiver-hawassa',orgs.receiver.id,null,'builtin:hawassa','Hawassa, Ethiopia',7.06,38.48,35,'user-receiver',iso);
  serviceAreaInsert.run('area-transporter-addis',orgs.transporter.id,null,'builtin:addis ababa','Addis Ababa, Ethiopia',9.03,38.74,60,'user-transporter',iso);
  serviceAreaInsert.run('area-driver-addis',null,'provider-driver','builtin:addis ababa','Addis Ababa, Ethiopia',9.03,38.74,30,'user-driver',iso);

  const capacityInsert = db.prepare(`INSERT INTO capacities
    (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  capacityInsert.run('cap-empty',orgs.transporter.id,null,'veh-trans-1','EMPTY',100,'Addis Ababa','Dire Dawa','Addis Ababa ↔ Dire Dawa',tomorrow,'Today 16:00','OPEN',null,'user-transporter',iso,expiresFresh,'Around Addis Ababa',iso,9,38.5,40,'DEVICE_OBSCURED');
  capacityInsert.run('cap-partial',null,'provider-driver','veh-driver-1','PARTIAL',40,'Addis Ababa','Hawassa','Addis Ababa ↔ Hawassa',null,'Ready now','OPEN',null,'user-driver',iso,expiresFresh,'Around Addis Ababa',iso,9,38.5,40,'DEVICE_OBSCURED');
  capacityInsert.run('cap-partner-partial',orgs.transporter.id,null,'veh-trans-2','PARTIAL',25,'Mekelle','Addis Ababa','Mekelle ↔ Addis Ababa',null,'After current delivery','SAVED_PARTNERS',null,'user-transporter',iso,expiresFresh,'Around Mekelle',iso,13.5,39.5,40,'DEVICE_OBSCURED');
  db.prepare(`UPDATE capacities SET movement_scope='BOTH',local_place_ref='builtin:addis ababa',
    local_place_label='Addis Ababa, Ethiopia',local_center_lat=9.03,local_center_lng=38.74,local_radius_km=40
    WHERE id='cap-partial'`).run();
  db.prepare(`UPDATE capacities SET current_route_origin='Addis Ababa',current_route_destination='Hawassa',
    current_origin_place_ref='builtin:addis ababa',current_origin_lat=9.03,current_origin_lng=38.74,
    current_destination_place_ref='builtin:hawassa',current_destination_lat=7.06,current_destination_lng=38.48,
    current_route_date=NULL WHERE id='cap-partial'`).run();
  db.prepare(`UPDATE capacities SET current_route_origin='Mekelle',current_route_destination='Addis Ababa',
    current_origin_place_ref='builtin:mekelle',current_origin_lat=13.50,current_origin_lng=39.47,
    current_destination_place_ref='builtin:addis ababa',current_destination_lat=9.03,current_destination_lng=38.74,
    current_route_date=NULL WHERE id='cap-partner-partial'`).run();

  const shipmentInsert = db.prepare(`INSERT INTO shipments
    (id,code,title,service_mode,distribution_mode,price_mode,price_minor,target_price_minor,shipper_organization_id,receiver_organization_id,provider_organization_id,provider_profile_id,origin,destination,cargo_description,package_count,estimated_weight,vehicle_category,load_type,receiver_first_name,receiver_phone,pickup_date,delivery_date,commercial_status,operational_status,tracking_mode,tracking_code_hash,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const seededShipments = [
    ['shp-freight-fixed','LGX-F2001','Beverage shipment to Dire Dawa','FREIGHT','OPEN_MARKET','FIXED_PRICE',4850000,null,orgs.shipper.id,orgs.receiver.id,null,null,'Addis Ababa','Dire Dawa','Palletized beverages',120,18000,'Medium Box Truck','FTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-freight-quote','LGX-F2002','Construction materials to Mekelle','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.shipper.id,null,null,null,'Addis Ababa','Mekelle','Bagged building materials',400,20000,'Heavy Rigid Stake Body Truck','FTL',null,null,dayAfter,null,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-freight-target','LGX-F2003','Packaged food to Hawassa','FREIGHT','SAVED_PARTNERS','TARGET_PRICE',null,3500000,orgs.shipper.id,orgs.receiver.id,null,null,'Addis Ababa','Hawassa','Packaged food cartons',250,9000,'Medium Box Truck','PTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-freight-active','LGX-F2004','Industrial supplies to Dire Dawa','FREIGHT','DIRECT_TO_PROVIDER','FIXED_PRICE',5200000,null,orgs.shipper.id,orgs.receiver.id,orgs.transporter.id,null,'Addis Ababa','Dire Dawa','Industrial supplies',80,19000,'Heavy Rigid Stake Body Truck','FTL','Marta','+251 911 222 222',tomorrow,dayAfter,'AGREED','IN_TRANSIT','LOCATION_AND_STATUS','user-shipper'],
    ['shp-pstl-baskets','LGX-F2005','Woven baskets for Hawassa shops','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.shipper.id,orgs.receiver.id,null,null,'Addis Ababa','Hawassa','Packed woven baskets from a local artisan workshop',1,null,'Mini Box Truck','PTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-pstl-coffee','LGX-F2006','Roasted coffee cartons to Shashamane','FREIGHT','OPEN_MARKET','TARGET_PRICE',null,1800000,orgs.shipper.id,null,null,null,'Addis Ababa','Shashamane','Sealed coffee cartons from a small local roaster',1,null,'Light Box Truck','PTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-freight-completed','LGX-F2007','Handwoven goods to Adama','FREIGHT','DIRECT_TO_PROVIDER','FIXED_PRICE',2100000,null,orgs.shipper.id,orgs.receiver.id,orgs.transporter.id,null,'Addis Ababa','Adama','Packed handwoven home goods',24,null,'Mini Box Truck','PTL','Marta','+251 911 222 222',tomorrow,dayAfter,'AGREED','COMPLETED','STATUS_ONLY','user-shipper'],
    ['shp-local-addis','LGX-F2008','Workshop supplies across Addis','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.shipper.id,null,null,null,'Addis Ababa','Addis Ababa','Packed workshop supplies for a local maker',12,null,'Mini Box Truck','PTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-driver-direct','LGX-F2009','Coffee cartons for Abebe','FREIGHT','DIRECT_TO_PROVIDER','QUOTE_REQUESTED',null,null,orgs.shipper.id,orgs.receiver.id,null,'provider-driver','Addis Ababa','Hawassa','Sealed coffee cartons for owner-operator delivery',36,null,'Light Stake Body Truck','PTL',null,null,tomorrow,dayAfter,'SENT','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-transporter-direct','LGX-F2010','Beverage restock for BlueLine','FREIGHT','DIRECT_TO_PROVIDER','TARGET_PRICE',null,4200000,orgs.shipper.id,orgs.receiver.id,orgs.transporter.id,null,'Addis Ababa','Dire Dawa','Palletized local beverage restock',48,null,'Medium Box Truck','FTL',null,null,tomorrow,dayAfter,'SENT','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-pstl-honey','LGX-F2011','Honey jars for Hawassa retailers','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.shipper.id,orgs.receiver.id,null,null,'Addis Ababa','Hawassa','Packed jars from a small honey producer',1,null,'Mini Box Truck','PTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-pstl-leather','LGX-F2012','Leather goods for Shashamane shops','FREIGHT','OPEN_MARKET','TARGET_PRICE',null,1600000,orgs.shipper.id,null,null,null,'Addis Ababa','Shashamane','Boxed finished goods from a local workshop',1,null,'Light Box Truck','PTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-route-addis-bishoftu','LGX-F2013','Metalwork order to Bishoftu','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.shipper.id,null,null,null,'Addis Ababa','Bishoftu','Protected metalwork from a small fabricator',1,null,'Light Stake Body Truck','FTL',null,null,tomorrow,dayAfter,'POSTED','POSTED','STATUS_ONLY','user-shipper'],
    ['shp-route-bishoftu-adama','LGX-F2014','Dairy cartons to Adama','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.receiver.id,null,null,null,'Bishoftu','Adama','Chilled cartons from a growing local processor',1,null,'Medium Box Truck','PTL',null,null,dayAfter,dayThree,'POSTED','POSTED','STATUS_ONLY','user-receiver'],
    ['shp-route-adama-shashamane','LGX-F2015','Milled grain to Shashamane','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.receiver.id,null,null,null,'Adama','Shashamane','Bagged grain from an independent mill',1,null,'Medium Stake Body Truck','FTL',null,null,dayThree,dayFour,'POSTED','POSTED','STATUS_ONLY','user-receiver'],
    ['shp-route-shashamane-hawassa','LGX-F2016','Farm inputs to Hawassa','FREIGHT','OPEN_MARKET','QUOTE_REQUESTED',null,null,orgs.receiver.id,orgs.shipper.id,null,null,'Shashamane','Hawassa','Packed farm inputs for local growers',1,null,'Light Stake Body Truck','PTL',null,null,dayFour,dayFive,'POSTED','POSTED','STATUS_ONLY','user-receiver'],
    ['shp-tracking-setup','LGX-F2017','Furniture shipment ready for assignment','FREIGHT','DIRECT_TO_PROVIDER','QUOTE_REQUESTED',null,null,orgs.shipper.id,orgs.receiver.id,orgs.transporter.id,null,'Addis Ababa','Adama','Finished furniture from a growing local workshop',18,null,'Medium Box Truck','FTL','Marta','+251 911 222 222',tomorrow,dayAfter,'AGREED','AGREED','STATUS_ONLY','user-shipper']
  ];
  for (const s of seededShipments) {
    const createdBy = s.at(-1);
    shipmentInsert.run(...s.slice(0,-1),hashTrackingAccessCode(trackingAccessCode(s[0])),createdBy,iso,iso);
  }
  db.exec(`UPDATE shipments SET
    load_owner_organization_id=COALESCE(load_owner_organization_id,shipper_organization_id),
    load_owner_party_role=COALESCE(load_owner_party_role,'SHIPPER')`);
  db.prepare(`UPDATE shipments SET movement_scope='LOCAL',local_place_ref='builtin:addis ababa',
    local_place_label='Addis Ababa, Ethiopia',local_center_lat=9.03,local_center_lng=38.74,
    pickup_area_label='Bole',dropoff_area_label='Saris'
    WHERE id='shp-local-addis'`).run();
  db.prepare(`UPDATE shipments SET assigned_vehicle_id='veh-trans-1',assigned_driver_user_id='user-company-driver'
    WHERE id IN ('shp-freight-active','shp-freight-completed')`).run();
  const interestInsert=db.prepare(`INSERT INTO shipment_interests
    (id,shipment_id,provider_organization_id,provider_profile_id,status,note,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?)`);
  interestInsert.run('interest-abebe-open','shp-freight-fixed',null,'provider-driver','INTERESTED','Available for this route.','user-driver',iso);
  interestInsert.run('interest-blueline-open','shp-freight-quote',orgs.transporter.id,null,'INTERESTED','Fleet can quote this movement.','user-transporter',iso);

  const eventInsert = db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,created_by,public,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  for (const s of seededShipments) {
    if (!['shp-freight-active','shp-freight-completed','shp-tracking-setup'].includes(s[0])) eventInsert.run(randomId('evt-'),s[0],s[24],'CREATED','Shipment created in Loadgistic',s[26],1,iso);
  }
  eventInsert.run(randomId('evt-'),'shp-freight-active','SENT','CREATED','Direct request sent by Blue Nile Trading','user-shipper',1,new Date(now.getTime()-6*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-freight-active','AGREED','STATUS','Business and transporter agreed to the shipment','user-transporter',1,new Date(now.getTime()-5*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-freight-active','ASSIGNED','STATUS','Loading started','user-transporter',1,new Date(now.getTime()-3*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-freight-active','IN_TRANSIT','STATUS','Truck departed Addis Ababa','user-transporter',1,new Date(now.getTime()-90*60*1000).toISOString());
  db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,public,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(randomId('evt-'),'shp-freight-active','IN_TRANSIT','LOCATION','Automatic device location','Around Addis Ababa',9,38.5,40,'DEVICE_OBSCURED','user-company-driver',1,new Date(now.getTime()-60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-freight-completed','SENT','CREATED','Shipment posted by Blue Nile Trading','user-shipper',1,new Date(now.getTime()-72*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-freight-completed','AGREED','STATUS','Businesses and transporter agreed to the shipment','user-transporter',1,new Date(now.getTime()-48*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-freight-completed','COMPLETED','STATUS','Delivery completed and received','user-transporter',1,new Date(now.getTime()-24*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-tracking-setup','SENT','CREATED','Direct request sent by Blue Nile Trading','user-shipper',1,new Date(now.getTime()-4*60*60*1000).toISOString());
  eventInsert.run(randomId('evt-'),'shp-tracking-setup','AGREED','STATUS','Business and transporter agreed to the shipment','user-transporter',1,new Date(now.getTime()-2*60*60*1000).toISOString());

  db.prepare(`INSERT INTO business_reviews
    (id,shipment_id,reviewer_organization_id,subject_organization_id,rating,note,status,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('review-pending-demo','shp-freight-completed',orgs.shipper.id,orgs.receiver.id,2,'Two cartons arrived damaged. Please investigate the receiving record.','PENDING','user-shipper',new Date(now.getTime()-20*60*60*1000).toISOString());

  const verificationInsert = db.prepare(`INSERT INTO verification_requests
    (id,subject_type,subject_id,verification_type,document_name,file_path,original_name,mime_type,status,submitted_by,reviewed_by,review_note,submitted_at,reviewed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const demoDocument = path.resolve(process.cwd(),'public/vehicle-configurations/cargo-van.jpg');
  const seededVerifications = [
    ['verification-business-id','ORGANIZATION',orgs.shipper.id,'IDENTITY','Owner national identity','user-shipper'],
    ['verification-business-license','ORGANIZATION',orgs.shipper.id,'BUSINESS_LICENSE','Business license','user-shipper'],
    ['verification-business-address','ORGANIZATION',orgs.shipper.id,'BUSINESS_ADDRESS','Business address proof','user-shipper'],
    ['verification-receiver-id','ORGANIZATION',orgs.receiver.id,'IDENTITY','Owner national identity','user-receiver'],
    ['verification-transporter-id','ORGANIZATION',orgs.transporter.id,'IDENTITY','Owner national identity','user-transporter'],
    ['verification-transporter-license','ORGANIZATION',orgs.transporter.id,'BUSINESS_LICENSE','Transport business license','user-transporter'],
    ['verification-transporter-address','ORGANIZATION',orgs.transporter.id,'BUSINESS_ADDRESS','Transport business address proof','user-transporter'],
    ['verification-driver-id','PROVIDER_PROFILE','provider-driver','IDENTITY','National identity','user-driver'],
    ['verification-driver-license','PROVIDER_PROFILE','provider-driver','DRIVER_IDENTITY','Driver license','user-driver'],
    ['verification-company-driver-id','DRIVER','user-company-driver','IDENTITY','Driver national identity','user-transporter'],
    ['verification-company-driver-license','DRIVER','user-company-driver','DRIVER_IDENTITY','Driver license','user-transporter'],
    ['verification-truck-1','VEHICLE','veh-trans-1','VEHICLE_OWNERSHIP','Vehicle ownership','user-transporter'],
    ['verification-truck-driver','VEHICLE','veh-driver-1','VEHICLE_OWNERSHIP','Vehicle ownership','user-driver']
  ];
  for (const item of seededVerifications) {
    verificationInsert.run(item[0],item[1],item[2],item[3],item[4],demoDocument,'Demo verification record.jpg','image/jpeg','APPROVED',item[5],'user-admin','Approved demo fixture',iso,iso);
  }
  const authorizationExpiry=new Date(now.getTime()+365*86_400_000).toISOString().slice(0,10);
  db.prepare(`INSERT INTO verification_requests
    (id,subject_type,subject_id,verification_type,related_vehicle_id,expires_on,document_name,file_path,original_name,mime_type,status,submitted_by,reviewed_by,review_note,submitted_at,reviewed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,'APPROVED',?,?,?, ?,?)`)
    .run('verification-company-driver-truck','DRIVER','user-company-driver','VEHICLE_AUTHORIZATION','veh-trans-1',authorizationExpiry,'Truck authorization',demoDocument,'Demo verification record.jpg','image/jpeg','user-transporter','user-admin','Approved demo fixture',iso,iso);
  db.prepare(`INSERT INTO verification_requests
    (id,subject_type,subject_id,verification_type,related_vehicle_id,expires_on,document_name,file_path,original_name,mime_type,status,submitted_by,reviewed_by,review_note,submitted_at,reviewed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,'APPROVED',?,?,?, ?,?)`)
    .run('verification-owner-driver-truck','PROVIDER_PROFILE','provider-driver','VEHICLE_AUTHORIZATION','veh-driver-1',authorizationExpiry,'Truck authorization',demoDocument,'Demo verification record.jpg','image/jpeg','user-driver','user-admin','Approved demo fixture',iso,iso);

  const planInsert = db.prepare('INSERT INTO plans (id,code,name,audience,active) VALUES (?,?,?,?,1)');
  planInsert.run('plan-business','BUSINESS_CAPACITY','Business Capacity','BUSINESS');
  planInsert.run('plan-transport','FLEET_DEMAND','Fleet Transporter Demand','TRANSPORTER');
  planInsert.run('plan-solo','SELF_MANAGED_DRIVER','Self-managed Driver Demand','DRIVER');
  const paidEndsAt = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const expiredAt = new Date(now.getTime() - 86_400_000).toISOString();
  const expiredStartedAt = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const subInsert = db.prepare(`INSERT INTO subscriptions (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  subInsert.run('sub-shipper',orgs.shipper.id,null,'plan-business','ACTIVE','FLAT_MONTHLY',iso,paidEndsAt,iso);
  subInsert.run('sub-receiver',orgs.receiver.id,null,'plan-business','ACTIVE','FLAT_MONTHLY',iso,paidEndsAt,iso);
  subInsert.run('sub-transporter',orgs.transporter.id,null,'plan-transport','ACTIVE','FLAT_MONTHLY',iso,paidEndsAt,iso);
  subInsert.run('sub-driver',null,'provider-driver','plan-solo','ACTIVE','FLAT_MONTHLY',iso,paidEndsAt,iso);
  subInsert.run('sub-expired',orgs.expired.id,null,'plan-business','TRIAL','FLAT_MONTHLY',expiredStartedAt,expiredAt,expiredAt);

  db.prepare(`INSERT INTO applications (id,user_id,business_name,application_type,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run('app-self-signup','user-applicant','Fresh Foods Distribution PLC','ENTERPRISE_RECEIVER','APPROVED','Workspace created by self-service signup.',iso,iso);

  const notify = db.prepare(`INSERT INTO notifications (id,user_id,title,body,read_at,created_at) VALUES (?,?,?,?,?,?)`);
  notify.run(randomId('ntf-'),'user-transporter','New open freight shipment','A fixed-price shipment is available from Addis Ababa to Dire Dawa.',null,iso);
  notify.run(randomId('ntf-'),'user-admin','Low Business rating needs review','A 2-star rating for Fresh Foods Distribution on LGX-F2007 is waiting in Rating Reviews.',null,iso);

  const supportCreatedAt=new Date(now.getTime()-50*60*1000).toISOString();
  const supportReplyAt=new Date(now.getTime()-42*60*1000).toISOString();
  db.prepare(`INSERT INTO support_conversations
    (id,customer_user_id,assigned_agent_user_id,category,status,created_at,updated_at,last_message_at,assigned_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('support-demo-open','user-receiver','user-support','PAYMENT','OPEN',supportCreatedAt,supportReplyAt,supportReplyAt,supportCreatedAt);
  const supportMessageInsert=db.prepare(`INSERT INTO support_messages
    (id,conversation_id,sender_user_id,body,created_at) VALUES (?,?,?,?,?)`);
  supportMessageInsert.run('support-message-demo-1','support-demo-open','user-receiver','My payment proof is still waiting for review.',supportCreatedAt);
  supportMessageInsert.run('support-message-demo-2','support-demo-open','user-support','I found it in the review queue. We will update you here.',supportReplyAt);
  db.prepare(`INSERT INTO support_events
    (id,conversation_id,actor_user_id,event_type,details,created_at) VALUES (?,?,?,?,?,?)`)
    .run('support-event-demo-assigned','support-demo-open',null,'ASSIGNED',JSON.stringify({agentUserId:'user-support'}),supportCreatedAt);
}
