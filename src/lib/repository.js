import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db.js';
import {
  USER_ROLES,
  SERVICE_MODES,
  DISTRIBUTION_MODES,
  PRICE_MODES,
  validatePriceMode,
  validateCapacity,
  assertTransition,
  capacityFreshness,
  roleCanCreateShipment,
  roleCanPublishCapacity,
  roleCanBrowseLoads,
  roleCanOperateParcel
} from './domain.js';
import { randomCode, randomId, opaqueToken, hashPassword } from './security.js';

function nowIso() {
  return new Date().toISOString();
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function audit(db, user, action, entityType, entityId, details = {}) {
  db.prepare(`INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(randomId('aud-'), user?.id || null, user?.organization_id || null, action, entityType, entityId, JSON.stringify(details), nowIso());
}

function notify(db, userId, title, body) {
  db.prepare(`INSERT INTO notifications (id,user_id,title,body,read_at,created_at) VALUES (?,?,?,?,?,?)`)
    .run(randomId('ntf-'), userId, title, body, null, nowIso());
}

export function getUserById(id) {
  return getDb().prepare(`
    SELECT u.*, o.name AS organization_name, o.handle AS organization_handle, o.type AS organization_type,
           p.business_name AS provider_business_name, p.handle AS provider_handle
    FROM users u
    LEFT JOIN organizations o ON o.id = u.organization_id
    LEFT JOIN provider_profiles p ON p.id = u.provider_profile_id
    WHERE u.id = ?
  `).get(id) || null;
}

export function findUserByEmail(email) {
  return getDb().prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) || null;
}

export function listDemoUsers() {
  return getDb().prepare(`SELECT email,name,role FROM users WHERE email LIKE '%@loadgistic.local' ORDER BY role`).all();
}

export function listNotifications(user) {
  return getDb().prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`).all(user.id);
}

export function getDashboard(user) {
  const db = getDb();
  const data = { role: user.role, actions: [], counts: {}, recent: [], capacities: [], notifications: listNotifications(user) };
  if (user.role === USER_ROLES.ADMIN) {
    data.counts = {
      Applications: db.prepare(`SELECT COUNT(*) AS n FROM applications WHERE status='PENDING'`).get().n,
      Organizations: db.prepare('SELECT COUNT(*) AS n FROM organizations').get().n,
      Shipments: db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n,
      'Fresh Capacity': db.prepare(`SELECT COUNT(*) AS n FROM capacities WHERE expires_at > ?`).get(nowIso()).n
    };
    data.actions = [
      { href: '/admin/applications', label: 'Review applications', description: 'Approve or request more information.' },
      { href: '/companies', label: 'View company directory', description: 'Inspect public provider pages.' }
    ];
    data.recent = db.prepare('SELECT code,title,service_mode,operational_status,origin,destination,created_at FROM shipments ORDER BY created_at DESC LIMIT 6').all();
    return data;
  }

  if (user.role === USER_ROLES.SHIPPER || user.role === USER_ROLES.RECEIVER) {
    const condition = 'shipper_organization_id = ? OR receiver_organization_id = ?';
    data.counts = {
      'Active Shipments': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE (${condition}) AND operational_status NOT IN ('COMPLETED','CANCELLED','RETURNED')`).get(user.organization_id,user.organization_id).n,
      'Open Requests': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE (${condition}) AND commercial_status IN ('POSTED','SENT','CONTACTED')`).get(user.organization_id,user.organization_id).n,
      'Saved Providers': db.prepare(`SELECT COUNT(*) AS n FROM partner_relationships WHERE owner_organization_id = ?`).get(user.organization_id).n,
      'Recent Updates': db.prepare(`SELECT COUNT(*) AS n FROM shipment_events e JOIN shipments s ON s.id=e.shipment_id WHERE (s.shipper_organization_id=? OR s.receiver_organization_id=?) AND e.created_at >= datetime('now','-7 days')`).get(user.organization_id,user.organization_id).n
    };
    data.actions = [
      { href: '/app/shipments/new', label: 'Create shipment', description: 'Send a parcel request or post a freight load.' },
      { href: '/app/providers', label: 'Find providers', description: 'Discover parcel companies, transporters, and owner-operators.' },
      { href: '/app/capacity', label: 'View capacity', description: 'See fresh truck availability on active corridors.' }
    ];
    data.recent = db.prepare(`SELECT code,title,service_mode,operational_status,origin,destination,created_at FROM shipments WHERE ${condition} ORDER BY updated_at DESC LIMIT 6`).all(user.organization_id,user.organization_id);
    return data;
  }

  if (user.role === USER_ROLES.PARCEL) {
    data.counts = {
      'New Requests': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE provider_organization_id=? AND service_mode='PARCEL' AND operational_status='NEW'`).get(user.organization_id).n,
      Collected: db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE provider_organization_id=? AND service_mode='PARCEL' AND operational_status='COLLECTED'`).get(user.organization_id).n,
      'In Route': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE provider_organization_id=? AND service_mode='PARCEL' AND operational_status='IN_ROUTE'`).get(user.organization_id).n,
      'Ready / Delivery': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE provider_organization_id=? AND service_mode='PARCEL' AND operational_status IN ('READY_FOR_PICKUP','OUT_FOR_DELIVERY')`).get(user.organization_id).n
    };
    data.actions = [
      { href: '/app/shipments', label: 'Open requests', description: 'Review B2B requests sent to your company.' },
      { href: '/app/routes-centers', label: 'Routes & centers', description: 'Show businesses where you operate.' },
      { href: '/app/company-page', label: 'Update company page', description: 'Keep public services and contact details current.' }
    ];
    data.recent = db.prepare(`SELECT code,title,service_mode,operational_status,origin,destination,created_at FROM shipments WHERE provider_organization_id=? AND service_mode='PARCEL' ORDER BY updated_at DESC LIMIT 6`).all(user.organization_id);
    return data;
  }

  data.counts = {
    'Available Loads': listLoads(user).length,
    'Active Shipments': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE ${user.role === USER_ROLES.DRIVER ? 'provider_profile_id=?' : 'provider_organization_id=?'} AND operational_status NOT IN ('COMPLETED','CANCELLED')`).get(user.role === USER_ROLES.DRIVER ? user.provider_profile_id : user.organization_id).n,
    'Current Capacity': db.prepare(`SELECT COUNT(*) AS n FROM capacities WHERE ${user.role === USER_ROLES.DRIVER ? 'provider_profile_id=?' : 'provider_organization_id=?'} AND expires_at > ?`).get(user.role === USER_ROLES.DRIVER ? user.provider_profile_id : user.organization_id, nowIso()).n,
    'Proof Pending': db.prepare(`SELECT COUNT(*) AS n FROM shipments s WHERE ${user.role === USER_ROLES.DRIVER ? 's.provider_profile_id=?' : 's.provider_organization_id=?'} AND s.operational_status IN ('DELIVERED','IN_TRANSIT') AND NOT EXISTS (SELECT 1 FROM proof_files p WHERE p.shipment_id=s.id AND p.proof_type='DELIVERY')`).get(user.role === USER_ROLES.DRIVER ? user.provider_profile_id : user.organization_id).n
  };
  data.actions = [
    { href: '/app/loads', label: 'Find loads', description: 'View direct, partner, and open B2B freight.' },
    { href: '/app/capacity', label: 'Update capacity', description: 'Publish Empty, Partial, or Full availability.' },
    { href: '/app/company-page', label: 'Update company page', description: 'Keep corridors and contact details current.' }
  ];
  data.recent = listVisibleShipments(user).slice(0, 6);
  data.capacities = listCapacity(user).filter(item => item.isOwn).slice(0, 3);
  return data;
}

export function listVisibleShipments(user) {
  const db = getDb();
  let sql = `SELECT s.*, so.name AS shipper_name, ro.name AS receiver_name, po.name AS provider_name,
    pp.business_name AS provider_profile_name
    FROM shipments s
    LEFT JOIN organizations so ON so.id=s.shipper_organization_id
    LEFT JOIN organizations ro ON ro.id=s.receiver_organization_id
    LEFT JOIN organizations po ON po.id=s.provider_organization_id
    LEFT JOIN provider_profiles pp ON pp.id=s.provider_profile_id`;
  const args = [];
  if (user.role === USER_ROLES.ADMIN) {
    sql += ' ORDER BY s.updated_at DESC';
  } else if (user.role === USER_ROLES.SHIPPER || user.role === USER_ROLES.RECEIVER) {
    sql += ' WHERE s.shipper_organization_id=? OR s.receiver_organization_id=? ORDER BY s.updated_at DESC';
    args.push(user.organization_id,user.organization_id);
  } else if (user.role === USER_ROLES.PARCEL) {
    sql += ` WHERE s.provider_organization_id=? AND s.service_mode='PARCEL' ORDER BY s.updated_at DESC`;
    args.push(user.organization_id);
  } else if (user.role === USER_ROLES.TRANSPORTER) {
    sql += ` WHERE s.provider_organization_id=? OR (s.service_mode='FREIGHT' AND s.operational_status='POSTED' AND s.distribution_mode IN ('OPEN_MARKET','SAVED_PARTNERS')) ORDER BY s.updated_at DESC`;
    args.push(user.organization_id);
  } else {
    sql += ` WHERE s.provider_profile_id=? OR (s.service_mode='FREIGHT' AND s.operational_status='POSTED' AND s.distribution_mode IN ('OPEN_MARKET','SAVED_PARTNERS')) ORDER BY s.updated_at DESC`;
    args.push(user.provider_profile_id);
  }
  return db.prepare(sql).all(...args).filter(shipment => canViewShipment(user,shipment));
}

export function getShipmentForUser(user, idOrCode) {
  const db = getDb();
  const shipment = db.prepare(`SELECT s.*, so.name AS shipper_name, ro.name AS receiver_name, po.name AS provider_name,
    pp.business_name AS provider_profile_name
    FROM shipments s
    LEFT JOIN organizations so ON so.id=s.shipper_organization_id
    LEFT JOIN organizations ro ON ro.id=s.receiver_organization_id
    LEFT JOIN organizations po ON po.id=s.provider_organization_id
    LEFT JOIN provider_profiles pp ON pp.id=s.provider_profile_id
    WHERE s.id=? OR s.code=?`).get(idOrCode,idOrCode);
  if (!shipment) return null;
  if (!canViewShipment(user, shipment)) return null;
  const isParty = isShipmentParty(user,shipment);
  shipment.events = db.prepare(`SELECT e.*, u.name AS actor_name FROM shipment_events e LEFT JOIN users u ON u.id=e.created_by WHERE e.shipment_id=? ${isParty ? '' : 'AND e.public=1'} ORDER BY e.created_at ASC`).all(shipment.id);
  if (isParty) {
    shipment.interests = db.prepare(`SELECT i.*, o.name AS organization_name, p.business_name AS provider_name FROM shipment_interests i LEFT JOIN organizations o ON o.id=i.provider_organization_id LEFT JOIN provider_profiles p ON p.id=i.provider_profile_id WHERE i.shipment_id=? ORDER BY i.created_at DESC`).all(shipment.id);
    shipment.proofs = db.prepare(`SELECT p.*, u.name AS uploaded_by_name FROM proof_files p JOIN users u ON u.id=p.uploaded_by WHERE p.shipment_id=? ORDER BY p.created_at DESC`).all(shipment.id);
    shipment.notes = db.prepare(`SELECT n.*,u.name AS author_name FROM shipment_notes n JOIN users u ON u.id=n.author_user_id WHERE n.shipment_id=? ORDER BY n.created_at DESC`).all(shipment.id);
  } else {
    shipment.receiver_name = null;
    shipment.interests = db.prepare(`SELECT i.*, o.name AS organization_name, p.business_name AS provider_name FROM shipment_interests i LEFT JOIN organizations o ON o.id=i.provider_organization_id LEFT JOIN provider_profiles p ON p.id=i.provider_profile_id WHERE i.shipment_id=? AND (i.provider_organization_id=? OR i.provider_profile_id=?) ORDER BY i.created_at DESC`).all(shipment.id,user.organization_id || '',user.provider_profile_id || '');
    shipment.proofs = [];
    shipment.notes = [];
  }
  return shipment;
}

function isShipmentParty(user, shipment) {
  if (user.role === USER_ROLES.ADMIN) return true;
  if (user.organization_id && [shipment.shipper_organization_id,shipment.receiver_organization_id,shipment.provider_organization_id].includes(user.organization_id)) return true;
  if (user.provider_profile_id && shipment.provider_profile_id === user.provider_profile_id) return true;
  return false;
}

function isSavedPartnerForShipment(user, shipment) {
  if (!roleCanBrowseLoads(user.role) || shipment.distribution_mode !== DISTRIBUTION_MODES.SAVED_PARTNERS) return false;
  const relationship = getDb().prepare(`SELECT 1 FROM partner_relationships
    WHERE owner_organization_id=? AND status='SAVED'
      AND (provider_organization_id=? OR provider_profile_id=?) LIMIT 1`)
    .get(shipment.shipper_organization_id,user.organization_id || '',user.provider_profile_id || '');
  return Boolean(relationship);
}

function canViewShipment(user, shipment) {
  if (isShipmentParty(user, shipment)) return true;
  if (!roleCanBrowseLoads(user.role) || shipment.service_mode !== SERVICE_MODES.FREIGHT || shipment.operational_status !== 'POSTED') return false;
  if (shipment.distribution_mode === DISTRIBUTION_MODES.OPEN_MARKET) return true;
  return isSavedPartnerForShipment(user, shipment);
}

function getShipmentParty(user, idOrCode) {
  const shipment = getShipmentForUser(user,idOrCode);
  return shipment && isShipmentParty(user,shipment) ? shipment : null;
}

export function createShipment(user, input) {
  if (!roleCanCreateShipment(user.role) || !user.organization_id) throw new Error('FORBIDDEN');
  const db = getDb();
  const serviceMode = input.serviceMode;
  if (!Object.values(SERVICE_MODES).includes(serviceMode)) throw new Error('INVALID_SERVICE_MODE');
  const distributionMode = input.distributionMode || DISTRIBUTION_MODES.OPEN_MARKET;
  if (!Object.values(DISTRIBUTION_MODES).includes(distributionMode)) throw new Error('INVALID_DISTRIBUTION_MODE');
  const { priceMinor, targetMinor } = validatePriceMode(input);
  if (!input.title || !input.origin || !input.destination || !input.cargoDescription || !input.pickupDate) throw new Error('MISSING_REQUIRED_FIELDS');

  let providerOrganizationId = null;
  let providerProfileId = null;
  if (distributionMode === DISTRIBUTION_MODES.DIRECT_TO_PROVIDER) {
    if (!input.providerRef) throw new Error('PROVIDER_REQUIRED');
    const [kind,id] = String(input.providerRef).split(':');
    if (kind === 'org') providerOrganizationId = id;
    else if (kind === 'profile') providerProfileId = id;
    else throw new Error('INVALID_PROVIDER');
  }
  if (serviceMode === SERVICE_MODES.PARCEL && !providerOrganizationId) throw new Error('PARCEL_PROVIDER_REQUIRED');

  const id = randomId('shp-');
  const code = randomCode(serviceMode === SERVICE_MODES.PARCEL ? 'LGX-P' : 'LGX-F');
  const trackingMode = input.trackingMode || 'NONE';
  const trackingToken = trackingMode === 'NONE' ? null : opaqueToken();
  const operationalStatus = serviceMode === SERVICE_MODES.PARCEL ? 'NEW' : (distributionMode === DISTRIBUTION_MODES.DIRECT_TO_PROVIDER ? 'SENT' : 'POSTED');
  const commercialStatus = distributionMode === DISTRIBUTION_MODES.DIRECT_TO_PROVIDER ? 'SENT' : 'POSTED';
  const timestamp = nowIso();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO shipments
      (id,code,title,service_mode,distribution_mode,price_mode,price_minor,target_price_minor,shipper_organization_id,receiver_organization_id,provider_organization_id,provider_profile_id,origin,destination,cargo_description,package_count,estimated_weight,vehicle_category,load_type,pickup_date,delivery_date,commercial_status,operational_status,tracking_mode,tracking_token,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,code,input.title,serviceMode,distributionMode,input.priceMode,priceMinor,targetMinor,user.organization_id,input.receiverOrganizationId || null,providerOrganizationId,providerProfileId,input.origin,input.destination,input.cargoDescription,Number(input.packageCount || 1),input.estimatedWeight ? Number(input.estimatedWeight) : null,input.vehicleCategory || null,input.loadType || null,input.pickupDate,input.deliveryDate || null,commercialStatus,operationalStatus,trackingMode,trackingToken,user.id,timestamp,timestamp);
    db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,created_by,public,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(randomId('evt-'),id,operationalStatus,'CREATED','Shipment created in Loadgistic',user.id,1,timestamp);
    if (providerOrganizationId) {
      const owner = db.prepare(`SELECT u.id FROM users u WHERE u.organization_id=? AND u.active=1 ORDER BY u.created_at LIMIT 1`).get(providerOrganizationId);
      if (owner) notify(db,owner.id,'New direct B2B shipment request',`${user.organization_name || 'A business'} sent ${code}.`);
    }
    audit(db,user,'SHIPMENT_CREATED','shipment',id,{ code, serviceMode, distributionMode });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { id, code };
}

export function transitionShipment(user, shipmentId, nextStatus, note = '') {
  const db = getDb();
  const shipment = getShipmentParty(user, shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  if (shipment.service_mode === SERVICE_MODES.PARCEL && !roleCanOperateParcel(user.role) && user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  if (shipment.service_mode === SERVICE_MODES.FREIGHT && ![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER,USER_ROLES.ADMIN].includes(user.role)) throw new Error('FORBIDDEN');
  assertTransition(shipment.service_mode, shipment.operational_status, nextStatus);
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE shipments SET operational_status=?, updated_at=? WHERE id=?').run(nextStatus,timestamp,shipment.id);
    db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,created_by,public,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(randomId('evt-'),shipment.id,nextStatus,'STATUS',note || null,user.id,1,timestamp);
    audit(db,user,'SHIPMENT_STATUS_CHANGED','shipment',shipment.id,{ from: shipment.operational_status, to: nextStatus });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function addShipmentNote(user, shipmentId, note) {
  const shipment = getShipmentParty(user, shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  if (!note?.trim()) throw new Error('NOTE_REQUIRED');
  const db = getDb();
  db.prepare(`INSERT INTO shipment_notes (id,shipment_id,author_user_id,note,created_at) VALUES (?,?,?,?,?)`)
    .run(randomId('note-'),shipment.id,user.id,note.trim(),nowIso());
  audit(db,user,'SHIPMENT_NOTE_ADDED','shipment',shipment.id,{});
}

export function listOrganizationsByType(types = []) {
  const db = getDb();
  if (!types.length) return db.prepare('SELECT * FROM organizations ORDER BY name').all();
  const placeholders = types.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM organizations WHERE type IN (${placeholders}) ORDER BY name`).all(...types);
}

