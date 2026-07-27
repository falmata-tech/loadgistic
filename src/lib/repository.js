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
  validateAcceptedLoads,
  validateFreightLoadType,
  assertTransition,
  capacityFreshness,
  roleCanCreateShipment,
  roleCanPublishCapacity,
  roleCanBrowseLoads
} from './domain.js';
import { randomCode, randomId, opaqueToken, hashPassword } from './security.js';
import { normalizePlace, routeMatch, splitPlaces, textIncludes } from './route-matching.js';

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
      Loads: db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n,
      'Fresh Capacity': db.prepare(`SELECT COUNT(*) AS n FROM capacities WHERE expires_at > ?`).get(nowIso()).n
    };
    data.actions = [
      { href: '/admin/applications', label: 'Review applications', description: 'Approve or request more information.' },
      { href: '/companies', label: 'View transporter directory', description: 'Inspect authenticated transporter pages.' }
    ];
    data.recent = db.prepare('SELECT code,title,service_mode,operational_status,origin,destination,created_at FROM shipments ORDER BY created_at DESC LIMIT 6').all();
    return data;
  }

  if (user.role === USER_ROLES.SHIPPER || user.role === USER_ROLES.RECEIVER) {
    const condition = 'shipper_organization_id = ? OR receiver_organization_id = ?';
    data.counts = {
      'Active Loads': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE (${condition}) AND operational_status NOT IN ('COMPLETED','CANCELLED','RETURNED')`).get(user.organization_id,user.organization_id).n,
      'Open Requests': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE (${condition}) AND commercial_status IN ('POSTED','SENT','CONTACTED')`).get(user.organization_id,user.organization_id).n,
      'Saved Providers': db.prepare(`SELECT COUNT(*) AS n FROM partner_relationships WHERE owner_organization_id = ?`).get(user.organization_id).n,
      'Recent Updates': db.prepare(`SELECT COUNT(*) AS n FROM shipment_events e JOIN shipments s ON s.id=e.shipment_id WHERE (s.shipper_organization_id=? OR s.receiver_organization_id=?) AND e.created_at >= datetime('now','-7 days')`).get(user.organization_id,user.organization_id).n
    };
    data.actions = [
      { href: '/app/shipments/new', label: 'Post a load', description: 'Request quotes or publish a road-freight load.' },
      { href: '/app/providers', label: 'Open directory', description: 'Confirm Businesses, fleet transporters, and self-managed drivers.' },
      { href: '/app/capacity', label: 'Open Capacity Board', description: 'See fresh truck availability on active corridors.' }
    ];
    data.recent = db.prepare(`SELECT code,title,service_mode,operational_status,origin,destination,created_at FROM shipments WHERE ${condition} ORDER BY updated_at DESC LIMIT 6`).all(user.organization_id,user.organization_id);
    return data;
  }

  data.counts = {
    'Available Loads': listLoads(user).length,
    'Active Loads': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE ${user.role === USER_ROLES.DRIVER ? 'provider_profile_id=?' : 'provider_organization_id=?'} AND operational_status NOT IN ('COMPLETED','CANCELLED')`).get(user.role === USER_ROLES.DRIVER ? user.provider_profile_id : user.organization_id).n,
    'Current Capacity': db.prepare(`SELECT COUNT(*) AS n FROM capacities WHERE ${user.role === USER_ROLES.DRIVER ? 'provider_profile_id=?' : 'provider_organization_id=?'} AND expires_at > ?`).get(user.role === USER_ROLES.DRIVER ? user.provider_profile_id : user.organization_id, nowIso()).n,
    'Proof Pending': db.prepare(`SELECT COUNT(*) AS n FROM shipments s WHERE ${user.role === USER_ROLES.DRIVER ? 's.provider_profile_id=?' : 's.provider_organization_id=?'} AND s.operational_status IN ('DELIVERED','IN_TRANSIT') AND NOT EXISTS (SELECT 1 FROM proof_files p WHERE p.shipment_id=s.id AND p.proof_type='DELIVERY')`).get(user.role === USER_ROLES.DRIVER ? user.provider_profile_id : user.organization_id).n
  };
  data.actions = [
    { href: '/app/loads', label: 'Open Load Board', description: 'View direct, partner, and open B2B freight.' },
    { href: user.role === USER_ROLES.TRANSPORTER ? '/app/fleet#capacity-update' : '/app/home', label: 'Update capacity', description: 'Publish Empty or Partial truck availability.' },
    { href: '/app/company-page', label: 'Update Public Profile', description: 'Keep corridors and contact details current.' }
  ];
  data.recent = listVisibleShipments(user).slice(0, 6);
  data.capacities = listCapacity(user).filter(item => item.isOwn).slice(0, 3);
  return data;
}

export function listVisibleShipments(user) {
  const db = getDb();
  let sql = `SELECT s.*, so.name AS shipper_name,so.handle AS shipper_handle,ro.name AS receiver_name,ro.handle AS receiver_handle,po.name AS provider_name,
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
  } else if (user.role === USER_ROLES.TRANSPORTER) {
    sql += ' WHERE s.provider_organization_id=? ORDER BY s.updated_at DESC';
    args.push(user.organization_id);
  } else {
    sql += ' WHERE s.provider_profile_id=? ORDER BY s.updated_at DESC';
    args.push(user.provider_profile_id);
  }
  return db.prepare(sql).all(...args);
}

