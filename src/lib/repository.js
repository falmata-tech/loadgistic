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
import {
  hashPassword,
  hashTrackingAccessCode,
  randomCode,
  randomId,
  trackingAccessCode
} from './security.js';
import { normalizePlace, routeMatch, splitPlaces, textIncludes } from './route-matching.js';
import { ETHIOPIA_PLACES, getPlaceCoordinate as getBuiltInPlaceCoordinate } from './ethiopia-places.js';
import { poolCompatibleLoads } from './pstl.js';
import { placeIdentity, placeLabel, placeLocalName, qualifyAreaLabel, qualifyPlaceList } from './place-labels.js';

function nowIso() {
  return new Date().toISOString();
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function todayInEthiopia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone:'Africa/Addis_Ababa',
    year:'numeric',
    month:'2-digit',
    day:'2-digit'
  }).format(new Date());
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

function isSelfManagedDriver(user) {
  return user.role === USER_ROLES.DRIVER && Boolean(user.provider_profile_id);
}

function isCompanyDriver(user) {
  return user.role === USER_ROLES.DRIVER && Boolean(user.organization_id) && !user.provider_profile_id;
}

function providerScope(user) {
  if (isSelfManagedDriver(user)) return { column:'provider_profile_id', id:user.provider_profile_id, organizationId:null, profileId:user.provider_profile_id };
  if ([USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role) && user.organization_id) {
    return { column:'provider_organization_id', id:user.organization_id, organizationId:user.organization_id, profileId:null };
  }
  return null;
}

export function getDriverAccess(user) {
  if (isSelfManagedDriver(user)) {
    return {
      kind:'SELF_MANAGED',
      can_browse_load_board:true,
      can_contact_businesses:true,
      can_negotiate_loads:true,
      can_manage_capacity:true
    };
  }
  if (!isCompanyDriver(user)) return null;
  const stored = getDb().prepare('SELECT * FROM driver_permissions WHERE user_id=?').get(user.id);
  return {
    kind:'COMPANY',
    can_browse_load_board:Boolean(stored?.can_browse_load_board ?? 1),
    can_contact_businesses:Boolean(stored?.can_contact_businesses ?? 1),
    can_negotiate_loads:Boolean(stored?.can_negotiate_loads ?? 1),
    can_manage_capacity:Boolean(stored?.can_manage_capacity ?? 1)
  };
}

function canBrowseLoads(user) {
  if (!roleCanBrowseLoads(user.role)) return false;
  const access = getDriverAccess(user);
  return access ? access.can_browse_load_board : true;
}

function canContactBusinesses(user) {
  const access = getDriverAccess(user);
  return access ? access.can_contact_businesses && access.can_browse_load_board : true;
}

function canNegotiateLoads(user) {
  const access = getDriverAccess(user);
  return access ? access.can_negotiate_loads && access.can_contact_businesses && access.can_browse_load_board : true;
}

export function searchPlaces(query,limit=20) {
  const normalized = normalizePlace(placeLocalName(query));
  if (normalized.length < 2) return [];
  const boundedLimit = Math.max(1,Math.min(Number(limit)||20,50));
  const db = getDb();
  const imported = db.prepare(`SELECT id,name,name || ', ' || country_name AS display_name,country_name,country_code,
      place_type,latitude AS lat,longitude AS lng,population,wikidata_id,source
    FROM place_catalog
    WHERE normalized_name LIKE ? OR lower(COALESCE(alternate_names,'')) LIKE ?
    ORDER BY
      CASE WHEN normalized_name=? THEN 0 WHEN normalized_name LIKE ? THEN 1 ELSE 2 END,
      CASE place_type WHEN 'city' THEN 0 WHEN 'town' THEN 1 WHEN 'village' THEN 2 ELSE 3 END,
      COALESCE(population,0) DESC,name
    LIMIT ?`).all(`%${normalized}%`,`%${normalized}%`,normalized,`${normalized}%`,boundedLimit);
  const seen = new Set(imported.map(place=>placeIdentity(place.display_name)));
  const fallback = ETHIOPIA_PLACES
    .filter(place=>normalizePlace(place.name).includes(normalized)&&!seen.has(placeIdentity(place.name)))
    .map(place=>({id:`builtin:${normalizePlace(place.name)}`,name:place.name,display_name:placeLabel(place.name),country_name:'Ethiopia',country_code:'ET',place_type:'city',lat:place.lat,lng:place.lng,population:null,wikidata_id:null,source:'BUILT_IN'}));
  return [...imported,...fallback].slice(0,boundedLimit);
}

export function getPlaceCoordinate(value) {
  const normalized = normalizePlace(placeLocalName(value));
  if (!normalized) return null;
  const imported = getDb().prepare(`SELECT name,latitude AS lat,longitude AS lng,place_type
    FROM place_catalog
    WHERE normalized_name=? OR lower(COALESCE(alternate_names,'')) LIKE ?
    ORDER BY CASE place_type WHEN 'city' THEN 0 WHEN 'town' THEN 1 WHEN 'village' THEN 2 ELSE 3 END,
      COALESCE(population,0) DESC LIMIT 1`).get(normalized,`%${normalized}%`);
  return imported || getBuiltInPlaceCoordinate(value);
}

export function searchDirectory(user,query,kind='ALL',limit=20) {
  const value=String(query||'').trim().toLowerCase();
  if(value.length<2)return [];
  const boundedLimit=Math.max(1,Math.min(Number(limit)||20,50));
  const pattern=`%${value}%`;
  const db=getDb();
  const results=[];
  if(kind==='ALL'||kind==='BUSINESS'){
    results.push(...db.prepare(`SELECT o.id,'org' AS ref_kind,o.name,o.type,o.city,
      EXISTS(SELECT 1 FROM member_favorites f WHERE f.owner_organization_id=? AND f.target_organization_id=o.id) AS is_favorite
      FROM organizations o
      WHERE o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER') AND o.id<>?
        AND (lower(o.name) LIKE ? OR lower(COALESCE(o.city,'')) LIKE ? OR lower(COALESCE(o.industry,'')) LIKE ?)
      ORDER BY is_favorite DESC,CASE WHEN lower(o.name)=? THEN 0 WHEN lower(o.name) LIKE ? THEN 1 ELSE 2 END,o.name
      LIMIT ?`).all(user.organization_id||'',user.organization_id||'',pattern,pattern,pattern,value,`${value}%`,boundedLimit));
  }
  if(kind==='ALL'||kind==='TRANSPORT'){
    results.push(...db.prepare(`SELECT * FROM (
      SELECT o.id,'org' AS ref_kind,o.name,o.type,o.city,0 AS is_favorite
      FROM organizations o WHERE o.type='TRANSPORT_COMPANY'
        AND (lower(o.name) LIKE ? OR lower(COALESCE(o.city,'')) LIKE ?)
      UNION ALL
      SELECT p.id,'profile' AS ref_kind,p.business_name AS name,'INDEPENDENT_PROVIDER' AS type,p.city,0 AS is_favorite
      FROM provider_profiles p WHERE lower(p.business_name) LIKE ? OR lower(COALESCE(p.city,'')) LIKE ?
    ) ORDER BY CASE WHEN lower(name)=? THEN 0 WHEN lower(name) LIKE ? THEN 1 ELSE 2 END,name LIMIT ?`)
      .all(pattern,pattern,pattern,pattern,value,`${value}%`,boundedLimit));
  }
  return results.slice(0,boundedLimit);
}

export function getMemberSelection(reference) {
  const [kind,id]=String(reference||'').split(':');
  const db=getDb();
  if(kind==='org'){
    const row=db.prepare(`SELECT id,'org' AS ref_kind,name,type,city FROM organizations WHERE id=?`).get(id);
    return row?{...row,ref:`org:${row.id}`}:null;
  }
  if(kind==='profile'){
    const row=db.prepare(`SELECT id,'profile' AS ref_kind,business_name AS name,'INDEPENDENT_PROVIDER' AS type,city FROM provider_profiles WHERE id=?`).get(id);
    return row?{...row,ref:`profile:${row.id}`}:null;
  }
  return null;
}

export function setBusinessFavorite(user,targetOrganizationId,isFavorite) {
  if(![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)||!user.organization_id)throw new Error('FORBIDDEN');
  const db=getDb();
  const target=db.prepare(`SELECT id FROM organizations WHERE id=? AND id<>? AND type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')`)
    .get(targetOrganizationId,user.organization_id);
  if(!target)throw new Error('INVALID_NETWORK_TARGET');
  if(isFavorite){
    db.prepare(`INSERT OR IGNORE INTO member_favorites
      (id,owner_organization_id,target_organization_id,created_by,created_at) VALUES (?,?,?,?,?)`)
      .run(randomId('favorite-'),user.organization_id,target.id,user.id,nowIso());
  }else{
    db.prepare('DELETE FROM member_favorites WHERE owner_organization_id=? AND target_organization_id=?')
      .run(user.organization_id,target.id);
  }
  audit(db,user,'BUSINESS_FAVORITE_CHANGED','organization',target.id,{isFavorite:Boolean(isFavorite)});
}

export function getUserById(id) {
  return getDb().prepare(`
    SELECT u.*, o.name AS organization_name, o.handle AS organization_handle, o.type AS organization_type,
           p.business_name AS provider_business_name, p.handle AS provider_handle,
           CASE WHEN u.role='DRIVER' AND u.provider_profile_id IS NOT NULL THEN 'SELF_MANAGED'
                WHEN u.role='DRIVER' AND u.organization_id IS NOT NULL THEN 'COMPANY' END AS driver_kind,
           COALESCE(dp.can_browse_load_board,1) AS can_browse_load_board,
           COALESCE(dp.can_contact_businesses,1) AS can_contact_businesses,
           COALESCE(dp.can_negotiate_loads,1) AS can_negotiate_loads,
           COALESCE(dp.can_manage_capacity,1) AS can_manage_capacity
    FROM users u
    LEFT JOIN organizations o ON o.id = u.organization_id
    LEFT JOIN provider_profiles p ON p.id = u.provider_profile_id
    LEFT JOIN driver_permissions dp ON dp.user_id=u.id
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
      { href: '/admin/operations', label: 'Open platform operations', description: 'Inspect accounts, workspaces, trucks, loads, and current capacity.' },
      { href: '/admin/applications', label: 'Review applications', description: 'Approve or request more information.' },
      { href: '/app/providers', label: 'View transporter directory', description: 'Inspect authenticated transporter pages.' }
    ];
    data.recent = db.prepare('SELECT code,title,service_mode,operational_status,origin,destination,created_at FROM shipments ORDER BY created_at DESC LIMIT 6').all();
    return data;
  }

  if (user.role === USER_ROLES.SHIPPER || user.role === USER_ROLES.RECEIVER) {
    const condition = 'COALESCE(load_owner_organization_id,shipper_organization_id) = ? OR shipper_organization_id = ? OR receiver_organization_id = ?';
    data.counts = {
      'Active Loads': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE (${condition}) AND operational_status NOT IN ('COMPLETED','CANCELLED','RETURNED')`).get(user.organization_id,user.organization_id,user.organization_id).n,
      'Open Requests': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE (${condition}) AND commercial_status IN ('POSTED','SENT','CONTACTED')`).get(user.organization_id,user.organization_id,user.organization_id).n,
      'Network Partners': db.prepare(`SELECT COUNT(*) AS n FROM partner_relationships WHERE owner_organization_id=? AND status='CONNECTED'`).get(user.organization_id).n,
      'Recent Updates': db.prepare(`SELECT COUNT(*) AS n FROM shipment_events e JOIN shipments s ON s.id=e.shipment_id WHERE (${condition}) AND e.created_at >= datetime('now','-7 days')`).get(user.organization_id,user.organization_id,user.organization_id).n
    };
    data.actions = [
      { href: '/app/shipments/new', label: 'Post a load', description: 'Request quotes or publish a road-freight load.' },
      { href: '/app/providers', label: 'Open directory', description: 'Confirm Businesses, fleet transporters, and self-managed drivers.' },
      { href: '/app/capacity', label: 'Open Capacity Board', description: 'See fresh truck availability on active routes.' }
    ];
    data.recent = listVisibleShipments(user).slice(0,6);
    return data;
  }

  const scope = providerScope(user);
  if (!scope) return data;
  data.counts = {
    'Available Loads': listLoads(user).length,
    'Active Loads': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE ${scope.column}=? AND operational_status NOT IN ('COMPLETED','CANCELLED')`).get(scope.id).n,
    'Current Capacity': db.prepare(`SELECT COUNT(*) AS n FROM capacities WHERE ${scope.column}=? AND expires_at > ?`).get(scope.id,nowIso()).n,
    'Proof Pending': db.prepare(`SELECT COUNT(*) AS n FROM shipments s WHERE s.${scope.column}=? AND s.operational_status IN ('DELIVERED','IN_TRANSIT') AND NOT EXISTS (SELECT 1 FROM proof_files p WHERE p.shipment_id=s.id AND p.proof_type='DELIVERY')`).get(scope.id).n
  };
  data.actions = [
    { href: '/app/loads', label: 'Open Load Board', description: 'View direct, partner, and open B2B freight.' },
    { href: user.role === USER_ROLES.TRANSPORTER ? '/app/fleet' : '/app/home', label: 'Update capacity', description: 'Publish Empty or Partial truck availability.' },
    { href: '/app/company-page', label: 'Update Public Profile', description: 'Keep Preferred Routes and contact details current.' }
  ];
  data.recent = listVisibleShipments(user).slice(0, 6);
  data.capacities = listCapacity(user).filter(item => item.isOwn).slice(0, 3);
  return data;
}