export function listProviders(kind = 'ALL') {
  const db = getDb();
  const providers = [];
  if (kind === 'ALL' || kind === 'PARCEL') {
    providers.push(...db.prepare(`SELECT o.id, 'org' AS ref_kind, o.name, o.handle, o.type, o.verified, o.city, cp.about, cp.services, cp.corridors, cp.contact_phone,
      (SELECT group_concat(l.name || ' — ' || l.city, '; ') FROM locations l WHERE l.organization_id=o.id AND l.active=1) AS centers
      FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id AND cp.published=1 WHERE o.type='PARCEL_OPERATOR'`).all());
  }
  if (kind === 'ALL' || kind === 'TRANSPORT') {
    providers.push(...db.prepare(`SELECT o.id, 'org' AS ref_kind, o.name, o.handle, o.type, o.verified, o.city, cp.about, cp.services, cp.corridors, cp.contact_phone,
      NULL AS centers FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id AND cp.published=1 WHERE o.type='TRANSPORT_COMPANY'`).all());
  }
  if (kind === 'ALL' || kind === 'DRIVER') {
    providers.push(...db.prepare(`SELECT p.id, 'profile' AS ref_kind, p.business_name AS name, p.handle, 'INDEPENDENT_PROVIDER' AS type,
      (p.verified_identity AND p.verified_license) AS verified, p.city, p.about, cp.services, cp.corridors, cp.contact_phone, NULL AS centers
      FROM provider_profiles p JOIN company_pages cp ON cp.provider_profile_id=p.id AND cp.published=1 WHERE p.public_visibility='PUBLIC'`).all());
  }
  const capacities = listPublicCapacity();
  return providers.map(provider => ({
    ...provider,
    capacity: capacities.find(c => (provider.ref_kind === 'org' ? c.provider_organization_id === provider.id : c.provider_profile_id === provider.id)) || null
  }));
}