export function getShipmentForUser(user, idOrCode) {
  const db = getDb();
  const shipment = db.prepare(`SELECT s.*, so.name AS shipper_name,so.handle AS shipper_handle,ro.name AS receiver_name,ro.handle AS receiver_handle,po.name AS provider_name,po.handle AS provider_handle,
    pp.business_name AS provider_profile_name,
    CASE WHEN cp.show_contact_phone_on_loads=1 THEN cp.contact_phone ELSE NULL END AS load_contact_phone
    FROM shipments s
    LEFT JOIN organizations so ON so.id=s.shipper_organization_id
    LEFT JOIN organizations ro ON ro.id=s.receiver_organization_id
    LEFT JOIN organizations po ON po.id=s.provider_organization_id
    LEFT JOIN provider_profiles pp ON pp.id=s.provider_profile_id
    LEFT JOIN company_pages cp ON cp.organization_id=s.shipper_organization_id
    WHERE s.id=? OR s.code=?`).get(idOrCode,idOrCode);
  if (!shipment) return null;
  if (!canViewShipment(user, shipment)) return null;
  const isParty = isShipmentParty(user,shipment);
  shipment.events = db.prepare(`SELECT e.*, u.name AS actor_name FROM shipment_events e LEFT JOIN users u ON u.id=e.created_by WHERE e.shipment_id=? ${isParty ? '' : 'AND e.public=1'} ORDER BY e.created_at ASC`).all(shipment.id);
  if (isParty) {
    shipment.interests = db.prepare(`SELECT i.*, o.name AS organization_name, p.business_name AS provider_name,
      r.id AS proof_request_id,r.requested_at AS proof_requested_at,r.fulfilled_at AS proof_fulfilled_at
      FROM shipment_interests i LEFT JOIN organizations o ON o.id=i.provider_organization_id LEFT JOIN provider_profiles p ON p.id=i.provider_profile_id
      LEFT JOIN load_proof_requests r ON r.interest_id=i.id WHERE i.shipment_id=? ORDER BY i.created_at DESC`).all(shipment.id);
    shipment.proofs = db.prepare(`SELECT p.*, u.name AS uploaded_by_name FROM proof_files p JOIN users u ON u.id=p.uploaded_by WHERE p.shipment_id=? ORDER BY p.created_at DESC`).all(shipment.id);
    shipment.notes = db.prepare(`SELECT n.*,u.name AS author_name FROM shipment_notes n JOIN users u ON u.id=n.author_user_id WHERE n.shipment_id=? ORDER BY n.created_at DESC`).all(shipment.id);
    shipment.business_reviews = db.prepare(`SELECT r.*,reviewer.name AS reviewer_name,subject.name AS subject_name
      FROM business_reviews r JOIN organizations reviewer ON reviewer.id=r.reviewer_organization_id
      JOIN organizations subject ON subject.id=r.subject_organization_id
      WHERE r.shipment_id=? ORDER BY r.created_at DESC`).all(shipment.id);
  } else {
    shipment.receiver_name = null;
    shipment.receiver_first_name = null;
    shipment.receiver_phone = null;
    shipment.interests = db.prepare(`SELECT i.*, o.name AS organization_name, p.business_name AS provider_name,
      r.id AS proof_request_id,r.requested_at AS proof_requested_at,r.fulfilled_at AS proof_fulfilled_at
      FROM shipment_interests i LEFT JOIN organizations o ON o.id=i.provider_organization_id LEFT JOIN provider_profiles p ON p.id=i.provider_profile_id
      LEFT JOIN load_proof_requests r ON r.interest_id=i.id
      WHERE i.shipment_id=? AND (i.provider_organization_id=? OR i.provider_profile_id=?) ORDER BY i.created_at DESC`).all(shipment.id,user.organization_id || '',user.provider_profile_id || '');
    shipment.proofs = [];
    shipment.notes = [];
    shipment.business_reviews = [];
  }
  const ownsLoad = user.role === USER_ROLES.ADMIN || Boolean(user.organization_id && shipment.shipper_organization_id === user.organization_id);
  const proofScope = ownsLoad ? 'i.shipment_id=?' : 'i.shipment_id=? AND (i.provider_organization_id=? OR i.provider_profile_id=?)';
  const proofArgs = ownsLoad ? [shipment.id] : [shipment.id,user.organization_id || '',user.provider_profile_id || ''];
  shipment.load_proof_shares = db.prepare(`SELECT ps.id,ps.interest_id,ps.note,ps.created_at,ps.expires_at,ps.revoked_at,
    i.provider_organization_id,i.provider_profile_id,o.name AS organization_name,p.business_name AS provider_name
    FROM load_proof_shares ps JOIN shipment_interests i ON i.id=ps.interest_id
    LEFT JOIN organizations o ON o.id=i.provider_organization_id LEFT JOIN provider_profiles p ON p.id=i.provider_profile_id
    WHERE ${proofScope} ORDER BY ps.created_at DESC`).all(...proofArgs);
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
  if (serviceMode !== SERVICE_MODES.FREIGHT) throw new Error('INVALID_SERVICE_MODE');
  const distributionMode = input.distributionMode || DISTRIBUTION_MODES.OPEN_MARKET;
  if (!Object.values(DISTRIBUTION_MODES).includes(distributionMode)) throw new Error('INVALID_DISTRIBUTION_MODE');
  const { priceMinor, targetMinor } = validatePriceMode(input);
  const loadType = validateFreightLoadType(serviceMode,input.loadType);
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
  const id = randomId('shp-');
  const code = randomCode('LGX-F');
  const trackingMode = input.trackingMode || 'STATUS_ONLY';
  if (!['STATUS_ONLY','LOCATION_AND_STATUS'].includes(trackingMode)) throw new Error('INVALID_TRACKING_MODE');
  const trackingToken = opaqueToken();
  const operationalStatus = distributionMode === DISTRIBUTION_MODES.DIRECT_TO_PROVIDER ? 'SENT' : 'POSTED';
  const commercialStatus = distributionMode === DISTRIBUTION_MODES.DIRECT_TO_PROVIDER ? 'SENT' : 'POSTED';
  const timestamp = nowIso();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO shipments
      (id,code,title,service_mode,distribution_mode,price_mode,price_minor,target_price_minor,shipper_organization_id,receiver_organization_id,provider_organization_id,provider_profile_id,origin,destination,cargo_description,package_count,estimated_weight,vehicle_category,load_type,pickup_date,delivery_date,commercial_status,operational_status,tracking_mode,tracking_token,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,code,input.title,serviceMode,distributionMode,input.priceMode,priceMinor,targetMinor,user.organization_id,input.receiverOrganizationId || null,providerOrganizationId,providerProfileId,input.origin,input.destination,input.cargoDescription,Number(input.packageCount || 1),input.estimatedWeight ? Number(input.estimatedWeight) : null,input.vehicleCategory || null,loadType,input.pickupDate,input.deliveryDate || null,commercialStatus,operationalStatus,trackingMode,trackingToken,user.id,timestamp,timestamp);
    db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,created_by,public,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(randomId('evt-'),id,operationalStatus,'CREATED','Shipment created in Loadgistic',user.id,1,timestamp);
    if (providerOrganizationId) {
      const owner = db.prepare(`SELECT u.id FROM users u WHERE u.organization_id=? AND u.active=1 ORDER BY u.created_at LIMIT 1`).get(providerOrganizationId);
      if (owner) notify(db,owner.id,'New direct B2B shipment request',`${user.organization_name || 'A business'} sent ${code}.`);
    }
    audit(db,user,'SHIPMENT_CREATED','shipment',id,{ code, serviceMode, distributionMode, trackingMode });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { id, code };
}