export function listVisibleShipments(user) {
  const db = getDb();
  let sql = `SELECT s.*, so.name AS shipper_name,so.handle AS shipper_handle,ro.name AS receiver_name,ro.handle AS receiver_handle,po.name AS provider_name,
    pp.business_name AS provider_profile_name,owner.name AS load_owner_name
    FROM shipments s
    LEFT JOIN organizations so ON so.id=s.shipper_organization_id
    LEFT JOIN organizations ro ON ro.id=s.receiver_organization_id
    LEFT JOIN organizations po ON po.id=s.provider_organization_id
    LEFT JOIN provider_profiles pp ON pp.id=s.provider_profile_id
    LEFT JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    WHERE s.operational_status IN ('AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED')`;
  const args = [];
  if (user.role === USER_ROLES.ADMIN) {
    sql += ' ORDER BY s.updated_at DESC';
  } else if (user.role === USER_ROLES.SHIPPER || user.role === USER_ROLES.RECEIVER) {
    sql += ' AND (COALESCE(s.load_owner_organization_id,s.shipper_organization_id)=? OR s.shipper_organization_id=? OR s.receiver_organization_id=?) ORDER BY s.updated_at DESC';
    args.push(user.organization_id,user.organization_id,user.organization_id);
  } else if (user.role === USER_ROLES.TRANSPORTER || isCompanyDriver(user)) {
    sql += ' AND s.provider_organization_id=? ORDER BY s.updated_at DESC';
    args.push(user.organization_id);
  } else {
    sql += ' AND s.provider_profile_id=? ORDER BY s.updated_at DESC';
    args.push(user.provider_profile_id);
  }
  return db.prepare(sql).all(...args).map(shipment=>({
    ...shipment,
    shipper_name:shipment.external_shipper_name||shipment.shipper_name,
    receiver_name:shipment.external_receiver_name||shipment.receiver_name
  }));
}

export function listOwnedLoads(user) {
  if(![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)||!user.organization_id)return [];
  return getDb().prepare(`SELECT s.*,
    COALESCE(s.external_shipper_name,shipper.name) AS shipper_name,
    COALESCE(s.external_receiver_name,receiver.name) AS receiver_name,
    owner.name AS load_owner_name,
    (SELECT COUNT(*) FROM shipment_interests interest WHERE interest.shipment_id=s.id) AS interest_count
    FROM shipments s
    JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    LEFT JOIN organizations shipper ON shipper.id=s.shipper_organization_id
    LEFT JOIN organizations receiver ON receiver.id=s.receiver_organization_id
    WHERE COALESCE(s.load_owner_organization_id,s.shipper_organization_id)=?
    ORDER BY CASE s.operational_status
      WHEN 'POSTED' THEN 0 WHEN 'SENT' THEN 1 WHEN 'CONTACTED' THEN 2 WHEN 'AGREED' THEN 3 ELSE 4 END,
      s.updated_at DESC`).all(user.organization_id);
}