export function getPublicCompany(handle) {
  const db = getDb();
  const org = db.prepare(`SELECT o.*,cp.headline,cp.about,cp.services,cp.corridors,cp.contact_phone,cp.contact_email
    FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id AND cp.published=1 WHERE o.handle=?`).get(handle);
  if (org) {
    org.page_kind = 'organization';
    org.locations = db.prepare('SELECT * FROM locations WHERE organization_id=? AND active=1 ORDER BY city,name').all(org.id);
    org.routes = db.prepare(`SELECT r.*,ol.name AS origin_name,ol.city AS origin_city,dl.name AS destination_name,dl.city AS destination_city
      FROM parcel_routes r JOIN locations ol ON ol.id=r.origin_location_id JOIN locations dl ON dl.id=r.destination_location_id
      WHERE r.organization_id=? AND r.active=1 AND r.public_visibility=1`).all(org.id);
    org.capacities = listPublicCapacity().filter(c => c.provider_organization_id === org.id);
    return org;
  }
  const provider = db.prepare(`SELECT p.*,p.business_name AS name,cp.headline,cp.about,cp.services,cp.corridors,cp.contact_phone,cp.contact_email
    FROM provider_profiles p JOIN company_pages cp ON cp.provider_profile_id=p.id AND cp.published=1 WHERE p.handle=?`).get(handle);
  if (provider) {
    provider.page_kind = 'provider';
    provider.type = 'INDEPENDENT_PROVIDER';
    provider.verified = provider.verified_identity && provider.verified_license;
    provider.capacities = listPublicCapacity().filter(c => c.provider_profile_id === provider.id);
    return provider;
  }
  return null;
}