function trackingLocation(input = {}, required = false) {
  const area = String(input.locationArea || '').trim();
  const device = input.locationSource === 'DEVICE_OBSCURED';
  const lat = device ? Number(input.approximateLat) : null;
  const lng = device ? Number(input.approximateLng) : null;
  const precisionKm = device ? Number(input.locationPrecisionKm) : null;
  if (required && !area) throw new Error('TRACKING_LOCATION_REQUIRED');
  if (device && (!area || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || precisionKm !== 40)) {
    throw new Error('INVALID_APPROXIMATE_LOCATION');
  }
  return {
    area: area || null,
    lat,
    lng,
    precisionKm,
    source: area ? (device ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA') : null
  };
}

function insertTrackingEvent(db, shipment, user, eventType, note, location, timestamp = nowIso()) {
  db.prepare(`INSERT INTO shipment_events
    (id,shipment_id,status,event_type,note,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,public,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(randomId('evt-'),shipment.id,shipment.operational_status,eventType,note || null,location.area,location.lat,location.lng,location.precisionKm,location.source,user.id,1,timestamp);
}

export function transitionShipment(user, shipmentId, nextStatus, note = '', locationInput = {}) {
  const db = getDb();
  const shipment = getShipmentParty(user, shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  if (shipment.service_mode !== SERVICE_MODES.FREIGHT || ![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER,USER_ROLES.ADMIN].includes(user.role)) throw new Error('FORBIDDEN');
  assertTransition(shipment.service_mode, shipment.operational_status, nextStatus);
  if (nextStatus === 'ASSIGNED' && (!shipment.receiver_first_name?.trim() || !shipment.receiver_phone?.trim())) {
    throw new Error('RECEIVER_CONTACT_REQUIRED');
  }
  const location = trackingLocation(locationInput,shipment.tracking_mode === 'LOCATION_AND_STATUS');
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE shipments SET operational_status=?, updated_at=? WHERE id=?').run(nextStatus,timestamp,shipment.id);
    insertTrackingEvent(db,{...shipment,operational_status:nextStatus},user,'STATUS',note,location,timestamp);
    audit(db,user,'SHIPMENT_STATUS_CHANGED','shipment',shipment.id,{ from: shipment.operational_status, to: nextStatus, trackingMode: shipment.tracking_mode, locationSource: location.source, locationPrecisionKm: location.precisionKm });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function addTrackingUpdate(user, shipmentId, input) {
  const db = getDb();
  const shipment = getShipmentParty(user,shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  const assignedProvider = (user.role === USER_ROLES.TRANSPORTER && shipment.provider_organization_id === user.organization_id)
    || (user.role === USER_ROLES.DRIVER && shipment.provider_profile_id === user.provider_profile_id)
    || user.role === USER_ROLES.ADMIN;
  if (!assignedProvider || !['ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE'].includes(shipment.operational_status)) throw new Error('FORBIDDEN');
  const note = String(input.note || '').trim();
  const needsLocation = shipment.tracking_mode === 'LOCATION_AND_STATUS';
  const location = trackingLocation(input,needsLocation);
  if (!needsLocation && !note) throw new Error('TRACKING_NOTE_REQUIRED');
  const timestamp = nowIso();
  insertTrackingEvent(db,shipment,user,needsLocation ? 'LOCATION' : 'UPDATE',note,location,timestamp);
  db.prepare('UPDATE shipments SET updated_at=? WHERE id=?').run(timestamp,shipment.id);
  audit(db,user,'SHIPMENT_TRACKING_UPDATED','shipment',shipment.id,{ trackingMode: shipment.tracking_mode, locationSource: location.source, locationPrecisionKm: location.precisionKm });
}

export function setTrackingMode(user, shipmentId, trackingMode) {
  if (trackingMode !== 'STATUS_ONLY') throw new Error('INVALID_TRACKING_MODE');
  const db = getDb();
  const shipment = db.prepare('SELECT * FROM shipments WHERE id=? OR code=?').get(shipmentId,shipmentId);
  const isBusinessParty = shipment && (user.role === USER_ROLES.ADMIN
    || (['SHIPPER','RECEIVER'].includes(user.role) && user.organization_id && [shipment.shipper_organization_id,shipment.receiver_organization_id].includes(user.organization_id)));
  if (!isBusinessParty) throw new Error('NOT_FOUND');
  if (shipment.tracking_mode === trackingMode) return;
  if (shipment.tracking_mode !== 'LOCATION_AND_STATUS') throw new Error('INVALID_TRACKING_MODE_CHANGE');
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE shipments SET tracking_mode=?,updated_at=? WHERE id=?').run(trackingMode,timestamp,shipment.id);
    insertTrackingEvent(db,{...shipment,operational_status:shipment.operational_status},user,'TRACKING_MODE','Tracking changed to status timeline by a Business party',trackingLocation(),timestamp);
    audit(db,user,'SHIPMENT_TRACKING_MODE_CHANGED','shipment',shipment.id,{ from: shipment.tracking_mode, to: trackingMode });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function setReceiverContact(user, shipmentId, firstName, phone) {
  const db = getDb();
  const shipment = db.prepare('SELECT * FROM shipments WHERE id=? OR code=?').get(shipmentId,shipmentId);
  const ownsShipment = shipment && (user.role === USER_ROLES.ADMIN || shipment.shipper_organization_id === user.organization_id);
  if (!ownsShipment) throw new Error('NOT_FOUND');
  if (shipment.operational_status !== 'AGREED') throw new Error('RECEIVER_CONTACT_NOT_READY');
  const cleanFirstName = String(firstName || '').trim();
  const cleanPhone = String(phone || '').trim();
  if (!cleanFirstName || !cleanPhone) throw new Error('RECEIVER_CONTACT_REQUIRED');
  db.prepare('UPDATE shipments SET receiver_first_name=?,receiver_phone=?,updated_at=? WHERE id=?')
    .run(cleanFirstName,cleanPhone,nowIso(),shipment.id);
  audit(db,user,'SHIPMENT_RECEIVER_CONTACT_SET','shipment',shipment.id,{});
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
  return listDirectoryProfiles(kind).filter(profile => !profile.is_business);
}

function verificationBadges(db, subjectType, subjectId) {
  const approved = new Set(db.prepare(`SELECT verification_type FROM verification_requests
    WHERE subject_type=? AND subject_id=? AND status='APPROVED'`).all(subjectType,subjectId).map(row => row.verification_type));
  if (subjectType === 'VEHICLE') {
    return [{type:'VEHICLE_AUTHORITY',verified:approved.has('VEHICLE_OWNERSHIP')||approved.has('VEHICLE_AUTHORIZATION')}];
  }
  const required = subjectType === 'ORGANIZATION'
    ? ['IDENTITY','BUSINESS_LICENSE']
    : subjectType === 'PROVIDER_PROFILE'
      ? ['IDENTITY','DRIVER_IDENTITY']
      : ['DRIVER_IDENTITY'];
  return required.map(type => ({ type, verified: approved.has(type) }));
}

function ratingSummary(db, organizationId) {
  return db.prepare(`SELECT COUNT(*) AS review_count,ROUND(AVG(rating),1) AS average_rating
    FROM business_reviews WHERE subject_organization_id=?`).get(organizationId);
}

export function listDirectoryProfiles(kind = 'ALL') {
  const db = getDb();
  const profiles = [];
  if (kind === 'ALL' || kind === 'BUSINESS') {
    const businesses = db.prepare(`SELECT o.id,'org' AS ref_kind,o.name,o.handle,o.type,o.city,cp.headline,cp.about,cp.services,cp.operating_regions,
      cp.contact_phone,cp.contact_email,1 AS is_business,0 AS fleet_size,0 AS active_capacity_count
      FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id AND cp.published=1
      WHERE o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER') ORDER BY o.name`).all();
    for (const business of businesses) {
      business.verification_badges = verificationBadges(db,'ORGANIZATION',business.id);
      business.verified = business.verification_badges.every(badge => badge.verified);
      Object.assign(business,ratingSummary(db,business.id));
      profiles.push(business);
    }
  }
  if (kind === 'ALL' || kind === 'TRANSPORT') {
    const transporters = db.prepare(`SELECT o.id, 'org' AS ref_kind, o.name, o.handle, o.type, o.city, cp.headline,cp.about, cp.services, cp.corridors,cp.operating_regions, cp.contact_phone,cp.contact_email,0 AS is_business,
      (SELECT COUNT(*) FROM vehicles v WHERE v.organization_id=o.id AND v.active=1) AS fleet_size,
      (SELECT COUNT(DISTINCT c.vehicle_id) FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
       WHERE v.organization_id=o.id AND v.active=1 AND c.visibility='OPEN' AND c.status IN ('EMPTY','PARTIAL') AND c.expires_at>?) AS active_capacity_count
      FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id AND cp.published=1 WHERE o.type='TRANSPORT_COMPANY'`).all(nowIso());
    for (const transporter of transporters) {
      transporter.verification_badges = verificationBadges(db,'ORGANIZATION',transporter.id);
      transporter.verified = transporter.verification_badges.every(badge => badge.verified);
      profiles.push(transporter);
    }
  }
  if (kind === 'ALL' || kind === 'DRIVER') {
    const drivers = db.prepare(`SELECT p.id, 'profile' AS ref_kind, p.business_name AS name, p.handle, 'INDEPENDENT_PROVIDER' AS type,
      p.city, p.about, cp.headline,cp.services, cp.corridors,cp.operating_regions, cp.contact_phone,cp.contact_email,0 AS is_business,
      (SELECT COUNT(*) FROM vehicles v WHERE v.provider_profile_id=p.id AND v.active=1) AS fleet_size,
      (SELECT COUNT(DISTINCT c.vehicle_id) FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
       WHERE v.provider_profile_id=p.id AND v.active=1 AND c.visibility='OPEN' AND c.status IN ('EMPTY','PARTIAL') AND c.expires_at>?) AS active_capacity_count
      FROM provider_profiles p JOIN company_pages cp ON cp.provider_profile_id=p.id AND cp.published=1 WHERE p.public_visibility='PUBLIC'`).all(nowIso());
    for (const driver of drivers) {
      driver.verification_badges = verificationBadges(db,'PROVIDER_PROFILE',driver.id);
      driver.verified = driver.verification_badges.every(badge => badge.verified);
      profiles.push(driver);
    }
  }
  return profiles;
}

function listProviderVehicles(db, ownerColumn, ownerId) {
  const vehicles = db.prepare(`SELECT v.id AS vehicle_id,v.label,v.category,v.plate,v.make,v.model,v.cargo_configuration,
    c.id AS capacity_id,c.status,c.available_percent,c.visibility,c.updated_at,c.expires_at,u.name AS updated_by_name
    FROM vehicles v
    LEFT JOIN capacities c ON c.id=(
      SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC LIMIT 1
    )
    LEFT JOIN users u ON u.id=c.updated_by
    WHERE v.${ownerColumn}=? AND v.active=1
    ORDER BY v.label,v.make,v.model`).all(ownerId);
  return vehicles.map(vehicle => ({...vehicle,verification_badges:verificationBadges(db,'VEHICLE',vehicle.vehicle_id)}));
}

export function getPublicCompany(handle) {
  const db = getDb();
  const org = db.prepare(`SELECT o.id,o.name,o.handle,o.type,o.industry,o.description,o.city,o.public_visibility,
    cp.headline,cp.about,cp.services,cp.corridors,cp.operating_regions,cp.contact_phone,cp.contact_email
    FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id AND cp.published=1
    WHERE o.handle=?`).get(handle);
  if (org) {
    org.page_kind = 'organization';
    org.is_business = ['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER'].includes(org.type);
    org.verification_badges = verificationBadges(db,'ORGANIZATION',org.id);
    org.verified = org.verification_badges.every(badge => badge.verified);
    Object.assign(org,ratingSummary(db,org.id));
    org.vehicles = org.is_business ? [] : listProviderVehicles(db,'organization_id',org.id);
    org.fleet_size = org.vehicles.length;
    org.capacities = org.is_business ? [] : listPublicCapacity().filter(c => c.provider_organization_id === org.id);
    return org;
  }
  const provider = db.prepare(`SELECT p.id,p.business_name,p.business_name AS name,p.handle,p.city,p.about,p.public_visibility,
    cp.headline,cp.services,cp.corridors,cp.operating_regions,cp.contact_phone,cp.contact_email
    FROM provider_profiles p JOIN company_pages cp ON cp.provider_profile_id=p.id AND cp.published=1 WHERE p.handle=?`).get(handle);
  if (provider) {
    provider.page_kind = 'provider';
    provider.type = 'INDEPENDENT_PROVIDER';
    provider.is_business = false;
    provider.verification_badges = verificationBadges(db,'PROVIDER_PROFILE',provider.id);
    provider.verified = provider.verification_badges.every(badge => badge.verified);
    provider.vehicles = listProviderVehicles(db,'provider_profile_id',provider.id);
    provider.fleet_size = provider.vehicles.length;
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
  const published = input.published ? 1 : 0;
  const showContactPhoneOnLoads = [USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role) && input.showContactPhoneOnLoads ? 1 : 0;
  db.prepare(`UPDATE company_pages SET headline=?,about=?,services=?,corridors=?,operating_regions=?,contact_phone=?,show_contact_phone_on_loads=?,contact_email=?,published=?,updated_at=? WHERE ${condition}`)
    .run(input.headline || '',input.about || '',input.services || '',input.corridors || '',input.operatingRegions || '',input.contactPhone || '',showContactPhoneOnLoads,input.contactEmail || '',published,nowIso(),id);
  audit(db,user,'COMPANY_PAGE_UPDATED','company_page',id,{});
}

export function getOwnCompanyPage(user) {
  const db = getDb();
  if (user.role === USER_ROLES.DRIVER) return db.prepare('SELECT * FROM company_pages WHERE provider_profile_id=?').get(user.provider_profile_id);
  return db.prepare('SELECT * FROM company_pages WHERE organization_id=?').get(user.organization_id);
}

export function getFleetNetworkCoverage(user) {
  if (user.role !== USER_ROLES.TRANSPORTER || !user.organization_id) return null;
  const db = getDb();
  const page = db.prepare('SELECT corridors FROM company_pages WHERE organization_id=?').get(user.organization_id);
  const corridorLabels = String(page?.corridors || '').split(/[;\n]/).map(value => value.trim()).filter(Boolean);
  const corridorPlaces = new Set(corridorLabels.flatMap(splitPlaces));
  const businesses = db.prepare(`SELECT o.id,o.name,o.handle,o.city,cp.operating_regions
    FROM partner_relationships rel
    JOIN organizations o ON o.id=rel.owner_organization_id
    LEFT JOIN company_pages cp ON cp.organization_id=o.id
    WHERE rel.provider_organization_id=? AND rel.status='SAVED'
    ORDER BY o.name`).all(user.organization_id).map(business => {
      const places = [...new Set([normalizePlace(business.city),...splitPlaces(business.operating_regions)].filter(Boolean))];
      const matched = places.filter(place => corridorPlaces.has(place));
      return {...business,places,matched_places:matched,coverage_label:matched.length ? `${matched.length} location${matched.length === 1 ? '' : 's'} on recorded corridors` : 'No recorded corridor match'};
    });
  return { corridors:corridorLabels,businesses };
}

const VERIFICATION_TYPES = Object.freeze({
  ORGANIZATION: ['IDENTITY','BUSINESS_LICENSE'],
  PROVIDER_PROFILE: ['IDENTITY','DRIVER_IDENTITY'],
  DRIVER: ['DRIVER_IDENTITY'],
  VEHICLE: ['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION']
});

function ownsVerificationSubject(db,user,subjectType,subjectId) {
  if (user.role === USER_ROLES.ADMIN) return true;
  if (subjectType === 'ORGANIZATION') return Boolean(user.organization_id && user.organization_id === subjectId);
  if (subjectType === 'PROVIDER_PROFILE') return Boolean(user.provider_profile_id && user.provider_profile_id === subjectId);
  if (subjectType === 'DRIVER') return Boolean(user.organization_id && db.prepare('SELECT 1 FROM drivers WHERE id=? AND organization_id=?').get(subjectId,user.organization_id));
  if (subjectType === 'VEHICLE') {
    return Boolean(db.prepare(`SELECT 1 FROM vehicles WHERE id=? AND
      ((organization_id IS NOT NULL AND organization_id=?) OR (provider_profile_id IS NOT NULL AND provider_profile_id=?))`)
      .get(subjectId,user.organization_id || '',user.provider_profile_id || ''));
  }
  return false;
}

export function getVerificationCenter(user) {
  const db = getDb();
  const subjects = [];
  if (user.organization_id) {
    subjects.push({subject_type:'ORGANIZATION',subject_id:user.organization_id,name:user.organization_name,type:'Workspace'});
    subjects.push(...db.prepare(`SELECT 'VEHICLE' AS subject_type,id AS subject_id,make || ' ' || model AS name,'Truck' AS type
      FROM vehicles WHERE organization_id=? AND active=1 ORDER BY label`).all(user.organization_id));
    subjects.push(...db.prepare(`SELECT 'DRIVER' AS subject_type,id AS subject_id,name,'Driver' AS type
      FROM drivers WHERE organization_id=? AND active=1 ORDER BY name`).all(user.organization_id));
  }
  if (user.provider_profile_id) {
    subjects.push({subject_type:'PROVIDER_PROFILE',subject_id:user.provider_profile_id,name:user.provider_business_name,type:'Self-managed driver'});
    subjects.push(...db.prepare(`SELECT 'VEHICLE' AS subject_type,id AS subject_id,make || ' ' || model AS name,'Truck' AS type
      FROM vehicles WHERE provider_profile_id=? AND active=1 ORDER BY label`).all(user.provider_profile_id));
  }
  const requests = db.prepare(`SELECT vr.*,reviewer.name AS reviewer_name FROM verification_requests vr
    LEFT JOIN users reviewer ON reviewer.id=vr.reviewed_by WHERE submitted_by=? ORDER BY submitted_at DESC`).all(user.id);
  const availableTypes = subject => {
    const approved = new Set(db.prepare(`SELECT verification_type FROM verification_requests
      WHERE subject_type=? AND subject_id=? AND status='APPROVED'`).all(subject.subject_type,subject.subject_id).map(row=>row.verification_type));
    if (subject.subject_type === 'VEHICLE' && (approved.has('VEHICLE_OWNERSHIP') || approved.has('VEHICLE_AUTHORIZATION'))) return [];
    return VERIFICATION_TYPES[subject.subject_type].filter(type=>!approved.has(type));
  };
  return {
    subjects: subjects.map(subject => ({...subject,allowed_types:availableTypes(subject),badges:verificationBadges(db,subject.subject_type,subject.subject_id)})),
    requests
  };
}

export function submitVerification(user,input,upload) {
  const db = getDb();
  const subjectType = String(input.subjectType || '');
  const subjectId = String(input.subjectId || '');
  const verificationType = String(input.verificationType || '');
  const documentName = String(input.documentName || '').trim();
  if (!VERIFICATION_TYPES[subjectType]?.includes(verificationType)) throw new Error('INVALID_VERIFICATION_TYPE');
  if (!ownsVerificationSubject(db,user,subjectType,subjectId)) throw new Error('FORBIDDEN');
  if (!documentName || !upload) throw new Error('VERIFICATION_DOCUMENT_REQUIRED');
  const existing = db.prepare(`SELECT 1 FROM verification_requests WHERE subject_type=? AND subject_id=? AND verification_type=?
    AND status IN ('PENDING','APPROVED')`).get(subjectType,subjectId,verificationType);
  if (existing) throw new Error('VERIFICATION_ALREADY_SUBMITTED');
  const id = randomId('verification-');
  db.prepare(`INSERT INTO verification_requests
    (id,subject_type,subject_id,verification_type,document_name,file_path,original_name,mime_type,status,submitted_by,reviewed_by,review_note,submitted_at,reviewed_at)
    VALUES (?,?,?,?,?,?,?,?, 'PENDING',?,NULL,NULL,?,NULL)`)
    .run(id,subjectType,subjectId,verificationType,documentName,upload.path,upload.originalName,upload.mimeType,user.id,nowIso());
  audit(db,user,'VERIFICATION_SUBMITTED','verification_request',id,{subjectType,subjectId,verificationType});
  return id;
}

export function listVerificationRequests(user) {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  return getDb().prepare(`SELECT vr.*,submitter.name AS submitter_name,reviewer.name AS reviewer_name
    FROM verification_requests vr JOIN users submitter ON submitter.id=vr.submitted_by
    LEFT JOIN users reviewer ON reviewer.id=vr.reviewed_by
    ORDER BY CASE vr.status WHEN 'PENDING' THEN 0 WHEN 'MORE_INFO' THEN 1 ELSE 2 END,vr.submitted_at DESC`).all();
}

export function reviewVerification(user,requestId,status,note='') {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  if (!['APPROVED','REJECTED','MORE_INFO'].includes(status)) throw new Error('INVALID_STATUS');
  const db = getDb();
  const request = db.prepare('SELECT * FROM verification_requests WHERE id=?').get(requestId);
  if (!request) throw new Error('NOT_FOUND');
  if (['APPROVED','REJECTED'].includes(request.status)) throw new Error('VERIFICATION_ALREADY_REVIEWED');
  const timestamp = nowIso();
  db.prepare(`UPDATE verification_requests SET status=?,reviewed_by=?,review_note=?,reviewed_at=? WHERE id=?`)
    .run(status,user.id,String(note || '').trim() || null,timestamp,requestId);
  audit(db,user,'VERIFICATION_REVIEWED','verification_request',requestId,{status,subjectType:request.subject_type,subjectId:request.subject_id,verificationType:request.verification_type});
}

export function getVerificationFile(user,requestId) {
  const db = getDb();
  const request = db.prepare('SELECT * FROM verification_requests WHERE id=?').get(requestId);
  if (!request) return null;
  if (user.role !== USER_ROLES.ADMIN && request.submitted_by !== user.id) return null;
  return request;
}

export function submitBusinessReview(user,shipmentId,rating,note='') {
  const db = getDb();
  const shipment = db.prepare('SELECT * FROM shipments WHERE id=? OR code=?').get(shipmentId,shipmentId);
  if (!shipment || shipment.operational_status !== 'COMPLETED' || !user.organization_id) throw new Error('REVIEW_NOT_ALLOWED');
  const parties = [shipment.shipper_organization_id,shipment.receiver_organization_id].filter(Boolean);
  if (parties.length !== 2 || !parties.includes(user.organization_id)) throw new Error('REVIEW_NOT_ALLOWED');
  const subjectOrganizationId = parties.find(id => id !== user.organization_id);
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('INVALID_RATING');
  try {
    const id = randomId('review-');
    db.prepare(`INSERT INTO business_reviews
      (id,shipment_id,reviewer_organization_id,subject_organization_id,rating,note,created_by,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(id,shipment.id,user.organization_id,subjectOrganizationId,value,String(note || '').trim() || null,user.id,nowIso());
    audit(db,user,'BUSINESS_REVIEW_SUBMITTED','business_review',id,{shipmentId:shipment.id,subjectOrganizationId,rating:value});
    return id;
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) throw new Error('REVIEW_ALREADY_SUBMITTED');
    throw error;
  }
}

export function listOwnTruckRouteOptions(user) {
  if (![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) return [];
  const latestByVehicle = new Map();
  for (const capacity of listOwnCapacity(user)) {
    if (!latestByVehicle.has(capacity.vehicle_id)) latestByVehicle.set(capacity.vehicle_id,capacity);
  }
  return [...latestByVehicle.values()]
    .filter(capacity => ['EMPTY','PARTIAL'].includes(capacity.status) && new Date(capacity.expires_at).getTime() > Date.now() && (capacity.origin || capacity.destination))
    .map(capacity => ({
    id: capacity.id,
    vehicle_id: capacity.vehicle_id,
    label: `${capacity.vehicle_make || ''} ${capacity.vehicle_model || ''}`.trim() || capacity.vehicle_label,
    origin: capacity.origin,
    destination: capacity.destination
  }));
}

export function listOwnLoadRouteOptions(user) {
  if (![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)) return [];
  return listVisibleShipments(user)
    .filter(load => ['POSTED','SENT','CONTACTED'].includes(load.operational_status))
    .map(load => ({ id:load.id,code:load.code,title:load.title,origin:load.origin,destination:load.destination,load_type:load.load_type }));
}

export function listLoads(user, mode = 'ALL', filters = {}) {
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
  let rows = db.prepare(`SELECT s.*,o.name AS shipper_name,r.name AS receiver_name,
    CASE WHEN cp.show_contact_phone_on_loads=1 THEN cp.contact_phone ELSE NULL END AS load_contact_phone,
    EXISTS(SELECT 1 FROM shipment_interests i WHERE i.shipment_id=s.id AND (i.provider_organization_id=? OR i.provider_profile_id=?)) AS interested
    FROM shipments s JOIN organizations o ON o.id=s.shipper_organization_id LEFT JOIN organizations r ON r.id=s.receiver_organization_id
    LEFT JOIN company_pages cp ON cp.organization_id=s.shipper_organization_id
    WHERE ${where} ORDER BY s.created_at DESC`).all(user.organization_id || '',user.provider_profile_id || '',...args)
    .filter(shipment => canViewShipment(user,shipment));
  const selectedRoute = filters.matchCapacityId
    ? listOwnTruckRouteOptions(user).find(option => option.id === filters.matchCapacityId)
    : null;
  rows = rows
    .filter(load => !filters.q || [load.title,load.cargo_description,load.shipper_name,load.origin,load.destination,load.vehicle_category].some(value => textIncludes(value,filters.q)))
    .filter(load => !filters.origin || textIncludes(load.origin,filters.origin))
    .filter(load => !filters.destination || textIncludes(load.destination,filters.destination))
    .filter(load => !filters.loadType || load.load_type === filters.loadType)
    .filter(load => !filters.vehicleCategory || load.vehicle_category === filters.vehicleCategory)
    .map(load => {
      const match = selectedRoute ? routeMatch(load.origin,load.destination,selectedRoute.origin,selectedRoute.destination) : null;
      return {...load,route_match_score:match?.score ?? null,route_match_label:match?.label ?? null};
    });
  if (selectedRoute) rows.sort((a,b) => b.route_match_score-a.route_match_score || new Date(b.created_at)-new Date(a.created_at));
  return rows;
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

export function requestLoadProof(user, shipmentId) {
  if (!roleCanBrowseLoads(user.role)) throw new Error('FORBIDDEN');
  const db = getDb();
  const shipment = getShipmentForUser(user,shipmentId);
  if (!shipment || shipment.service_mode !== SERVICE_MODES.FREIGHT) throw new Error('NOT_FOUND');
  const interest = db.prepare(`SELECT * FROM shipment_interests WHERE shipment_id=? AND (provider_organization_id=? OR provider_profile_id=?)`)
    .get(shipment.id,user.organization_id || '',user.provider_profile_id || '');
  if (!interest) throw new Error('NOT_FOUND');
  const existing = db.prepare('SELECT * FROM load_proof_requests WHERE interest_id=?').get(interest.id);
  if (existing) return existing.id;
  const id = randomId('load-proof-request-');
  db.prepare(`INSERT INTO load_proof_requests (id,shipment_id,interest_id,requested_at,fulfilled_at) VALUES (?,?,?,?,NULL)`)
    .run(id,shipment.id,interest.id,nowIso());
  const owner = db.prepare(`SELECT id FROM users WHERE organization_id=? AND active=1 ORDER BY created_at LIMIT 1`).get(shipment.shipper_organization_id);
  if (owner) notify(db,owner.id,'Load proof requested',`${user.organization_name || user.provider_business_name || user.name} requested load-size proof for ${shipment.code}.`);
  audit(db,user,'LOAD_PROOF_REQUESTED','shipment',shipment.id,{ interestId: interest.id });
  return id;
}

export async function shareLoadProof(user, shipmentId, interestId, file, note = '') {
  const db = getDb();
  const shipment = db.prepare(`SELECT * FROM shipments WHERE id=? OR code=?`).get(shipmentId,shipmentId);
  if (!shipment || (user.role !== USER_ROLES.ADMIN && shipment.shipper_organization_id !== user.organization_id)) throw new Error('NOT_FOUND');
  if (shipment.service_mode !== SERVICE_MODES.FREIGHT) throw new Error('NOT_FOUND');
  const interest = db.prepare('SELECT * FROM shipment_interests WHERE id=? AND shipment_id=?').get(interestId,shipment.id);
  if (!interest) throw new Error('INVALID_INTEREST');
  const upload = await saveUpload(file,'load-proof');
  if (!upload) throw new Error('FILE_REQUIRED');
  const timestamp = nowIso();
  const expiresAt = hoursFromNow(Number(process.env.LOAD_PROOF_SHARE_HOURS || 48));
  const id = randomId('load-proof-');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE load_proof_shares SET revoked_at=? WHERE interest_id=? AND revoked_at IS NULL').run(timestamp,interest.id);
    db.prepare(`INSERT INTO load_proof_shares (id,shipment_id,interest_id,file_path,original_name,mime_type,note,uploaded_by,created_at,expires_at,revoked_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,NULL)`).run(id,shipment.id,interest.id,upload.path,upload.originalName,upload.mimeType,note || null,user.id,timestamp,expiresAt);
    db.prepare('UPDATE load_proof_requests SET fulfilled_at=? WHERE interest_id=?').run(timestamp,interest.id);
    const recipient = interest.provider_organization_id
      ? db.prepare(`SELECT id FROM users WHERE organization_id=? AND active=1 ORDER BY created_at LIMIT 1`).get(interest.provider_organization_id)
      : db.prepare(`SELECT user_id AS id FROM provider_profiles WHERE id=?`).get(interest.provider_profile_id);
    if (recipient) notify(db,recipient.id,'Load proof shared',`Temporary load-size proof is available for ${shipment.code}.`);
    audit(db,user,'LOAD_PROOF_SHARED','shipment',shipment.id,{ interestId: interest.id, proofId: id, expiresAt });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    if (fs.existsSync(upload.path)) fs.rmSync(upload.path);
    throw error;
  }
  return id;
}

export function getLoadProofFile(user, proofId) {
  const share = getDb().prepare(`SELECT ps.*,i.provider_organization_id AS recipient_organization_id,i.provider_profile_id AS recipient_profile_id,
    s.shipper_organization_id,s.provider_organization_id AS assigned_organization_id,s.provider_profile_id AS assigned_profile_id,s.operational_status
    FROM load_proof_shares ps JOIN shipment_interests i ON i.id=ps.interest_id JOIN shipments s ON s.id=ps.shipment_id WHERE ps.id=?`).get(proofId);
  if (!share) return null;
  if (user.role === USER_ROLES.ADMIN || (user.organization_id && user.organization_id === share.shipper_organization_id)) return share;
  const isRecipient = (user.organization_id && user.organization_id === share.recipient_organization_id)
    || (user.provider_profile_id && user.provider_profile_id === share.recipient_profile_id);
  if (!isRecipient || share.revoked_at || new Date(share.expires_at).getTime() <= Date.now()) return null;
  if (['WITHDRAWN','CANCELLED','COMPLETED','DECLINED'].includes(share.operational_status)) return null;
  if (share.assigned_organization_id && share.assigned_organization_id !== share.recipient_organization_id) return null;
  if (share.assigned_profile_id && share.assigned_profile_id !== share.recipient_profile_id) return null;
  return share;
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
  return db.prepare(`SELECT c.*,v.label AS vehicle_label,v.category AS vehicle_category,v.make AS vehicle_make,v.model AS vehicle_model,v.cargo_configuration,o.name AS organization_name,o.handle AS organization_handle,
    p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    JOIN users u ON u.id=c.updated_by
    WHERE c.visibility='OPEN' AND c.status IN ('EMPTY','PARTIAL') AND c.expires_at > ? ORDER BY c.updated_at DESC`).all(nowIso())
    .map(row => marketCapacityRow(row,freshHours));
}

function marketCapacityRow(row, freshHours, additions = {}) {
  const { photo_path: _privatePhotoPath, ...visible } = row;
  return {
    ...visible,
    ...additions,
    proof_available: Boolean(row.photo_path),
    freshness: capacityFreshness(row.updated_at,row.expires_at,freshHours)
  };
}

function listRelationshipCapacity(user) {
  if (![USER_ROLES.SHIPPER, USER_ROLES.RECEIVER].includes(user.role) || !user.organization_id) return [];
  const db = getDb();
  const freshHours = Number(process.env.CAPACITY_FRESH_HOURS || 12);
  return db.prepare(`SELECT c.*,v.label AS vehicle_label,v.category AS vehicle_category,v.make AS vehicle_make,v.model AS vehicle_model,v.cargo_configuration,o.name AS organization_name,o.handle AS organization_handle,
    p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    JOIN users u ON u.id=c.updated_by
    JOIN partner_relationships rel ON rel.owner_organization_id=?
      AND rel.status='SAVED'
      AND (rel.provider_organization_id=c.provider_organization_id OR rel.provider_profile_id=c.provider_profile_id)
    WHERE c.visibility='SAVED_PARTNERS' AND c.status IN ('EMPTY','PARTIAL') AND c.expires_at > ?
    ORDER BY c.updated_at DESC`).all(user.organization_id,nowIso())
    .map(row => marketCapacityRow(row,freshHours,{ relationshipVisible: true }));
}

export function listMarketCapacity(user, filters = {}) {
  const rows = [
    ...listPublicCapacity(),
    ...listRelationshipCapacity(user)
  ];
  const seen = new Set();
  const selectedLoad = filters.matchLoadId
    ? listOwnLoadRouteOptions(user).find(option => option.id === filters.matchLoadId)
    : null;
  const visible = rows.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    if (user.role === USER_ROLES.TRANSPORTER && row.provider_organization_id === user.organization_id) return false;
    if (user.role === USER_ROLES.DRIVER && row.provider_profile_id === user.provider_profile_id) return false;
    return true;
  });
  const filtered = visible
    .filter(row => !filters.q || [row.vehicle_make,row.vehicle_model,row.cargo_configuration,row.organization_name,row.provider_name,row.origin,row.destination,row.location_area].some(value => textIncludes(value,filters.q)))
    .filter(row => !filters.origin || textIncludes(row.origin,filters.origin))
    .filter(row => !filters.destination || textIncludes(row.destination,filters.destination))
    .filter(row => !filters.status || row.status === filters.status)
    .filter(row => !filters.loadType || (filters.loadType === 'FTL' ? row.accepts_full_load : row.accepts_partial_load))
    .filter(row => !filters.vehicleCategory || row.cargo_configuration === filters.vehicleCategory || row.vehicle_category === filters.vehicleCategory)
    .map(row => {
      const match = selectedLoad ? routeMatch(row.origin,row.destination,selectedLoad.origin,selectedLoad.destination) : null;
      return {...row,route_match_score:match?.score ?? null,route_match_label:match?.label ?? null};
    });
  if (selectedLoad) filtered.sort((a,b) => b.route_match_score-a.route_match_score || new Date(b.updated_at)-new Date(a.updated_at));
  return filtered;
}

export function listOwnCapacity(user) {
  if (!roleCanPublishCapacity(user.role) || user.role === USER_ROLES.ADMIN) return [];
  const db = getDb();
  const freshHours = Number(process.env.CAPACITY_FRESH_HOURS || 12);
  const ownCondition = user.role === USER_ROLES.DRIVER ? 'c.provider_profile_id=?' : 'c.provider_organization_id=?';
  const ownId = user.role === USER_ROLES.DRIVER ? user.provider_profile_id : user.organization_id;
  return db.prepare(`SELECT c.*,v.label AS vehicle_label,v.category AS vehicle_category,v.make AS vehicle_make,v.model AS vehicle_model,v.cargo_configuration,o.name AS organization_name,o.handle AS organization_handle,
    p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id JOIN users u ON u.id=c.updated_by
    WHERE ${ownCondition} ORDER BY c.updated_at DESC`).all(ownId)
    .map(row => ({ ...row, proof_available: Boolean(row.photo_path), freshness: capacityFreshness(row.updated_at,row.expires_at,freshHours), isOwn: true }));
}

export function listCapacity(user) {
  const visibleRows = listMarketCapacity(user).map(row => ({ ...row, isOwn: false }));
  if (!roleCanPublishCapacity(user.role) || user.role === USER_ROLES.ADMIN) return visibleRows;
  const ownRows = listOwnCapacity(user);
  const ownIds = new Set(ownRows.map(r => r.id));
  return [...ownRows,...visibleRows.filter(r => !ownIds.has(r.id))];
}

export function getCapacityForUser(user, capacityId) {
  const visible = listMarketCapacity(user).find(row => row.id === capacityId);
  if (visible) return visible;
  if (roleCanPublishCapacity(user.role) && user.role !== USER_ROLES.ADMIN) {
    return listOwnCapacity(user).find(row => row.id === capacityId) || null;
  }
  return null;
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
  const acceptedLoads = validateAcceptedLoads(input.status,input.acceptedLoads);
  const visibility = input.visibility || 'OPEN';
  if (!['OPEN','SAVED_PARTNERS'].includes(visibility)) throw new Error('INVALID_CAPACITY_VISIBILITY');
  if (input.status !== 'OFF_DUTY' && !input.locationArea?.trim()) throw new Error('CAPACITY_AREA_REQUIRED');
  const hasDeviceArea = input.status !== 'OFF_DUTY' && input.locationSource === 'DEVICE_OBSCURED';
  const locationLat = hasDeviceArea ? Number(input.approximateLat) : null;
  const locationLng = hasDeviceArea ? Number(input.approximateLng) : null;
  const locationPrecisionKm = hasDeviceArea ? Number(input.locationPrecisionKm) : null;
  if (hasDeviceArea && (!Number.isFinite(locationLat) || locationLat < -90 || locationLat > 90 || !Number.isFinite(locationLng) || locationLng < -180 || locationLng > 180 || locationPrecisionKm !== 40)) {
    throw new Error('INVALID_APPROXIMATE_LOCATION');
  }
  const expiresHours = Number(process.env.CAPACITY_EXPIRES_HOURS || 24);
  const timestamp = nowIso();
  const expiresAt = hoursFromNow(expiresHours);
  const id = randomId('cap-');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE capacities SET expires_at=? WHERE vehicle_id=? AND expires_at>?`).run(timestamp,vehicle.id,timestamp);
    db.prepare(`INSERT INTO capacities
      (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,proof_recorded_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,user.role === USER_ROLES.TRANSPORTER ? user.organization_id : null,user.role === USER_ROLES.DRIVER ? user.provider_profile_id : null,vehicle.id,input.status,percent,input.origin || null,input.destination || null,input.corridor || `${input.origin || ''} → ${input.destination || ''}`,input.travelDate || null,input.nextAvailable || null,visibility,photo?.path || null,user.id,timestamp,expiresAt,input.status === 'OFF_DUTY' ? null : input.locationArea.trim(),input.status === 'OFF_DUTY' ? null : timestamp,locationLat,locationLng,locationPrecisionKm,hasDeviceArea ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA',acceptedLoads.acceptsFullLoad ? 1 : 0,acceptedLoads.acceptsPartialLoad ? 1 : 0,input.openToContractLanes ? 1 : 0,input.acceptsMultiStop ? 1 : 0,photo?.path ? timestamp : null);
    audit(db,user,'CAPACITY_PUBLISHED','capacity',id,{ status: input.status, percent, vehicleId: vehicle.id, locationArea: input.status === 'OFF_DUTY' ? null : input.locationArea.trim(), locationSource: hasDeviceArea ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA', locationPrecisionKm, acceptedLoads: input.status === 'OFF_DUTY' ? null : input.acceptedLoads, openToContractLanes: Boolean(input.openToContractLanes), acceptsMultiStop: Boolean(input.acceptsMultiStop), proofRecorded: Boolean(photo?.path) });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
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
        db.prepare(`INSERT INTO company_pages (id,organization_id,provider_profile_id,headline,about,services,corridors,operating_regions,contact_phone,contact_email,published,updated_at) VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?)`)
          .run(randomId('page-'),providerId,'Independent B2B freight provider','Complete this company page before publishing.','','','','','',0,nowIso());
        db.prepare('UPDATE users SET provider_profile_id=?,active=1 WHERE id=?').run(providerId,application.user_id);
        db.prepare(`INSERT INTO subscriptions (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at) VALUES (?,NULL,?,'plan-solo','PAYMENT_UNDER_REVIEW','FLAT_MONTHLY',?,NULL)`).run(randomId('sub-'),providerId,nowIso());
      } else {
        const orgId = randomId('org-');
        db.prepare(`INSERT INTO organizations (id,name,handle,type,verified,industry,description,phone,email,city,public_visibility,created_at) VALUES (?,?,?,?,1,NULL,?,NULL,NULL,NULL,'PUBLIC',?)`)
          .run(orgId,application.business_name,handle,application.application_type,'New approved Loadgistic business.',nowIso());
        db.prepare(`INSERT INTO memberships (id,user_id,organization_id,membership_role) VALUES (?,?,?,'OWNER')`).run(randomId('mem-'),application.user_id,orgId);
        db.prepare(`INSERT INTO company_pages (id,organization_id,provider_profile_id,headline,about,services,corridors,operating_regions,contact_phone,contact_email,published,updated_at) VALUES (?,?,NULL,?,?,?,?,?,?,?,0,?)`)
          .run(randomId('page-'),orgId,'B2B logistics company page','Complete this company page before publishing.','','','','','',nowIso());
        db.prepare('UPDATE users SET organization_id=?,active=1 WHERE id=?').run(orgId,application.user_id);
        const planId = application.application_type === 'TRANSPORT_COMPANY' ? 'plan-transport' : 'plan-business';
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
    WHERE s.tracking_token=?`).get(token);
  if (!shipment) return null;
  shipment.events = db.prepare(`SELECT status,event_type,note,location_area,location_precision_km,location_source,created_at
    FROM shipment_events WHERE shipment_id=(SELECT id FROM shipments WHERE tracking_token=?) AND public=1 ORDER BY created_at ASC`).all(token);
  return shipment;
}


function slugify(value) {
  return String(value || 'business').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42) || 'business';
}

export function createBusinessApplication(input) {
  const db = getDb();
  if (!input.name || !input.email || !input.phone || !input.password || !input.businessName || !input.applicationType) throw new Error('MISSING_REQUIRED_FIELDS');
  if (String(input.password).length < 10) throw new Error('PASSWORD_TOO_SHORT');
  if (findUserByEmail(input.email)) throw new Error('EMAIL_ALREADY_EXISTS');
  const roleMap = {
    ENTERPRISE_SHIPPER: 'SHIPPER',
    ENTERPRISE_RECEIVER: 'RECEIVER',
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
    db.prepare(`INSERT INTO users (id,email,phone,password_hash,name,role,organization_id,provider_profile_id,active,created_at) VALUES (?,?,?,?,?,?,?,?,0,?)`)
      .run(userId,input.email.toLowerCase(),String(input.phone).trim(),hashPassword(input.password),input.name,role,null,null,timestamp);
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