export function getShipmentForUser(user, idOrCode) {
  const db = getDb();
  const shipment = db.prepare(`SELECT s.*, so.name AS shipper_name,so.handle AS shipper_handle,ro.name AS receiver_name,ro.handle AS receiver_handle,po.name AS provider_name,po.handle AS provider_handle,
    pp.business_name AS provider_profile_name,owner.name AS load_owner_name,
    CASE WHEN cp.show_contact_phone_on_loads=1 THEN cp.contact_phone ELSE NULL END AS load_contact_phone
    FROM shipments s
    LEFT JOIN organizations so ON so.id=s.shipper_organization_id
    LEFT JOIN organizations ro ON ro.id=s.receiver_organization_id
    LEFT JOIN organizations po ON po.id=s.provider_organization_id
    LEFT JOIN provider_profiles pp ON pp.id=s.provider_profile_id
    LEFT JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    LEFT JOIN company_pages cp ON cp.organization_id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    WHERE s.id=? OR s.code=?`).get(idOrCode,idOrCode);
  if (!shipment) return null;
  shipment.shipper_name=shipment.external_shipper_name||shipment.shipper_name;
  shipment.receiver_name=shipment.external_receiver_name||shipment.receiver_name;
  if(shipment.external_shipper_name)shipment.shipper_handle=null;
  if(shipment.external_receiver_name)shipment.receiver_handle=null;
  if (!canViewShipment(user, shipment)) return null;
  if (!canContactBusinesses(user)) shipment.load_contact_phone = null;
  const isParty = isShipmentParty(user,shipment);
  shipment.events = db.prepare(`SELECT e.*, u.name AS actor_name FROM shipment_events e LEFT JOIN users u ON u.id=e.created_by WHERE e.shipment_id=? ${isParty ? '' : 'AND e.public=1'} ORDER BY e.created_at ASC`).all(shipment.id);
  if (isParty) {
    shipment.interests = db.prepare(`SELECT i.*, o.name AS organization_name, p.business_name AS provider_name,actor.name AS created_by_name,
      r.id AS proof_request_id,r.requested_at AS proof_requested_at,r.fulfilled_at AS proof_fulfilled_at
      FROM shipment_interests i LEFT JOIN organizations o ON o.id=i.provider_organization_id LEFT JOIN provider_profiles p ON p.id=i.provider_profile_id
      LEFT JOIN users actor ON actor.id=i.created_by
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
    shipment.interests = db.prepare(`SELECT i.*, o.name AS organization_name, p.business_name AS provider_name,actor.name AS created_by_name,
      r.id AS proof_request_id,r.requested_at AS proof_requested_at,r.fulfilled_at AS proof_fulfilled_at
      FROM shipment_interests i LEFT JOIN organizations o ON o.id=i.provider_organization_id LEFT JOIN provider_profiles p ON p.id=i.provider_profile_id
      LEFT JOIN users actor ON actor.id=i.created_by
      LEFT JOIN load_proof_requests r ON r.interest_id=i.id
      WHERE i.shipment_id=? AND (i.provider_organization_id=? OR i.provider_profile_id=?) ORDER BY i.created_at DESC`).all(shipment.id,user.organization_id || '',user.provider_profile_id || '');
    shipment.proofs = [];
    shipment.notes = [];
    shipment.business_reviews = [];
  }
  const ownsLoad = user.role === USER_ROLES.ADMIN || Boolean(user.organization_id && (shipment.load_owner_organization_id||shipment.shipper_organization_id) === user.organization_id);
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
  if (user.organization_id && [shipment.load_owner_organization_id,shipment.shipper_organization_id,shipment.receiver_organization_id,shipment.provider_organization_id].includes(user.organization_id)) return true;
  if (user.provider_profile_id && shipment.provider_profile_id === user.provider_profile_id) return true;
  return false;
}

function isSavedPartnerForShipment(user, shipment) {
  if (!canBrowseLoads(user) || shipment.distribution_mode !== DISTRIBUTION_MODES.SAVED_PARTNERS) return false;
  const relationship = getDb().prepare(`SELECT 1 FROM partner_relationships
    WHERE owner_organization_id=? AND status='CONNECTED'
      AND (provider_organization_id=? OR provider_profile_id=?) LIMIT 1`)
    .get(shipment.load_owner_organization_id||shipment.shipper_organization_id,user.organization_id || '',user.provider_profile_id || '');
  return Boolean(relationship);
}

function canViewShipment(user, shipment) {
  if (isShipmentParty(user, shipment)) return true;
  if (!canBrowseLoads(user) || shipment.service_mode !== SERVICE_MODES.FREIGHT || shipment.operational_status !== 'POSTED') return false;
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
  const ownerPartyRole=['SHIPPER','RECEIVER'].includes(input.ownerPartyRole)?input.ownerPartyRole:'SHIPPER';
  const counterpartyRef=input.counterpartyRef||input.receiverOrganizationId&&`org:${input.receiverOrganizationId}`;
  let counterpartyOrganizationId=null;
  if(counterpartyRef){
    const [kind,id]=String(counterpartyRef).split(':');
    if(kind!=='org')throw new Error('INVALID_BUSINESS_PARTY');
    const counterpart=db.prepare(`SELECT id FROM organizations
      WHERE id=? AND id<>? AND type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')`).get(id,user.organization_id);
    if(!counterpart)throw new Error('INVALID_BUSINESS_PARTY');
    counterpartyOrganizationId=counterpart.id;
  }
  const externalCounterpartyName=String(input.externalCounterpartyName||'').trim()||null;
  const externalCounterpartyPhone=String(input.externalCounterpartyPhone||'').trim()||null;
  if(input.counterpartyType==='ACCOUNT'&&!counterpartyOrganizationId)throw new Error('BUSINESS_PARTY_REQUIRED');
  if(input.counterpartyType==='EXTERNAL'&&!externalCounterpartyName)throw new Error('EXTERNAL_PARTY_REQUIRED');
  const shipperOrganizationId=ownerPartyRole==='SHIPPER'
    ? user.organization_id
    : counterpartyOrganizationId||user.organization_id;
  const receiverOrganizationId=ownerPartyRole==='RECEIVER'
    ? user.organization_id
    : counterpartyOrganizationId;
  const externalShipperName=ownerPartyRole==='RECEIVER'?externalCounterpartyName:null;
  const externalShipperPhone=ownerPartyRole==='RECEIVER'?externalCounterpartyPhone:null;
  const externalReceiverName=ownerPartyRole==='SHIPPER'?externalCounterpartyName:null;
  const externalReceiverPhone=ownerPartyRole==='SHIPPER'?externalCounterpartyPhone:null;

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
  const trackingCodeHash = hashTrackingAccessCode(trackingAccessCode(id));
  const operationalStatus = distributionMode === DISTRIBUTION_MODES.DIRECT_TO_PROVIDER ? 'SENT' : 'POSTED';
  const commercialStatus = distributionMode === DISTRIBUTION_MODES.DIRECT_TO_PROVIDER ? 'SENT' : 'POSTED';
  const timestamp = nowIso();
  const origin=placeLabel(input.origin);
  const destination=placeLabel(input.destination);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO shipments
      (id,code,title,service_mode,distribution_mode,price_mode,price_minor,target_price_minor,
       shipper_organization_id,receiver_organization_id,load_owner_organization_id,load_owner_party_role,
       external_shipper_name,external_shipper_phone,external_receiver_name,external_receiver_phone,
       provider_organization_id,provider_profile_id,origin,destination,cargo_description,package_count,estimated_weight,
       vehicle_category,load_type,pickup_date,delivery_date,commercial_status,operational_status,tracking_mode,
       tracking_code_hash,created_by,created_at,updated_at)
      VALUES (@id,@code,@title,@serviceMode,@distributionMode,@priceMode,@priceMinor,@targetMinor,
       @shipperOrganizationId,@receiverOrganizationId,@loadOwnerOrganizationId,@loadOwnerPartyRole,
       @externalShipperName,@externalShipperPhone,@externalReceiverName,@externalReceiverPhone,
       @providerOrganizationId,@providerProfileId,@origin,@destination,@cargoDescription,@packageCount,NULL,
       @vehicleCategory,@loadType,@pickupDate,@deliveryDate,@commercialStatus,@operationalStatus,@trackingMode,
       @trackingCodeHash,@createdBy,@createdAt,@updatedAt)`)
      .run({
        id,code,title:input.title,serviceMode,distributionMode,priceMode:input.priceMode,priceMinor,targetMinor,
        shipperOrganizationId,receiverOrganizationId,loadOwnerOrganizationId:user.organization_id,loadOwnerPartyRole:ownerPartyRole,
        externalShipperName,externalShipperPhone,externalReceiverName,externalReceiverPhone,
        providerOrganizationId,providerProfileId,origin,destination,
        cargoDescription:input.cargoDescription,packageCount:Number(input.packageCount||1),
        vehicleCategory:input.vehicleCategory||null,loadType,pickupDate:input.pickupDate,deliveryDate:input.deliveryDate||null,
        commercialStatus,operationalStatus,trackingMode,trackingCodeHash,createdBy:user.id,createdAt:timestamp,updatedAt:timestamp
      });
    db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,created_by,public,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(randomId('evt-'),id,operationalStatus,'CREATED','Shipment created in Loadgistic',user.id,1,timestamp);
    if (providerOrganizationId) {
      const owner = db.prepare(`SELECT u.id FROM users u WHERE u.organization_id=? AND u.active=1 ORDER BY u.created_at LIMIT 1`).get(providerOrganizationId);
      if (owner) notify(db,owner.id,'New direct B2B shipment request',`${user.organization_name || 'A business'} sent ${code}.`);
    }
    audit(db,user,'SHIPMENT_CREATED','shipment',id,{ code, serviceMode, distributionMode, trackingMode, ownerPartyRole, externalCounterparty:Boolean(externalCounterpartyName) });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { id, code };
}

function trackingLocation(input = {}, required = false,allowDeviceLocation = true,expectedPrecisionKm=40) {
  const area = qualifyAreaLabel(input.locationArea);
  const device = input.locationSource === 'DEVICE_OBSCURED';
  if (device && !allowDeviceLocation) throw new Error('DEVICE_LOCATION_DRIVER_ONLY');
  const lat = device ? Number(input.approximateLat) : null;
  const lng = device ? Number(input.approximateLng) : null;
  const precisionKm = device ? Number(input.locationPrecisionKm) : null;
  if (required && !area) throw new Error('TRACKING_LOCATION_REQUIRED');
  if (device && (!area || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || precisionKm !== expectedPrecisionKm)) {
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
  const location = trackingLocation(locationInput,shipment.tracking_mode === 'LOCATION_AND_STATUS',user.role === USER_ROLES.DRIVER,shipment.load_type==='FTL'?20:40);
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
    || (isCompanyDriver(user) && shipment.provider_organization_id === user.organization_id)
    || (isSelfManagedDriver(user) && shipment.provider_profile_id === user.provider_profile_id)
    || user.role === USER_ROLES.ADMIN;
  if (!assignedProvider || !['ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE'].includes(shipment.operational_status)) throw new Error('FORBIDDEN');
  const note = String(input.note || '').trim();
  const needsLocation = shipment.tracking_mode === 'LOCATION_AND_STATUS';
  const location = trackingLocation(input,needsLocation,user.role === USER_ROLES.DRIVER,shipment.load_type==='FTL'?20:40);
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
    || (['SHIPPER','RECEIVER'].includes(user.role) && user.organization_id && [shipment.load_owner_organization_id,shipment.shipper_organization_id,shipment.receiver_organization_id].includes(user.organization_id)));
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
  const ownsShipment = shipment && (user.role === USER_ROLES.ADMIN || (shipment.load_owner_organization_id||shipment.shipper_organization_id) === user.organization_id);
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

function networkActor(user) {
  if ([USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role) && user.organization_id) {
    return { side:'BUSINESS',businessOrganizationId:user.organization_id,providerOrganizationId:null,providerProfileId:null };
  }
  if (user.role === USER_ROLES.TRANSPORTER && user.organization_id) {
    return { side:'PROVIDER',businessOrganizationId:null,providerOrganizationId:user.organization_id,providerProfileId:null };
  }
  if (isSelfManagedDriver(user)) {
    return { side:'PROVIDER',businessOrganizationId:null,providerOrganizationId:null,providerProfileId:user.provider_profile_id };
  }
  return null;
}

function networkPair(db,user,targetKind,targetId) {
  const actor = networkActor(user);
  if (!actor) throw new Error('FORBIDDEN');
  if (actor.side === 'BUSINESS') {
    if (targetKind === 'org') {
      const provider = db.prepare(`SELECT id,name,handle FROM organizations WHERE id=? AND type='TRANSPORT_COMPANY'`).get(targetId);
      if (!provider) throw new Error('INVALID_NETWORK_TARGET');
      return {...actor,providerOrganizationId:provider.id,target:provider};
    }
    if (targetKind === 'profile') {
      const provider = db.prepare('SELECT id,business_name AS name,handle FROM provider_profiles WHERE id=?').get(targetId);
      if (!provider) throw new Error('INVALID_NETWORK_TARGET');
      return {...actor,providerProfileId:provider.id,target:provider};
    }
    throw new Error('INVALID_NETWORK_TARGET');
  }
  if (targetKind !== 'org') throw new Error('INVALID_NETWORK_TARGET');
  const business = db.prepare(`SELECT id,name,handle FROM organizations WHERE id=? AND type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')`).get(targetId);
  if (!business) throw new Error('INVALID_NETWORK_TARGET');
  return {...actor,businessOrganizationId:business.id,target:business};
}

function findNetworkRelationship(db,pair) {
  return db.prepare(`SELECT * FROM partner_relationships
    WHERE owner_organization_id=?
      AND COALESCE(provider_organization_id,'')=?
      AND COALESCE(provider_profile_id,'')=? LIMIT 1`)
    .get(pair.businessOrganizationId,pair.providerOrganizationId || '',pair.providerProfileId || '');
}

function networkRecipientUserId(db,pair) {
  if (pair.side === 'BUSINESS') {
    return pair.providerOrganizationId
      ? db.prepare(`SELECT id FROM users WHERE organization_id=? AND role='TRANSPORTER' AND active=1 ORDER BY created_at LIMIT 1`).get(pair.providerOrganizationId)?.id
      : db.prepare(`SELECT id FROM users WHERE provider_profile_id=? AND active=1 ORDER BY created_at LIMIT 1`).get(pair.providerProfileId)?.id;
  }
  return db.prepare(`SELECT id FROM users WHERE organization_id=? AND role IN ('SHIPPER','RECEIVER') AND active=1 ORDER BY created_at LIMIT 1`).get(pair.businessOrganizationId)?.id;
}

export function getNetworkState(user,targetKind,targetId) {
  const db = getDb();
  if ([USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)&&user.organization_id&&targetKind==='org') {
    const target=db.prepare(`SELECT id FROM organizations WHERE id=? AND id<>? AND type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')`)
      .get(targetId,user.organization_id);
    if(target){
      const favorite=db.prepare('SELECT 1 FROM member_favorites WHERE owner_organization_id=? AND target_organization_id=?')
        .get(user.organization_id,target.id);
      return {eligible:true,connect_eligible:false,status:null,is_favorite:Boolean(favorite),incoming:false,outgoing:false};
    }
  }
  let pair;
  try {
    pair = networkPair(db,user,targetKind,targetId);
  } catch {
    return { eligible:false,status:null,is_favorite:false,incoming:false,outgoing:false };
  }
  const relationship = findNetworkRelationship(db,pair);
  const favoriteColumn = pair.side === 'BUSINESS' ? 'business_favorite' : 'provider_favorite';
  return {
    eligible:true,
    connect_eligible:true,
    status:relationship?.status || null,
    is_favorite:Boolean(relationship?.[favoriteColumn]),
    incoming:relationship?.status === 'PENDING' && relationship.requested_by_side !== pair.side,
    outgoing:relationship?.status === 'PENDING' && relationship.requested_by_side === pair.side
  };
}

export function changeNetworkRelationship(user,input) {
  if ([USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)&&user.organization_id&&input.targetKind==='org') {
    const target=getDb().prepare(`SELECT id FROM organizations WHERE id=? AND id<>? AND type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')`)
      .get(input.targetId,user.organization_id);
    if(target){
      const action=String(input.action||'').toUpperCase();
      if(!['FAVORITE','UNFAVORITE'].includes(action))throw new Error('INVALID_NETWORK_TARGET');
      setBusinessFavorite(user,target.id,action==='FAVORITE');
      return target.id;
    }
  }
  const db = getDb();
  const pair = networkPair(db,user,input.targetKind,input.targetId);
  const action = String(input.action || '').toUpperCase();
  const timestamp = nowIso();
  let relationship = findNetworkRelationship(db,pair);
  const favoriteColumn = pair.side === 'BUSINESS' ? 'business_favorite' : 'provider_favorite';

  db.exec('BEGIN IMMEDIATE');
  try {
    if (!relationship) {
      if (!['FAVORITE','REQUEST'].includes(action)) throw new Error('NETWORK_RELATIONSHIP_NOT_FOUND');
      const id = randomId('network-');
      db.prepare(`INSERT INTO partner_relationships
        (id,owner_organization_id,provider_organization_id,provider_profile_id,status,requested_by_side,business_favorite,provider_favorite,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(id,pair.businessOrganizationId,pair.providerOrganizationId,pair.providerProfileId,action === 'REQUEST' ? 'PENDING' : 'FAVORITE',action === 'REQUEST' ? pair.side : null,pair.side === 'BUSINESS' ? 1 : 0,pair.side === 'PROVIDER' ? 1 : 0,timestamp,timestamp);
      relationship = db.prepare('SELECT * FROM partner_relationships WHERE id=?').get(id);
    } else if (action === 'FAVORITE') {
      db.prepare(`UPDATE partner_relationships SET ${favoriteColumn}=1,updated_at=? WHERE id=?`).run(timestamp,relationship.id);
    } else if (action === 'UNFAVORITE') {
      db.prepare(`UPDATE partner_relationships SET ${favoriteColumn}=0,updated_at=? WHERE id=?`).run(timestamp,relationship.id);
    } else if (action === 'REQUEST') {
      if (relationship.status !== 'CONNECTED') {
        db.prepare(`UPDATE partner_relationships SET status='PENDING',requested_by_side=?,${favoriteColumn}=1,responded_at=NULL,updated_at=? WHERE id=?`)
          .run(pair.side,timestamp,relationship.id);
      }
    } else if (action === 'ACCEPT') {
      if (relationship.status !== 'PENDING' || relationship.requested_by_side === pair.side) throw new Error('NETWORK_REQUEST_NOT_ACTIONABLE');
      db.prepare(`UPDATE partner_relationships SET status='CONNECTED',business_favorite=1,provider_favorite=1,responded_at=?,updated_at=? WHERE id=?`)
        .run(timestamp,timestamp,relationship.id);
    } else if (action === 'DECLINE') {
      if (relationship.status !== 'PENDING' || relationship.requested_by_side === pair.side) throw new Error('NETWORK_REQUEST_NOT_ACTIONABLE');
      db.prepare(`UPDATE partner_relationships SET status='DECLINED',responded_at=?,updated_at=? WHERE id=?`)
        .run(timestamp,timestamp,relationship.id);
    } else {
      throw new Error('INVALID_NETWORK_ACTION');
    }

    const auditAction = action === 'REQUEST'
      ? 'NETWORK_CONNECTION_REQUESTED'
      : ['ACCEPT','DECLINE'].includes(action)
        ? 'NETWORK_CONNECTION_DECIDED'
        : 'NETWORK_FAVORITE_CHANGED';
    audit(db,user,auditAction,'partner_relationship',relationship.id,{action,side:pair.side});
    if (['REQUEST','ACCEPT','DECLINE'].includes(action)) {
      const recipientId = networkRecipientUserId(db,pair);
      if (recipientId) {
        const title = action === 'REQUEST' ? 'New network request' : `Network request ${action === 'ACCEPT' ? 'accepted' : 'declined'}`;
        notify(db,recipientId,title,`${user.organization_name || user.provider_business_name || user.name} updated your network relationship.`);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return relationship.id;
}

export function listNetwork(user) {
  const actor = networkActor(user);
  if (!actor) throw new Error('FORBIDDEN');
  const db = getDb();
  const where = actor.side === 'BUSINESS'
    ? 'rel.owner_organization_id=?'
    : actor.providerOrganizationId
      ? 'rel.provider_organization_id=?'
      : 'rel.provider_profile_id=?';
  const actorId = actor.businessOrganizationId || actor.providerOrganizationId || actor.providerProfileId;
  const rows = db.prepare(`SELECT rel.*,
    business.name AS business_name,business.handle AS business_handle,business.city AS business_city,
    COALESCE(provider_org.name,provider_profile.business_name) AS provider_name,
    COALESCE(provider_org.handle,provider_profile.handle) AS provider_handle,
    COALESCE(provider_org.city,provider_profile.city) AS provider_city,
    CASE WHEN provider_profile.id IS NOT NULL THEN 'profile' ELSE 'org' END AS provider_kind
    FROM partner_relationships rel
    JOIN organizations business ON business.id=rel.owner_organization_id
    LEFT JOIN organizations provider_org ON provider_org.id=rel.provider_organization_id
    LEFT JOIN provider_profiles provider_profile ON provider_profile.id=rel.provider_profile_id
    WHERE ${where} ORDER BY rel.updated_at DESC,rel.created_at DESC`).all(actorId);
  const favoriteColumn = actor.side === 'BUSINESS' ? 'business_favorite' : 'provider_favorite';
  const visible = rows.filter(row => row.status === 'CONNECTED'
    || row.status === 'PENDING'
    || Boolean(row[favoriteColumn]));
  const mapped = visible.map(row => ({
    ...row,
    name:actor.side === 'BUSINESS' ? row.provider_name : row.business_name,
    handle:actor.side === 'BUSINESS' ? row.provider_handle : row.business_handle,
    city:actor.side === 'BUSINESS' ? row.provider_city : row.business_city,
    target_kind:actor.side === 'BUSINESS' ? row.provider_kind : 'org',
    target_id:actor.side === 'BUSINESS' ? (row.provider_organization_id || row.provider_profile_id) : row.owner_organization_id,
    is_favorite:Boolean(row[favoriteColumn]),
    incoming:row.status === 'PENDING' && row.requested_by_side !== actor.side,
    outgoing:row.status === 'PENDING' && row.requested_by_side === actor.side
  }));
  const sameSideFavorites=actor.side==='BUSINESS'?db.prepare(`SELECT f.id,f.created_at AS updated_at,'FAVORITE' AS status,
    target.name,target.handle,target.city,'org' AS target_kind,target.id AS target_id,1 AS is_favorite,0 AS incoming,0 AS outgoing,0 AS connect_eligible
    FROM member_favorites f JOIN organizations target ON target.id=f.target_organization_id
    WHERE f.owner_organization_id=? ORDER BY f.created_at DESC`).all(actor.businessOrganizationId):[];
  return {
    connected:mapped.filter(row => row.status === 'CONNECTED'),
    requests:mapped.filter(row => row.status === 'PENDING'),
    favorites:[...sameSideFavorites,...mapped.filter(row => row.is_favorite && row.status !== 'CONNECTED')]
  };
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
    const transporters = db.prepare(`SELECT o.id, 'org' AS ref_kind, o.name, o.handle, o.type, o.city, cp.headline,cp.about, cp.services,cp.operating_regions, cp.contact_phone,cp.contact_email,0 AS is_business,
      (SELECT GROUP_CONCAT(r.origin || ' ↔ ' || r.destination,'; ') FROM profile_routes r WHERE r.organization_id=o.id) AS preferred_routes_text,
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
      p.city, p.about, cp.headline,cp.services,cp.operating_regions, cp.contact_phone,cp.contact_email,0 AS is_business,
      (SELECT GROUP_CONCAT(r.origin || ' ↔ ' || r.destination,'; ') FROM profile_routes r WHERE r.provider_profile_id=p.id) AS preferred_routes_text,
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
  const vehicles = db.prepare(`SELECT v.id AS vehicle_id,v.label,v.category,v.plate,v.platform_number,v.make,v.model,v.cargo_configuration,
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

function routeOwner(page) {
  return page.page_kind === 'provider'
    ? { column:'provider_profile_id', id:page.id, organizationId:null, profileId:page.id }
    : { column:'organization_id', id:page.id, organizationId:page.id, profileId:null };
}

function hasTrackedExecution(db, shipmentId) {
  return Boolean(db.prepare(`SELECT 1 FROM shipment_events
    WHERE shipment_id=? AND status IN ('ASSIGNED','IN_TRANSIT','DELIVERED','COMPLETED') LIMIT 1`).get(shipmentId));
}

function capacityRouteCandidates(capacity, { requireCurrentDate = false } = {}) {
  const routes = [];
  const today = todayInEthiopia();
  if (
    capacity.status === 'PARTIAL'
    && capacity.current_route_origin
    && capacity.current_route_destination
    && (!requireCurrentDate || (capacity.current_route_date && capacity.current_route_date >= today))
  ) {
    routes.push({
      id:`${capacity.id}:current`,
      capacity_id:capacity.id,
      vehicle_id:capacity.vehicle_id,
      platform_number:capacity.platform_number,
      vehicle_make:capacity.vehicle_make,
      vehicle_model:capacity.vehicle_model,
      origin:capacity.current_route_origin,
      destination:capacity.current_route_destination,
      route_kind:'CURRENT_PARTIAL',
      source_label:'Current partial route',
      route_date:capacity.current_route_date,
      planned_space_status:'PARTIAL',
      expires_at:capacity.expires_at
    });
  }
  if (
    capacity.origin
    && capacity.destination
    && (!requireCurrentDate || (capacity.travel_date && capacity.travel_date >= today))
  ) {
    routes.push({
      id:capacity.id,
      capacity_id:capacity.id,
      vehicle_id:capacity.vehicle_id,
      platform_number:capacity.platform_number,
      vehicle_make:capacity.vehicle_make,
      vehicle_model:capacity.vehicle_model,
      origin:capacity.origin,
      destination:capacity.destination,
      route_kind:'PLANNED',
      source_label:'Planned route',
      route_date:capacity.travel_date,
      planned_space_status:capacity.planned_space_status || (capacity.status === 'PARTIAL' ? 'PARTIAL' : 'FULL'),
      expires_at:capacity.expires_at
    });
  }
  return routes;
}

function listLiveTruckRoutesForPage(db, page, includeAllVisibility = false) {
  if (page.is_business) return [];
  const owner = routeOwner(page);
  const visibilityClause = includeAllVisibility ? '' : " AND c.visibility='OPEN'";
  const capacities = db.prepare(`SELECT c.*,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model
    FROM vehicles v JOIN capacities c ON c.id=(
      SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC LIMIT 1
    )
    WHERE v.${owner.column}=? AND v.active=1 AND c.status IN ('EMPTY','PARTIAL') AND c.expires_at>?${visibilityClause}
    ORDER BY v.platform_number`).all(owner.id,nowIso());
  return capacities.flatMap(capacity => capacityRouteCandidates(capacity,{requireCurrentDate:true}));
}

function listProfileRoutesWithEvidence(db, page) {
  const owner = routeOwner(page);
  const routes = db.prepare(`SELECT * FROM profile_routes WHERE ${owner.column}=? ORDER BY created_at,id`).all(owner.id);
  const activity = page.is_business
    ? db.prepare(`SELECT id,origin,destination FROM shipments WHERE COALESCE(load_owner_organization_id,shipper_organization_id)=?`).all(owner.id)
    : owner.organizationId
      ? {
          capacity:db.prepare(`SELECT id,vehicle_id,status,origin,destination,travel_date,current_route_origin,current_route_destination,current_route_date FROM capacities WHERE provider_organization_id=? AND status IN ('EMPTY','PARTIAL')`).all(owner.id),
          shipments:db.prepare(`SELECT id,origin,destination FROM shipments WHERE provider_organization_id=?`).all(owner.id)
        }
      : {
          capacity:db.prepare(`SELECT id,vehicle_id,status,origin,destination,travel_date,current_route_origin,current_route_destination,current_route_date FROM capacities WHERE provider_profile_id=? AND status IN ('EMPTY','PARTIAL')`).all(owner.id),
          shipments:db.prepare(`SELECT id,origin,destination FROM shipments WHERE provider_profile_id=?`).all(owner.id)
        };
  return routes.map(route => {
    if (page.is_business) {
      const posted = activity.filter(item => routeMatch(route.origin,route.destination,item.origin,item.destination).score === 2);
      const tracked = posted.filter(item => hasTrackedExecution(db,item.id));
      return {...route,reported_count:posted.length,tracked_count:tracked.length,evidence_label:tracked.length?'Tracked activity':posted.length?'Reported activity':'Declared only'};
    }
    const reported = activity.capacity.filter(item => capacityRouteCandidates(item).some(candidate => routeMatch(route.origin,route.destination,candidate.origin,candidate.destination).score === 2));
    const tracked = activity.shipments.filter(item => routeMatch(route.origin,route.destination,item.origin,item.destination).score === 2 && hasTrackedExecution(db,item.id));
    return {...route,reported_count:reported.length,tracked_count:tracked.length,evidence_label:tracked.length?'Tracked activity':reported.length?'Reported activity':'Declared only'};
  });
}

function attachProfileRoutes(db, page) {
  page.routes = listProfileRoutesWithEvidence(db,page);
  page.live_routes = listLiveTruckRoutesForPage(db,page);
  page.map_routes = [
    ...page.routes.map(route => ({...route,route_kind:'PROFILE',source_label:page.is_business?'Freight Route':'Preferred Route'})),
    ...page.live_routes
  ];
  return page;
}

export function getPublicCompany(handle) {
  const db = getDb();
  const org = db.prepare(`SELECT o.id,o.name,o.handle,o.type,o.industry,o.description,o.city,o.public_visibility,
    cp.headline,cp.about,cp.services,cp.operating_regions,cp.contact_phone,cp.contact_email
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
    return attachProfileRoutes(db,org);
  }
  const provider = db.prepare(`SELECT p.id,p.business_name,p.business_name AS name,p.handle,p.city,p.about,p.public_visibility,
    cp.headline,cp.services,cp.operating_regions,cp.contact_phone,cp.contact_email
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
    return attachProfileRoutes(db,provider);
  }
  return null;
}

export function updateCompanyPage(user, input) {
  const db = getDb();
  const isProvider = isSelfManagedDriver(user);
  if (isCompanyDriver(user) || ![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER,USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) throw new Error('FORBIDDEN');
  const condition = isProvider ? 'provider_profile_id=?' : 'organization_id=?';
  const id = isProvider ? user.provider_profile_id : user.organization_id;
  if (!id) throw new Error('FORBIDDEN');
  const published = input.published ? 1 : 0;
  const showContactPhoneOnLoads = [USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role) && input.showContactPhoneOnLoads ? 1 : 0;
  const routes = (input.routes || []).map(route => ({origin:placeLabel(route.origin),destination:placeLabel(route.destination)}))
    .filter(route => route.origin || route.destination);
  for (const route of routes) {
    if (!route.origin || !route.destination) throw new Error('MISSING_REQUIRED_FIELDS');
    if (placeIdentity(route.origin) === placeIdentity(route.destination)) throw new Error('ROUTE_LOCATIONS_MUST_DIFFER');
  }
  const uniqueRoutes = [...new Map(routes.map(route => [`${placeIdentity(route.origin)}|${placeIdentity(route.destination)}`.split('|').sort().join('|'),route])).values()];
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE company_pages SET headline=?,about=?,services=?,operating_regions=?,contact_phone=?,show_contact_phone_on_loads=?,contact_email=?,published=?,updated_at=? WHERE ${condition}`)
      .run(input.headline || '',input.about || '',input.services || '',qualifyPlaceList(input.operatingRegions),input.contactPhone || '',showContactPhoneOnLoads,input.contactEmail || '',published,timestamp,id);
    db.prepare(`DELETE FROM profile_routes WHERE ${condition}`).run(id);
    const insert = db.prepare(`INSERT INTO profile_routes (id,organization_id,provider_profile_id,origin,destination,created_by,created_at) VALUES (?,?,?,?,?,?,?)`);
    for (const route of uniqueRoutes) insert.run(randomId('route-'),isProvider ? null : id,isProvider ? id : null,route.origin,route.destination,user.id,timestamp);
    audit(db,user,'COMPANY_PAGE_UPDATED','company_page',id,{routeCount:uniqueRoutes.length});
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getOwnCompanyPage(user) {
  const db = getDb();
  if (isCompanyDriver(user)) throw new Error('FORBIDDEN');
  const page = isSelfManagedDriver(user)
    ? db.prepare(`SELECT cp.*,p.id,p.business_name AS name,'provider' AS page_kind,0 AS is_business FROM company_pages cp JOIN provider_profiles p ON p.id=cp.provider_profile_id WHERE cp.provider_profile_id=?`).get(user.provider_profile_id)
    : db.prepare(`SELECT cp.*,o.id,o.name,'organization' AS page_kind,
      CASE WHEN o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER') THEN 1 ELSE 0 END AS is_business
      FROM company_pages cp JOIN organizations o ON o.id=cp.organization_id WHERE cp.organization_id=?`).get(user.organization_id);
  return page ? attachProfileRoutes(db,page) : null;
}

export function getProfileRouteComparison(user, company) {
  const db = getDb();
  const viewerPage = isSelfManagedDriver(user)
    ? {id:user.provider_profile_id,page_kind:'provider',is_business:false}
    : user.organization_id
      ? {id:user.organization_id,page_kind:'organization',is_business:[USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)}
      : null;
  if (!viewerPage || (viewerPage.page_kind === company.page_kind && viewerPage.id === company.id)) return null;
  const viewerDeclaredRoutes = listProfileRoutesWithEvidence(db,viewerPage)
    .map(route => ({...route,route_kind:'PROFILE',source_label:viewerPage.is_business?'Freight Route':'Preferred Route'}));
  const viewerRoutes = [...viewerDeclaredRoutes,...listLiveTruckRoutesForPage(db,viewerPage,true)];
  const targetRoutes = company.map_routes || [
    ...listProfileRoutesWithEvidence(db,company).map(route => ({...route,route_kind:'PROFILE',source_label:company.is_business?'Freight Route':'Preferred Route'})),
    ...listLiveTruckRoutesForPage(db,company)
  ];
  const matches = targetRoutes.map(target => {
    const ranked = viewerRoutes.map(viewer => ({viewer,target,...routeMatch(viewer.origin,viewer.destination,target.origin,target.destination)}))
      .sort((a,b) => b.score-a.score);
    return ranked[0] || {viewer:null,target,score:0,label:'No recorded route match'};
  });
  const exact = matches.filter(match => match.score === 2);
  const partial = matches.filter(match => match.score === 1);
  return {
    viewer_routes:viewerRoutes,
    target_routes:targetRoutes,
    matches,
    exact_count:exact.length,
    partial_count:partial.length,
    strongest_label:exact.length ? `${exact.length} full route ${exact.length === 1 ? 'match' : 'matches'}` : partial.length ? `${partial.length} shared-endpoint ${partial.length === 1 ? 'match' : 'matches'}` : 'No recorded route overlap',
    evidence_label:targetRoutes.some(route => route.route_kind !== 'PROFILE')
      ? targetRoutes.some(route => route.tracked_count)
        ? 'Includes tracked activity and fresh truck routes'
        : 'Includes fresh truck routes'
      : targetRoutes.some(route => route.tracked_count) ? 'Includes tracked activity' : targetRoutes.some(route => route.reported_count) ? 'Reported activity only' : 'Declarations only'
  };
}

export function getFleetNetworkCoverage(user) {
  if (user.role !== USER_ROLES.TRANSPORTER || !user.organization_id) return null;
  const db = getDb();
  const page = db.prepare(`SELECT o.id,o.name,o.type,o.handle,'organization' AS page_kind,0 AS is_business
    FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id WHERE o.id=?`).get(user.organization_id);
  const routes = page ? listProfileRoutesWithEvidence(db,page) : [];
  const preferredRoutes = routes.map(route => ({...route,route_kind:'PROFILE',source_label:'Preferred Route'}));
  const liveRoutes = page ? listLiveTruckRoutesForPage(db,page,true) : [];
  const mapRoutes = [...preferredRoutes,...liveRoutes];
  const routeLabels = preferredRoutes.map(route => `${route.origin} ↔ ${route.destination}`);
  const routePlaces = new Set(mapRoutes.flatMap(route => [placeIdentity(route.origin),placeIdentity(route.destination)]));
  const businesses = db.prepare(`SELECT o.id,o.name,o.handle,o.city,cp.operating_regions
    FROM partner_relationships rel
    JOIN organizations o ON o.id=rel.owner_organization_id
    LEFT JOIN company_pages cp ON cp.organization_id=o.id
    WHERE rel.provider_organization_id=? AND rel.status='CONNECTED'
    ORDER BY o.name`).all(user.organization_id).map(business => {
      const places = [...new Set([placeIdentity(business.city),...splitPlaces(business.operating_regions)].filter(Boolean))];
      const matched = places.filter(place => routePlaces.has(place));
      return {...business,places,matched_places:matched,coverage_label:matched.length ? `${matched.length} location${matched.length === 1 ? '' : 's'} on recorded routes` : 'No recorded route match'};
    });
  return { preferred_routes:routeLabels,routes:mapRoutes,live_routes:liveRoutes,businesses };
}

const VERIFICATION_TYPES = Object.freeze({
  ORGANIZATION: ['IDENTITY','BUSINESS_LICENSE'],
  PROVIDER_PROFILE: ['IDENTITY','DRIVER_IDENTITY'],
  DRIVER: ['DRIVER_IDENTITY'],
  VEHICLE: ['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION']
});

function ownsVerificationSubject(db,user,subjectType,subjectId) {
  if (user.role === USER_ROLES.ADMIN) return true;
  if (subjectType === 'ORGANIZATION') return Boolean(user.role !== USER_ROLES.DRIVER && user.organization_id && user.organization_id === subjectId);
  if (subjectType === 'PROVIDER_PROFILE') return Boolean(user.provider_profile_id && user.provider_profile_id === subjectId);
  if (subjectType === 'DRIVER') return Boolean(
    isCompanyDriver(user)
      ? db.prepare('SELECT 1 FROM drivers WHERE id=? AND user_id=? AND active=1').get(subjectId,user.id)
      : user.organization_id && db.prepare('SELECT 1 FROM drivers WHERE id=? AND organization_id=?').get(subjectId,user.organization_id)
  );
  if (subjectType === 'VEHICLE') {
    if (isCompanyDriver(user)) return false;
    return Boolean(db.prepare(`SELECT 1 FROM vehicles WHERE id=? AND
      ((organization_id IS NOT NULL AND organization_id=?) OR (provider_profile_id IS NOT NULL AND provider_profile_id=?))`)
      .get(subjectId,user.organization_id || '',user.provider_profile_id || ''));
  }
  return false;
}

export function getVerificationCenter(user) {
  const db = getDb();
  const subjects = [];
  if (isCompanyDriver(user)) {
    const driver=db.prepare('SELECT id,name FROM drivers WHERE user_id=? AND organization_id=? AND active=1').get(user.id,user.organization_id);
    if(driver)subjects.push({subject_type:'DRIVER',subject_id:driver.id,name:driver.name,type:'Driver'});
  } else if (user.organization_id) {
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
  const parties = [shipment.shipper_organization_id,shipment.receiver_organization_id]
    .filter((id,index,all)=>Boolean(id)&&all.indexOf(id)===index);
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
  const routes = [...latestByVehicle.values()]
    .filter(capacity => ['EMPTY','PARTIAL'].includes(capacity.status) && new Date(capacity.expires_at).getTime() > Date.now())
    .flatMap(capacity => capacityRouteCandidates(capacity,{requireCurrentDate:true}))
    .map(route => ({
      ...route,
      label:`${route.platform_number} · ${route.source_label}`,
      option_label:`${route.platform_number} · ${route.source_label} · ${route.route_date} · ${route.planned_space_status === 'FULL' ? 'Full' : 'Partial'}`
    }));
  return routes.length > 1
    ? [{id:'ALL_ACTIVE',label:'All active truck routes',option_label:`All active truck routes · ${routes.length} routes`,routes},...routes]
    : routes;
}

export function listOwnLoadRouteOptions(user) {
  if (![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)) return [];
  return getDb().prepare(`SELECT id,code,title,origin,destination,load_type FROM shipments
    WHERE COALESCE(load_owner_organization_id,shipper_organization_id)=?
      AND operational_status IN ('POSTED','SENT','CONTACTED') ORDER BY updated_at DESC`).all(user.organization_id)
    .map(load => ({ id:load.id,code:load.code,title:load.title,origin:load.origin,destination:load.destination,load_type:load.load_type }));
}

export function listLoads(user, mode = 'ALL', filters = {}) {
  if (!canBrowseLoads(user) && user.role !== USER_ROLES.ADMIN) return [];
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
  if (mode === 'INTERESTED') {
    where += ` AND EXISTS(SELECT 1 FROM shipment_interests mine WHERE mine.shipment_id=s.id AND (mine.provider_organization_id=? OR mine.provider_profile_id=?))`;
    args.push(user.organization_id || '',user.provider_profile_id || '');
  }
  let rows = db.prepare(`SELECT s.*,
    COALESCE(s.external_shipper_name,shipper.name) AS shipper_name,
    COALESCE(s.external_receiver_name,r.name) AS receiver_name,
    owner.name AS load_owner_name,
    CASE WHEN cp.show_contact_phone_on_loads=1 THEN cp.contact_phone ELSE NULL END AS load_contact_phone,
    EXISTS(SELECT 1 FROM shipment_interests i WHERE i.shipment_id=s.id AND (i.provider_organization_id=? OR i.provider_profile_id=?)) AS interested
    FROM shipments s LEFT JOIN organizations shipper ON shipper.id=s.shipper_organization_id LEFT JOIN organizations r ON r.id=s.receiver_organization_id
    JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    LEFT JOIN company_pages cp ON cp.organization_id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    WHERE ${where} ORDER BY s.created_at DESC`).all(user.organization_id || '',user.provider_profile_id || '',...args)
    .filter(shipment => canViewShipment(user,shipment));
  const selectedRoute = filters.matchCapacityId
    ? listOwnTruckRouteOptions(user).find(option => option.id === filters.matchCapacityId)
    : null;
  const minPriceMinor = Number(filters.minPriceEtb) > 0 ? Math.round(Number(filters.minPriceEtb) * 100) : null;
  const maxPriceMinor = Number(filters.maxPriceEtb) > 0 ? Math.round(Number(filters.maxPriceEtb) * 100) : null;
  const postedHours = { '24H':24, '3D':72, '7D':168 }[filters.postedWithin] || null;
  const postedCutoff = postedHours ? Date.now() - postedHours * 60 * 60 * 1000 : null;
  rows = rows
    .filter(load => !filters.q || [load.code,load.title,load.cargo_description,load.shipper_name,load.receiver_name,load.load_owner_name,load.origin,load.destination,load.vehicle_category,load.price_mode].some(value => textIncludes(value,filters.q)))
    .filter(load => !filters.origin || textIncludes(load.origin,filters.origin))
    .filter(load => !filters.destination || textIncludes(load.destination,filters.destination))
    .filter(load => !filters.loadType || load.load_type === filters.loadType)
    .filter(load => !filters.vehicleCategory || load.vehicle_category === filters.vehicleCategory)
    .filter(load => !filters.priceMode || load.price_mode === filters.priceMode)
    .filter(load => {
      if (!minPriceMinor && !maxPriceMinor) return true;
      const amount = load.price_mode === 'FIXED_PRICE' ? load.price_minor : load.price_mode === 'TARGET_PRICE' ? load.target_price_minor : null;
      return amount !== null && (!minPriceMinor || amount >= minPriceMinor) && (!maxPriceMinor || amount <= maxPriceMinor);
    })
    .filter(load => !filters.pickupBy || (load.pickup_date && load.pickup_date <= filters.pickupBy))
    .filter(load => !filters.deliveryBy || (load.delivery_date && load.delivery_date <= filters.deliveryBy))
    .filter(load => !postedCutoff || new Date(load.created_at).getTime() >= postedCutoff)
    .map(load => {
      const candidates=selectedRoute?.routes||[selectedRoute].filter(Boolean);
      const match = candidates.map(route => ({...route,...routeMatch(load.origin,load.destination,route.origin,route.destination)})).sort((a,b)=>b.score-a.score)[0]||null;
      return {...load,route_match_score:match?.score ?? null,route_match_label:match?.label ?? null,route_match_source:match?.source_label||null,route_match_platform_number:match?.platform_number||null};
    });
  if (selectedRoute) rows.sort((a,b) => b.route_match_score-a.route_match_score || new Date(b.created_at)-new Date(a.created_at));
  if (!canContactBusinesses(user)) rows = rows.map(row => ({...row,load_contact_phone:null}));
  return rows;
}

export function listPooledLoads(user,filters={}) {
  const loads = listLoads(user,'ALL',{...filters,loadType:'PTL'})
    .filter(load=>load.operational_status==='POSTED')
    .map(load=>({
      ...load,
      origin_coordinate:getPlaceCoordinate(load.origin),
      destination_coordinate:getPlaceCoordinate(load.destination)
    }));
  return poolCompatibleLoads(loads,{
    originRadiusKm:Number(process.env.PSTL_ORIGIN_RADIUS_KM||40),
    destinationRadiusKm:Number(process.env.PSTL_DESTINATION_RADIUS_KM||40)
  });
}

export function getPooledLoad(user,poolId) {
  return listPooledLoads(user).find(pool=>pool.id===poolId)||null;
}

export function expressInterest(user, shipmentId, note = '') {
  if (!canNegotiateLoads(user)) throw new Error('FORBIDDEN');
  const db = getDb();
  const shipment = getShipmentForUser(user, shipmentId);
  if (!shipment || shipment.service_mode !== SERVICE_MODES.FREIGHT) throw new Error('NOT_FOUND');
  if (![DISTRIBUTION_MODES.OPEN_MARKET,DISTRIBUTION_MODES.SAVED_PARTNERS].includes(shipment.distribution_mode)) throw new Error('NOT_FOUND');
  db.prepare(`INSERT OR IGNORE INTO shipment_interests
    (id,shipment_id,provider_organization_id,provider_profile_id,status,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(randomId('int-'),shipment.id,providerScope(user)?.organizationId,providerScope(user)?.profileId,'INTERESTED',note || null,user.id,nowIso());
  const owner = db.prepare(`SELECT id FROM users WHERE organization_id=? AND active=1 ORDER BY created_at LIMIT 1`).get(shipment.load_owner_organization_id||shipment.shipper_organization_id);
  if (owner) notify(db,owner.id,'Provider expressed interest',`${user.organization_name || user.provider_business_name || user.name} is interested in ${shipment.code}.`);
  audit(db,user,'SHIPMENT_INTEREST_CREATED','shipment',shipment.id,{});
}

export function requestLoadProof(user, shipmentId) {
  if (!canNegotiateLoads(user)) throw new Error('FORBIDDEN');
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
  const owner = db.prepare(`SELECT id FROM users WHERE organization_id=? AND active=1 ORDER BY created_at LIMIT 1`).get(shipment.load_owner_organization_id||shipment.shipper_organization_id);
  if (owner) notify(db,owner.id,'Load proof requested',`${user.organization_name || user.provider_business_name || user.name} requested load-size proof for ${shipment.code}.`);
  audit(db,user,'LOAD_PROOF_REQUESTED','shipment',shipment.id,{ interestId: interest.id });
  return id;
}

export async function shareLoadProof(user, shipmentId, interestId, file, note = '') {
  const db = getDb();
  const shipment = db.prepare(`SELECT * FROM shipments WHERE id=? OR code=?`).get(shipmentId,shipmentId);
  if (!shipment || (user.role !== USER_ROLES.ADMIN && (shipment.load_owner_organization_id||shipment.shipper_organization_id) !== user.organization_id)) throw new Error('NOT_FOUND');
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
    s.shipper_organization_id,s.load_owner_organization_id,s.provider_organization_id AS assigned_organization_id,s.provider_profile_id AS assigned_profile_id,s.operational_status
    FROM load_proof_shares ps JOIN shipment_interests i ON i.id=ps.interest_id JOIN shipments s ON s.id=ps.shipment_id WHERE ps.id=?`).get(proofId);
  if (!share) return null;
  if (user.role === USER_ROLES.ADMIN || (user.organization_id && user.organization_id === (share.load_owner_organization_id||share.shipper_organization_id))) return share;
  const isRecipient = (user.organization_id && user.organization_id === share.recipient_organization_id)
    || (user.provider_profile_id && user.provider_profile_id === share.recipient_profile_id);
  if (!isRecipient || share.revoked_at || new Date(share.expires_at).getTime() <= Date.now()) return null;
  if (['WITHDRAWN','CANCELLED','COMPLETED','DECLINED'].includes(share.operational_status)) return null;
  if (share.assigned_organization_id && share.assigned_organization_id !== share.recipient_organization_id) return null;
  if (share.assigned_profile_id && share.assigned_profile_id !== share.recipient_profile_id) return null;
  return share;
}

export function acceptDirectedShipment(user, shipmentId) {
  if (!canNegotiateLoads(user)) throw new Error('FORBIDDEN');
  const db = getDb();
  const shipment = getShipmentForUser(user, shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  if (shipment.distribution_mode !== DISTRIBUTION_MODES.DIRECT_TO_PROVIDER) throw new Error('NOT_DIRECT_REQUEST');
  const scope = providerScope(user);
  const matches = Boolean(scope && ((scope.organizationId && shipment.provider_organization_id === scope.organizationId) || (scope.profileId && shipment.provider_profile_id === scope.profileId)));
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
  return db.prepare(`SELECT c.*,v.label AS vehicle_label,v.category AS vehicle_category,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,v.cargo_configuration,o.name AS organization_name,o.handle AS organization_handle,
    p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    JOIN users u ON u.id=c.updated_by
    WHERE v.active=1 AND c.visibility='OPEN' AND c.status IN ('EMPTY','PARTIAL') AND c.expires_at > ? ORDER BY c.updated_at DESC`).all(nowIso())
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
  return db.prepare(`SELECT c.*,v.label AS vehicle_label,v.category AS vehicle_category,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,v.cargo_configuration,o.name AS organization_name,o.handle AS organization_handle,
    p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    JOIN users u ON u.id=c.updated_by
    JOIN partner_relationships rel ON rel.owner_organization_id=?
      AND rel.status='CONNECTED'
      AND (rel.provider_organization_id=c.provider_organization_id OR rel.provider_profile_id=c.provider_profile_id)
    WHERE v.active=1 AND c.visibility='SAVED_PARTNERS' AND c.status IN ('EMPTY','PARTIAL') AND c.expires_at > ?
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
    const scope = providerScope(user);
    if (scope?.organizationId && row.provider_organization_id === scope.organizationId) return false;
    if (scope?.profileId && row.provider_profile_id === scope.profileId) return false;
    return true;
  });
  const filtered = visible
    .filter(row => !filters.q || [row.platform_number,row.vehicle_make,row.vehicle_model,row.cargo_configuration,row.organization_name,row.provider_name,row.origin,row.destination,row.current_route_origin,row.current_route_destination,row.location_area].some(value => textIncludes(value,filters.q)))
    .filter(row => !filters.origin || capacityRouteCandidates(row,{requireCurrentDate:true}).some(route => textIncludes(route.origin,filters.origin)))
    .filter(row => !filters.destination || capacityRouteCandidates(row,{requireCurrentDate:true}).some(route => textIncludes(route.destination,filters.destination)))
    .filter(row => !filters.status || row.status === filters.status)
    .filter(row => !filters.loadType || (filters.loadType === 'FTL' ? row.accepts_full_load : row.accepts_partial_load))
    .filter(row => !filters.vehicleCategory || row.cargo_configuration === filters.vehicleCategory || row.vehicle_category === filters.vehicleCategory)
    .filter(row => !filters.minAvailable || row.available_percent >= Number(filters.minAvailable))
    .filter(row => !filters.routeBy || capacityRouteCandidates(row,{requireCurrentDate:true}).some(route => route.route_date <= filters.routeBy))
    .filter(row => !filters.visibility || row.visibility === filters.visibility)
    .filter(row => !filters.freshness || String(row.freshness).toUpperCase().replaceAll(' ','_') === filters.freshness)
    .filter(row => !filters.stopOption
      || (filters.stopOption === 'DIRECT_ONLY' && !row.accepts_multi_pick && !row.accepts_multi_drop)
      || (filters.stopOption === 'MULTI_PICK' && row.accepts_multi_pick)
      || (filters.stopOption === 'MULTI_DROP' && row.accepts_multi_drop))
    .filter(row => filters.contractRoutes !== 'YES' || row.open_to_contract_lanes)
    .filter(row => filters.proof !== 'RECORDED' || row.proof_available)
    .map(row => {
      const match = selectedLoad
        ? capacityRouteCandidates(row,{requireCurrentDate:true})
          .map(route => ({...route,...routeMatch(route.origin,route.destination,selectedLoad.origin,selectedLoad.destination)}))
          .sort((a,b)=>b.score-a.score)[0]||null
        : null;
      return {...row,route_match_score:match?.score ?? null,route_match_label:match?.label ?? null,route_match_source:match?.source_label||null};
    });
  if (selectedLoad) filtered.sort((a,b) => b.route_match_score-a.route_match_score || new Date(b.updated_at)-new Date(a.updated_at));
  return filtered;
}

export function listOwnCapacity(user) {
  if (!roleCanPublishCapacity(user.role) || user.role === USER_ROLES.ADMIN) return [];
  const db = getDb();
  const freshHours = Number(process.env.CAPACITY_FRESH_HOURS || 12);
  const scope = providerScope(user);
  if (!scope) return [];
  const assignmentCondition = isCompanyDriver(user)
    ? ' AND EXISTS (SELECT 1 FROM driver_vehicle_assignments a WHERE a.driver_user_id=? AND a.vehicle_id=v.id AND a.active=1)'
    : '';
  const args = isCompanyDriver(user) ? [scope.id,user.id] : [scope.id];
  return db.prepare(`SELECT c.*,v.label AS vehicle_label,v.category AS vehicle_category,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,v.cargo_configuration,o.name AS organization_name,o.handle AS organization_handle,
    p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id JOIN users u ON u.id=c.updated_by
    WHERE v.active=1 AND c.${scope.column}=?${assignmentCondition} ORDER BY c.updated_at DESC`).all(...args)
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
  if (visible) return attachCapacityPreferredRoutes(visible);
  if (roleCanPublishCapacity(user.role) && user.role !== USER_ROLES.ADMIN) {
    const own=listOwnCapacity(user).find(row => row.id === capacityId);
    return own?attachCapacityPreferredRoutes(own):null;
  }
  return null;
}

function attachCapacityPreferredRoutes(capacity) {
  const db=getDb();
  const condition=capacity.provider_profile_id?'provider_profile_id=?':'organization_id=?';
  const ownerId=capacity.provider_profile_id||capacity.provider_organization_id;
  return {
    ...capacity,
    preferred_routes:ownerId
      ? db.prepare(`SELECT id,origin,destination FROM profile_routes WHERE ${condition} ORDER BY created_at,id`).all(ownerId)
      : []
  };
}

export function listOwnVehicles(user) {
  const db = getDb();
  if (isSelfManagedDriver(user)) return db.prepare('SELECT * FROM vehicles WHERE provider_profile_id=? AND active=1').all(user.provider_profile_id);
  if (isCompanyDriver(user)) return db.prepare(`SELECT v.* FROM vehicles v JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id
    WHERE a.driver_user_id=? AND a.active=1 AND v.organization_id=? AND v.active=1 ORDER BY v.label`).all(user.id,user.organization_id);
  if (user.role === USER_ROLES.TRANSPORTER) return db.prepare('SELECT * FROM vehicles WHERE organization_id=? AND active=1').all(user.organization_id);
  return [];
}

export function publishCapacity(user, input, photo = null) {
  if (!roleCanPublishCapacity(user.role)) throw new Error('FORBIDDEN');
  const db = getDb();
  const scope = providerScope(user);
  if (!scope) throw new Error('FORBIDDEN');
  if (isCompanyDriver(user) && !getDriverAccess(user)?.can_manage_capacity) throw new Error('FORBIDDEN');
  const assignmentJoin = isCompanyDriver(user)
    ? ` AND EXISTS (SELECT 1 FROM driver_vehicle_assignments a WHERE a.driver_user_id=? AND a.vehicle_id=vehicles.id AND a.active=1)`
    : '';
  const vehicleArgs = isCompanyDriver(user) ? [input.vehicleId,scope.id,user.id] : [input.vehicleId,scope.id];
  const vehicle = db.prepare(`SELECT * FROM vehicles WHERE id=? AND ${scope.column === 'provider_profile_id' ? 'provider_profile_id' : 'organization_id'}=? AND active=1${assignmentJoin}`)
    .get(...vehicleArgs);
  if (!vehicle) throw new Error('INVALID_VEHICLE');
  const percent = validateCapacity(input.status,input.availablePercent);
  const acceptedLoads = validateAcceptedLoads(input.status,input.acceptedLoads);
  const acceptsMultiPick=Boolean(input.acceptsMultiPick||input.acceptsMultiStop);
  const acceptsMultiDrop=Boolean(input.acceptsMultiDrop||input.acceptsMultiStop);
  if(input.status==='PARTIAL'&&Boolean(input.currentRouteOrigin)!==Boolean(input.currentRouteDestination))throw new Error('ROUTE_ENDPOINTS_REQUIRED');
  if(Boolean(input.origin)!==Boolean(input.destination))throw new Error('ROUTE_ENDPOINTS_REQUIRED');
  const hasCurrentRoute=input.status==='PARTIAL'&&Boolean(input.currentRouteOrigin&&input.currentRouteDestination);
  const hasPlannedRoute=input.status!=='OFF_DUTY'&&Boolean(input.origin&&input.destination);
  if(hasCurrentRoute&&!input.currentRouteDate)throw new Error('CURRENT_ROUTE_DATE_REQUIRED');
  if(hasPlannedRoute&&!input.travelDate)throw new Error('PLANNED_ROUTE_DATE_REQUIRED');
  if((hasCurrentRoute&&input.currentRouteDate<todayInEthiopia())||(hasPlannedRoute&&input.travelDate<todayInEthiopia()))throw new Error('INVALID_ROUTE_DATE');
  if(hasPlannedRoute&&!['FULL','PARTIAL'].includes(input.plannedSpaceStatus))throw new Error('PLANNED_SPACE_STATUS_REQUIRED');
  const visibility = input.visibility || 'OPEN';
  if (!['OPEN','SAVED_PARTNERS'].includes(visibility)) throw new Error('INVALID_CAPACITY_VISIBILITY');
  if (input.status !== 'OFF_DUTY' && !input.locationArea?.trim()) throw new Error('CAPACITY_AREA_REQUIRED');
  const hasDeviceArea = input.status !== 'OFF_DUTY' && input.locationSource === 'DEVICE_OBSCURED';
  if (user.role === USER_ROLES.TRANSPORTER && hasDeviceArea) throw new Error('DEVICE_LOCATION_DRIVER_ONLY');
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
  const origin=input.origin?placeLabel(input.origin):null;
  const destination=input.destination?placeLabel(input.destination):null;
  const currentRouteOrigin=input.currentRouteOrigin?placeLabel(input.currentRouteOrigin):null;
  const currentRouteDestination=input.currentRouteDestination?placeLabel(input.currentRouteDestination):null;
  const locationArea=input.status==='OFF_DUTY'?null:qualifyAreaLabel(input.locationArea);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE capacities SET expires_at=? WHERE vehicle_id=? AND expires_at>?`).run(timestamp,vehicle.id,timestamp);
    db.prepare(`INSERT INTO capacities
      (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,proof_recorded_at,current_route_origin,current_route_destination,current_route_date,planned_space_status,accepts_multi_pick,accepts_multi_drop)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,scope.organizationId,scope.profileId,vehicle.id,input.status,percent,origin,destination,origin&&destination?`${origin} → ${destination}`:null,hasPlannedRoute?input.travelDate:null,input.nextAvailable || null,visibility,photo?.path || null,user.id,timestamp,expiresAt,locationArea,input.status === 'OFF_DUTY' ? null : timestamp,locationLat,locationLng,locationPrecisionKm,hasDeviceArea ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA',acceptedLoads.acceptsFullLoad ? 1 : 0,acceptedLoads.acceptsPartialLoad ? 1 : 0,input.openToContractLanes ? 1 : 0,(acceptsMultiPick||acceptsMultiDrop) ? 1 : 0,photo?.path ? timestamp : null,hasCurrentRoute?currentRouteOrigin:null,hasCurrentRoute?currentRouteDestination:null,hasCurrentRoute?input.currentRouteDate:null,hasPlannedRoute?input.plannedSpaceStatus:null,acceptsMultiPick?1:0,acceptsMultiDrop?1:0);
    audit(db,user,'CAPACITY_PUBLISHED','capacity',id,{ status: input.status, percent, vehicleId: vehicle.id, locationArea, locationSource: hasDeviceArea ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA', locationPrecisionKm, acceptedLoads: input.status === 'OFF_DUTY' ? null : input.acceptedLoads, currentRouteDate:hasCurrentRoute?input.currentRouteDate:null,plannedRouteDate:hasPlannedRoute?input.travelDate:null,plannedSpaceStatus:hasPlannedRoute?input.plannedSpaceStatus:null, openToContractLanes: Boolean(input.openToContractLanes), acceptsMultiPick, acceptsMultiDrop, proofRecorded: Boolean(photo?.path) });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export function setAssignedVehicleDuty(user, vehicleId, onDuty) {
  if (![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) throw new Error('FORBIDDEN');
  const db = getDb();
  const scope = providerScope(user);
  if (!scope) throw new Error('FORBIDDEN');
  const assignment = isCompanyDriver(user)
    ? db.prepare(`SELECT v.* FROM vehicles v JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id
      WHERE v.id=? AND v.organization_id=? AND v.active=1 AND a.driver_user_id=? AND a.active=1`).get(vehicleId,scope.id,user.id)
    : db.prepare(`SELECT * FROM vehicles WHERE id=? AND ${scope.column === 'provider_profile_id' ? 'provider_profile_id' : 'organization_id'}=? AND active=1`).get(vehicleId,scope.id);
  if (!assignment) throw new Error('INVALID_VEHICLE');
  const source = onDuty
    ? db.prepare(`SELECT c.* FROM capacities c JOIN users u ON u.id=c.updated_by
      WHERE c.vehicle_id=? AND c.status IN ('EMPTY','PARTIAL') AND (?=0 OR u.role='TRANSPORTER')
      ORDER BY c.updated_at DESC LIMIT 1`).get(vehicleId,isCompanyDriver(user) ? 1 : 0)
    : db.prepare('SELECT * FROM capacities WHERE vehicle_id=? ORDER BY updated_at DESC LIMIT 1').get(vehicleId);
  if (onDuty && !source) throw new Error('CAPACITY_CONFIGURATION_REQUIRED');
  const timestamp = nowIso();
  const expiresAt = hoursFromNow(Number(process.env.CAPACITY_EXPIRES_HOURS || 24));
  const id = randomId('cap-');
  const status = onDuty ? source.status : 'OFF_DUTY';
  const percent = onDuty ? source.available_percent : 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE capacities SET expires_at=? WHERE vehicle_id=? AND expires_at>?`).run(timestamp,vehicleId,timestamp);
    db.prepare(`INSERT INTO capacities
      (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,proof_recorded_at,current_route_origin,current_route_destination,current_route_date,planned_space_status,accepts_multi_pick,accepts_multi_drop)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,scope.organizationId,scope.profileId,vehicleId,status,percent,source?.origin || null,source?.destination || null,source?.corridor || null,source?.travel_date || null,source?.next_available || null,source?.visibility || 'OPEN',null,user.id,timestamp,expiresAt,onDuty ? source.location_area : null,onDuty ? timestamp : null,onDuty ? source.location_lat : null,onDuty ? source.location_lng : null,onDuty ? source.location_precision_km : null,onDuty ? source.location_source : null,onDuty ? source.accepts_full_load : 0,onDuty ? source.accepts_partial_load : 0,onDuty ? source.open_to_contract_lanes : 0,onDuty ? source.accepts_multi_stop : 0,null,onDuty?source.current_route_origin:null,onDuty?source.current_route_destination:null,onDuty?source.current_route_date:null,onDuty?source.planned_space_status:null,onDuty?source.accepts_multi_pick:0,onDuty?source.accepts_multi_drop:0);
    audit(db,user,onDuty ? 'VEHICLE_SET_ON_DUTY' : 'VEHICLE_SET_OFF_DUTY','vehicle',vehicleId,{restoredCapacityId:onDuty ? source.id : null});
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export function listFleetDrivers(user) {
  if (user.role !== USER_ROLES.TRANSPORTER || !user.organization_id) throw new Error('FORBIDDEN');
  const db = getDb();
  return db.prepare(`SELECT u.id,u.name,u.email,d.phone,d.license_verified,
    COALESCE(p.can_browse_load_board,1) AS can_browse_load_board,
    COALESCE(p.can_contact_businesses,1) AS can_contact_businesses,
    COALESCE(p.can_negotiate_loads,1) AS can_negotiate_loads,
    COALESCE(p.can_manage_capacity,1) AS can_manage_capacity,
    GROUP_CONCAT(v.make || ' ' || v.model || ' · ' || COALESCE(v.plate,''),'; ') AS assigned_vehicles
    FROM users u JOIN drivers d ON d.user_id=u.id AND d.active=1
    LEFT JOIN driver_permissions p ON p.user_id=u.id
    LEFT JOIN driver_vehicle_assignments a ON a.driver_user_id=u.id AND a.active=1
    LEFT JOIN vehicles v ON v.id=a.vehicle_id AND v.active=1
    WHERE u.role='DRIVER' AND u.organization_id=? AND u.active=1
    GROUP BY u.id ORDER BY u.name`).all(user.organization_id);
}

export function updateFleetDriverPermissions(user, driverUserId, input) {
  if (user.role !== USER_ROLES.TRANSPORTER || !user.organization_id) throw new Error('FORBIDDEN');
  const db = getDb();
  const driver = db.prepare(`SELECT u.id FROM users u JOIN drivers d ON d.user_id=u.id
    WHERE u.id=? AND u.role='DRIVER' AND u.organization_id=? AND u.active=1 AND d.active=1`).get(driverUserId,user.organization_id);
  if (!driver) throw new Error('NOT_FOUND');
  const values = {
    browse:Boolean(input.canBrowseLoadBoard),
    contact:Boolean(input.canContactBusinesses),
    negotiate:Boolean(input.canNegotiateLoads),
    capacity:Boolean(input.canManageCapacity)
  };
  db.prepare(`INSERT INTO driver_permissions
    (user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,updated_by,updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      can_browse_load_board=excluded.can_browse_load_board,
      can_contact_businesses=excluded.can_contact_businesses,
      can_negotiate_loads=excluded.can_negotiate_loads,
      can_manage_capacity=excluded.can_manage_capacity,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at`)
    .run(driver.id,values.browse ? 1 : 0,values.contact ? 1 : 0,values.negotiate ? 1 : 0,values.capacity ? 1 : 0,user.id,nowIso());
  audit(db,user,'DRIVER_PERMISSIONS_UPDATED','user',driver.id,values);
}

export function listApplications(user) {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  return getDb().prepare(`SELECT a.*,u.email,u.name FROM applications a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC`).all();
}

export function getAdminOperations(user, query = '') {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  const db=getDb();
  const term=String(query||'').trim().toLowerCase().slice(0,80);
  const pattern=`%${term}%`;
  const matches=(expression)=>`(?='' OR lower(${expression}) LIKE ?)`;
  const searchArgs=[term,pattern];
  const users=db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.role,u.active,u.created_at,
      COALESCE(o.name,p.business_name,'Loadgistic') AS workspace_name
    FROM users u
    LEFT JOIN organizations o ON o.id=u.organization_id
    LEFT JOIN provider_profiles p ON p.id=u.provider_profile_id
    WHERE ${matches("u.name || ' ' || u.email || ' ' || u.role || ' ' || COALESCE(o.name,'') || ' ' || COALESCE(p.business_name,'')")}
    ORDER BY u.active DESC,u.created_at DESC LIMIT 75`).all(...searchArgs);
  const organizations=db.prepare(`SELECT o.id,'ORGANIZATION' AS record_kind,o.name,o.type,o.city,o.public_visibility,
      (SELECT COUNT(*) FROM users u WHERE u.organization_id=o.id) AS user_count,
      (SELECT COUNT(*) FROM vehicles v WHERE v.organization_id=o.id AND v.active=1) AS truck_count,
      (SELECT COUNT(*) FROM shipments s WHERE COALESCE(s.load_owner_organization_id,s.shipper_organization_id)=o.id OR s.provider_organization_id=o.id) AS load_count
    FROM organizations o
    WHERE ${matches("o.name || ' ' || o.type || ' ' || COALESCE(o.city,'')")}
    ORDER BY o.name LIMIT 50`).all(...searchArgs);
  const providers=db.prepare(`SELECT p.id,'PROVIDER_PROFILE' AS record_kind,p.business_name AS name,'SELF_MANAGED_DRIVER' AS type,p.city,p.public_visibility,
      (SELECT COUNT(*) FROM users u WHERE u.provider_profile_id=p.id) AS user_count,
      (SELECT COUNT(*) FROM vehicles v WHERE v.provider_profile_id=p.id AND v.active=1) AS truck_count,
      (SELECT COUNT(*) FROM shipments s WHERE s.provider_profile_id=p.id) AS load_count
    FROM provider_profiles p
    WHERE ${matches("p.business_name || ' ' || COALESCE(p.city,'')")}
    ORDER BY p.business_name LIMIT 50`).all(...searchArgs);
  const vehicles=db.prepare(`SELECT v.id,v.platform_number,v.make,v.model,v.cargo_configuration,v.plate,v.active,
      COALESCE(o.name,p.business_name) AS owner_name,
      c.id AS capacity_id,c.status AS capacity_status,c.location_area,c.updated_at AS capacity_updated_at,c.expires_at
    FROM vehicles v
    LEFT JOIN organizations o ON o.id=v.organization_id
    LEFT JOIN provider_profiles p ON p.id=v.provider_profile_id
    LEFT JOIN capacities c ON c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC LIMIT 1)
    WHERE ${matches("COALESCE(v.platform_number,'') || ' ' || COALESCE(v.make,'') || ' ' || COALESCE(v.model,'') || ' ' || COALESCE(v.cargo_configuration,'') || ' ' || COALESCE(v.plate,'') || ' ' || COALESCE(o.name,'') || ' ' || COALESCE(p.business_name,'')")}
    ORDER BY v.active DESC,v.platform_number LIMIT 100`).all(...searchArgs);
  const loads=db.prepare(`SELECT s.id,s.code,s.title,s.origin,s.destination,s.load_type,s.operational_status,s.updated_at,
      owner.name AS owner_name,COALESCE(provider.name,profile.business_name) AS provider_name
    FROM shipments s
    JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    LEFT JOIN organizations provider ON provider.id=s.provider_organization_id
    LEFT JOIN provider_profiles profile ON profile.id=s.provider_profile_id
    WHERE ${matches("s.code || ' ' || s.title || ' ' || s.origin || ' ' || s.destination || ' ' || owner.name || ' ' || COALESCE(provider.name,'') || ' ' || COALESCE(profile.business_name,'')")}
    ORDER BY s.updated_at DESC LIMIT 100`).all(...searchArgs);
  const capacities=db.prepare(`SELECT c.id,c.status,c.available_percent,c.visibility,c.location_area,c.updated_at,c.expires_at,
      v.platform_number,v.make,v.model,COALESCE(o.name,p.business_name) AS owner_name
    FROM capacities c
    JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    WHERE c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC LIMIT 1)
      AND ${matches("COALESCE(v.platform_number,'') || ' ' || COALESCE(v.make,'') || ' ' || COALESCE(v.model,'') || ' ' || COALESCE(o.name,'') || ' ' || COALESCE(p.business_name,'') || ' ' || COALESCE(c.location_area,'')")}
    ORDER BY c.updated_at DESC LIMIT 100`).all(...searchArgs);
  const counts={
    users:db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    workspaces:db.prepare('SELECT (SELECT COUNT(*) FROM organizations)+(SELECT COUNT(*) FROM provider_profiles) AS n').get().n,
    trucks:db.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n,
    loads:db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n,
    fresh_capacity:db.prepare(`SELECT COUNT(DISTINCT c.vehicle_id) AS n FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id WHERE v.active=1 AND c.status IN ('EMPTY','PARTIAL') AND c.expires_at>?`).get(nowIso()).n
  };
  audit(db,user,'ADMIN_OPERATIONS_VIEWED','platform',null,{queryUsed:Boolean(term)});
  return {counts,users,workspaces:[...organizations,...providers],vehicles,loads,capacities,query:term};
}

export function setAdminRecordActive(user, recordType, recordId, active) {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  const db=getDb();
  const enabled=Boolean(active);
  if(recordType==='USER'){
    const target=db.prepare('SELECT id,role,active FROM users WHERE id=?').get(recordId);
    if(!target)throw new Error('NOT_FOUND');
    if(target.id===user.id&&!enabled)throw new Error('ADMIN_SELF_SUSPENSION_DENIED');
    db.prepare('UPDATE users SET active=? WHERE id=?').run(enabled?1:0,target.id);
    audit(db,user,'ADMIN_USER_ACCESS_CHANGED','user',target.id,{active:enabled});
    return;
  }
  if(recordType==='VEHICLE'){
    const target=db.prepare('SELECT id,active,platform_number FROM vehicles WHERE id=?').get(recordId);
    if(!target)throw new Error('NOT_FOUND');
    db.prepare('UPDATE vehicles SET active=? WHERE id=?').run(enabled?1:0,target.id);
    audit(db,user,'ADMIN_VEHICLE_STATUS_CHANGED','vehicle',target.id,{active:enabled,platformNumber:target.platform_number});
    return;
  }
  throw new Error('INVALID_ADMIN_RECORD_TYPE');
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

export function getBusinessTrackingAccessCode(user,shipmentId) {
  if (![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role) || !user.organization_id) throw new Error('NOT_FOUND');
  const db = getDb();
  const shipment = db.prepare(`SELECT id FROM shipments
    WHERE (id=? OR code=?) AND COALESCE(load_owner_organization_id,shipper_organization_id)=?`)
    .get(shipmentId,shipmentId,user.organization_id);
  if (!shipment) throw new Error('NOT_FOUND');
  return trackingAccessCode(shipment.id);
}

export function unlockBusinessTracking(user,code) {
  if (user && ![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)) throw new Error('TRACKING_ACCESS_DENIED');
  const db = getDb();
  const codeHash = hashTrackingAccessCode(code);
  const shipment = db.prepare(`SELECT id,code FROM shipments WHERE tracking_code_hash=?`).get(codeHash);
  if (!shipment) {
    audit(db,user,'TRACKING_UNLOCK_DENIED','shipment',null,{});
    throw new Error('TRACKING_ACCESS_DENIED');
  }
  audit(db,user,'TRACKING_UNLOCKED','shipment',shipment.id,{});
  return shipment;
}

export function getBusinessTracking(user,shipmentId) {
  if (user && ![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)) return null;
  const db = getDb();
  const shipment = db.prepare(`SELECT s.id,s.code,s.title,s.service_mode,s.origin,s.destination,s.operational_status,s.tracking_mode,s.updated_at,
    COALESCE(s.external_shipper_name,so.name) AS shipper_name,
    COALESCE(s.external_receiver_name,ro.name) AS receiver_name,
    po.name AS provider_name,pp.business_name AS provider_profile_name,s.load_type
    FROM shipments s LEFT JOIN organizations so ON so.id=s.shipper_organization_id LEFT JOIN organizations ro ON ro.id=s.receiver_organization_id
    LEFT JOIN organizations po ON po.id=s.provider_organization_id LEFT JOIN provider_profiles pp ON pp.id=s.provider_profile_id
    WHERE s.id=?`).get(shipmentId);
  if (!shipment) return null;
  shipment.events = db.prepare(`SELECT status,event_type,note,location_area,location_precision_km,location_source,created_at
    FROM shipment_events WHERE shipment_id=? AND public=1 ORDER BY created_at ASC`).all(shipment.id);
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