export function updateCompanyPage(user, input) {
  const db = getDb();
  const isProvider = user.role === USER_ROLES.DRIVER;
  const condition = isProvider ? 'provider_profile_id=?' : 'organization_id=?';
  const id = isProvider ? user.provider_profile_id : user.organization_id;
  if (!id) throw new Error('FORBIDDEN');
  db.prepare(`UPDATE company_pages SET headline=?,about=?,services=?,corridors=?,contact_phone=?,contact_email=?,published=?,updated_at=? WHERE ${condition}`)
    .run(input.headline || '',input.about || '',input.services || '',input.corridors || '',input.contactPhone || '',input.contactEmail || '',input.published ? 1 : 0,nowIso(),id);
  audit(db,user,'COMPANY_PAGE_UPDATED','company_page',id,{});
}

export function getOwnCompanyPage(user) {
  const db = getDb();
  if (user.role === USER_ROLES.DRIVER) return db.prepare('SELECT * FROM company_pages WHERE provider_profile_id=?').get(user.provider_profile_id);
  return db.prepare('SELECT * FROM company_pages WHERE organization_id=?').get(user.organization_id);
}

export function listLoads(user, mode = 'ALL') {
  if (!roleCanBrowseLoads(user.role) && user.role !== USER_ROLES.ADMIN) return [];
  const db = getDb();
  let where = `s.service_mode='FREIGHT' AND s.operational_status IN ('POSTED','SENT','CONTACTED')`;
  const args = [];
  if (user.role !== USER_ROLES.ADMIN) {
    const ownOrg = user.organization_id;
    const ownProfile = user.provider_profile_id;
    where += ` AND (
      s.distribution_mode='OPEN_MARKET'
      OR s.distribution_mode='SAVED_PARTNERS'
      OR (s.distribution_mode='DIRECT_TO_PROVIDER' AND (s.provider_organization_id=? OR s.provider_profile_id=?))
    )`;
    args.push(ownOrg || '',ownProfile || '');
  }
  if (mode === 'DIRECT') where += ` AND s.distribution_mode='DIRECT_TO_PROVIDER'`;
  if (mode === 'PARTNERS') where += ` AND s.distribution_mode='SAVED_PARTNERS'`;
  if (mode === 'OPEN') where += ` AND s.distribution_mode='OPEN_MARKET'`;
  return db.prepare(`SELECT s.*,o.name AS shipper_name,r.name AS receiver_name,
    EXISTS(SELECT 1 FROM shipment_interests i WHERE i.shipment_id=s.id AND (i.provider_organization_id=? OR i.provider_profile_id=?)) AS interested
    FROM shipments s JOIN organizations o ON o.id=s.shipper_organization_id LEFT JOIN organizations r ON r.id=s.receiver_organization_id
    WHERE ${where} ORDER BY s.created_at DESC`).all(user.organization_id || '',user.provider_profile_id || '',...args)
    .filter(shipment => canViewShipment(user,shipment));
}

export function expressInterest(user, shipmentId, note = '') {
  if (!roleCanBrowseLoads(user.role)) throw new Error('FORBIDDEN');
  const db = getDb();
  const shipment = getShipmentForUser(user, shipmentId);
  if (!shipment || shipment.service_mode !== SERVICE_MODES.FREIGHT) throw new Error('NOT_FOUND');
  if (![DISTRIBUTION_MODES.OPEN_MARKET,DISTRIBUTION_MODES.SAVED_PARTNERS].includes(shipment.distribution_mode)) throw new Error('NOT_FOUND');
  db.prepare(`INSERT OR IGNORE INTO shipment_interests
    (id,shipment_id,provider_organization_id,provider_profile_id,status,note,created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(randomId('int-'),shipment.id,user.role === USER_ROLES.TRANSPORTER ? user.organization_id : null,user.role === USER_ROLES.DRIVER ? user.provider_profile_id : null,'INTERESTED',note || null,nowIso());
  const owner = db.prepare(`SELECT id FROM users WHERE organization_id=? AND active=1 ORDER BY created_at LIMIT 1`).get(shipment.shipper_organization_id);
  if (owner) notify(db,owner.id,'Provider expressed interest',`${user.organization_name || user.provider_business_name || user.name} is interested in ${shipment.code}.`);
  audit(db,user,'SHIPMENT_INTEREST_CREATED','shipment',shipment.id,{});
}

export function acceptDirectedShipment(user, shipmentId) {
  if (!roleCanBrowseLoads(user.role)) throw new Error('FORBIDDEN');
  const db = getDb();
  const shipment = getShipmentForUser(user, shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  if (shipment.distribution_mode !== DISTRIBUTION_MODES.DIRECT_TO_PROVIDER) throw new Error('NOT_DIRECT_REQUEST');
  const matches = (user.role === USER_ROLES.TRANSPORTER && shipment.provider_organization_id === user.organization_id) || (user.role === USER_ROLES.DRIVER && shipment.provider_profile_id === user.provider_profile_id);
  if (!matches) throw new Error('FORBIDDEN');
  if (shipment.operational_status !== 'SENT' || shipment.commercial_status !== 'SENT') throw new Error('DIRECT_REQUEST_NOT_PENDING');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE shipments SET commercial_status='AGREED', operational_status='AGREED', updated_at=? WHERE id=?`).run(nowIso(),shipment.id);
    db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,created_by,public,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(randomId('evt-'),shipment.id,'AGREED','STATUS','Provider accepted the direct request',user.id,1,nowIso());
    audit(db,user,'DIRECT_SHIPMENT_ACCEPTED','shipment',shipment.id,{});
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listPublicCapacity() {
  const db = getDb();
  const freshHours = Number(process.env.CAPACITY_FRESH_HOURS || 12);
  return db.prepare(`SELECT c.*,v.label AS vehicle_label,v.category AS vehicle_category,o.name AS organization_name,o.handle AS organization_handle,
    p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    JOIN users u ON u.id=c.updated_by
    WHERE c.visibility='OPEN' AND c.expires_at > ? ORDER BY c.updated_at DESC`).all(nowIso())
    .map(row => ({ ...row, freshness: capacityFreshness(row.updated_at,row.expires_at,freshHours) }));
}

export function listCapacity(user) {
  const db = getDb();
  const freshHours = Number(process.env.CAPACITY_FRESH_HOURS || 12);
  const publicRows = listPublicCapacity();
  if (!roleCanPublishCapacity(user.role) && user.role !== USER_ROLES.ADMIN) return publicRows.map(row => ({ ...row, isOwn: false }));
  const ownCondition = user.role === USER_ROLES.DRIVER ? 'c.provider_profile_id=?' : 'c.provider_organization_id=?';
  const ownId = user.role === USER_ROLES.DRIVER ? user.provider_profile_id : user.organization_id;
  const ownRows = db.prepare(`SELECT c.*,v.label AS vehicle_label,v.category AS vehicle_category,o.name AS organization_name,o.handle AS organization_handle,
    p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id JOIN users u ON u.id=c.updated_by
    WHERE ${ownCondition} ORDER BY c.updated_at DESC`).all(ownId)
    .map(row => ({ ...row, freshness: capacityFreshness(row.updated_at,row.expires_at,freshHours), isOwn: true }));
  const ownIds = new Set(ownRows.map(r => r.id));
  return [...ownRows,...publicRows.filter(r => !ownIds.has(r.id)).map(r => ({ ...r, isOwn: false }))];
}

export function listOwnVehicles(user) {
  const db = getDb();
  if (user.role === USER_ROLES.DRIVER) return db.prepare('SELECT * FROM vehicles WHERE provider_profile_id=? AND active=1').all(user.provider_profile_id);
  if (user.role === USER_ROLES.TRANSPORTER) return db.prepare('SELECT * FROM vehicles WHERE organization_id=? AND active=1').all(user.organization_id);
  return [];
}

export function publishCapacity(user, input, photo = null) {
  if (!roleCanPublishCapacity(user.role)) throw new Error('FORBIDDEN');
  const db = getDb();
  const vehicle = db.prepare(`SELECT * FROM vehicles WHERE id=? AND ${user.role === USER_ROLES.DRIVER ? 'provider_profile_id=?' : 'organization_id=?'} AND active=1`)
    .get(input.vehicleId,user.role === USER_ROLES.DRIVER ? user.provider_profile_id : user.organization_id);
  if (!vehicle) throw new Error('INVALID_VEHICLE');
  const percent = validateCapacity(input.status,input.availablePercent);
  const expiresHours = Number(process.env.CAPACITY_EXPIRES_HOURS || 24);
  const timestamp = nowIso();
  const expiresAt = hoursFromNow(expiresHours);
  const id = randomId('cap-');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE capacities SET expires_at=? WHERE vehicle_id=? AND expires_at>?`).run(timestamp,vehicle.id,timestamp);
    db.prepare(`INSERT INTO capacities
      (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,user.role === USER_ROLES.TRANSPORTER ? user.organization_id : null,user.role === USER_ROLES.DRIVER ? user.provider_profile_id : null,vehicle.id,input.status,percent,input.origin || null,input.destination || null,input.corridor || `${input.origin || ''} → ${input.destination || ''}`,input.travelDate || null,input.nextAvailable || null,input.visibility || 'OPEN',photo?.path || null,user.id,timestamp,expiresAt);
    audit(db,user,'CAPACITY_PUBLISHED','capacity',id,{ status: input.status, percent, vehicleId: vehicle.id });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export function listRoutesAndCenters(user) {
  if (user.role !== USER_ROLES.PARCEL && user.role !== USER_ROLES.ADMIN) return { locations: [], routes: [] };
  const orgId = user.role === USER_ROLES.ADMIN ? 'org-parcel' : user.organization_id;
  const db = getDb();
  return {
    locations: db.prepare('SELECT * FROM locations WHERE organization_id=? ORDER BY city,name').all(orgId),
    routes: db.prepare(`SELECT r.*,ol.name AS origin_name,ol.city AS origin_city,dl.name AS destination_name,dl.city AS destination_city
      FROM parcel_routes r JOIN locations ol ON ol.id=r.origin_location_id JOIN locations dl ON dl.id=r.destination_location_id
      WHERE r.organization_id=? ORDER BY r.active DESC,ol.city,dl.city`).all(orgId)
  };
}

export function addLocation(user, input) {
  if (user.role !== USER_ROLES.PARCEL && user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  if (!input.name || !input.city) throw new Error('MISSING_REQUIRED_FIELDS');
  const db = getDb();
  const orgId = user.role === USER_ROLES.ADMIN ? 'org-parcel' : user.organization_id;
  const id = randomId('loc-');
  db.prepare(`INSERT INTO locations
    (id,organization_id,name,city,details,phone,accepts_dropoff,receiver_pickup,supports_transfer,direct_delivery,business_hours,active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`)
    .run(id,orgId,input.name,input.city,input.details || null,input.phone || null,input.acceptsDropoff ? 1 : 0,input.receiverPickup ? 1 : 0,input.supportsTransfer ? 1 : 0,input.directDelivery ? 1 : 0,input.businessHours || null);
  audit(db,user,'LOCATION_CREATED','location',id,{});
}

export function addRoute(user, input) {
  if (user.role !== USER_ROLES.PARCEL && user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  if (!input.originLocationId || !input.destinationLocationId) throw new Error('MISSING_REQUIRED_FIELDS');
  if (input.originLocationId === input.destinationLocationId) throw new Error('ROUTE_LOCATIONS_MUST_DIFFER');
  const db = getDb();
  const orgId = user.role === USER_ROLES.ADMIN ? 'org-parcel' : user.organization_id;
  const allowed = db.prepare('SELECT COUNT(*) AS n FROM locations WHERE organization_id=? AND id IN (?,?)').get(orgId,input.originLocationId,input.destinationLocationId).n;
  if (allowed !== 2) throw new Error('INVALID_LOCATION');
  const id = randomId('route-');
  db.prepare(`INSERT INTO parcel_routes
    (id,organization_id,origin_location_id,destination_location_id,service_days,estimated_time,branch_dropoff,receiver_pickup,direct_delivery,public_visibility,active)
    VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
    .run(id,orgId,input.originLocationId,input.destinationLocationId,input.serviceDays || null,input.estimatedTime || null,input.branchDropoff ? 1 : 0,input.receiverPickup ? 1 : 0,input.directDelivery ? 1 : 0,input.publicVisibility ? 1 : 0);
  audit(db,user,'PARCEL_ROUTE_CREATED','route',id,{});
}

export function listApplications(user) {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  return getDb().prepare(`SELECT a.*,u.email,u.name FROM applications a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC`).all();
}

export function reviewApplication(user, applicationId, status, notes = '') {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  if (!['APPROVED','MORE_INFO','REJECTED'].includes(status)) throw new Error('INVALID_STATUS');
  const db = getDb();
  const application = db.prepare(`SELECT a.*,u.role,u.organization_id,u.provider_profile_id FROM applications a JOIN users u ON u.id=a.user_id WHERE a.id=?`).get(applicationId);
  if (!application) throw new Error('NOT_FOUND');
  if (['APPROVED','REJECTED'].includes(application.status)) throw new Error('APPLICATION_ALREADY_REVIEWED');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE applications SET status=?,notes=?,updated_at=? WHERE id=?').run(status,notes || null,nowIso(),applicationId);
    if (status === 'APPROVED' && !application.organization_id && !application.provider_profile_id) {
      const handle = `${slugify(application.business_name)}-${Math.random().toString(16).slice(2,6)}`;
      if (application.application_type === 'INDEPENDENT_PROVIDER') {
        const providerId = randomId('provider-');
        db.prepare(`INSERT INTO provider_profiles (id,user_id,business_name,handle,verified_identity,verified_license,vehicle_documents_verified,vehicle_type,corridors,phone,city,about,public_visibility,created_at) VALUES (?,?,?,?,1,1,0,NULL,NULL,NULL,NULL,?,'PUBLIC',?)`)
          .run(providerId,application.user_id,application.business_name,handle,'New independent provider approved through Loadgistic.',nowIso());
        db.prepare(`INSERT INTO company_pages (id,organization_id,provider_profile_id,headline,about,services,corridors,contact_phone,contact_email,published,updated_at) VALUES (?,NULL,?,?,?,?,?,?,?,?,?)`)
          .run(randomId('page-'),providerId,'Independent B2B freight provider','Complete this company page before publishing.','','','','',0,nowIso());
        db.prepare('UPDATE users SET provider_profile_id=?,active=1 WHERE id=?').run(providerId,application.user_id);
        db.prepare(`INSERT INTO subscriptions (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at) VALUES (?,NULL,?,'plan-solo','PAYMENT_UNDER_REVIEW','FLAT_MONTHLY',?,NULL)`).run(randomId('sub-'),providerId,nowIso());
      } else {
        const orgId = randomId('org-');
        db.prepare(`INSERT INTO organizations (id,name,handle,type,verified,industry,description,phone,email,city,public_visibility,created_at) VALUES (?,?,?,?,1,NULL,?,NULL,NULL,NULL,'PUBLIC',?)`)
          .run(orgId,application.business_name,handle,application.application_type,'New approved Loadgistic business.',nowIso());
        db.prepare(`INSERT INTO memberships (id,user_id,organization_id,membership_role) VALUES (?,?,?,'OWNER')`).run(randomId('mem-'),application.user_id,orgId);
        db.prepare(`INSERT INTO company_pages (id,organization_id,provider_profile_id,headline,about,services,corridors,contact_phone,contact_email,published,updated_at) VALUES (?,?,NULL,?,?,?,?,?,?,0,?)`)
          .run(randomId('page-'),orgId,'B2B logistics company page','Complete this company page before publishing.','','','','',nowIso());
        db.prepare('UPDATE users SET organization_id=?,active=1 WHERE id=?').run(orgId,application.user_id);
        const planId = application.application_type === 'PARCEL_OPERATOR' ? 'plan-parcel' : application.application_type === 'TRANSPORT_COMPANY' ? 'plan-transport' : 'plan-business';
        db.prepare(`INSERT INTO subscriptions (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at) VALUES (?,?,NULL,?,'PAYMENT_UNDER_REVIEW','FLAT_MONTHLY',?,NULL)`).run(randomId('sub-'),orgId,planId,nowIso());
      }
    }
    audit(db,user,'APPLICATION_REVIEWED','application',applicationId,{ status });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listAudit(user) {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  return getDb().prepare(`SELECT a.*,u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 100`).all();
}

export function saveUpload(file, prefix = 'file') {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) return null;
  const maxMb = Number(process.env.FILE_MAX_MB || 10);
  if (file.size > maxMb * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
  const allowed = new Set(['image/jpeg','image/png','image/webp','application/pdf']);
  if (!allowed.has(file.type)) throw new Error('UNSUPPORTED_FILE_TYPE');
  const extensionMap = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
  const name = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}${extensionMap[file.type]}`;
  const dir = path.resolve(process.cwd(),'data/uploads');
  fs.mkdirSync(dir,{ recursive: true });
  const filePath = path.join(dir,name);
  return file.arrayBuffer().then(buffer => {
    fs.writeFileSync(filePath,Buffer.from(buffer));
    return { path: filePath, name, originalName: file.name, mimeType: file.type };
  });
}

export function addProof(user, shipmentId, proofType, upload, note = '') {
  const shipment = getShipmentParty(user,shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  if (!['LOADING','DELIVERY','ISSUE'].includes(proofType)) throw new Error('INVALID_PROOF_TYPE');
  if (!upload) throw new Error('FILE_REQUIRED');
  const db = getDb();
  const id = randomId('proof-');
  db.prepare(`INSERT INTO proof_files (id,shipment_id,proof_type,file_path,original_name,mime_type,note,uploaded_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id,shipment.id,proofType,upload.path,upload.originalName,upload.mimeType,note || null,user.id,nowIso());
  audit(db,user,'PROOF_UPLOADED','shipment',shipment.id,{ proofType, proofId: id });
  return id;
}

export function getProofFile(user, proofId) {
  const db = getDb();
  const proof = db.prepare('SELECT * FROM proof_files WHERE id=?').get(proofId);
  if (!proof) return null;
  const shipment = getShipmentParty(user,proof.shipment_id);
  if (!shipment) return null;
  return proof;
}

export function getTrackingByToken(token) {
  const db = getDb();
  const shipment = db.prepare(`SELECT s.code,s.title,s.service_mode,s.origin,s.destination,s.operational_status,s.tracking_mode,s.updated_at,
    so.name AS shipper_name,ro.name AS receiver_name,po.name AS provider_name,pp.business_name AS provider_profile_name
    FROM shipments s LEFT JOIN organizations so ON so.id=s.shipper_organization_id LEFT JOIN organizations ro ON ro.id=s.receiver_organization_id
    LEFT JOIN organizations po ON po.id=s.provider_organization_id LEFT JOIN provider_profiles pp ON pp.id=s.provider_profile_id
    WHERE s.tracking_token=? AND s.tracking_mode!='NONE'`).get(token);
  if (!shipment) return null;
  shipment.events = db.prepare(`SELECT status,note,created_at FROM shipment_events WHERE shipment_id=(SELECT id FROM shipments WHERE tracking_token=?) AND public=1 ORDER BY created_at ASC`).all(token);
  return shipment;
}


function slugify(value) {
  return String(value || 'business').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42) || 'business';
}

export function createBusinessApplication(input) {
  const db = getDb();
  if (!input.name || !input.email || !input.password || !input.businessName || !input.applicationType) throw new Error('MISSING_REQUIRED_FIELDS');
  if (String(input.password).length < 10) throw new Error('PASSWORD_TOO_SHORT');
  if (findUserByEmail(input.email)) throw new Error('EMAIL_ALREADY_EXISTS');
  const roleMap = {
    ENTERPRISE_SHIPPER: 'SHIPPER',
    ENTERPRISE_RECEIVER: 'RECEIVER',
    PARCEL_OPERATOR: 'PARCEL',
    TRANSPORT_COMPANY: 'TRANSPORTER',
    INDEPENDENT_PROVIDER: 'DRIVER'
  };
  const role = roleMap[input.applicationType];
  if (!role) throw new Error('INVALID_APPLICATION_TYPE');
  const userId = randomId('user-');
  const applicationId = randomId('app-');
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO users (id,email,password_hash,name,role,organization_id,provider_profile_id,active,created_at) VALUES (?,?,?,?,?,?,?,0,?)`)
      .run(userId,input.email.toLowerCase(),hashPassword(input.password),input.name,role,null,null,timestamp);
    db.prepare(`INSERT INTO applications (id,user_id,business_name,application_type,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(applicationId,userId,input.businessName,input.applicationType,'PENDING',input.notes || null,timestamp,timestamp);
    audit(db,{id:userId,organization_id:null},'BUSINESS_APPLICATION_CREATED','application',applicationId,{ applicationType: input.applicationType });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return applicationId;
}

export function getApplicationStatus(email) {
  return getDb().prepare(`SELECT a.*,u.email,u.name FROM applications a JOIN users u ON u.id=a.user_id WHERE lower(u.email)=lower(?) ORDER BY a.created_at DESC LIMIT 1`).get(email) || null;
}

export function getBillingSummary(user) {
  const db = getDb();
  const subscription = user.role === USER_ROLES.DRIVER
    ? db.prepare(`SELECT s.*,p.name AS plan_name,p.code AS plan_code FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.provider_profile_id=? ORDER BY s.starts_at DESC LIMIT 1`).get(user.provider_profile_id)
    : db.prepare(`SELECT s.*,p.name AS plan_name,p.code AS plan_code FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=? ORDER BY s.starts_at DESC LIMIT 1`).get(user.organization_id);
  if (!subscription) return { subscription: null, proofs: [] };
  const proofs = db.prepare(`SELECT * FROM payment_proofs WHERE subscription_id=? ORDER BY submitted_at DESC`).all(subscription.id);
  return { subscription, proofs };
}

export function submitPaymentProof(user, amountEtb, reference, upload = null) {
  const db = getDb();
  const summary = getBillingSummary(user);
  if (!summary.subscription) throw new Error('SUBSCRIPTION_NOT_FOUND');
  const amountMinor = Number(amountEtb);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error('INVALID_ETB_AMOUNT');
  const id = randomId('pay-');
  db.prepare(`INSERT INTO payment_proofs (id,subscription_id,amount_minor,reference,file_path,status,submitted_at,reviewed_at) VALUES (?,?,?,?,?,'PENDING',?,NULL)`)
    .run(id,summary.subscription.id,Math.round(amountMinor*100),reference || null,upload?.path || null,nowIso());
  audit(db,user,'PAYMENT_PROOF_SUBMITTED','payment_proof',id,{ amountEtb: amountMinor });
  return id;
}

export function listPaymentProofs(user) {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  return getDb().prepare(`SELECT pp.*,p.name AS plan_name,o.name AS organization_name,pr.business_name AS provider_name
    FROM payment_proofs pp JOIN subscriptions s ON s.id=pp.subscription_id JOIN plans p ON p.id=s.plan_id
    LEFT JOIN organizations o ON o.id=s.organization_id LEFT JOIN provider_profiles pr ON pr.id=s.provider_profile_id
    ORDER BY pp.submitted_at DESC`).all();
}

export function reviewPaymentProof(user, proofId, status) {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  if (!['APPROVED','REJECTED','MORE_INFO'].includes(status)) throw new Error('INVALID_STATUS');
  const db = getDb();
  const proof = db.prepare('SELECT * FROM payment_proofs WHERE id=?').get(proofId);
  if (!proof) throw new Error('NOT_FOUND');
  if (['APPROVED','REJECTED'].includes(proof.status)) throw new Error('PAYMENT_PROOF_ALREADY_REVIEWED');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE payment_proofs SET status=?,reviewed_at=? WHERE id=?').run(status,nowIso(),proofId);
    if (status === 'APPROVED') db.prepare(`UPDATE subscriptions SET status='ACTIVE' WHERE id=?`).run(proof.subscription_id);
    audit(db,user,'PAYMENT_PROOF_REVIEWED','payment_proof',proofId,{ status });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
