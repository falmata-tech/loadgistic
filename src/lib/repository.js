import { getDb } from './db.js';
import { removePrivateUpload, storePrivateUpload } from './private-storage.js';
import {
  USER_ROLES,
  SERVICE_MODES,
  DISTRIBUTION_MODES,
  PRICE_MODES,
  MOVEMENT_SCOPES,
  validatePriceMode,
  validateCapacity,
  validateAcceptedLoads,
  validateFreightLoadType,
  validateMovementScope,
  validateServiceRadius,
  validateSupportAgentLimit,
  validateSupportCategory,
  validateSupportMessage,
  pointInServiceArea,
  serviceAreasOverlap,
  assertTransition,
  capacitySignalFreshness,
  loadBoardDeadlineState,
  LOAD_BOARD_GRACE_DAYS,
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
import { bestGeographicRouteMatch, geographicRouteMatch, normalizePlace } from './route-matching.js';
import { ETHIOPIA_PLACES, getPlaceCoordinate as getBuiltInPlaceCoordinate } from './ethiopia-places.js';
import { buildAlongRouteChains, poolCompatibleLoads } from './pstl.js';
import { placeIdentity, placeLabel, placeLocalName, qualifyAreaLabel } from './place-labels.js';
import { accessPeriodEnd, PAID_ACCESS_DAYS, subscriptionAccess, TRIAL_DAYS } from './subscription-access.js';

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

function dateInEthiopiaOffset(days) {
  const date=new Date(`${todayInEthiopia()}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
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

function workspaceSubscription(db,user) {
  if (!user || user.role === USER_ROLES.ADMIN) return null;
  if (user.provider_profile_id) {
    return db.prepare(`SELECT s.*,p.name AS plan_name,p.code AS plan_code
      FROM subscriptions s JOIN plans p ON p.id=s.plan_id
      WHERE s.provider_profile_id=? ORDER BY s.starts_at DESC LIMIT 1`).get(user.provider_profile_id);
  }
  if (user.organization_id) {
    return db.prepare(`SELECT s.*,p.name AS plan_name,p.code AS plan_code
      FROM subscriptions s JOIN plans p ON p.id=s.plan_id
      WHERE s.organization_id=? ORDER BY s.starts_at DESC LIMIT 1`).get(user.organization_id);
  }
  return null;
}

export function getWorkspaceAccess(user, at = new Date()) {
  if ([USER_ROLES.ADMIN,USER_ROLES.SUPPORT].includes(user?.role)) {
    return {granted:true,status:user.role,ends_at:null,days_remaining:null,subscription:null};
  }
  const subscription = workspaceSubscription(getDb(),user);
  return {...subscriptionAccess(subscription,at),subscription};
}

export function assertWorkspaceAccess(user) {
  const access = getWorkspaceAccess(user);
  if (!access.granted) throw new Error('SUBSCRIPTION_ACCESS_REQUIRED');
  return access;
}

export const PLATFORM_PERMISSIONS=Object.freeze({
  CUSTOMERS:'CUSTOMERS',
  OPERATIONS:'OPERATIONS',
  TRUST:'TRUST',
  BILLING:'BILLING',
  SUPPORT:'SUPPORT'
});

const PLATFORM_PERMISSION_FIELDS=Object.freeze({
  CUSTOMERS:'can_manage_customers',
  OPERATIONS:'can_manage_operations',
  TRUST:'can_manage_trust',
  BILLING:'can_manage_billing',
  SUPPORT:'can_manage_support'
});

export function hasPlatformPermission(user,permission){
  if(user?.role===USER_ROLES.ADMIN)return true;
  const field=PLATFORM_PERMISSION_FIELDS[permission];
  return Boolean(field&&user?.role===USER_ROLES.SUPPORT&&user[field]);
}

export function assertPlatformPermission(user,permission){
  if(!hasPlatformPermission(user,permission))throw new Error('FORBIDDEN');
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
  const select=`SELECT id,name,
      name || CASE WHEN parent_name IS NOT NULL AND trim(parent_name)<>'' AND lower(parent_name)<>lower(name) THEN ', ' || parent_name ELSE '' END || ', ' || country_name AS display_name,
      country_name,country_code,parent_name,place_type,latitude AS lat,longitude AS lng,population,wikidata_id,source FROM place_catalog`;
  const order=`ORDER BY
      CASE WHEN normalized_name=? THEN 0 WHEN normalized_name GLOB ? THEN 1 ELSE 2 END,
      CASE place_type WHEN 'city' THEN 0 WHEN 'town' THEN 1 WHEN 'suburb' THEN 2 WHEN 'neighbourhood' THEN 3 WHEN 'quarter' THEN 4 WHEN 'village' THEN 5 ELSE 6 END,
      COALESCE(population,0) DESC,name`;
  const imported = db.prepare(`${select}
    WHERE normalized_name GLOB ?
    ${order}
    LIMIT ?`).all(`${normalized}*`,normalized,`${normalized}*`,boundedLimit);
  if(imported.length<boundedLimit){
    const excluded=imported.length?` AND id NOT IN (${imported.map(()=>'?').join(',')})`:'';
    const remaining=boundedLimit-imported.length;
    imported.push(...db.prepare(`${select}
      WHERE (normalized_name LIKE ? OR lower(COALESCE(alternate_names,'')) LIKE ?)${excluded}
      ${order}
      LIMIT ?`).all(
        `%${normalized}%`,`%${normalized}%`,...imported.map(place=>place.id),
        normalized,`${normalized}*`,remaining
      ));
  }
  const seen = new Set(imported.map(place=>placeIdentity(place.display_name)));
  const fallback = ETHIOPIA_PLACES
    .filter(place=>normalizePlace(place.name).includes(normalized)&&!seen.has(placeIdentity(place.name)))
    .map(place=>({id:`builtin:${normalizePlace(place.name)}`,name:place.name,display_name:placeLabel(place.name),country_name:'Ethiopia',country_code:'ET',parent_name:null,place_type:'city',lat:place.lat,lng:place.lng,population:null,wikidata_id:null,source:'BUILT_IN'}));
  return [...imported,...fallback].slice(0,boundedLimit);
}

function resolvePlaceReference(placeRef, label) {
  const reference=String(placeRef||'').trim();
  const fallbackLabel=placeLabel(label);
  if (!reference) throw new Error('LOCALITY_REQUIRED');
  if (reference.startsWith('builtin:')) {
    const coordinate=getBuiltInPlaceCoordinate(fallbackLabel||reference.slice('builtin:'.length));
    if (!coordinate) throw new Error('INVALID_LOCALITY');
    return {place_ref:reference,place_label:placeLabel(coordinate.name),center_lat:coordinate.lat,center_lng:coordinate.lng};
  }
  const place=getDb().prepare(`SELECT id,name,parent_name,country_name,latitude,longitude FROM place_catalog WHERE id=?`).get(reference);
  if (!place) throw new Error('INVALID_LOCALITY');
  const qualified=place.parent_name&&normalizePlace(place.parent_name)!==normalizePlace(place.name)
    ? `${place.name}, ${place.parent_name}, ${place.country_name}`
    : `${place.name}, ${place.country_name}`;
  return {place_ref:place.id,place_label:qualified,center_lat:place.latitude,center_lng:place.longitude};
}

function optionalCoordinatePair(latValue,lngValue) {
  if ((latValue===''||latValue==null)&&(lngValue===''||lngValue==null)) return {lat:null,lng:null};
  const lat=Number(latValue);
  const lng=Number(lngValue);
  if (!Number.isFinite(lat)||lat < 3||lat > 15||!Number.isFinite(lng)||lng < 32||lng > 49) {
    throw new Error('INVALID_ETHIOPIA_POINT');
  }
  return {lat,lng};
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
  assertWorkspaceAccess(user);
  if(user.role===USER_ROLES.SUPPORT)throw new Error('FORBIDDEN');
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
        AND (lower(o.name) LIKE ? OR lower(COALESCE(o.industry,'')) LIKE ?)
      ORDER BY is_favorite DESC,CASE WHEN lower(o.name)=? THEN 0 WHEN lower(o.name) LIKE ? THEN 1 ELSE 2 END,o.name
      LIMIT ?`).all(user.organization_id||'',user.organization_id||'',pattern,pattern,value,`${value}%`,boundedLimit));
  }
  if(kind==='ALL'||kind==='TRANSPORT'){
    results.push(...db.prepare(`SELECT * FROM (
      SELECT o.id,'org' AS ref_kind,o.name,o.type,o.city,0 AS is_favorite
      FROM organizations o WHERE o.type='TRANSPORT_COMPANY'
        AND lower(o.name) LIKE ?
      UNION ALL
      SELECT p.id,'profile' AS ref_kind,p.business_name AS name,'INDEPENDENT_PROVIDER' AS type,p.city,0 AS is_favorite
      FROM provider_profiles p WHERE lower(p.business_name) LIKE ?
    ) ORDER BY CASE WHEN lower(name)=? THEN 0 WHEN lower(name) LIKE ? THEN 1 ELSE 2 END,name LIMIT ?`)
      .all(pattern,pattern,value,`${value}%`,boundedLimit));
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
  assertWorkspaceAccess(user);
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
           COALESCE(dp.can_manage_capacity,1) AS can_manage_capacity,
           COALESCE(sap.can_manage_customers,0) AS can_manage_customers,
           COALESCE(sap.can_manage_operations,0) AS can_manage_operations,
           COALESCE(sap.can_manage_trust,0) AS can_manage_trust,
           COALESCE(sap.can_manage_billing,0) AS can_manage_billing,
           COALESCE(sap.can_manage_support,0) AS can_manage_support
    FROM users u
    LEFT JOIN organizations o ON o.id = u.organization_id
    LEFT JOIN provider_profiles p ON p.id = u.provider_profile_id
    LEFT JOIN driver_permissions dp ON dp.user_id=u.id
    LEFT JOIN support_agent_profiles sap ON sap.user_id=u.id
    WHERE u.id = ?
  `).get(id) || null;
}

export function findUserByEmail(email) {
  return getDb().prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) || null;
}

export function listNotifications(user) {
  assertWorkspaceAccess(user);
  return getDb().prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`).all(user.id);
}

export function getDashboard(user) {
  assertWorkspaceAccess(user);
  const db = getDb();
  const data = { role: user.role, actions: [], counts: {}, recent: [], capacities: [], notifications: listNotifications(user) };
  if (user.role === USER_ROLES.ADMIN) {
    data.counts = {
      'Rating Reviews': db.prepare(`SELECT COUNT(*) AS n FROM business_reviews WHERE status='PENDING'`).get().n,
      Organizations: db.prepare('SELECT COUNT(*) AS n FROM organizations').get().n,
      Loads: db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n,
      'Board Capacity': db.prepare(`SELECT COUNT(*) AS n FROM capacities c
        WHERE c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
          AND (COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')
            OR (COALESCE(c.market_status,c.status)='BUSY' AND c.available_again_date>=?))`).get(todayInEthiopia()).n
    };
    data.actions = [
      { href: '/admin/operations', label: 'Open platform operations', description: 'Inspect one focused client, truck, shipment, or capacity view.' },
      { href: '/admin/reviews?tab=ratings', label: 'Review low ratings', description: 'Investigate private one- to three-star Business ratings.' },
      { href: '/admin/reviews?tab=documents', label: 'Review trust documents', description: 'Verify identities, licenses, drivers, and trucks.' },
      { href: '/app/providers', label: 'View transporter directory', description: 'Inspect authenticated transporter pages.' }
    ];
    data.recent = db.prepare('SELECT code,title,service_mode,operational_status,origin,destination,created_at FROM shipments ORDER BY created_at DESC LIMIT 6').all();
    return data;
  }

  if (user.role === USER_ROLES.SHIPPER || user.role === USER_ROLES.RECEIVER) {
    const condition = 'COALESCE(load_owner_organization_id,shipper_organization_id) = ? OR shipper_organization_id = ? OR receiver_organization_id = ?';
    data.counts = {
      'Active Shipments': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE (${condition}) AND operational_status NOT IN ('COMPLETED','CANCELLED','RETURNED')`).get(user.organization_id,user.organization_id,user.organization_id).n,
      'Open Requests': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE (${condition}) AND commercial_status IN ('POSTED','SENT','CONTACTED')`).get(user.organization_id,user.organization_id,user.organization_id).n,
      'Network Partners': db.prepare(`SELECT COUNT(*) AS n FROM partner_relationships WHERE owner_organization_id=? AND status='CONNECTED'`).get(user.organization_id).n,
      'Recent Updates': db.prepare(`SELECT COUNT(*) AS n FROM shipment_events e JOIN shipments s ON s.id=e.shipment_id WHERE (${condition}) AND e.created_at >= datetime('now','-7 days')`).get(user.organization_id,user.organization_id,user.organization_id).n
    };
    data.actions = [
      { href: '/app/shipments/new', label: 'Post a shipment', description: 'Request quotes or publish a road-freight shipment.' },
      { href: '/app/providers', label: 'Open directory', description: 'Confirm Businesses, fleet transporters, and self-managed drivers.' },
      { href: '/app/capacity', label: 'Open Truck Board', description: 'See fresh truck availability on active routes.' }
    ];
    data.recent = listVisibleShipments(user,6);
    return data;
  }

  const scope = providerScope(user);
  if (!scope) return data;
  data.counts = {
    'Available Shipments': countLoads(user),
    'Active Shipments': db.prepare(`SELECT COUNT(*) AS n FROM shipments WHERE ${scope.column}=? AND operational_status NOT IN ('COMPLETED','CANCELLED')`).get(scope.id).n,
    'On-duty Trucks': db.prepare(`SELECT COUNT(*) AS n FROM capacities c WHERE c.${scope.column}=?
      AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
      AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL','BUSY')`).get(scope.id).n,
    'Proof Pending': db.prepare(`SELECT COUNT(*) AS n FROM shipments s WHERE s.${scope.column}=? AND s.operational_status IN ('DELIVERED','IN_TRANSIT') AND NOT EXISTS (SELECT 1 FROM proof_files p WHERE p.shipment_id=s.id AND p.proof_type='DELIVERY')`).get(scope.id).n
  };
  data.actions = [
    { href: '/app/loads', label: 'Open Shipment Board', description: 'View direct, partner, and open B2B freight.' },
    { href: user.role === USER_ROLES.TRANSPORTER ? '/app/fleet' : '/app/home', label: 'Update capacity', description: 'Publish Empty or Partial truck availability.' },
    { href: '/app/company-page', label: 'Update Public Profile', description: 'Keep Preferred Routes and contact details current.' }
  ];
  data.recent = listVisibleShipments(user,6);
  data.capacities = listOwnCapacity(user,null,3);
  return data;
}

export function listVisibleShipments(user,limit=null) {
  assertWorkspaceAccess(user);
  if(user.role===USER_ROLES.SUPPORT)throw new Error('FORBIDDEN');
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
  if(limit!=null){
    sql+=' LIMIT ?';
    args.push(Math.max(1,Math.min(100,Number(limit)||6)));
  }
  return db.prepare(sql).all(...args).map(shipment=>({
    ...shipment,
    shipper_name:shipment.external_shipper_name||shipment.shipper_name,
    receiver_name:shipment.external_receiver_name||shipment.receiver_name
  }));
}

export function listOwnedLoads(user) {
  assertWorkspaceAccess(user);
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
      s.updated_at DESC`).all(user.organization_id)
    .map(load=>({...load,board_deadline_state:loadBoardDeadlineState(load.delivery_date,todayInEthiopia())}));
}

function shipmentWorkspaceStage(shipment, isBusiness) {
  if(['COMPLETED','CANCELLED'].includes(shipment.operational_status))return 'HISTORY';
  if(['AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED'].includes(shipment.operational_status))return 'TRACKING';
  if(isBusiness)return 'POSTED';
  if(shipment.direct_request)return 'DIRECT';
  return 'INTERESTED';
}

export function listMyShipments(user) {
  assertWorkspaceAccess(user);
  const isBusiness=[USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role);
  if(isBusiness)return listOwnedLoads(user).map(shipment=>({...shipment,workspace_stage:shipmentWorkspaceStage(shipment,true)}));
  if(user.role===USER_ROLES.ADMIN)return listVisibleShipments(user).map(shipment=>({...shipment,workspace_stage:shipmentWorkspaceStage(shipment,false)}));
  const scope=providerScope(user);
  if(!scope)return [];
  const db=getDb();
  const companyDriver=isCompanyDriver(user);
  const interestCondition=companyDriver
    ? `interest.created_by=?`
    : scope.organizationId?`interest.provider_organization_id=?`:`interest.provider_profile_id=?`;
  const interestArg=companyDriver?user.id:scope.id;
  const providerColumn=scope.organizationId?'provider_organization_id':'provider_profile_id';
  let where=`(s.${providerColumn}=? OR EXISTS(SELECT 1 FROM shipment_interests interest WHERE interest.shipment_id=s.id AND ${interestCondition}))`;
  const args=[scope.id,interestArg];
  if(companyDriver&&!canBrowseLoads(user)){
    where=`s.provider_organization_id=? AND s.operational_status IN ('AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED')`;
    args.splice(0,args.length,scope.id);
  }
  return db.prepare(`SELECT s.*,
    COALESCE(s.external_shipper_name,shipper.name) AS shipper_name,
    COALESCE(s.external_receiver_name,receiver.name) AS receiver_name,
    owner.name AS load_owner_name,
    EXISTS(SELECT 1 FROM shipment_interests own_interest WHERE own_interest.shipment_id=s.id AND ${companyDriver?'own_interest.created_by=?':scope.organizationId?'own_interest.provider_organization_id=?':'own_interest.provider_profile_id=?'}) AS interested,
    CASE WHEN s.${providerColumn}=? AND s.operational_status IN ('POSTED','SENT','CONTACTED') THEN 1 ELSE 0 END AS direct_request,
    (SELECT COUNT(*) FROM shipment_interests all_interest WHERE all_interest.shipment_id=s.id) AS interest_count
    FROM shipments s
    JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    LEFT JOIN organizations shipper ON shipper.id=s.shipper_organization_id
    LEFT JOIN organizations receiver ON receiver.id=s.receiver_organization_id
    WHERE ${where}
    ORDER BY s.updated_at DESC`)
    .all(interestArg,scope.id,...args)
    .map(shipment=>({...shipment,workspace_stage:shipmentWorkspaceStage(shipment,false),board_deadline_state:loadBoardDeadlineState(shipment.delivery_date,todayInEthiopia())}));
}

export function listMyShipmentsPage(user,filters={},options={}){
  assertWorkspaceAccess(user);
  if(user.role===USER_ROLES.ADMIN){
    const rows=listMyShipments(user)
      .filter(row=>!filters.view||filters.view==='ALL'||row.workspace_stage===filters.view)
      .filter(row=>!filters.status||filters.status==='ALL'||row.operational_status===filters.status)
      .filter(row=>!filters.q||[row.code,row.title,row.shipper_name,row.receiver_name,row.cargo_description].some(value=>String(value||'').toLowerCase().includes(String(filters.q).toLowerCase())));
    return paginateResults(rows,options);
  }
  const db=getDb();
  const isBusiness=[USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role);
  let baseSql;
  let args;
  if(isBusiness){
    baseSql=`SELECT owned.*,
      CASE
        WHEN operational_status IN ('COMPLETED','CANCELLED') THEN 'HISTORY'
        WHEN operational_status IN ('AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED') THEN 'TRACKING'
        ELSE 'POSTED'
      END AS workspace_stage
      FROM (SELECT s.*,
        COALESCE(s.external_shipper_name,shipper.name) AS shipper_name,
        COALESCE(s.external_receiver_name,receiver.name) AS receiver_name,
        owner.name AS load_owner_name,
        (SELECT COUNT(*) FROM shipment_interests interest WHERE interest.shipment_id=s.id) AS interest_count
        FROM shipments s
        JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
        LEFT JOIN organizations shipper ON shipper.id=s.shipper_organization_id
        LEFT JOIN organizations receiver ON receiver.id=s.receiver_organization_id
        WHERE COALESCE(s.load_owner_organization_id,s.shipper_organization_id)=?) owned`;
    args=[user.organization_id];
  }else{
    const scope=providerScope(user);
    if(!scope)return paginateResults([],options);
    const companyDriver=isCompanyDriver(user);
    const interestCondition=companyDriver
      ? `interest.created_by=?`
      : scope.organizationId?`interest.provider_organization_id=?`:`interest.provider_profile_id=?`;
    const interestArg=companyDriver?user.id:scope.id;
    const providerColumn=scope.organizationId?'provider_organization_id':'provider_profile_id';
    let providerWhere=`(s.${providerColumn}=? OR EXISTS(SELECT 1 FROM shipment_interests interest WHERE interest.shipment_id=s.id AND ${interestCondition}))`;
    const providerArgs=[scope.id,interestArg];
    if(companyDriver&&!canBrowseLoads(user)){
      providerWhere=`s.provider_organization_id=? AND s.operational_status IN ('AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED')`;
      providerArgs.splice(0,providerArgs.length,scope.id);
    }
    baseSql=`SELECT provider.*,
      CASE
        WHEN operational_status IN ('COMPLETED','CANCELLED') THEN 'HISTORY'
        WHEN operational_status IN ('AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED') THEN 'TRACKING'
        WHEN direct_request=1 THEN 'DIRECT'
        ELSE 'INTERESTED'
      END AS workspace_stage
      FROM (SELECT s.*,
        COALESCE(s.external_shipper_name,shipper.name) AS shipper_name,
        COALESCE(s.external_receiver_name,receiver.name) AS receiver_name,
        owner.name AS load_owner_name,
        EXISTS(SELECT 1 FROM shipment_interests own_interest WHERE own_interest.shipment_id=s.id AND ${companyDriver?'own_interest.created_by=?':scope.organizationId?'own_interest.provider_organization_id=?':'own_interest.provider_profile_id=?'}) AS interested,
        CASE WHEN s.${providerColumn}=? AND s.operational_status IN ('POSTED','SENT','CONTACTED') THEN 1 ELSE 0 END AS direct_request,
        (SELECT COUNT(*) FROM shipment_interests all_interest WHERE all_interest.shipment_id=s.id) AS interest_count
        FROM shipments s
        JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
        LEFT JOIN organizations shipper ON shipper.id=s.shipper_organization_id
        LEFT JOIN organizations receiver ON receiver.id=s.receiver_organization_id
        WHERE ${providerWhere}) provider`;
    args=[interestArg,scope.id,...providerArgs];
  }
  const where=[];
  if(filters.view&&filters.view!=='ALL'){where.push('workspace_stage=?');args.push(filters.view);}
  if(filters.status&&filters.status!=='ALL'){where.push('operational_status=?');args.push(filters.status);}
  const search=String(filters.q||'').trim().toLowerCase();
  if(search){
    where.push(`lower(COALESCE(code,'') || ' ' || COALESCE(title,'') || ' ' || COALESCE(shipper_name,'') || ' ' || COALESCE(receiver_name,'') || ' ' || COALESCE(cargo_description,'')) LIKE ?`);
    args.push(`%${search}%`);
  }
  const filteredSql=`SELECT * FROM (${baseSql}) my_shipments${where.length?` WHERE ${where.join(' AND ')}`:''}`;
  const result=paginateQuery(db,filteredSql,args,'updated_at DESC,id',options);
  result.items=result.items.map(shipment=>({...shipment,board_deadline_state:loadBoardDeadlineState(shipment.delivery_date,todayInEthiopia())}));
  return result;
}

export function getOwnedShipmentDeadlineSummary(user){
  if(![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)||!user.organization_id)return {needsReview:0,hidden:0};
  const today=todayInEthiopia();
  const cutoff=new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate()-LOAD_BOARD_GRACE_DAYS);
  const expiredBefore=cutoff.toISOString().slice(0,10);
  const row=getDb().prepare(`SELECT
      SUM(CASE WHEN delivery_date<? THEN 1 ELSE 0 END) AS needs_review,
      SUM(CASE WHEN delivery_date<? THEN 1 ELSE 0 END) AS hidden
    FROM shipments
    WHERE COALESCE(load_owner_organization_id,shipper_organization_id)=?
      AND operational_status IN ('POSTED','SENT','CONTACTED')
      AND delivery_date IS NOT NULL`).get(today,expiredBefore,user.organization_id);
  return {needsReview:Number(row.needs_review||0),hidden:Number(row.hidden||0)};
}

export function getShipmentForUser(user, idOrCode) {
  assertWorkspaceAccess(user);
  const db = getDb();
  const shipment = db.prepare(`SELECT s.*, so.name AS shipper_name,so.handle AS shipper_handle,ro.name AS receiver_name,ro.handle AS receiver_handle,po.name AS provider_name,po.handle AS provider_handle,
    pp.business_name AS provider_profile_name,owner.name AS load_owner_name,
    assigned_vehicle.platform_number AS assigned_vehicle_platform_number,
    assigned_vehicle.make AS assigned_vehicle_make,assigned_vehicle.model AS assigned_vehicle_model,
    assigned_vehicle.cargo_configuration AS assigned_vehicle_configuration,
    assigned_driver.name AS assigned_driver_name,
    CASE WHEN cp.show_contact_phone_on_loads=1 THEN cp.contact_phone ELSE NULL END AS load_contact_phone
    FROM shipments s
    LEFT JOIN organizations so ON so.id=s.shipper_organization_id
    LEFT JOIN organizations ro ON ro.id=s.receiver_organization_id
    LEFT JOIN organizations po ON po.id=s.provider_organization_id
    LEFT JOIN provider_profiles pp ON pp.id=s.provider_profile_id
    LEFT JOIN vehicles assigned_vehicle ON assigned_vehicle.id=s.assigned_vehicle_id
    LEFT JOIN users assigned_driver ON assigned_driver.id=s.assigned_driver_user_id
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
  const ownsLoad = user.role === USER_ROLES.ADMIN || Boolean(user.organization_id && (shipment.load_owner_organization_id||shipment.shipper_organization_id) === user.organization_id);
  const executionStarted=['AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED'].includes(shipment.operational_status);
  if(!ownsLoad&&!(isParty&&executionStarted)){
    delete shipment.pickup_lat;
    delete shipment.pickup_lng;
    delete shipment.dropoff_lat;
    delete shipment.dropoff_lng;
  }
  shipment.events = db.prepare(`SELECT e.*, u.name AS actor_name FROM shipment_events e LEFT JOIN users u ON u.id=e.created_by WHERE e.shipment_id=? ${isParty ? '' : 'AND e.public=1'} ORDER BY e.created_at ASC`).all(shipment.id);
  if (isParty) {
    shipment.interests = db.prepare(`SELECT i.*, o.name AS organization_name, p.business_name AS provider_name,actor.name AS created_by_name,
      r.id AS proof_request_id,r.requested_at AS proof_requested_at,r.fulfilled_at AS proof_fulfilled_at
      FROM shipment_interests i LEFT JOIN organizations o ON o.id=i.provider_organization_id LEFT JOIN provider_profiles p ON p.id=i.provider_profile_id
      LEFT JOIN users actor ON actor.id=i.created_by
      LEFT JOIN load_proof_requests r ON r.interest_id=i.id WHERE i.shipment_id=? ORDER BY i.created_at DESC`).all(shipment.id);
    shipment.proofs = db.prepare(`SELECT p.*, u.name AS uploaded_by_name FROM proof_files p JOIN users u ON u.id=p.uploaded_by WHERE p.shipment_id=? ORDER BY p.created_at DESC`).all(shipment.id);
    const reviewVisibility = user.role === USER_ROLES.ADMIN
      ? 'r.shipment_id=?'
      : user.organization_id
        ? `r.shipment_id=? AND (r.status='PUBLISHED' OR r.reviewer_organization_id=?)`
        : `r.shipment_id=? AND r.status='PUBLISHED'`;
    const reviewArgs = user.role === USER_ROLES.ADMIN || !user.organization_id
      ? [shipment.id]
      : [shipment.id,user.organization_id];
    shipment.business_reviews = db.prepare(`SELECT r.*,reviewer.name AS reviewer_name,subject.name AS subject_name
      FROM business_reviews r JOIN organizations reviewer ON reviewer.id=r.reviewer_organization_id
      JOIN organizations subject ON subject.id=r.subject_organization_id
      WHERE ${reviewVisibility} ORDER BY r.created_at DESC`).all(...reviewArgs);
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
    shipment.business_reviews = [];
  }
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
  const scope=providerScope(user);
  if(scope){
    const ownInterest=isCompanyDriver(user)
      ? getDb().prepare(`SELECT 1 FROM shipment_interests WHERE shipment_id=? AND created_by=?`).get(shipment.id,user.id)
      : getDb().prepare(`SELECT 1 FROM shipment_interests WHERE shipment_id=? AND (provider_organization_id=? OR provider_profile_id=?)`).get(shipment.id,scope.organizationId||'',scope.profileId||'');
    if(ownInterest)return true;
  }
  if (!canBrowseLoads(user) || shipment.service_mode !== SERVICE_MODES.FREIGHT || shipment.operational_status !== 'POSTED') return false;
  if (shipment.distribution_mode === DISTRIBUTION_MODES.OPEN_MARKET) return true;
  return isSavedPartnerForShipment(user, shipment);
}

function getShipmentParty(user, idOrCode) {
  const shipment = getShipmentForUser(user,idOrCode);
  return shipment && isShipmentParty(user,shipment) ? shipment : null;
}

export function listShipmentAssignmentVehicles(user, shipmentId) {
  assertWorkspaceAccess(user);
  const shipment=getShipmentParty(user,shipmentId);
  if(!shipment||shipment.service_mode!==SERVICE_MODES.FREIGHT)return [];
  const db=getDb();
  if(isSelfManagedDriver(user)&&shipment.provider_profile_id===user.provider_profile_id){
    return db.prepare(`SELECT v.*,? AS assigned_driver_user_id,? AS assigned_driver_name
      FROM vehicles v WHERE v.provider_profile_id=? AND v.active=1 ORDER BY v.label`)
      .all(user.id,user.name,user.provider_profile_id);
  }
  if(isCompanyDriver(user)&&shipment.provider_organization_id===user.organization_id){
    return db.prepare(`SELECT v.*,a.driver_user_id AS assigned_driver_user_id,u.name AS assigned_driver_name
      FROM vehicles v JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id AND a.active=1
      JOIN users u ON u.id=a.driver_user_id AND u.active=1
      WHERE v.organization_id=? AND v.active=1 AND a.driver_user_id=? ORDER BY v.label`)
      .all(user.organization_id,user.id);
  }
  if(user.role===USER_ROLES.TRANSPORTER&&shipment.provider_organization_id===user.organization_id){
    return db.prepare(`SELECT v.*,a.driver_user_id AS assigned_driver_user_id,u.name AS assigned_driver_name
      FROM vehicles v JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id AND a.active=1
      JOIN users u ON u.id=a.driver_user_id AND u.active=1
      WHERE v.organization_id=? AND v.active=1 ORDER BY v.label`)
      .all(user.organization_id);
  }
  return [];
}

export function assignShipmentVehicle(user, shipmentId, vehicleId) {
  assertWorkspaceAccess(user);
  const shipment=getShipmentParty(user,shipmentId);
  if(!shipment)throw new Error('NOT_FOUND');
  if(shipment.operational_status!=='AGREED')throw new Error('INVALID_STATUS_TRANSITION');
  if(isCompanyDriver(user)&&!getDriverAccess(user)?.can_negotiate_loads)throw new Error('FORBIDDEN');
  const vehicle=listShipmentAssignmentVehicles(user,shipmentId).find(candidate=>candidate.id===vehicleId);
  if(!vehicle)throw new Error('INVALID_VEHICLE');
  const timestamp=nowIso();
  const db=getDb();
  db.prepare(`UPDATE shipments SET assigned_vehicle_id=?,assigned_driver_user_id=?,updated_at=? WHERE id=?`)
    .run(vehicle.id,vehicle.assigned_driver_user_id,timestamp,shipment.id);
  audit(db,user,'SHIPMENT_VEHICLE_ASSIGNED','shipment',shipment.id,{vehicleId:vehicle.id,driverUserId:vehicle.assigned_driver_user_id});
  return {vehicleId:vehicle.id,driverUserId:vehicle.assigned_driver_user_id};
}

export function createShipment(user, input) {
  assertWorkspaceAccess(user);
  if (!roleCanCreateShipment(user.role) || !user.organization_id) throw new Error('FORBIDDEN');
  const db = getDb();
  const serviceMode = input.serviceMode;
  if (serviceMode !== SERVICE_MODES.FREIGHT) throw new Error('INVALID_SERVICE_MODE');
  const distributionMode = input.distributionMode || DISTRIBUTION_MODES.OPEN_MARKET;
  if (!Object.values(DISTRIBUTION_MODES).includes(distributionMode)) throw new Error('INVALID_DISTRIBUTION_MODE');
  const { priceMinor, targetMinor } = validatePriceMode(input);
  const loadType = validateFreightLoadType(serviceMode,input.loadType);
  const movementScope=validateMovementScope(input.movementScope||MOVEMENT_SCOPES.INTERCITY);
  if (!input.title || !input.cargoDescription || !input.pickupDate) throw new Error('MISSING_REQUIRED_FIELDS');
  let localPlace=null;
  let originPlace=null;
  let destinationPlace=null;
  let origin=null;
  let destination=null;
  if (movementScope===MOVEMENT_SCOPES.LOCAL) {
    localPlace=resolvePlaceReference(input.localPlaceRef,input.localPlaceLabel);
    origin=localPlace.place_label;
    destination=localPlace.place_label;
  } else {
    if (!input.origin || !input.destination) throw new Error('MISSING_REQUIRED_FIELDS');
    originPlace=resolvePlaceReference(input.originPlaceRef,input.origin);
    destinationPlace=resolvePlaceReference(input.destinationPlaceRef,input.destination);
    origin=originPlace.place_label;
    destination=destinationPlace.place_label;
    if (originPlace.place_ref===destinationPlace.place_ref) throw new Error('ROUTE_LOCATIONS_MUST_DIFFER');
  }
  const pickupPoint=optionalCoordinatePair(input.pickupLat,input.pickupLng);
  const dropoffPoint=optionalCoordinatePair(input.dropoffLat,input.dropoffLng);
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
  const trackingMode = 'STATUS_ONLY';
  const trackingCodeHash = hashTrackingAccessCode(trackingAccessCode(id));
  const operationalStatus = distributionMode === DISTRIBUTION_MODES.DIRECT_TO_PROVIDER ? 'SENT' : 'POSTED';
  const commercialStatus = distributionMode === DISTRIBUTION_MODES.DIRECT_TO_PROVIDER ? 'SENT' : 'POSTED';
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO shipments
      (id,code,title,service_mode,distribution_mode,price_mode,price_minor,target_price_minor,
       shipper_organization_id,receiver_organization_id,load_owner_organization_id,load_owner_party_role,
       external_shipper_name,external_shipper_phone,external_receiver_name,external_receiver_phone,
       provider_organization_id,provider_profile_id,origin,destination,cargo_description,package_count,estimated_weight,
       vehicle_category,load_type,pickup_date,delivery_date,commercial_status,operational_status,tracking_mode,
       tracking_code_hash,created_by,created_at,updated_at,movement_scope,local_place_ref,local_place_label,
       local_center_lat,local_center_lng,pickup_area_label,dropoff_area_label,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,
       origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng)
      VALUES (@id,@code,@title,@serviceMode,@distributionMode,@priceMode,@priceMinor,@targetMinor,
       @shipperOrganizationId,@receiverOrganizationId,@loadOwnerOrganizationId,@loadOwnerPartyRole,
       @externalShipperName,@externalShipperPhone,@externalReceiverName,@externalReceiverPhone,
       @providerOrganizationId,@providerProfileId,@origin,@destination,@cargoDescription,@packageCount,NULL,
       @vehicleCategory,@loadType,@pickupDate,@deliveryDate,@commercialStatus,@operationalStatus,@trackingMode,
       @trackingCodeHash,@createdBy,@createdAt,@updatedAt,@movementScope,@localPlaceRef,@localPlaceLabel,
       @localCenterLat,@localCenterLng,@pickupAreaLabel,@dropoffAreaLabel,@pickupLat,@pickupLng,@dropoffLat,@dropoffLng,
       @originPlaceRef,@originLat,@originLng,@destinationPlaceRef,@destinationLat,@destinationLng)`)
      .run({
        id,code,title:input.title,serviceMode,distributionMode,priceMode:input.priceMode,priceMinor,targetMinor,
        shipperOrganizationId,receiverOrganizationId,loadOwnerOrganizationId:user.organization_id,loadOwnerPartyRole:ownerPartyRole,
        externalShipperName,externalShipperPhone,externalReceiverName,externalReceiverPhone,
        providerOrganizationId,providerProfileId,origin,destination,
        cargoDescription:input.cargoDescription,packageCount:Number(input.packageCount||1),
        vehicleCategory:input.vehicleCategory||null,loadType,pickupDate:input.pickupDate,deliveryDate:input.deliveryDate||null,
        commercialStatus,operationalStatus,trackingMode,trackingCodeHash,createdBy:user.id,createdAt:timestamp,updatedAt:timestamp,
        movementScope,localPlaceRef:localPlace?.place_ref||null,localPlaceLabel:localPlace?.place_label||null,
        localCenterLat:localPlace?.center_lat??null,localCenterLng:localPlace?.center_lng??null,
        pickupAreaLabel:String(input.pickupAreaLabel||'').trim()||null,dropoffAreaLabel:String(input.dropoffAreaLabel||'').trim()||null,
        pickupLat:pickupPoint.lat,pickupLng:pickupPoint.lng,dropoffLat:dropoffPoint.lat,dropoffLng:dropoffPoint.lng,
        originPlaceRef:originPlace?.place_ref||null,originLat:originPlace?.center_lat??null,originLng:originPlace?.center_lng??null,
        destinationPlaceRef:destinationPlace?.place_ref||null,destinationLat:destinationPlace?.center_lat??null,destinationLng:destinationPlace?.center_lng??null
      });
    db.prepare(`INSERT INTO shipment_events (id,shipment_id,status,event_type,note,created_by,public,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(randomId('evt-'),id,operationalStatus,'CREATED','Shipment created in Loadgistic',user.id,1,timestamp);
    if (providerOrganizationId) {
      const owner = db.prepare(`SELECT u.id FROM users u WHERE u.organization_id=? AND u.active=1 ORDER BY u.created_at LIMIT 1`).get(providerOrganizationId);
      if (owner) notify(db,owner.id,'New direct B2B shipment request',`${user.organization_name || 'A business'} sent ${code}.`);
    }
    audit(db,user,'SHIPMENT_CREATED','shipment',id,{ code, serviceMode, distributionMode, movementScope, trackingMode, ownerPartyRole, externalCounterparty:Boolean(externalCounterpartyName), hasPrivatePoints:Boolean(pickupPoint.lat||dropoffPoint.lat) });
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

function insertProofFile(db,user,shipment,proofType,upload,note='') {
  if (!['LOADING','TRANSIT','UNLOADING','DELIVERY','ISSUE'].includes(proofType)) throw new Error('INVALID_PROOF_TYPE');
  if (!upload) throw new Error('FILE_REQUIRED');
  const id=randomId('proof-');
  db.prepare(`INSERT INTO proof_files (id,shipment_id,proof_type,file_path,original_name,mime_type,note,uploaded_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id,shipment.id,proofType,upload.path,upload.originalName,upload.mimeType,note||null,user.id,nowIso());
  audit(db,user,'PROOF_UPLOADED','shipment',shipment.id,{proofType,proofId:id});
  return id;
}

/** @param {{upload?: {path:string,originalName:string,mimeType:string},proofType?:string}|null} evidence */
export function transitionShipment(user, shipmentId, nextStatus, note = '', locationInput = {}, evidence = null) {
  assertWorkspaceAccess(user);
  const db = getDb();
  const shipment = getShipmentParty(user, shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  if (shipment.service_mode !== SERVICE_MODES.FREIGHT || ![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER,USER_ROLES.ADMIN].includes(user.role)) throw new Error('FORBIDDEN');
  if(isCompanyDriver(user)){
    if(nextStatus==='ASSIGNED'&&(!getDriverAccess(user)?.can_negotiate_loads||shipment.assigned_driver_user_id!==user.id))throw new Error('FORBIDDEN');
    if(nextStatus!=='ASSIGNED'&&shipment.assigned_driver_user_id!==user.id)throw new Error('FORBIDDEN');
  }
  assertTransition(shipment.service_mode, shipment.operational_status, nextStatus);
  if (nextStatus === 'ASSIGNED' && (!shipment.receiver_first_name?.trim() || !shipment.receiver_phone?.trim())) {
    throw new Error('RECEIVER_CONTACT_REQUIRED');
  }
  if(nextStatus==='ASSIGNED'&&(!shipment.assigned_vehicle_id||!shipment.assigned_driver_user_id))throw new Error('SHIPMENT_VEHICLE_REQUIRED');
  const location = trackingLocation(locationInput,shipment.tracking_mode === 'LOCATION_AND_STATUS',user.role === USER_ROLES.DRIVER,shipment.load_type==='FTL'?20:40);
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE shipments SET operational_status=?, updated_at=? WHERE id=?').run(nextStatus,timestamp,shipment.id);
    insertTrackingEvent(db,{...shipment,operational_status:nextStatus},user,'STATUS',note,location,timestamp);
    if(evidence?.upload)insertProofFile(db,user,shipment,evidence.proofType,evidence.upload,note);
    audit(db,user,'SHIPMENT_STATUS_CHANGED','shipment',shipment.id,{ from: shipment.operational_status, to: nextStatus, trackingMode: shipment.tracking_mode, locationSource: location.source, locationPrecisionKm: location.precisionKm });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function addTrackingUpdate(user, shipmentId, input) {
  assertWorkspaceAccess(user);
  const db = getDb();
  const shipment = getShipmentParty(user,shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  const assignedProvider = (user.role === USER_ROLES.TRANSPORTER && shipment.provider_organization_id === user.organization_id)
    || (isCompanyDriver(user) && shipment.provider_organization_id === user.organization_id && shipment.assigned_driver_user_id===user.id)
    || (isSelfManagedDriver(user) && shipment.provider_profile_id === user.provider_profile_id)
    || user.role === USER_ROLES.ADMIN;
  if (!assignedProvider || !['ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE'].includes(shipment.operational_status)) throw new Error('FORBIDDEN');
  const note = String(input.note || '').trim();
  const needsLocation = shipment.tracking_mode === 'LOCATION_AND_STATUS';
  if (!needsLocation) throw new Error('TRACKING_LOCATION_NOT_ENABLED');
  const location = trackingLocation(input,needsLocation,user.role === USER_ROLES.DRIVER,shipment.load_type==='FTL'?20:40);
  const timestamp = nowIso();
  insertTrackingEvent(db,shipment,user,'LOCATION',note,location,timestamp);
  db.prepare('UPDATE shipments SET updated_at=? WHERE id=?').run(timestamp,shipment.id);
  audit(db,user,'SHIPMENT_TRACKING_UPDATED','shipment',shipment.id,{ trackingMode: shipment.tracking_mode, locationSource: location.source, locationPrecisionKm: location.precisionKm });
}

export function setTrackingMode(user, shipmentId, trackingMode) {
  assertWorkspaceAccess(user);
  if (!['STATUS_ONLY','LOCATION_AND_STATUS'].includes(trackingMode)) throw new Error('INVALID_TRACKING_MODE');
  const db = getDb();
  const shipment = db.prepare('SELECT * FROM shipments WHERE id=? OR code=?').get(shipmentId,shipmentId);
  const isAdmin=user.role===USER_ROLES.ADMIN;
  const ownerOrganizationId=shipment&&(shipment.load_owner_organization_id||shipment.shipper_organization_id);
  const isOwningBusiness=Boolean(shipment&&['SHIPPER','RECEIVER'].includes(user.role)&&user.organization_id===ownerOrganizationId);
  const isBusinessParty = shipment && (isAdmin
    || (['SHIPPER','RECEIVER'].includes(user.role) && user.organization_id && [ownerOrganizationId,shipment.shipper_organization_id,shipment.receiver_organization_id].includes(user.organization_id)));
  if (!isBusinessParty) throw new Error('NOT_FOUND');
  if (shipment.tracking_mode === trackingMode) return;
  const beforeAssignment=shipment.operational_status==='AGREED'&&!shipment.assigned_vehicle_id&&!shipment.assigned_driver_user_id;
  const mayChooseBeforeAssignment=beforeAssignment&&(isAdmin||isOwningBusiness);
  const mayReduceAfterAgreement=trackingMode==='STATUS_ONLY'&&shipment.tracking_mode==='LOCATION_AND_STATUS';
  if (!mayChooseBeforeAssignment&&!mayReduceAfterAgreement) throw new Error('INVALID_TRACKING_MODE_CHANGE');
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE shipments SET tracking_mode=?,updated_at=? WHERE id=?').run(trackingMode,timestamp,shipment.id);
    const modeLabel=trackingMode==='LOCATION_AND_STATUS'?'approximate location and status':'status timeline';
    insertTrackingEvent(db,{...shipment,operational_status:shipment.operational_status},user,'TRACKING_MODE',`Tracking changed to ${modeLabel} by a Business party`,trackingLocation(),timestamp);
    audit(db,user,'SHIPMENT_TRACKING_MODE_CHANGED','shipment',shipment.id,{ from: shipment.tracking_mode, to: trackingMode });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function setReceiverContact(user, shipmentId, firstName, phone) {
  assertWorkspaceAccess(user);
  const db = getDb();
  const shipment = db.prepare('SELECT * FROM shipments WHERE id=? OR code=?').get(shipmentId,shipmentId);
  const ownerOrganizationId=shipment&&(shipment.load_owner_organization_id||shipment.shipper_organization_id);
  const ownsShipment = shipment && (user.role === USER_ROLES.ADMIN || ownerOrganizationId === user.organization_id);
  if (!ownsShipment) throw new Error('NOT_FOUND');
  if (shipment.operational_status !== 'AGREED') throw new Error('RECEIVER_CONTACT_NOT_READY');
  const cleanFirstName = String(firstName || '').trim();
  const cleanPhone = String(phone || '').trim();
  if (!cleanFirstName || !cleanPhone) throw new Error('RECEIVER_CONTACT_REQUIRED');
  db.prepare('UPDATE shipments SET receiver_first_name=?,receiver_phone=?,updated_at=? WHERE id=?')
    .run(cleanFirstName,cleanPhone,nowIso(),shipment.id);
  audit(db,user,'SHIPMENT_RECEIVER_CONTACT_SET','shipment',shipment.id,{});
}

export function setShipmentParties(user, shipmentId, input) {
  assertWorkspaceAccess(user);
  const db = getDb();
  const shipment = db.prepare('SELECT * FROM shipments WHERE id=? OR code=?').get(shipmentId,shipmentId);
  const ownerOrganizationId=shipment&&(shipment.load_owner_organization_id||shipment.shipper_organization_id);
  const ownsShipment = shipment && (user.role === USER_ROLES.ADMIN || ownerOrganizationId === user.organization_id);
  if (!ownsShipment) throw new Error('NOT_FOUND');
  if (shipment.operational_status !== 'AGREED') throw new Error('RECEIVER_CONTACT_NOT_READY');
  const ownerPartyRole=['SHIPPER','RECEIVER'].includes(input.ownerPartyRole)?input.ownerPartyRole:'SHIPPER';
  const cleanFirstName=String(input.receiverFirstName||'').trim();
  const cleanPhone=String(input.receiverPhone||'').trim();
  if(!cleanFirstName||!cleanPhone)throw new Error('RECEIVER_CONTACT_REQUIRED');
  let counterpartyOrganizationId=null;
  let externalCounterpartyName=null;
  if(input.counterpartyType==='ACCOUNT'){
    const [kind,id]=String(input.counterpartyRef||'').split(':');
    if(kind!=='org')throw new Error('INVALID_BUSINESS_PARTY');
    const counterpart=db.prepare(`SELECT id FROM organizations WHERE id=? AND id<>? AND type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')`).get(id,ownerOrganizationId);
    if(!counterpart)throw new Error('INVALID_BUSINESS_PARTY');
    counterpartyOrganizationId=counterpart.id;
  }else if(input.counterpartyType==='EXTERNAL'){
    externalCounterpartyName=String(input.externalCounterpartyName||'').trim();
    if(!externalCounterpartyName)throw new Error('EXTERNAL_PARTY_REQUIRED');
  }else throw new Error('BUSINESS_PARTY_REQUIRED');
  const shipperOrganizationId=ownerPartyRole==='SHIPPER'?ownerOrganizationId:counterpartyOrganizationId;
  const receiverOrganizationId=ownerPartyRole==='RECEIVER'?ownerOrganizationId:counterpartyOrganizationId;
  db.prepare(`UPDATE shipments SET load_owner_party_role=?,shipper_organization_id=?,receiver_organization_id=?,
    external_shipper_name=?,external_shipper_phone=NULL,external_receiver_name=?,external_receiver_phone=NULL,
    receiver_first_name=?,receiver_phone=?,updated_at=? WHERE id=?`)
    .run(ownerPartyRole,shipperOrganizationId,receiverOrganizationId,
      ownerPartyRole==='RECEIVER'?externalCounterpartyName:null,ownerPartyRole==='SHIPPER'?externalCounterpartyName:null,
      cleanFirstName,cleanPhone,nowIso(),shipment.id);
  audit(db,user,'SHIPMENT_PARTIES_SET','shipment',shipment.id,{ownerPartyRole,counterpartyType:input.counterpartyType});
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
  assertWorkspaceAccess(user);
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
  assertWorkspaceAccess(user);
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
  assertWorkspaceAccess(user);
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
  return verificationBadgesFromApproved(subjectType,approved);
}

function verificationBadgesFromApproved(subjectType,approved) {
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

function verificationBadgesBySubject(db,subjects) {
  if(!subjects.length)return new Map();
  const where=subjects.map(()=>'(subject_type=? AND subject_id=?)').join(' OR ');
  const args=subjects.flatMap(subject=>[subject.type,subject.id]);
  const approvedBySubject=new Map();
  for(const row of db.prepare(`SELECT subject_type,subject_id,verification_type FROM verification_requests
    WHERE status='APPROVED' AND (${where})`).all(...args)){
    const key=`${row.subject_type}:${row.subject_id}`;
    if(!approvedBySubject.has(key))approvedBySubject.set(key,new Set());
    approvedBySubject.get(key).add(row.verification_type);
  }
  return new Map(subjects.map(subject=>{
    const key=`${subject.type}:${subject.id}`;
    return [key,verificationBadgesFromApproved(subject.type,approvedBySubject.get(key)||new Set())];
  }));
}

function ratingSummary(db, organizationId) {
  return db.prepare(`SELECT COUNT(*) AS review_count,ROUND(AVG(rating),1) AS average_rating
    FROM business_reviews WHERE subject_organization_id=? AND status='PUBLISHED'`).get(organizationId);
}

function ratingSummariesByOrganization(db, organizationIds) {
  const ids=[...new Set(organizationIds.filter(Boolean))];
  if(!ids.length)return new Map();
  return new Map(db.prepare(`SELECT subject_organization_id,COUNT(*) AS review_count,ROUND(AVG(rating),1) AS average_rating
    FROM business_reviews WHERE status='PUBLISHED' AND subject_organization_id IN (${ids.map(()=>'?').join(',')})
    GROUP BY subject_organization_id`).all(...ids).map(row=>[row.subject_organization_id,row]));
}

export function paginateResults(rows, options = {}) {
  const pageSize = Math.max(1,Math.min(100,Number(options.pageSize)||20));
  const total = rows.length;
  const pageCount = Math.max(1,Math.ceil(total/pageSize));
  const page = Math.max(1,Math.min(pageCount,Number(options.page)||1));
  return {
    items:rows.slice((page-1)*pageSize,page*pageSize),
    total,
    page,
    pageSize,
    pageCount
  };
}

function paginateQuery(db,baseSql,args,orderBy,options={}) {
  const pageSize=Math.max(1,Math.min(100,Number(options.pageSize)||20));
  const total=db.prepare(`SELECT COUNT(*) AS n FROM (${baseSql}) bounded_rows`).get(...args).n;
  const pageCount=Math.max(1,Math.ceil(total/pageSize));
  const page=Math.max(1,Math.min(pageCount,Number(options.page)||1));
  const items=db.prepare(`SELECT * FROM (${baseSql}) bounded_rows ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...args,pageSize,(page-1)*pageSize);
  return {items,total,page,pageSize,pageCount};
}

export function listDirectoryProfiles(kind = 'ALL', options = /** @type {any} */ (null)) {
  const db = getDb();
  const selects = [];
  const selectArgs = [];
  if (kind === 'ALL' || kind === 'BUSINESS') {
    selects.push(`SELECT o.id,'org' AS ref_kind,o.name,o.handle,o.type,o.city,o.city_place_ref,o.city_lat,o.city_lng,
      cp.headline,cp.about,cp.services,cp.operating_regions,
      cp.contact_phone,cp.contact_email,
      (SELECT u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=o.id AND m.membership_role='OWNER' AND u.active=1 ORDER BY u.created_at LIMIT 1) AS owner_name,
      1 AS is_business,NULL AS preferred_routes_text,0 AS fleet_size,0 AS active_capacity_count,
      (SELECT COUNT(*) FROM business_reviews r WHERE r.subject_organization_id=o.id AND r.status='PUBLISHED') AS review_count,
      (SELECT ROUND(AVG(r.rating),1) FROM business_reviews r WHERE r.subject_organization_id=o.id AND r.status='PUBLISHED') AS average_rating
      FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id AND cp.published=1
      WHERE o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')`);
  }
  if (kind === 'ALL' || kind === 'TRANSPORT') {
    selects.push(`SELECT o.id,'org' AS ref_kind,o.name,o.handle,o.type,o.city,o.city_place_ref,o.city_lat,o.city_lng,
      cp.headline,cp.about,cp.services,cp.operating_regions,
      cp.contact_phone,cp.contact_email,
      (SELECT u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=o.id AND m.membership_role='OWNER' AND u.active=1 ORDER BY u.created_at LIMIT 1) AS owner_name,
      0 AS is_business,
      (SELECT GROUP_CONCAT(r.origin || ' ↔ ' || r.destination,'; ') FROM profile_routes r WHERE r.organization_id=o.id) AS preferred_routes_text,
      (SELECT COUNT(*) FROM vehicles v WHERE v.organization_id=o.id AND v.active=1) AS fleet_size,
      (SELECT COUNT(DISTINCT c.vehicle_id) FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
       WHERE v.organization_id=o.id AND v.active=1 AND c.visibility='OPEN'
         AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
         AND (COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL') OR (COALESCE(c.market_status,c.status)='BUSY' AND c.available_again_date>=?))) AS active_capacity_count,
      0 AS review_count,NULL AS average_rating
      FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id AND cp.published=1 WHERE o.type='TRANSPORT_COMPANY'`);
    selectArgs.push(todayInEthiopia());
  }
  if (kind === 'ALL' || kind === 'DRIVER') {
    selects.push(`SELECT p.id,'profile' AS ref_kind,p.business_name AS name,p.handle,'INDEPENDENT_PROVIDER' AS type,
      p.city,p.city_place_ref,p.city_lat,p.city_lng,cp.headline,p.about,cp.services,cp.operating_regions,
      cp.contact_phone,cp.contact_email,u.name AS owner_name,0 AS is_business,
      (SELECT GROUP_CONCAT(r.origin || ' ↔ ' || r.destination,'; ') FROM profile_routes r WHERE r.provider_profile_id=p.id) AS preferred_routes_text,
      (SELECT COUNT(*) FROM vehicles v WHERE v.provider_profile_id=p.id AND v.active=1) AS fleet_size,
      (SELECT COUNT(DISTINCT c.vehicle_id) FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
       WHERE v.provider_profile_id=p.id AND v.active=1 AND c.visibility='OPEN'
         AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
         AND (COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL') OR (COALESCE(c.market_status,c.status)='BUSY' AND c.available_again_date>=?))) AS active_capacity_count,
      0 AS review_count,NULL AS average_rating
      FROM provider_profiles p JOIN users u ON u.id=p.user_id JOIN company_pages cp ON cp.provider_profile_id=p.id AND cp.published=1 WHERE p.public_visibility='PUBLIC'`);
    selectArgs.push(todayInEthiopia());
  }
  if(!selects.length)return options?paginateResults([],options):[];
  const search = String(options?.q||'').trim().toLowerCase();
  const source=`FROM (${selects.join(' UNION ALL ')}) profiles`;
  const searchColumns=['name','owner_name','contact_phone','about','headline','services'];
  const conditions=search?[`(${searchColumns.map(column=>`lower(COALESCE(${column},'')) LIKE ?`).join(' OR ')})`]:[];
  const searchArgs=search?Array(searchColumns.length).fill(`%${search}%`):[];
  const nearPlace=selectedBoardPlace(options?.nearPlaceRef,options?.nearPlace);
  const nearRadius=boardFilterRadius(options?.nearRadiusKm);
  if(nearPlace)conditions.push('geo_distance_km(?,?,city_lat,city_lng)<=?');
  const nearArgs=nearPlace?[nearPlace.center_lat,nearPlace.center_lng,nearRadius]:[];
  const where=conditions.length?`WHERE ${conditions.join(' AND ')}`:'';
  let page=null;
  let items;
  if(options){
    const pageSize=Math.max(1,Math.min(100,Number(options.pageSize)||20));
    const total=db.prepare(`SELECT COUNT(*) AS n ${source} ${where}`).get(...selectArgs,...searchArgs,...nearArgs).n;
    const pageCount=Math.max(1,Math.ceil(total/pageSize));
    const currentPage=Math.max(1,Math.min(pageCount,Number(options.page)||1));
    const projection=nearPlace?'profiles.*,geo_distance_km(?,?,city_lat,city_lng) AS location_distance_km':'profiles.*';
    const projectionArgs=nearPlace?[nearPlace.center_lat,nearPlace.center_lng]:[];
    const order=nearPlace?'location_distance_km,name COLLATE NOCASE,id':'name COLLATE NOCASE,id';
    items=db.prepare(`SELECT ${projection} ${source} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...projectionArgs,...selectArgs,...searchArgs,...nearArgs,pageSize,(currentPage-1)*pageSize);
    page={total,page:currentPage,pageSize,pageCount};
  }else{
    items=db.prepare(`SELECT * ${source} ${where} ORDER BY name COLLATE NOCASE,id`).all(...selectArgs,...searchArgs,...nearArgs);
  }
  const subjects=items.map(profile=>({
    type:profile.ref_kind==='profile'?'PROVIDER_PROFILE':'ORGANIZATION',
    id:profile.id
  }));
  const badgesBySubject=verificationBadgesBySubject(db,subjects);
  for (const profile of items) {
    const subjectType = profile.ref_kind === 'profile' ? 'PROVIDER_PROFILE' : 'ORGANIZATION';
    profile.verification_badges = badgesBySubject.get(`${subjectType}:${profile.id}`)||[];
    profile.verified = profile.verification_badges.every(badge => badge.verified);
  }
  return page ? {...page,items} : items;
}

function listProviderVehicles(db, ownerColumn, ownerId) {
  const vehicles = db.prepare(`SELECT v.id AS vehicle_id,v.label,v.category,v.plate,v.platform_number,v.make,v.model,v.cargo_configuration,
    c.id AS capacity_id,COALESCE(c.market_status,c.status) AS status,c.available_percent,c.visibility,c.updated_at,c.expires_at,c.available_again_date,u.name AS updated_by_name
    FROM vehicles v
    LEFT JOIN capacities c ON c.id=(
      SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC LIMIT 1
    )
    LEFT JOIN users u ON u.id=c.updated_by
    WHERE v.${ownerColumn}=? AND v.active=1
    ORDER BY v.label,v.make,v.model`).all(ownerId);
  const badges=verificationBadgesBySubject(db,vehicles.map(vehicle=>({type:'VEHICLE',id:vehicle.vehicle_id})));
  return vehicles.map(vehicle => ({
    ...vehicle,
    verification_badges:badges.get(`VEHICLE:${vehicle.vehicle_id}`)||verificationBadgesFromApproved('VEHICLE',new Set())
  }));
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
  if (capacity.status==='BUSY'||capacity.movement_scope===MOVEMENT_SCOPES.LOCAL) return routes;
  const today = todayInEthiopia();
  if (
    capacity.status === 'PARTIAL'
    && capacity.current_route_origin
    && capacity.current_route_destination
    && (!requireCurrentDate || capacity.updated_at >= hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12)))
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
      origin_place_ref:capacity.current_origin_place_ref,
      origin_lat:capacity.current_origin_lat,
      origin_lng:capacity.current_origin_lng,
      destination_place_ref:capacity.current_destination_place_ref,
      destination_lat:capacity.current_destination_lat,
      destination_lng:capacity.current_destination_lng,
      route_kind:'CURRENT_PARTIAL',
      source_label:'Live partial route',
      route_date:null,
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
      origin_place_ref:capacity.origin_place_ref,
      origin_lat:capacity.origin_lat,
      origin_lng:capacity.origin_lng,
      destination_place_ref:capacity.destination_place_ref,
      destination_lat:capacity.destination_lat,
      destination_lng:capacity.destination_lng,
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
    WHERE v.${owner.column}=? AND v.active=1 AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')${visibilityClause}
    ORDER BY v.platform_number`).all(owner.id);
  return capacities.flatMap(capacity => capacityRouteCandidates({...capacity,status:capacity.market_status||capacity.status},{requireCurrentDate:true}));
}

function listProfileRoutesWithEvidence(db, page) {
  const owner = routeOwner(page);
  const routes = db.prepare(`SELECT * FROM profile_routes WHERE ${owner.column}=? ORDER BY created_at,id`).all(owner.id);
  const activity = page.is_business
    ? db.prepare(`SELECT id,origin,destination,origin_place_ref,origin_lat,origin_lng,
        destination_place_ref,destination_lat,destination_lng,
        EXISTS(SELECT 1 FROM shipment_events e WHERE e.shipment_id=shipments.id AND e.status IN ('ASSIGNED','IN_TRANSIT','DELIVERED','COMPLETED')) AS has_tracked
        FROM shipments WHERE movement_scope='INTERCITY' AND COALESCE(load_owner_organization_id,shipper_organization_id)=?`).all(owner.id)
    : owner.organizationId
      ? {
          capacity:db.prepare(`SELECT id,vehicle_id,status,origin,destination,origin_place_ref,origin_lat,origin_lng,
            destination_place_ref,destination_lat,destination_lng,travel_date,current_route_origin,current_route_destination,
            current_origin_place_ref,current_origin_lat,current_origin_lng,current_destination_place_ref,current_destination_lat,current_destination_lng,current_route_date
            FROM capacities WHERE movement_scope IN ('INTERCITY','BOTH') AND provider_organization_id=? AND COALESCE(market_status,status) IN ('EMPTY','PARTIAL')`).all(owner.id)
            .map(capacity=>({...capacity,status:capacity.market_status||capacity.status})),
          shipments:db.prepare(`SELECT id,origin,destination,origin_place_ref,origin_lat,origin_lng,
            destination_place_ref,destination_lat,destination_lng,
            EXISTS(SELECT 1 FROM shipment_events e WHERE e.shipment_id=shipments.id AND e.status IN ('ASSIGNED','IN_TRANSIT','DELIVERED','COMPLETED')) AS has_tracked
            FROM shipments WHERE movement_scope='INTERCITY' AND provider_organization_id=?`).all(owner.id)
        }
      : {
          capacity:db.prepare(`SELECT id,vehicle_id,status,origin,destination,origin_place_ref,origin_lat,origin_lng,
            destination_place_ref,destination_lat,destination_lng,travel_date,current_route_origin,current_route_destination,
            current_origin_place_ref,current_origin_lat,current_origin_lng,current_destination_place_ref,current_destination_lat,current_destination_lng,current_route_date
            FROM capacities WHERE movement_scope IN ('INTERCITY','BOTH') AND provider_profile_id=? AND COALESCE(market_status,status) IN ('EMPTY','PARTIAL')`).all(owner.id)
            .map(capacity=>({...capacity,status:capacity.market_status||capacity.status})),
          shipments:db.prepare(`SELECT id,origin,destination,origin_place_ref,origin_lat,origin_lng,
            destination_place_ref,destination_lat,destination_lng,
            EXISTS(SELECT 1 FROM shipment_events e WHERE e.shipment_id=shipments.id AND e.status IN ('ASSIGNED','IN_TRANSIT','DELIVERED','COMPLETED')) AS has_tracked
            FROM shipments WHERE movement_scope='INTERCITY' AND provider_profile_id=?`).all(owner.id)
        };
  return routes.map(route => {
    if (page.is_business) {
      const posted = activity.filter(item => geographicRouteMatch(route,item,{directionMode:'EITHER'}).matched);
      const tracked = posted.filter(item => item.has_tracked);
      return {...route,reported_count:posted.length,tracked_count:tracked.length,evidence_label:tracked.length?'Tracked activity':posted.length?'Reported activity':'Declared only'};
    }
    const reported = activity.capacity.filter(item => capacityRouteCandidates(item).some(candidate => geographicRouteMatch(route,candidate,{directionMode:'EITHER'}).matched));
    const tracked = activity.shipments.filter(item => geographicRouteMatch(route,item,{directionMode:'EITHER'}).matched && item.has_tracked);
    return {...route,reported_count:reported.length,tracked_count:tracked.length,evidence_label:tracked.length?'Tracked activity':reported.length?'Reported activity':'Declared only'};
  });
}

function listServiceAreasWithEvidence(db,page) {
  const owner=routeOwner(page);
  const areas=db.prepare(`SELECT * FROM service_areas WHERE ${owner.column}=? ORDER BY place_label,id`).all(owner.id);
  const activity=page.is_business
    ? db.prepare(`SELECT id,local_center_lat AS lat,local_center_lng AS lng,
        EXISTS(SELECT 1 FROM shipment_events e WHERE e.shipment_id=shipments.id AND e.status IN ('ASSIGNED','IN_TRANSIT','DELIVERED','COMPLETED')) AS has_tracked
        FROM shipments WHERE movement_scope='LOCAL' AND COALESCE(load_owner_organization_id,shipper_organization_id)=?`).all(owner.id)
    : owner.organizationId
      ? {
          capacity:db.prepare(`SELECT id,local_center_lat AS lat,local_center_lng AS lng FROM capacities
            WHERE movement_scope IN ('LOCAL','BOTH') AND provider_organization_id=? AND COALESCE(market_status,status) IN ('EMPTY','PARTIAL')`).all(owner.id),
          shipments:db.prepare(`SELECT id,local_center_lat AS lat,local_center_lng AS lng,
            EXISTS(SELECT 1 FROM shipment_events e WHERE e.shipment_id=shipments.id AND e.status IN ('ASSIGNED','IN_TRANSIT','DELIVERED','COMPLETED')) AS has_tracked
            FROM shipments WHERE movement_scope='LOCAL' AND provider_organization_id=?`).all(owner.id)
        }
      : {
          capacity:db.prepare(`SELECT id,local_center_lat AS lat,local_center_lng AS lng FROM capacities
            WHERE movement_scope IN ('LOCAL','BOTH') AND provider_profile_id=? AND COALESCE(market_status,status) IN ('EMPTY','PARTIAL')`).all(owner.id),
          shipments:db.prepare(`SELECT id,local_center_lat AS lat,local_center_lng AS lng,
            EXISTS(SELECT 1 FROM shipment_events e WHERE e.shipment_id=shipments.id AND e.status IN ('ASSIGNED','IN_TRANSIT','DELIVERED','COMPLETED')) AS has_tracked
            FROM shipments WHERE movement_scope='LOCAL' AND provider_profile_id=?`).all(owner.id)
        };
  return areas.map(area=>{
    if(page.is_business){
      const reported=activity.filter(item=>pointInServiceArea(item,area));
      const tracked=reported.filter(item=>item.has_tracked);
      return {...area,reported_count:reported.length,tracked_count:tracked.length,evidence_label:tracked.length?'Tracked activity':reported.length?'Reported activity':'Declared only'};
    }
    const reported=activity.capacity.filter(item=>pointInServiceArea(item,area));
    const tracked=activity.shipments.filter(item=>item.has_tracked&&pointInServiceArea(item,area));
    return {...area,reported_count:reported.length,tracked_count:tracked.length,evidence_label:tracked.length?'Tracked activity':reported.length?'Reported activity':'Declared only'};
  });
}

function listLiveTruckAreasForPage(db,page,includeAllVisibility=false) {
  if(page.is_business)return [];
  const owner=routeOwner(page);
  const visibilityClause=includeAllVisibility?'':" AND c.visibility='OPEN'";
  return db.prepare(`SELECT c.id,c.vehicle_id,c.local_place_ref AS place_ref,c.local_place_label AS place_label,
      c.local_center_lat AS center_lat,c.local_center_lng AS center_lng,c.local_radius_km AS radius_km,
      c.updated_at,c.expires_at,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,
      'LIVE_LOCAL' AS area_kind,'Fresh truck area' AS source_label
    FROM vehicles v JOIN capacities c ON c.id=(
      SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1
    )
    WHERE v.${owner.column}=? AND v.active=1 AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')
      AND c.movement_scope IN ('LOCAL','BOTH') AND c.local_place_ref IS NOT NULL
      ${visibilityClause}
    ORDER BY v.platform_number`).all(owner.id).map(area=>({...area}));
}

function attachProfileCoverage(db, page) {
  page.routes = listProfileRoutesWithEvidence(db,page);
  page.live_routes = listLiveTruckRoutesForPage(db,page);
  page.service_areas=listServiceAreasWithEvidence(db,page);
  page.live_areas=listLiveTruckAreasForPage(db,page);
  page.map_routes = [
    ...page.routes.map(route => ({...route,route_kind:'PROFILE',source_label:page.is_business?'Freight Route':'Preferred Route'})),
    ...page.live_routes
  ];
  page.map_areas=[
    ...page.service_areas.map(area=>({...area,area_kind:'PROFILE',source_label:'Local Service Area'})),
    ...page.live_areas
  ];
  return page;
}

export function getPublicCompany(handle) {
  const db = getDb();
  const org = db.prepare(`SELECT o.id,o.name,o.handle,o.type,o.industry,o.description,o.city,
    o.city_place_ref,o.city_lat,o.city_lng,o.public_visibility,
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
    org.capacities = org.is_business ? [] : listPublicCapacity('provider_organization_id',org.id);
    return attachProfileCoverage(db,org);
  }
  const provider = db.prepare(`SELECT p.id,p.business_name,p.business_name AS name,p.handle,p.city,
    p.city_place_ref,p.city_lat,p.city_lng,p.about,p.public_visibility,
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
    provider.capacities = listPublicCapacity('provider_profile_id',provider.id);
    return attachProfileCoverage(db,provider);
  }
  return null;
}

export function updateCompanyPage(user, input) {
  assertWorkspaceAccess(user);
  const db = getDb();
  const isProvider = isSelfManagedDriver(user);
  if (isCompanyDriver(user) || ![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER,USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) throw new Error('FORBIDDEN');
  const condition = isProvider ? 'provider_profile_id=?' : 'organization_id=?';
  const id = isProvider ? user.provider_profile_id : user.organization_id;
  if (!id) throw new Error('FORBIDDEN');
  const published = input.published ? 1 : 0;
  const showContactPhoneOnLoads = [USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role) && input.showContactPhoneOnLoads ? 1 : 0;
  const routes = (input.routes || []).filter(route => route.origin || route.destination).map(route => {
    if (!route.origin || !route.destination) throw new Error('MISSING_REQUIRED_FIELDS');
    const origin=resolvePlaceReference(route.originPlaceRef||route.origin_place_ref,route.origin);
    const destination=resolvePlaceReference(route.destinationPlaceRef||route.destination_place_ref,route.destination);
    return {
      origin:origin.place_label,origin_place_ref:origin.place_ref,origin_lat:origin.center_lat,origin_lng:origin.center_lng,
      destination:destination.place_label,destination_place_ref:destination.place_ref,
      destination_lat:destination.center_lat,destination_lng:destination.center_lng
    };
  });
  for (const route of routes) {
    if (route.origin_place_ref === route.destination_place_ref) throw new Error('ROUTE_LOCATIONS_MUST_DIFFER');
  }
  const uniqueRoutes = [...new Map(routes.map(route => [[route.origin_place_ref,route.destination_place_ref].sort().join('|'),route])).values()];
  const serviceAreas=(input.serviceAreas||[]).filter(area=>area.placeRef||area.placeLabel).map(area=>({
    ...resolvePlaceReference(area.placeRef,area.placeLabel),
    radius_km:validateServiceRadius(area.radiusKm)
  }));
  const uniqueServiceAreas=[...new Map(serviceAreas.map(area=>[area.place_ref,area])).values()];
  const basePlace=input.basePlaceRef||input.basePlaceLabel
    ? resolvePlaceReference(input.basePlaceRef,input.basePlaceLabel)
    : null;
  if(published&&!basePlace){
    const existingBase=db.prepare(`SELECT city_place_ref FROM ${isProvider?'provider_profiles':'organizations'} WHERE id=?`).get(id);
    if(!existingBase?.city_place_ref)throw new Error('BASE_LOCATION_REQUIRED');
  }
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE company_pages SET headline=?,about=?,services=?,operating_regions=?,contact_phone=?,show_contact_phone_on_loads=?,contact_email=?,published=?,updated_at=? WHERE ${condition}`)
      .run(input.headline || '',input.about || '',input.services || '',uniqueServiceAreas.map(area=>area.place_label).join(', '),input.contactPhone || '',showContactPhoneOnLoads,input.contactEmail || '',published,timestamp,id);
    if(basePlace){
      db.prepare(`UPDATE ${isProvider?'provider_profiles':'organizations'}
        SET city=?,city_place_ref=?,city_lat=?,city_lng=? WHERE id=?`)
        .run(basePlace.place_label,basePlace.place_ref,basePlace.center_lat,basePlace.center_lng,id);
    }
    db.prepare(`DELETE FROM profile_routes WHERE ${condition}`).run(id);
    const insert = db.prepare(`INSERT INTO profile_routes
      (id,organization_id,provider_profile_id,origin,destination,origin_place_ref,origin_lat,origin_lng,
       destination_place_ref,destination_lat,destination_lng,created_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const route of uniqueRoutes) insert.run(
      randomId('route-'),isProvider ? null : id,isProvider ? id : null,route.origin,route.destination,
      route.origin_place_ref,route.origin_lat,route.origin_lng,
      route.destination_place_ref,route.destination_lat,route.destination_lng,user.id,timestamp
    );
    db.prepare(`DELETE FROM service_areas WHERE ${condition}`).run(id);
    const insertArea=db.prepare(`INSERT INTO service_areas
      (id,organization_id,provider_profile_id,place_ref,place_label,center_lat,center_lng,radius_km,created_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    for(const area of uniqueServiceAreas)insertArea.run(randomId('area-'),isProvider?null:id,isProvider?id:null,area.place_ref,area.place_label,area.center_lat,area.center_lng,area.radius_km,user.id,timestamp);
    audit(db,user,'COMPANY_PAGE_UPDATED','company_page',id,{
      routeCount:uniqueRoutes.length,serviceAreaCount:uniqueServiceAreas.length,basePlaceRef:basePlace?.place_ref||null
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getOwnCompanyPage(user) {
  assertWorkspaceAccess(user);
  const db = getDb();
  if (isCompanyDriver(user)) throw new Error('FORBIDDEN');
  const page = isSelfManagedDriver(user)
    ? db.prepare(`SELECT cp.*,p.id,p.business_name AS name,p.city,p.city_place_ref,p.city_lat,p.city_lng,
      'provider' AS page_kind,0 AS is_business FROM company_pages cp JOIN provider_profiles p ON p.id=cp.provider_profile_id WHERE cp.provider_profile_id=?`).get(user.provider_profile_id)
    : db.prepare(`SELECT cp.*,o.id,o.name,o.city,o.city_place_ref,o.city_lat,o.city_lng,'organization' AS page_kind,
      CASE WHEN o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER') THEN 1 ELSE 0 END AS is_business
      FROM company_pages cp JOIN organizations o ON o.id=cp.organization_id WHERE cp.organization_id=?`).get(user.organization_id);
  return page ? attachProfileCoverage(db,page) : null;
}

export function getProfileRouteComparison(user, company) {
  assertWorkspaceAccess(user);
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
  const viewerAreas=[
    ...listServiceAreasWithEvidence(db,viewerPage).map(area=>({...area,area_kind:'PROFILE',source_label:'Local Service Area'})),
    ...listLiveTruckAreasForPage(db,viewerPage,true)
  ];
  const targetRoutes = company.map_routes || [
    ...listProfileRoutesWithEvidence(db,company).map(route => ({...route,route_kind:'PROFILE',source_label:company.is_business?'Freight Route':'Preferred Route'})),
    ...listLiveTruckRoutesForPage(db,company)
  ];
  const targetAreas=company.map_areas||[
    ...listServiceAreasWithEvidence(db,company).map(area=>({...area,area_kind:'PROFILE',source_label:'Local Service Area'})),
    ...listLiveTruckAreasForPage(db,company)
  ];
  const matches = targetRoutes.map(target => {
    const ranked = viewerRoutes.map(viewer => ({viewer,target,...geographicRouteMatch(viewer,target,{directionMode:'EITHER'})}))
      .sort((a,b) => b.score-a.score || Number(a.worst_ratio??Infinity)-Number(b.worst_ratio??Infinity));
    return ranked[0] || {viewer:null,target,score:0,label:'No recorded route match'};
  });
  const exact = matches.filter(match => match.score === 2);
  const partial = matches.filter(match => match.score === 1);
  const areaMatches=targetAreas.flatMap(target=>viewerAreas
    .filter(viewer=>serviceAreasOverlap(viewer,target))
    .map(viewer=>({viewer,target,label:'Local service areas overlap'})));
  const routeAreaMatches=[];
  for(const route of viewerRoutes){
    for(const area of targetAreas){
      const endpoints=[
        Number.isFinite(Number(route.origin_lat))?{lat:route.origin_lat,lng:route.origin_lng}:null,
        Number.isFinite(Number(route.destination_lat))?{lat:route.destination_lat,lng:route.destination_lng}:null
      ].filter(Boolean);
      if(endpoints.some(point=>pointInServiceArea(point,area)))routeAreaMatches.push({viewer:route,target:area,label:'Your route endpoint aligns with this service area'});
    }
  }
  for(const area of viewerAreas){
    for(const route of targetRoutes){
      const endpoints=[
        Number.isFinite(Number(route.origin_lat))?{lat:route.origin_lat,lng:route.origin_lng}:null,
        Number.isFinite(Number(route.destination_lat))?{lat:route.destination_lat,lng:route.destination_lng}:null
      ].filter(Boolean);
      if(endpoints.some(point=>pointInServiceArea(point,area)))routeAreaMatches.push({viewer:area,target:route,label:'Profile route endpoint aligns with your service area'});
    }
  }
  const strongestLabel=exact.length
    ? `${exact.length} full route ${exact.length===1?'match':'matches'}`
    : areaMatches.length
      ? `${areaMatches.length} local service-area ${areaMatches.length===1?'overlap':'overlaps'}`
      : partial.length||routeAreaMatches.length
        ? `${partial.length+routeAreaMatches.length} endpoint ${partial.length+routeAreaMatches.length===1?'alignment':'alignments'}`
        : 'No recorded coverage overlap';
  return {
    viewer_routes:viewerRoutes,
    target_routes:targetRoutes,
    viewer_areas:viewerAreas,
    target_areas:targetAreas,
    matches,
    area_matches:areaMatches,
    route_area_matches:routeAreaMatches,
    exact_count:exact.length,
    partial_count:partial.length,
    area_overlap_count:areaMatches.length,
    route_area_count:routeAreaMatches.length,
    strongest_label:strongestLabel,
    evidence_label:[...targetRoutes,...targetAreas].some(item => item.route_kind !== 'PROFILE'&&item.area_kind !== 'PROFILE')
      ? [...targetRoutes,...targetAreas].some(item => item.tracked_count)
        ? 'Includes tracked activity and fresh truck routes'
        : 'Includes fresh truck coverage'
      : [...targetRoutes,...targetAreas].some(item => item.tracked_count) ? 'Includes tracked activity' : [...targetRoutes,...targetAreas].some(item => item.reported_count) ? 'Reported activity only' : 'Declarations only'
  };
}

export function getFleetNetworkCoverage(user) {
  assertWorkspaceAccess(user);
  if (user.role !== USER_ROLES.TRANSPORTER || !user.organization_id) return null;
  const db = getDb();
  const page = db.prepare(`SELECT o.id,o.name,o.type,o.handle,'organization' AS page_kind,0 AS is_business
    FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id WHERE o.id=?`).get(user.organization_id);
  const routes = page ? listProfileRoutesWithEvidence(db,page) : [];
  const preferredRoutes = routes.map(route => ({...route,route_kind:'PROFILE',source_label:'Preferred Route'}));
  const liveRoutes = page ? listLiveTruckRoutesForPage(db,page,true) : [];
  const mapRoutes = [...preferredRoutes,...liveRoutes];
  const routeLabels = preferredRoutes.map(route => `${route.origin} ↔ ${route.destination}`);
  const businesses = db.prepare(`SELECT o.id,o.name,o.handle,o.city,o.city_lat,o.city_lng,cp.operating_regions
    FROM partner_relationships rel
    JOIN organizations o ON o.id=rel.owner_organization_id
    LEFT JOIN company_pages cp ON cp.organization_id=o.id
    WHERE rel.provider_organization_id=? AND rel.status='CONNECTED'
    ORDER BY o.name`).all(user.organization_id).map(business => {
      const declaredAreas=db.prepare(`SELECT place_label,center_lat,center_lng,radius_km FROM service_areas WHERE organization_id=?`).all(business.id);
      if(Number.isFinite(Number(business.city_lat))&&Number.isFinite(Number(business.city_lng))){
        declaredAreas.unshift({place_label:business.city,center_lat:business.city_lat,center_lng:business.city_lng,radius_km:50});
      }
      const matched=[...new Set(declaredAreas.filter(area=>mapRoutes.some(route=>{
        const endpoints=[
          Number.isFinite(Number(route.origin_lat))?{lat:route.origin_lat,lng:route.origin_lng}:null,
          Number.isFinite(Number(route.destination_lat))?{lat:route.destination_lat,lng:route.destination_lng}:null
        ].filter(Boolean);
        return endpoints.some(point=>pointInServiceArea(point,area));
      })).map(area=>placeIdentity(area.place_label)))];
      return {
        ...business,
        places:declaredAreas.map(area=>area.place_label),
        matched_places:matched,
        coverage_label:matched.length ? `${matched.length} location${matched.length === 1 ? '' : 's'} near recorded routes` : 'No coordinate-based route match'
      };
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
  assertWorkspaceAccess(user);
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
  const badgesBySubject=verificationBadgesBySubject(db,subjects.map(subject=>({type:subject.subject_type,id:subject.subject_id})));
  return {
    subjects: subjects.map(subject => {
      const badges=badgesBySubject.get(`${subject.subject_type}:${subject.subject_id}`)||[];
      const verifiedTypes=new Set(badges.filter(badge=>badge.verified).map(badge=>badge.type));
      const allowedTypes=subject.subject_type==='VEHICLE'
        ? badges.some(badge=>badge.verified)?[]:VERIFICATION_TYPES.VEHICLE
        : VERIFICATION_TYPES[subject.subject_type].filter(type=>!verifiedTypes.has(type));
      return {...subject,allowed_types:allowedTypes,badges};
    }),
    requests
  };
}

export function submitVerification(user,input,upload) {
  assertWorkspaceAccess(user);
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

export function listVerificationRequests(user, options = /** @type {any} */ (null)) {
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.TRUST);
  const db=getDb();
  const status = String(options?.status||'ALL').toUpperCase();
  const search = String(options?.q||'').trim().toLowerCase();
  const args=[];
  let where='1=1';
  if(status!=='ALL'){where+=' AND vr.status=?';args.push(status);}
  if(search){
    const pattern=`%${search}%`;
    where+=` AND lower(submitter.name || ' ' || vr.document_name || ' ' || vr.original_name || ' ' ||
      vr.subject_type || ' ' || vr.verification_type || ' ' || vr.status) LIKE ?`;
    args.push(pattern);
  }
  const base=`SELECT vr.*,submitter.name AS submitter_name,reviewer.name AS reviewer_name
    FROM verification_requests vr JOIN users submitter ON submitter.id=vr.submitted_by
    LEFT JOIN users reviewer ON reviewer.id=vr.reviewed_by
    WHERE ${where}`;
  if (!options) return db.prepare(`${base} ORDER BY CASE vr.status WHEN 'PENDING' THEN 0 WHEN 'MORE_INFO' THEN 1 ELSE 2 END,vr.submitted_at DESC`).all(...args);
  return paginateQuery(db,base,args,`CASE status WHEN 'PENDING' THEN 0 WHEN 'MORE_INFO' THEN 1 ELSE 2 END,submitted_at DESC`,options);
}

export function reviewVerification(user,requestId,status,note='') {
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.TRUST);
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
  assertWorkspaceAccess(user);
  const db = getDb();
  const request = db.prepare('SELECT * FROM verification_requests WHERE id=?').get(requestId);
  if (!request) return null;
  if (!hasPlatformPermission(user,PLATFORM_PERMISSIONS.TRUST) && request.submitted_by !== user.id) return null;
  return request;
}

export function submitBusinessReview(user,shipmentId,rating,note='') {
  assertWorkspaceAccess(user);
  const db = getDb();
  const shipment = db.prepare('SELECT * FROM shipments WHERE id=? OR code=?').get(shipmentId,shipmentId);
  if (!shipment || shipment.operational_status !== 'COMPLETED' || !user.organization_id) throw new Error('REVIEW_NOT_ALLOWED');
  const parties = [shipment.shipper_organization_id,shipment.receiver_organization_id]
    .filter((id,index,all)=>Boolean(id)&&all.indexOf(id)===index);
  if (parties.length !== 2 || !parties.includes(user.organization_id)) throw new Error('REVIEW_NOT_ALLOWED');
  const subjectOrganizationId = parties.find(id => id !== user.organization_id);
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('INVALID_RATING');
  const cleanNote = String(note || '').trim();
  if (value < 4 && !cleanNote) throw new Error('LOW_RATING_NOTE_REQUIRED');
  const status = value >= 4 ? 'PUBLISHED' : 'PENDING';
  try {
    const id = randomId('review-');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`INSERT INTO business_reviews
        (id,shipment_id,reviewer_organization_id,subject_organization_id,rating,note,status,created_by,created_at)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(id,shipment.id,user.organization_id,subjectOrganizationId,value,cleanNote || null,status,user.id,nowIso());
      if (status === 'PENDING') {
        const subject = db.prepare('SELECT name FROM organizations WHERE id=?').get(subjectOrganizationId);
        for (const admin of db.prepare(`SELECT id FROM users WHERE role='ADMIN' AND active=1`).all()) {
          notify(db,admin.id,'Low Business rating needs review',`${value}-star rating for ${subject?.name || 'a Business'} on ${shipment.code} is waiting in Rating Reviews.`);
        }
      }
      audit(db,user,'BUSINESS_REVIEW_SUBMITTED','business_review',id,{shipmentId:shipment.id,subjectOrganizationId,rating:value,status});
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return {id,status};
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) throw new Error('REVIEW_ALREADY_SUBMITTED');
    throw error;
  }
}

export function listRatingModerationQueue(user,status='PENDING',options=/** @type {any} */ (null)) {
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.TRUST);
  const normalizedStatus = String(status || 'PENDING').toUpperCase();
  if (!['PENDING','PUBLISHED','DISMISSED'].includes(normalizedStatus)) throw new Error('INVALID_RATING_REVIEW_STATUS');
  const db = getDb();
  const base=`SELECT
      r.id,r.rating,r.note,r.status,r.created_at,r.review_note,r.reviewed_at,
      s.id AS shipment_id,s.code AS shipment_code,s.title AS shipment_title,
      s.origin,s.destination,s.operational_status,
      reviewer.name AS reviewer_name,reviewer.handle AS reviewer_handle,
      subject.name AS subject_name,subject.handle AS subject_handle,
      submitter.name AS submitted_by_name,administrator.name AS reviewed_by_name
    FROM business_reviews r
    JOIN shipments s ON s.id=r.shipment_id
    JOIN organizations reviewer ON reviewer.id=r.reviewer_organization_id
    JOIN organizations subject ON subject.id=r.subject_organization_id
    JOIN users submitter ON submitter.id=r.created_by
    LEFT JOIN users administrator ON administrator.id=r.reviewed_by
    WHERE r.status=?`;
  const result=options
    ? paginateQuery(db,base,[normalizedStatus],'created_at DESC',options)
    : db.prepare(`${base} ORDER BY r.created_at DESC LIMIT 100`).all(normalizedStatus);
  audit(db,user,'ADMIN_RATING_QUEUE_READ','business_review',null,{status:normalizedStatus,count:options?result.total:result.length});
  return result;
}

export function reviewBusinessRating(user,reviewId,status,note='') {
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.TRUST);
  const normalizedStatus = String(status || '').toUpperCase();
  if (!['PUBLISHED','DISMISSED'].includes(normalizedStatus)) throw new Error('INVALID_RATING_REVIEW_STATUS');
  const cleanNote = String(note || '').trim();
  if (!cleanNote) throw new Error('RATING_REVIEW_NOTE_REQUIRED');
  const db = getDb();
  const review = db.prepare(`SELECT r.*,s.code AS shipment_code,subject.name AS subject_name
    FROM business_reviews r
    JOIN shipments s ON s.id=r.shipment_id
    JOIN organizations subject ON subject.id=r.subject_organization_id
    WHERE r.id=?`).get(reviewId);
  if (!review) throw new Error('NOT_FOUND');
  if (review.status !== 'PENDING') throw new Error('RATING_ALREADY_REVIEWED');
  const reviewedAt = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = db.prepare(`UPDATE business_reviews
      SET status=?,reviewed_by=?,review_note=?,reviewed_at=?
      WHERE id=? AND status='PENDING'`).run(normalizedStatus,user.id,cleanNote,reviewedAt,reviewId);
    if (!result.changes) throw new Error('RATING_ALREADY_REVIEWED');
    audit(db,user,'BUSINESS_RATING_REVIEWED','business_review',reviewId,{
      shipmentId:review.shipment_id,
      subjectOrganizationId:review.subject_organization_id,
      status:normalizedStatus
    });
    notify(
      db,
      review.created_by,
      normalizedStatus === 'PUBLISHED' ? 'Business rating published' : 'Business rating review completed',
      `${review.rating}-star rating for ${review.subject_name} on ${review.shipment_code} was ${normalizedStatus === 'PUBLISHED' ? 'published' : 'dismissed'}.`
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return {id:reviewId,status:normalizedStatus,reviewedAt};
}

export function listOwnTruckRouteOptions(user) {
  assertWorkspaceAccess(user);
  if (![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) return [];
  const latestByVehicle = new Map();
  for (const capacity of listOwnCapacity(user)) {
    if (!latestByVehicle.has(capacity.vehicle_id)) latestByVehicle.set(capacity.vehicle_id,capacity);
  }
  const routes = [...latestByVehicle.values()]
    .filter(capacity => ['EMPTY','PARTIAL'].includes(capacity.status))
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
  assertWorkspaceAccess(user);
  if (![USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)) return [];
  return getDb().prepare(`SELECT id,code,title,origin,destination,origin_place_ref,origin_lat,origin_lng,
    destination_place_ref,destination_lat,destination_lng,load_type,movement_scope,
    local_place_ref,local_place_label,local_center_lat,local_center_lng FROM shipments
    WHERE COALESCE(load_owner_organization_id,shipper_organization_id)=?
      AND operational_status IN ('POSTED','SENT','CONTACTED') ORDER BY updated_at DESC`).all(user.organization_id)
    .map(load => ({...load}));
}

function boardFilterRadius(value, fallback=50) {
  const radius=Number(value);
  return Number.isFinite(radius)&&radius>=5&&radius<=300?radius:fallback;
}

function selectedBoardPlace(placeRef,label) {
  return placeRef?resolvePlaceReference(placeRef,label):null;
}

function loadBoardQuery(user,mode,filters={}) {
  let where=`s.service_mode='FREIGHT' AND s.operational_status IN ('POSTED','SENT','CONTACTED')
    AND (s.delivery_date IS NULL OR s.delivery_date>=?)`;
  const args=[dateInEthiopiaOffset(-LOAD_BOARD_GRACE_DAYS)];
  if(user.role!==USER_ROLES.ADMIN){
    where+=` AND (
      (s.distribution_mode='OPEN_MARKET' AND s.operational_status='POSTED')
      OR (s.distribution_mode='SAVED_PARTNERS' AND s.operational_status='POSTED' AND EXISTS(
        SELECT 1 FROM partner_relationships rel
        WHERE rel.owner_organization_id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
          AND rel.status='CONNECTED' AND (rel.provider_organization_id=? OR rel.provider_profile_id=?)
      ))
      OR (s.distribution_mode='DIRECT_TO_PROVIDER' AND (s.provider_organization_id=? OR s.provider_profile_id=?))
    )`;
    args.push(user.organization_id||'',user.provider_profile_id||'',user.organization_id||'',user.provider_profile_id||'');
  }
  if(mode==='DIRECT')where+=` AND s.distribution_mode='DIRECT_TO_PROVIDER'`;
  if(mode==='PARTNERS')where+=` AND s.distribution_mode='SAVED_PARTNERS'`;
  if(mode==='OPEN')where+=` AND s.distribution_mode='OPEN_MARKET'`;
  if(mode==='INTERESTED'){
    where+=` AND EXISTS(SELECT 1 FROM shipment_interests mine WHERE mine.shipment_id=s.id AND (mine.provider_organization_id=? OR mine.provider_profile_id=?))`;
    args.push(user.organization_id||'',user.provider_profile_id||'');
  }
  if(['LOCAL','INTERCITY'].includes(filters.movementScope)){
    where+=` AND s.movement_scope=?`;
    args.push(filters.movementScope);
  }
  const localPlace=selectedBoardPlace(filters.localPlaceRef,filters.locality);
  if(localPlace){
    where+=` AND s.movement_scope='LOCAL'
      AND geo_distance_km(?,?,s.local_center_lat,s.local_center_lng)<=?`;
    args.push(localPlace.center_lat,localPlace.center_lng,boardFilterRadius(filters.localRadiusKm));
  }
  if(filters.q){
    const pattern=`%${String(filters.q).trim().toLowerCase()}%`;
    where+=` AND (lower(s.code) LIKE ? OR lower(s.title) LIKE ? OR lower(s.cargo_description) LIKE ?
      OR lower(COALESCE(shipper.name,s.external_shipper_name,'')) LIKE ?
      OR lower(COALESCE(receiver.name,s.external_receiver_name,'')) LIKE ?
      OR lower(owner.name) LIKE ? OR lower(COALESCE(s.vehicle_category,'')) LIKE ?)`;
    args.push(...Array(7).fill(pattern));
  }
  const originPlace=selectedBoardPlace(filters.originPlaceRef,filters.origin);
  const destinationPlace=selectedBoardPlace(filters.destinationPlaceRef,filters.destination);
  const originRadius=boardFilterRadius(filters.originRadiusKm);
  const destinationRadius=boardFilterRadius(filters.destinationRadiusKm);
  const eitherDirection=filters.directionMode==='EITHER';
  if(originPlace||destinationPlace){
    where+=` AND s.movement_scope='INTERCITY'`;
    const direct=[];
    const reverse=[];
    const directArgs=[];
    const reverseArgs=[];
    if(originPlace){
      direct.push('geo_distance_km(?,?,s.origin_lat,s.origin_lng)<=?');
      directArgs.push(originPlace.center_lat,originPlace.center_lng,originRadius);
      if(eitherDirection){
        reverse.push('geo_distance_km(?,?,s.destination_lat,s.destination_lng)<=?');
        reverseArgs.push(originPlace.center_lat,originPlace.center_lng,originRadius);
      }
    }
    if(destinationPlace){
      direct.push('geo_distance_km(?,?,s.destination_lat,s.destination_lng)<=?');
      directArgs.push(destinationPlace.center_lat,destinationPlace.center_lng,destinationRadius);
      if(eitherDirection){
        reverse.push('geo_distance_km(?,?,s.origin_lat,s.origin_lng)<=?');
        reverseArgs.push(destinationPlace.center_lat,destinationPlace.center_lng,destinationRadius);
      }
    }
    where+=eitherDirection?` AND ((${direct.join(' AND ')}) OR (${reverse.join(' AND ')}))`:` AND (${direct.join(' AND ')})`;
    args.push(...directArgs,...reverseArgs);
  }
  for(const [filter,column] of [['loadType','s.load_type'],['vehicleCategory','s.vehicle_category'],['priceMode','s.price_mode']]){
    if(filters[filter]){where+=` AND ${column}=?`;args.push(filters[filter]);}
  }
  const minPrice=Number(filters.minPriceEtb)>0?Math.round(Number(filters.minPriceEtb)*100):null;
  const maxPrice=Number(filters.maxPriceEtb)>0?Math.round(Number(filters.maxPriceEtb)*100):null;
  const comparableAmount=`CASE s.price_mode WHEN 'FIXED_PRICE' THEN s.price_minor WHEN 'TARGET_PRICE' THEN s.target_price_minor ELSE NULL END`;
  if(minPrice){where+=` AND ${comparableAmount}>=?`;args.push(minPrice);}
  if(maxPrice){where+=` AND ${comparableAmount}<=?`;args.push(maxPrice);}
  if(filters.pickupBy){where+=` AND s.pickup_date<=?`;args.push(filters.pickupBy);}
  if(filters.deliveryBy){where+=` AND s.delivery_date IS NOT NULL AND s.delivery_date<=?`;args.push(filters.deliveryBy);}
  const postedHours={'24H':24,'3D':72,'7D':168}[filters.postedWithin];
  if(postedHours){where+=` AND s.created_at>=?`;args.push(new Date(Date.now()-postedHours*3600000).toISOString());}
  const from=`FROM shipments s
    LEFT JOIN organizations shipper ON shipper.id=s.shipper_organization_id
    LEFT JOIN organizations receiver ON receiver.id=s.receiver_organization_id
    JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    LEFT JOIN company_pages cp ON cp.organization_id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)`;
  return {where,args,from};
}

const LOAD_BOARD_COLUMNS=`s.id,s.code,s.title,s.service_mode,s.distribution_mode,s.price_mode,s.price_minor,s.target_price_minor,
  s.shipper_organization_id,s.receiver_organization_id,s.provider_organization_id,s.provider_profile_id,
  COALESCE(s.load_owner_organization_id,s.shipper_organization_id) AS load_owner_organization_id,
  s.origin,s.destination,s.origin_place_ref,s.origin_lat,s.origin_lng,s.destination_place_ref,s.destination_lat,s.destination_lng,
  s.cargo_description,s.package_count,s.vehicle_category,s.load_type,s.pickup_date,s.delivery_date,
  s.commercial_status,s.operational_status,s.tracking_mode,s.created_at,s.updated_at,s.movement_scope,
  s.local_place_ref,s.local_place_label,s.pickup_area_label,s.dropoff_area_label,
  COALESCE(s.external_shipper_name,shipper.name) AS shipper_name,
  COALESCE(s.external_receiver_name,receiver.name) AS receiver_name,owner.name AS load_owner_name,owner.handle AS load_owner_handle,
  CASE WHEN cp.show_contact_phone_on_loads=1 THEN cp.contact_phone ELSE NULL END AS load_contact_phone`;

function rankLoadRows(rows,selectedRoute){
  if(!selectedRoute)return rows.map(load=>({...load,route_match_score:null,route_match_label:null,route_match_source:null,route_match_platform_number:null}));
  return rows.map(load=>{
    if(load.movement_scope==='LOCAL')return {...load,route_match_score:0,route_match_label:'Local shipment',route_match_source:null,route_match_platform_number:null};
    const candidates=selectedRoute.routes||[selectedRoute];
    const match=bestGeographicRouteMatch(load,candidates,{
      originRadiusKm:selectedRoute.originRadiusKm||50,
      destinationRadiusKm:selectedRoute.destinationRadiusKm||50,
      directionMode:selectedRoute.directionMode||'DIRECT'
    });
    return {...load,route_match_score:match?.score??null,route_match_label:match?.label??null,route_match_source:match?.source_label||null,route_match_platform_number:match?.platform_number||null};
  }).sort((a,b)=>(b.route_match_score??0)-(a.route_match_score??0)||new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
}

function loadBoardRows(user,mode,filters={},limit=null,offset=0){
  const db=getDb();
  const query=loadBoardQuery(user,mode,filters);
  const suffix=limit==null?'':` LIMIT ? OFFSET ?`;
  const rows=db.prepare(`SELECT ${LOAD_BOARD_COLUMNS},
    EXISTS(SELECT 1 FROM shipment_interests i WHERE i.shipment_id=s.id AND (i.provider_organization_id=? OR i.provider_profile_id=?)) AS interested
    ${query.from} WHERE ${query.where} ORDER BY s.created_at DESC${suffix}`)
    .all(user.organization_id||'',user.provider_profile_id||'',...query.args,...(limit==null?[]:[limit,offset]));
  const ownerIds=rows.map(row=>row.load_owner_organization_id).filter(Boolean);
  const badges=verificationBadgesBySubject(db,[...new Set(ownerIds)].map(id=>({type:'ORGANIZATION',id})));
  const ratings=ratingSummariesByOrganization(db,ownerIds);
  const trustedRows=rows.map(row=>({
    ...row,
    owner_verification_badges:badges.get(`ORGANIZATION:${row.load_owner_organization_id}`)||[],
    owner_review_count:ratings.get(row.load_owner_organization_id)?.review_count||0,
    owner_average_rating:ratings.get(row.load_owner_organization_id)?.average_rating||null
  }));
  return canContactBusinesses(user)?trustedRows:trustedRows.map(row=>({...row,load_contact_phone:null}));
}

export function listLoadsPage(user,mode='ALL',filters={},options={}) {
  assertWorkspaceAccess(user);
  const pageSize=Math.max(1,Math.min(100,Number(options.pageSize)||20));
  if(!canBrowseLoads(user)&&user.role!==USER_ROLES.ADMIN)return paginateResults([],{page:1,pageSize});
  const selectedRoute = filters.matchCapacityId
    ? listOwnTruckRouteOptions(user).find(option => option.id === filters.matchCapacityId)
    : null;
  if(selectedRoute){
    return paginateResults(rankLoadRows(loadBoardRows(user,mode,filters),selectedRoute),{page:options.page,pageSize});
  }
  const query=loadBoardQuery(user,mode,filters);
  const total=getDb().prepare(`SELECT COUNT(*) AS n ${query.from} WHERE ${query.where}`).get(...query.args).n;
  const pageCount=Math.max(1,Math.ceil(total/pageSize));
  const page=Math.max(1,Math.min(pageCount,Number(options.page)||1));
  const rows=loadBoardRows(user,mode,filters,pageSize,(page-1)*pageSize);
  return {items:rankLoadRows(rows,null),total,page,pageSize,pageCount};
}

export function listLoads(user,mode='ALL',filters={}) {
  assertWorkspaceAccess(user);
  if(!canBrowseLoads(user)&&user.role!==USER_ROLES.ADMIN)return [];
  const selectedRoute=filters.matchCapacityId?listOwnTruckRouteOptions(user).find(option=>option.id===filters.matchCapacityId):null;
  return rankLoadRows(loadBoardRows(user,mode,filters),selectedRoute);
}

function countLoads(user,mode='ALL',filters={}) {
  if(!canBrowseLoads(user)&&user.role!==USER_ROLES.ADMIN)return 0;
  const query=loadBoardQuery(user,mode,filters);
  return getDb().prepare(`SELECT COUNT(*) AS n ${query.from} WHERE ${query.where}`).get(...query.args).n;
}

function sharedLoadCandidates(user,filters={}) {
  assertWorkspaceAccess(user);
  if(!canBrowseLoads(user)&&user.role!==USER_ROLES.ADMIN)return [];
  const candidateLimit=Math.max(100,Math.min(1000,Number(process.env.SHARED_LOAD_CANDIDATE_LIMIT||process.env.PSTL_CANDIDATE_LIMIT)||500));
  return loadBoardRows(user,'ALL',{...filters,movementScope:'INTERCITY'},candidateLimit)
    .filter(load=>load.operational_status==='POSTED'&&load.movement_scope==='INTERCITY')
    .map(load=>({
      ...load,
      origin_coordinate:Number.isFinite(Number(load.origin_lat))?{lat:load.origin_lat,lng:load.origin_lng}:null,
      destination_coordinate:Number.isFinite(Number(load.destination_lat))?{lat:load.destination_lat,lng:load.destination_lng}:null
    }));
}

export function listPooledLoads(user,filters={}) {
  const loads=sharedLoadCandidates(user,{...filters,loadType:'PTL'});
  return poolCompatibleLoads(loads,{
    originRadiusKm:Number(process.env.PSTL_ORIGIN_RADIUS_KM||40),
    destinationRadiusKm:Number(process.env.PSTL_DESTINATION_RADIUS_KM||40),
    deadlineWindowDays:Number(process.env.PSTL_DEADLINE_WINDOW_DAYS||3)
  });
}

export function getPooledLoad(user,poolId) {
  assertWorkspaceAccess(user);
  return listPooledLoads(user).find(pool=>pool.id===poolId)||null;
}

export function listAlongRouteLoads(user,filters={}) {
  return buildAlongRouteChains(sharedLoadCandidates(user,filters),{
    handoffRadiusKm:Number(process.env.ALONG_ROUTE_HANDOFF_RADIUS_KM||60),
    maxBearingDifferenceDegrees:Number(process.env.ALONG_ROUTE_MAX_BEARING_DEGREES||90),
    maxLegs:Number(process.env.ALONG_ROUTE_MAX_LEGS||8)
  });
}

export function getAlongRouteLoad(user,routeId) {
  assertWorkspaceAccess(user);
  return listAlongRouteLoads(user).find(route=>route.id===routeId)||null;
}

export function expressInterest(user, shipmentId, note = '') {
  assertWorkspaceAccess(user);
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
  assertWorkspaceAccess(user);
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
  if (owner) notify(db,owner.id,'Shipment proof requested',`${user.organization_name || user.provider_business_name || user.name} requested shipment-size proof for ${shipment.code}.`);
  audit(db,user,'LOAD_PROOF_REQUESTED','shipment',shipment.id,{ interestId: interest.id });
  return id;
}

export async function shareLoadProof(user, shipmentId, interestId, file, note = '') {
  assertWorkspaceAccess(user);
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
    if (recipient) notify(db,recipient.id,'Shipment proof shared',`Temporary shipment-size proof is available for ${shipment.code}.`);
    audit(db,user,'LOAD_PROOF_SHARED','shipment',shipment.id,{ interestId: interest.id, proofId: id, expiresAt });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    await removePrivateUpload(upload.path);
    throw error;
  }
  return id;
}

export function getLoadProofFile(user, proofId) {
  assertWorkspaceAccess(user);
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
  assertWorkspaceAccess(user);
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

const CAPACITY_BOARD_COLUMNS=`c.id,c.provider_organization_id,c.provider_profile_id,c.vehicle_id,c.status,c.available_percent,
  COALESCE(c.market_status,c.status) AS market_status,c.available_again_date,
  c.origin,c.destination,c.origin_place_ref,c.origin_lat,c.origin_lng,c.destination_place_ref,c.destination_lat,c.destination_lng,
  c.corridor,c.travel_date,c.next_available,c.visibility,c.updated_by,c.updated_at,c.expires_at,
  c.location_area,c.location_place_ref,c.location_updated_at,c.location_precision_km,c.location_source,c.accepts_full_load,c.accepts_partial_load,
  c.open_to_contract_lanes,c.accepts_multi_stop,c.proof_recorded_at,c.current_route_origin,c.current_route_destination,
  c.current_origin_place_ref,c.current_origin_lat,c.current_origin_lng,
  c.current_destination_place_ref,c.current_destination_lat,c.current_destination_lng,
  c.current_route_date,c.planned_space_status,c.accepts_multi_pick,c.accepts_multi_drop,c.movement_scope,
  c.local_place_ref,c.local_place_label,c.local_center_lat,c.local_center_lng,c.local_radius_km,
  v.label AS vehicle_label,v.category AS vehicle_category,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,
  v.cargo_configuration,o.name AS organization_name,o.handle AS organization_handle,
  p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name,
  cp.contact_phone AS provider_contact_phone,
  CASE WHEN c.photo_path IS NOT NULL AND trim(c.photo_path)<>'' THEN 1 ELSE 0 END AS proof_available,
  (SELECT GROUP_CONCAT(r.origin || ' → ' || r.destination,' • ') FROM profile_routes r
    WHERE r.organization_id=c.provider_organization_id OR r.provider_profile_id=c.provider_profile_id) AS preferred_routes_label`;

function marketCapacityRow(row, freshHours, additions = {}) {
  const status=row.market_status||row.status;
  return {
    ...row,
    ...additions,
    status,
    proof_available:Boolean(row.proof_available),
    freshness: capacitySignalFreshness(status,row.updated_at,row.available_again_date,freshHours,todayInEthiopia()),
    expiry_state:status==='BUSY'&&row.available_again_date<todayInEthiopia()?'EXPIRED':'CURRENT'
  };
}

function capacityBoardQuery(user,filters={}) {
  let where=`v.active=1
    AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
    AND (c.provider_profile_id IS NOT NULL OR EXISTS(
      SELECT 1 FROM driver_vehicle_assignments board_assignment
      WHERE board_assignment.vehicle_id=v.id AND board_assignment.active=1
    ))
    AND (
      COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')
      OR (COALESCE(c.market_status,c.status)='BUSY' AND c.available_again_date>=?)
    )`;
  const args=[todayInEthiopia()];
  if([USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role)&&user.organization_id){
    where+=` AND (c.visibility='OPEN' OR (c.visibility='SAVED_PARTNERS' AND EXISTS(
      SELECT 1 FROM partner_relationships rel WHERE rel.owner_organization_id=? AND rel.status='CONNECTED'
        AND (rel.provider_organization_id=c.provider_organization_id OR rel.provider_profile_id=c.provider_profile_id)
    )))`;
    args.push(user.organization_id);
  }else where+=` AND c.visibility='OPEN'`;
  const scope=providerScope(user);
  if(scope?.organizationId){where+=` AND COALESCE(c.provider_organization_id,'')<>?`;args.push(scope.organizationId);}
  if(scope?.profileId){where+=` AND COALESCE(c.provider_profile_id,'')<>?`;args.push(scope.profileId);}
  if(filters.q){
    const pattern=`%${String(filters.q).trim().toLowerCase()}%`;
    where+=` AND (lower(v.platform_number) LIKE ? OR lower(COALESCE(v.make,'')) LIKE ? OR lower(COALESCE(v.model,'')) LIKE ?
      OR lower(COALESCE(v.cargo_configuration,v.category,'')) LIKE ? OR lower(COALESCE(o.name,p.business_name,'')) LIKE ?
      )`;
    args.push(...Array(5).fill(pattern));
  }
  if(filters.capacityId){where+=` AND c.id=?`;args.push(filters.capacityId);}
  if(filters.movementScope==='LOCAL')where+=` AND c.movement_scope IN ('LOCAL','BOTH')`;
  if(filters.movementScope==='INTERCITY')where+=` AND c.movement_scope IN ('INTERCITY','BOTH')`;
  const localPlace=selectedBoardPlace(filters.localPlaceRef,filters.locality);
  if(localPlace){
    where+=` AND c.movement_scope IN ('LOCAL','BOTH')
      AND geo_distance_km(?,?,c.local_center_lat,c.local_center_lng)<=?+COALESCE(c.local_radius_km,0)`;
    args.push(localPlace.center_lat,localPlace.center_lng,boardFilterRadius(filters.localRadiusKm));
  }
  const originPlace=selectedBoardPlace(filters.originPlaceRef,filters.origin);
  const destinationPlace=selectedBoardPlace(filters.destinationPlaceRef,filters.destination);
  if(originPlace||destinationPlace){
    const originRadius=boardFilterRadius(filters.originRadiusKm);
    const destinationRadius=boardFilterRadius(filters.destinationRadiusKm);
    const eitherDirection=filters.directionMode==='EITHER';
    const routeVariants=[
      {origin:'c.origin',originLat:'c.origin_lat',originLng:'c.origin_lng',destination:'c.destination',destinationLat:'c.destination_lat',destinationLng:'c.destination_lng'},
      {origin:'c.current_route_origin',originLat:'c.current_origin_lat',originLng:'c.current_origin_lng',destination:'c.current_route_destination',destinationLat:'c.current_destination_lat',destinationLng:'c.current_destination_lng'}
    ];
    const clauses=[];
    const routeArgs=[];
    for(const route of routeVariants){
      const orientations=[false,...(eitherDirection?[true]:[])];
      for(const reversed of orientations){
        const parts=[`${route.origin} IS NOT NULL`,`${route.destination} IS NOT NULL`];
        if(originPlace){
          parts.push(`geo_distance_km(?,?,${reversed?route.destinationLat:route.originLat},${reversed?route.destinationLng:route.originLng})<=?`);
          routeArgs.push(originPlace.center_lat,originPlace.center_lng,originRadius);
        }
        if(destinationPlace){
          parts.push(`geo_distance_km(?,?,${reversed?route.originLat:route.destinationLat},${reversed?route.originLng:route.destinationLng})<=?`);
          routeArgs.push(destinationPlace.center_lat,destinationPlace.center_lng,destinationRadius);
        }
        clauses.push(`(${parts.join(' AND ')})`);
      }
    }
    for(const reversed of [false,...(eitherDirection?[true]:[])]){
      const parts=[`(pr.organization_id=c.provider_organization_id OR pr.provider_profile_id=c.provider_profile_id)`];
      if(originPlace){
        parts.push(`geo_distance_km(?,?,${reversed?'pr.destination_lat':'pr.origin_lat'},${reversed?'pr.destination_lng':'pr.origin_lng'})<=?`);
        routeArgs.push(originPlace.center_lat,originPlace.center_lng,originRadius);
      }
      if(destinationPlace){
        parts.push(`geo_distance_km(?,?,${reversed?'pr.origin_lat':'pr.destination_lat'},${reversed?'pr.origin_lng':'pr.destination_lng'})<=?`);
        routeArgs.push(destinationPlace.center_lat,destinationPlace.center_lng,destinationRadius);
      }
      clauses.push(`EXISTS (SELECT 1 FROM profile_routes pr WHERE ${parts.join(' AND ')})`);
    }
    where+=` AND c.movement_scope IN ('INTERCITY','BOTH') AND (${clauses.join(' OR ')})`;
    args.push(...routeArgs);
  }
  if(filters.status){where+=` AND COALESCE(c.market_status,c.status)=?`;args.push(filters.status);}
  if(filters.loadType==='FTL')where+=` AND COALESCE(c.market_status,c.status)<>'BUSY' AND c.accepts_full_load=1`;
  if(filters.loadType==='PTL')where+=` AND COALESCE(c.market_status,c.status)<>'BUSY' AND c.accepts_partial_load=1`;
  if(filters.vehicleCategory){where+=` AND (v.cargo_configuration=? OR v.category=?)`;args.push(filters.vehicleCategory,filters.vehicleCategory);}
  if(Number(filters.minAvailable)>0){where+=` AND c.available_percent>=?`;args.push(Number(filters.minAvailable));}
  if(filters.routeBy){where+=` AND c.travel_date IS NOT NULL AND c.travel_date<=?`;args.push(filters.routeBy);}
  if(filters.visibility){where+=` AND c.visibility=?`;args.push(filters.visibility);}
  if(filters.freshness==='FRESH'){where+=` AND c.updated_at>=?`;args.push(hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12)));}
  if(filters.freshness==='UPDATE_NEEDED'){where+=` AND c.updated_at<?`;args.push(hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12)));}
  if(filters.stopOption==='DIRECT_ONLY')where+=` AND c.accepts_multi_pick=0 AND c.accepts_multi_drop=0`;
  if(filters.stopOption==='MULTI_PICK')where+=` AND c.accepts_multi_pick=1`;
  if(filters.stopOption==='MULTI_DROP')where+=` AND c.accepts_multi_drop=1`;
  if(filters.contractRoutes==='YES')where+=` AND c.open_to_contract_lanes=1`;
  if(filters.proof==='RECORDED')where+=` AND c.photo_path IS NOT NULL AND trim(c.photo_path)<>''`;
  const currentAreaPlace=selectedBoardPlace(filters.currentAreaPlaceRef,filters.currentArea);
  const currentAreaRadius=boardFilterRadius(filters.currentAreaRadiusKm);
  const currentAreaMatchExpression=currentAreaPlace
    ? `geo_distance_km(${Number(currentAreaPlace.center_lat)},${Number(currentAreaPlace.center_lng)},c.location_lat,c.location_lng)<=${currentAreaRadius}+COALESCE(c.location_precision_km,40)`
    : null;
  if(currentAreaMatchExpression&&filters.currentAreaMode==='REQUIRE')where+=` AND ${currentAreaMatchExpression}`;
  const from=`FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    LEFT JOIN company_pages cp ON cp.organization_id=c.provider_organization_id OR cp.provider_profile_id=c.provider_profile_id
    JOIN users u ON u.id=c.updated_by`;
  return {where,args,from,currentAreaMatchExpression};
}

function capacityBoardRows(user,filters={},limit=null,offset=0) {
  const query=capacityBoardQuery(user,filters);
  const areaProjection=query.currentAreaMatchExpression?`,${query.currentAreaMatchExpression} AS current_area_match`:'';
  const areaOrder=query.currentAreaMatchExpression&&filters.currentAreaMode==='PREFER'?'current_area_match DESC,':'';
  const rows=getDb().prepare(`SELECT ${CAPACITY_BOARD_COLUMNS}${areaProjection} ${query.from} WHERE ${query.where}
    ORDER BY ${areaOrder}CASE WHEN c.updated_at>=? THEN 0 ELSE 1 END,c.updated_at DESC${limit==null?'':' LIMIT ? OFFSET ?'}`)
    .all(...query.args,hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12)),...(limit==null?[]:[limit,offset]));
  const organizationIds=[...new Set(rows.map(row=>row.provider_organization_id).filter(Boolean))];
  const profileIds=[...new Set(rows.map(row=>row.provider_profile_id).filter(Boolean))];
  const routeClauses=[];
  const routeArgs=[];
  if(organizationIds.length){routeClauses.push(`organization_id IN (${organizationIds.map(()=>'?').join(',')})`);routeArgs.push(...organizationIds);}
  if(profileIds.length){routeClauses.push(`provider_profile_id IN (${profileIds.map(()=>'?').join(',')})`);routeArgs.push(...profileIds);}
  const preferredRoutes=routeClauses.length
    ? getDb().prepare(`SELECT * FROM profile_routes WHERE ${routeClauses.join(' OR ')} ORDER BY created_at,id`).all(...routeArgs)
    : [];
  const routesByOwner=new Map();
  for(const route of preferredRoutes){
    const key=route.organization_id?`org:${route.organization_id}`:`profile:${route.provider_profile_id}`;
    if(!routesByOwner.has(key))routesByOwner.set(key,[]);
    routesByOwner.get(key).push({...route,source_label:'Preferred Route',route_kind:'PROFILE'});
  }
  const ownerSubjects=[];
  const vehicleSubjects=rows.map(row=>({type:'VEHICLE',id:row.vehicle_id}));
  for(const row of rows)ownerSubjects.push(row.provider_organization_id
    ? {type:'ORGANIZATION',id:row.provider_organization_id}
    : {type:'PROVIDER_PROFILE',id:row.provider_profile_id});
  const vehicleIds=[...new Set(rows.map(row=>row.vehicle_id).filter(Boolean))];
  const assignments=vehicleIds.length?getDb().prepare(`SELECT a.vehicle_id,u.id AS driver_user_id,u.name AS driver_name
    FROM driver_vehicle_assignments a JOIN users u ON u.id=a.driver_user_id
    WHERE a.active=1 AND a.vehicle_id IN (${vehicleIds.map(()=>'?').join(',')})`).all(...vehicleIds):[];
  const assignmentByVehicle=new Map(assignments.map(assignment=>[assignment.vehicle_id,assignment]));
  const driverSubjects=assignments.map(assignment=>({type:'DRIVER',id:assignment.driver_user_id}));
  const trustBadges=verificationBadgesBySubject(getDb(),[...ownerSubjects,...vehicleSubjects,...driverSubjects]);
  return rows.map(row=>{
    const ownerKey=row.provider_organization_id?`org:${row.provider_organization_id}`:`profile:${row.provider_profile_id}`;
    const ownerSubject=row.provider_organization_id?`ORGANIZATION:${row.provider_organization_id}`:`PROVIDER_PROFILE:${row.provider_profile_id}`;
    const assignment=assignmentByVehicle.get(row.vehicle_id);
    return marketCapacityRow(row,Number(process.env.CAPACITY_FRESH_HOURS||12),{
      relationshipVisible:row.visibility==='SAVED_PARTNERS',
      preferred_routes:routesByOwner.get(ownerKey)||[],
      owner_verification_badges:trustBadges.get(ownerSubject)||[],
      vehicle_verification_badges:trustBadges.get(`VEHICLE:${row.vehicle_id}`)||[],
      assigned_driver_name:assignment?.driver_name||null,
      driver_verification_badges:assignment?trustBadges.get(`DRIVER:${assignment.driver_user_id}`)||[]:[]
    });
  });
}

function capacityMatch(row,selectedLoad){
  if(!selectedLoad)return null;
  if(selectedLoad.movement_scope==='LOCAL'){
    if(!['LOCAL','BOTH'].includes(row.movement_scope)||!row.local_center_lat)return {score:0,label:'Different movement scope'};
    const match=pointInServiceArea({lat:selectedLoad.local_center_lat,lng:selectedLoad.local_center_lng},{
      center_lat:row.local_center_lat,center_lng:row.local_center_lng,radius_km:row.local_radius_km
    });
    return {score:match?2:0,label:match?'Local area covers shipment city':'Local areas do not align',source_label:'Local service area'};
  }
  const routes=row.status==='BUSY'?row.preferred_routes||[]:capacityRouteCandidates(row,{requireCurrentDate:true});
  return bestGeographicRouteMatch(selectedLoad,routes,{
    originRadiusKm:50,destinationRadiusKm:50,directionMode:'DIRECT'
  });
}

function rankCapacityRows(rows,selectedLoad){
  const mapped=rows.map(row=>{
    const match=capacityMatch(row,selectedLoad);
    return {...row,route_match_score:match?.score??null,route_match_label:match?.label??null,route_match_source:match?.source_label||null};
  });
  if(selectedLoad)mapped.sort((a,b)=>(b.route_match_score??0)-(a.route_match_score??0)
    ||(a.freshness==='FRESH'?0:1)-(b.freshness==='FRESH'?0:1)
    ||new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());
  return mapped;
}

export function listMarketCapacityPage(user,filters={},options={}) {
  assertWorkspaceAccess(user);
  if ([USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) throw new Error('FORBIDDEN');
  const pageSize=Math.max(1,Math.min(100,Number(options.pageSize)||20));
  const selectedLoad = filters.matchLoadId
    ? listOwnLoadRouteOptions(user).find(option => option.id === filters.matchLoadId)
    : null;
  if(selectedLoad){
    return paginateResults(rankCapacityRows(capacityBoardRows(user,filters),selectedLoad),{page:options.page,pageSize});
  }
  const query=capacityBoardQuery(user,filters);
  const total=getDb().prepare(`SELECT COUNT(*) AS n ${query.from} WHERE ${query.where}`).get(...query.args).n;
  const pageCount=Math.max(1,Math.ceil(total/pageSize));
  const page=Math.max(1,Math.min(pageCount,Number(options.page)||1));
  const rows=capacityBoardRows(user,filters,pageSize,(page-1)*pageSize);
  return {items:rankCapacityRows(rows,null),total,page,pageSize,pageCount};
}

export function listProviderCapacityBoardPage(user,filters={},options={}) {
  assertWorkspaceAccess(user);
  if (![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) throw new Error('FORBIDDEN');
  const safeFilters={
    movementScope:filters.movementScope,
    localPlaceRef:filters.localPlaceRef,
    locality:filters.locality,
    localRadiusKm:filters.localRadiusKm,
    originPlaceRef:filters.originPlaceRef,
    origin:filters.origin,
    originRadiusKm:filters.originRadiusKm,
    destinationPlaceRef:filters.destinationPlaceRef,
    destination:filters.destination,
    destinationRadiusKm:filters.destinationRadiusKm,
    directionMode:filters.directionMode,
    currentAreaPlaceRef:filters.currentAreaPlaceRef,
    currentArea:filters.currentArea,
    currentAreaRadiusKm:filters.currentAreaRadiusKm,
    currentAreaMode:filters.currentAreaMode,
    status:filters.status,
    loadType:filters.loadType,
    vehicleCategory:filters.vehicleCategory,
    minAvailable:filters.minAvailable,
    routeBy:filters.routeBy,
    freshness:filters.freshness,
    stopOption:filters.stopOption,
    contractRoutes:filters.contractRoutes,
    proof:filters.proof
  };
  const pageSize=Math.max(1,Math.min(50,Number(options.pageSize)||12));
  const query=capacityBoardQuery(user,safeFilters);
  const total=getDb().prepare(`SELECT COUNT(*) AS n ${query.from} WHERE ${query.where}`).get(...query.args).n;
  const pageCount=Math.max(1,Math.ceil(total/pageSize));
  const page=Math.max(1,Math.min(pageCount,Number(options.page)||1));
  const areaProjection=query.currentAreaMatchExpression?`,${query.currentAreaMatchExpression} AS current_area_match`:'';
  const areaOrder=query.currentAreaMatchExpression&&safeFilters.currentAreaMode==='PREFER'?'current_area_match DESC,':'';
  const rows=getDb().prepare(`SELECT
      COALESCE(c.market_status,c.status) AS status,c.available_percent,c.available_again_date,
      c.origin,c.destination,c.travel_date,c.updated_at,c.location_area,c.location_updated_at,
      c.accepts_full_load,c.accepts_partial_load,c.open_to_contract_lanes,c.proof_recorded_at,
      c.current_route_origin,c.current_route_destination,c.planned_space_status,
      c.accepts_multi_pick,c.accepts_multi_drop,c.movement_scope,c.local_place_label,c.local_radius_km,
      COALESCE(v.cargo_configuration,v.category) AS cargo_configuration,
      CASE WHEN c.photo_path IS NOT NULL AND trim(c.photo_path)<>'' THEN 1 ELSE 0 END AS proof_available,
      (SELECT GROUP_CONCAT(r.origin || ' → ' || r.destination,' • ') FROM profile_routes r
        WHERE r.organization_id=c.provider_organization_id OR r.provider_profile_id=c.provider_profile_id) AS preferred_routes_label
      ${areaProjection}
    ${query.from} WHERE ${query.where}
    ORDER BY ${areaOrder}CASE WHEN c.updated_at>=? THEN 0 ELSE 1 END,c.updated_at DESC
    LIMIT ? OFFSET ?`).all(...query.args,hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12)),pageSize,(page-1)*pageSize);
  const items=rows.map(row=>{
    const {current_area_match:unused,...safeRow}=row;
    return {
      ...safeRow,
      proof_available:Boolean(row.proof_available),
      freshness:capacitySignalFreshness(row.status,row.updated_at,row.available_again_date,Number(process.env.CAPACITY_FRESH_HOURS||12),todayInEthiopia())
    };
  });
  return {items,total,page,pageSize,pageCount};
}

export function listMarketCapacity(user,filters={}) {
  assertWorkspaceAccess(user);
  if ([USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) throw new Error('FORBIDDEN');
  const selectedLoad=filters.matchLoadId?listOwnLoadRouteOptions(user).find(option=>option.id===filters.matchLoadId):null;
  return rankCapacityRows(capacityBoardRows(user,filters),selectedLoad);
}

function publicBoardTime(value) {
  if (!value) return null;
  const date=new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US',{
    timeZone:'Africa/Addis_Ababa',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
  }).format(date);
}

function publicPlaceLabel(label,placeRef) {
  if (!label || !placeRef) return null;
  return String(label).slice(0,120);
}

export function listAnonymousMarketplacePreview(limit=3) {
  const boundedLimit=Math.max(1,Math.min(6,Number(limit)||3));
  const anonymousAdmin={role:USER_ROLES.ADMIN,organization_id:null,provider_profile_id:null};
  const shipments=loadBoardRows(anonymousAdmin,'OPEN',{},boundedLimit).map(row=>({
    movement_scope:row.movement_scope,
    origin:row.movement_scope==='LOCAL'?null:publicPlaceLabel(row.origin,row.origin_place_ref),
    destination:row.movement_scope==='LOCAL'?null:publicPlaceLabel(row.destination,row.destination_place_ref),
    local_place_label:row.movement_scope==='LOCAL'?publicPlaceLabel(row.local_place_label,row.local_place_ref):null,
    load_type:row.load_type,
    vehicle_category:row.vehicle_category,
    pickup_label:publicBoardTime(row.pickup_date),
    delivery_label:publicBoardTime(row.delivery_date),
    price_mode:row.price_mode,
    price_minor:['FIXED_PRICE','TARGET_PRICE'].includes(row.price_mode)?row.price_minor||row.target_price_minor:null,
    distribution_mode:row.distribution_mode,
    posted_label:publicBoardTime(row.created_at)
  }));
  const trucks=capacityBoardRows(anonymousAdmin,{},boundedLimit).map(row=>({
    status:row.status,
    available_percent:row.available_percent,
    available_again_date:row.available_again_date,
    movement_scope:row.movement_scope,
    local_place_label:publicPlaceLabel(row.local_place_label,row.local_place_ref),
    local_radius_km:row.local_radius_km,
    location_area:publicPlaceLabel(row.location_area,row.location_place_ref),
    location_precision_km:row.location_precision_km,
    current_route_origin:publicPlaceLabel(row.current_route_origin,row.current_origin_place_ref),
    current_route_destination:publicPlaceLabel(row.current_route_destination,row.current_destination_place_ref),
    origin:publicPlaceLabel(row.origin,row.origin_place_ref),
    destination:publicPlaceLabel(row.destination,row.destination_place_ref),
    travel_date:row.travel_date,
    planned_space_status:row.planned_space_status,
    vehicle_make:row.vehicle_make,
    vehicle_model:row.vehicle_model,
    cargo_configuration:row.cargo_configuration||row.vehicle_category,
    accepts_full_load:Boolean(row.accepts_full_load),
    accepts_partial_load:Boolean(row.accepts_partial_load),
    accepts_multi_pick:Boolean(row.accepts_multi_pick),
    accepts_multi_drop:Boolean(row.accepts_multi_drop),
    open_to_contract_lanes:Boolean(row.open_to_contract_lanes),
    proof_available:Boolean(row.proof_available),
    freshness:row.freshness,
    updated_label:publicBoardTime(row.updated_at)
  }));
  const sharedCandidates=loadBoardRows(anonymousAdmin,'OPEN',{movementScope:'INTERCITY'},100)
    .filter(row=>row.operational_status==='POSTED'&&row.origin_place_ref&&row.destination_place_ref)
    .map(row=>({
      ...row,
      origin_coordinate:Number.isFinite(Number(row.origin_lat))?{lat:row.origin_lat,lng:row.origin_lng}:null,
      destination_coordinate:Number.isFinite(Number(row.destination_lat))?{lat:row.destination_lat,lng:row.destination_lng}:null
    }));
  const pool=poolCompatibleLoads(sharedCandidates,{
    originRadiusKm:Number(process.env.PSTL_ORIGIN_RADIUS_KM||40),
    destinationRadiusKm:Number(process.env.PSTL_DESTINATION_RADIUS_KM||40),
    deadlineWindowDays:Number(process.env.PSTL_DEADLINE_WINDOW_DAYS||3)
  })[0];
  const along=buildAlongRouteChains(sharedCandidates,{
    handoffRadiusKm:Number(process.env.ALONG_ROUTE_HANDOFF_RADIUS_KM||60),
    maxBearingDifferenceDegrees:Number(process.env.ALONG_ROUTE_MAX_BEARING_DEGREES||90),
    maxLegs:Number(process.env.ALONG_ROUTE_MAX_LEGS||8)
  })[0];
  const shared={
    pool:pool?{
      member_count:pool.member_count,
      origin:publicPlaceLabel(pool.origin,pool.members[0]?.origin_place_ref),
      destination:publicPlaceLabel(pool.destination,pool.members[0]?.destination_place_ref),
      origin_spread_km:pool.origin_spread_km,
      destination_spread_km:pool.destination_spread_km,
      earliest_pickup:publicBoardTime(pool.earliest_pickup),
      latest_delivery:publicBoardTime(pool.latest_delivery)
    }:null,
    along:along?{
      member_count:along.member_count,
      origin:publicPlaceLabel(along.origin,along.members[0]?.origin_place_ref),
      destination:publicPlaceLabel(along.destination,along.members.at(-1)?.destination_place_ref),
      loaded_distance_km:along.loaded_distance_km,
      connector_distance_km:along.connector_distance_km,
      stops:along.members.slice(0,5).map(member=>({
        origin:publicPlaceLabel(member.origin,member.origin_place_ref),
        destination:publicPlaceLabel(member.destination,member.destination_place_ref)
      }))
    }:null
  };
  return {shipments,trucks,shared};
}

export function listPublicCapacity(ownerColumn=null,ownerId=null) {
  const user={role:USER_ROLES.ADMIN,organization_id:null,provider_profile_id:null};
  const filters={};
  const query=capacityBoardQuery(user,filters);
  const ownerWhere=ownerColumn&&ownerId?` AND c.${ownerColumn}=?`:'';
  const rows=getDb().prepare(`SELECT ${CAPACITY_BOARD_COLUMNS} ${query.from} WHERE ${query.where}${ownerWhere} ORDER BY c.updated_at DESC`)
    .all(...query.args,...(ownerWhere?[ownerId]:[]));
  return rows.map(row=>marketCapacityRow(row,Number(process.env.CAPACITY_FRESH_HOURS||12)));
}

export function listOwnCapacity(user, capacityId = null, limit = null) {
  assertWorkspaceAccess(user);
  if (!roleCanPublishCapacity(user.role) || user.role === USER_ROLES.ADMIN) return [];
  const db = getDb();
  const freshHours = Number(process.env.CAPACITY_FRESH_HOURS || 12);
  const scope = providerScope(user);
  if (!scope) return [];
  const assignmentCondition = isCompanyDriver(user)
    ? ' AND EXISTS (SELECT 1 FROM driver_vehicle_assignments a WHERE a.driver_user_id=? AND a.vehicle_id=v.id AND a.active=1)'
    : '';
  const idCondition=capacityId?' AND c.id=?':'';
  const args = isCompanyDriver(user) ? [scope.id,user.id] : [scope.id];
  if(capacityId)args.push(capacityId);
  const boundedLimit=limit==null?null:Math.max(1,Math.min(100,Number(limit)||3));
  return db.prepare(`SELECT c.*,v.label AS vehicle_label,v.category AS vehicle_category,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,v.cargo_configuration,o.name AS organization_name,o.handle AS organization_handle,
    p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id JOIN users u ON u.id=c.updated_by
    WHERE v.active=1
      AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
      AND c.${scope.column}=?${assignmentCondition}${idCondition}
    ORDER BY c.updated_at DESC${boundedLimit==null?'':' LIMIT ?'}`).all(...args,...(boundedLimit==null?[]:[boundedLimit]))
    .map(row => {
      const status=row.market_status||row.status;
      return { ...row, status, proof_available: Boolean(row.photo_path), freshness: capacitySignalFreshness(status,row.updated_at,row.available_again_date,freshHours,todayInEthiopia()), expiry_state:status==='BUSY'&&row.available_again_date<todayInEthiopia()?'EXPIRED':'CURRENT', isOwn: true };
    });
}

export function listCapacity(user) {
  assertWorkspaceAccess(user);
  if ([USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) return listOwnCapacity(user);
  const visibleRows = listMarketCapacity(user).map(row => ({ ...row, isOwn: false }));
  if (!roleCanPublishCapacity(user.role) || user.role === USER_ROLES.ADMIN) return visibleRows;
  const ownRows = listOwnCapacity(user);
  const ownIds = new Set(ownRows.map(r => r.id));
  return [...ownRows,...visibleRows.filter(r => !ownIds.has(r.id))];
}

export function getCapacityForUser(user, capacityId) {
  assertWorkspaceAccess(user);
  if ([USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) {
    const own=listOwnCapacity(user,capacityId)[0];
    return own?attachCapacityPreferredRoutes(own):null;
  }
  const visible = capacityBoardRows(user,{capacityId},1)[0];
  if (visible) return attachCapacityPreferredRoutes(visible);
  if (roleCanPublishCapacity(user.role) && user.role !== USER_ROLES.ADMIN) {
    const own=listOwnCapacity(user,capacityId)[0];
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
  assertWorkspaceAccess(user);
  const db = getDb();
  if (isSelfManagedDriver(user)) return db.prepare('SELECT * FROM vehicles WHERE provider_profile_id=? AND active=1').all(user.provider_profile_id);
  if (isCompanyDriver(user)) return db.prepare(`SELECT v.* FROM vehicles v JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id
    WHERE a.driver_user_id=? AND a.active=1 AND v.organization_id=? AND v.active=1 ORDER BY v.label`).all(user.id,user.organization_id);
  if (user.role === USER_ROLES.TRANSPORTER) return db.prepare('SELECT * FROM vehicles WHERE organization_id=? AND active=1').all(user.organization_id);
  return [];
}

export function publishCapacity(user, input, photo = /** @type {null|{path:string,name:string,originalName:string,mimeType:string,size:number}} */ (null)) {
  assertWorkspaceAccess(user);
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
  if (vehicle.organization_id && input.status !== 'OFF_DUTY') {
    const assignedDriver=db.prepare(`SELECT 1 FROM driver_vehicle_assignments WHERE vehicle_id=? AND active=1`).get(vehicle.id);
    if(!assignedDriver)throw new Error('DRIVER_REQUIRED_FOR_CAPACITY');
  }
  const percent = validateCapacity(input.status,input.availablePercent);
  const acceptedLoads = validateAcceptedLoads(input.status,input.acceptedLoads);
  const movementScope=validateMovementScope(input.movementScope||MOVEMENT_SCOPES.INTERCITY,{allowBoth:true});
  if(movementScope===MOVEMENT_SCOPES.LOCAL&&input.status==='PARTIAL')throw new Error('LOCAL_CAPACITY_MUST_BE_EMPTY');
  const availableAgainDate=input.status==='BUSY'?String(input.availableAgainDate||'').trim():null;
  if(input.status==='BUSY'&&!availableAgainDate)throw new Error('BUSY_AVAILABLE_DATE_REQUIRED');
  if(availableAgainDate&&availableAgainDate<todayInEthiopia())throw new Error('INVALID_BUSY_AVAILABLE_DATE');
  const localPlace=input.status!=='OFF_DUTY'&&[MOVEMENT_SCOPES.LOCAL,MOVEMENT_SCOPES.BOTH].includes(movementScope)
    ? {...resolvePlaceReference(input.localPlaceRef,input.localPlaceLabel),radius_km:validateServiceRadius(input.localRadiusKm)}
    : null;
  const acceptsIntercity=movementScope!==MOVEMENT_SCOPES.LOCAL;
  const acceptsMultiPick=Boolean(input.acceptsMultiPick||input.acceptsMultiStop);
  const acceptsMultiDrop=Boolean(input.acceptsMultiDrop||input.acceptsMultiStop);
  if(acceptsIntercity&&input.status==='PARTIAL'&&(!input.currentRouteOrigin||!input.currentRouteDestination))throw new Error('ROUTE_ENDPOINTS_REQUIRED');
  if(acceptsIntercity&&Boolean(input.origin)!==Boolean(input.destination))throw new Error('ROUTE_ENDPOINTS_REQUIRED');
  const hasCurrentRoute=acceptsIntercity&&input.status==='PARTIAL'&&Boolean(input.currentRouteOrigin&&input.currentRouteDestination);
  const hasPlannedRoute=acceptsIntercity&&!['BUSY','OFF_DUTY'].includes(input.status)&&Boolean(input.origin&&input.destination);
  const currentOriginPlace=hasCurrentRoute?resolvePlaceReference(input.currentOriginPlaceRef,input.currentRouteOrigin):null;
  const currentDestinationPlace=hasCurrentRoute?resolvePlaceReference(input.currentDestinationPlaceRef,input.currentRouteDestination):null;
  const plannedOriginPlace=hasPlannedRoute?resolvePlaceReference(input.originPlaceRef,input.origin):null;
  const plannedDestinationPlace=hasPlannedRoute?resolvePlaceReference(input.destinationPlaceRef,input.destination):null;
  if(hasCurrentRoute&&currentOriginPlace.place_ref===currentDestinationPlace.place_ref)throw new Error('ROUTE_LOCATIONS_MUST_DIFFER');
  if(hasPlannedRoute&&plannedOriginPlace.place_ref===plannedDestinationPlace.place_ref)throw new Error('ROUTE_LOCATIONS_MUST_DIFFER');
  if(hasPlannedRoute&&!input.travelDate)throw new Error('PLANNED_ROUTE_DATE_REQUIRED');
  if(hasPlannedRoute&&input.travelDate<todayInEthiopia())throw new Error('INVALID_ROUTE_DATE');
  if(hasPlannedRoute&&!['FULL','PARTIAL'].includes(input.plannedSpaceStatus))throw new Error('PLANNED_SPACE_STATUS_REQUIRED');
  const visibility = input.visibility || 'OPEN';
  if (!['OPEN','SAVED_PARTNERS'].includes(visibility)) throw new Error('INVALID_CAPACITY_VISIBILITY');
  if (input.status !== 'OFF_DUTY' && !input.locationArea?.trim() && !localPlace) throw new Error('CAPACITY_AREA_REQUIRED');
  const hasDeviceArea = input.status !== 'OFF_DUTY' && input.locationSource === 'DEVICE_OBSCURED';
  if (user.role === USER_ROLES.TRANSPORTER && hasDeviceArea) throw new Error('DEVICE_LOCATION_DRIVER_ONLY');
  const locationLat = hasDeviceArea ? Number(input.approximateLat) : null;
  const locationLng = hasDeviceArea ? Number(input.approximateLng) : null;
  const locationPrecisionKm = hasDeviceArea ? Number(input.locationPrecisionKm) : null;
  if (hasDeviceArea && (!Number.isFinite(locationLat) || locationLat < -90 || locationLat > 90 || !Number.isFinite(locationLng) || locationLng < -180 || locationLng > 180 || locationPrecisionKm !== 40)) {
    throw new Error('INVALID_APPROXIMATE_LOCATION');
  }
  const manualLocationPlace=input.status!=='OFF_DUTY'&&acceptsIntercity&&!localPlace&&!hasDeviceArea
    ? resolvePlaceReference(input.locationPlaceRef,input.locationArea)
    : null;
  const expiresHours = Number(process.env.CAPACITY_EXPIRES_HOURS || 24);
  const timestamp = nowIso();
  const expiresAt = hoursFromNow(expiresHours);
  const id = randomId('cap-');
  const origin=plannedOriginPlace?.place_label||null;
  const destination=plannedDestinationPlace?.place_label||null;
  const currentRouteOrigin=currentOriginPlace?.place_label||null;
  const currentRouteDestination=currentDestinationPlace?.place_label||null;
  const legacyStatus=input.status==='BUSY'?'OFF_DUTY':input.status;
  const locationArea=input.status==='OFF_DUTY'?null:localPlace
    ? `Around ${localPlace.place_label}`
    : manualLocationPlace
      ? `Around ${manualLocationPlace.place_label}`
      : qualifyAreaLabel(input.locationArea);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE capacities SET expires_at=? WHERE vehicle_id=? AND expires_at>?`).run(timestamp,vehicle.id,timestamp);
    db.prepare(`INSERT INTO capacities
      (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,proof_recorded_at,current_route_origin,current_route_destination,current_route_date,planned_space_status,accepts_multi_pick,accepts_multi_drop,movement_scope,local_place_ref,local_place_label,local_center_lat,local_center_lng,local_radius_km,
       origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng,
      current_origin_place_ref,current_origin_lat,current_origin_lng,current_destination_place_ref,current_destination_lat,current_destination_lng,location_place_ref,
      market_status,available_again_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,scope.organizationId,scope.profileId,vehicle.id,legacyStatus,percent,origin,destination,origin&&destination?`${origin} → ${destination}`:null,hasPlannedRoute?input.travelDate:null,input.nextAvailable || null,visibility,photo?.path || null,user.id,timestamp,expiresAt,locationArea,input.status === 'OFF_DUTY' ? null : timestamp,
        hasDeviceArea?locationLat:manualLocationPlace?.center_lat??null,hasDeviceArea?locationLng:manualLocationPlace?.center_lng??null,hasDeviceArea?locationPrecisionKm:manualLocationPlace?40:null,
        input.status==='OFF_DUTY'?null:hasDeviceArea ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA',acceptedLoads.acceptsFullLoad ? 1 : 0,acceptedLoads.acceptsPartialLoad ? 1 : 0,input.openToContractLanes ? 1 : 0,(acceptsMultiPick||acceptsMultiDrop) ? 1 : 0,photo?.path ? timestamp : null,currentRouteOrigin,currentRouteDestination,null,hasPlannedRoute?input.plannedSpaceStatus:null,acceptsMultiPick?1:0,acceptsMultiDrop?1:0,movementScope,localPlace?.place_ref||null,localPlace?.place_label||null,localPlace?.center_lat??null,localPlace?.center_lng??null,localPlace?.radius_km??null,
        plannedOriginPlace?.place_ref||null,plannedOriginPlace?.center_lat??null,plannedOriginPlace?.center_lng??null,
        plannedDestinationPlace?.place_ref||null,plannedDestinationPlace?.center_lat??null,plannedDestinationPlace?.center_lng??null,
        currentOriginPlace?.place_ref||null,currentOriginPlace?.center_lat??null,currentOriginPlace?.center_lng??null,
        currentDestinationPlace?.place_ref||null,currentDestinationPlace?.center_lat??null,currentDestinationPlace?.center_lng??null,
        localPlace?.place_ref||manualLocationPlace?.place_ref||null,input.status,availableAgainDate);
    audit(db,user,'CAPACITY_PUBLISHED','capacity',id,{ status: input.status, percent, vehicleId: vehicle.id, movementScope, localPlaceRef:localPlace?.place_ref||null, localRadiusKm:localPlace?.radius_km||null, locationArea, locationSource: hasDeviceArea ? 'DEVICE_OBSCURED' : 'MANUAL_GENERAL_AREA', locationPrecisionKm, acceptedLoads: input.status === 'OFF_DUTY' ? null : input.acceptedLoads, currentRouteLive:hasCurrentRoute,plannedRouteDate:hasPlannedRoute?input.travelDate:null,plannedSpaceStatus:hasPlannedRoute?input.plannedSpaceStatus:null, openToContractLanes: Boolean(input.openToContractLanes), acceptsMultiPick, acceptsMultiDrop, proofRecorded: Boolean(photo?.path) });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export function setAssignedVehicleDuty(user, vehicleId, onDuty) {
  assertWorkspaceAccess(user);
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
      WHERE c.vehicle_id=? AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL') AND (?=0 OR u.role='TRANSPORTER')
      ORDER BY c.updated_at DESC LIMIT 1`).get(vehicleId,isCompanyDriver(user) ? 1 : 0)
    : db.prepare('SELECT * FROM capacities WHERE vehicle_id=? ORDER BY updated_at DESC LIMIT 1').get(vehicleId);
  if (onDuty && !source) throw new Error('CAPACITY_CONFIGURATION_REQUIRED');
  const timestamp = nowIso();
  const expiresAt = hoursFromNow(Number(process.env.CAPACITY_EXPIRES_HOURS || 24));
  const id = randomId('cap-');
  const status = onDuty ? (source.market_status||source.status) : 'OFF_DUTY';
  const legacyStatus=status==='BUSY'?'OFF_DUTY':status;
  const percent = onDuty ? source.available_percent : 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE capacities SET expires_at=? WHERE vehicle_id=? AND expires_at>?`).run(timestamp,vehicleId,timestamp);
    db.prepare(`INSERT INTO capacities
      (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,proof_recorded_at,current_route_origin,current_route_destination,current_route_date,planned_space_status,accepts_multi_pick,accepts_multi_drop,movement_scope,local_place_ref,local_place_label,local_center_lat,local_center_lng,local_radius_km,
       origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng,
      current_origin_place_ref,current_origin_lat,current_origin_lng,current_destination_place_ref,current_destination_lat,current_destination_lng,location_place_ref,
      market_status,available_again_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,scope.organizationId,scope.profileId,vehicleId,legacyStatus,percent,source?.origin || null,source?.destination || null,source?.corridor || null,source?.travel_date || null,source?.next_available || null,source?.visibility || 'OPEN',null,user.id,timestamp,expiresAt,onDuty ? source.location_area : null,onDuty ? timestamp : null,onDuty ? source.location_lat : null,onDuty ? source.location_lng : null,onDuty ? source.location_precision_km : null,onDuty ? source.location_source : null,onDuty ? source.accepts_full_load : 0,onDuty ? source.accepts_partial_load : 0,onDuty ? source.open_to_contract_lanes : 0,onDuty ? source.accepts_multi_stop : 0,null,onDuty?source.current_route_origin:null,onDuty?source.current_route_destination:null,null,onDuty?source.planned_space_status:null,onDuty?source.accepts_multi_pick:0,onDuty?source.accepts_multi_drop:0,onDuty?source.movement_scope||'INTERCITY':'INTERCITY',onDuty?source.local_place_ref:null,onDuty?source.local_place_label:null,onDuty?source.local_center_lat:null,onDuty?source.local_center_lng:null,onDuty?source.local_radius_km:null,
        onDuty?source.origin_place_ref:null,onDuty?source.origin_lat:null,onDuty?source.origin_lng:null,
        onDuty?source.destination_place_ref:null,onDuty?source.destination_lat:null,onDuty?source.destination_lng:null,
        onDuty?source.current_origin_place_ref:null,onDuty?source.current_origin_lat:null,onDuty?source.current_origin_lng:null,
        onDuty?source.current_destination_place_ref:null,onDuty?source.current_destination_lat:null,onDuty?source.current_destination_lng:null,
        onDuty?source.location_place_ref:null,status,onDuty?source.available_again_date:null);
    audit(db,user,onDuty ? 'VEHICLE_SET_ON_DUTY' : 'VEHICLE_SET_OFF_DUTY','vehicle',vehicleId,{restoredCapacityId:onDuty ? source.id : null});
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export function listFleetDrivers(user) {
  assertWorkspaceAccess(user);
  if (user.role !== USER_ROLES.TRANSPORTER || !user.organization_id) throw new Error('FORBIDDEN');
  const db = getDb();
  return db.prepare(`SELECT u.id,u.name,u.email,d.phone,d.license_verified,
    COALESCE(p.can_browse_load_board,1) AS can_browse_load_board,
    COALESCE(p.can_contact_businesses,1) AS can_contact_businesses,
    COALESCE(p.can_negotiate_loads,1) AS can_negotiate_loads,
    COALESCE(p.can_manage_capacity,1) AS can_manage_capacity,
    MAX(a.vehicle_id) AS assigned_vehicle_id,
    GROUP_CONCAT(v.make || ' ' || v.model || ' · ' || COALESCE(v.plate,''),'; ') AS assigned_vehicles
    FROM users u JOIN drivers d ON d.user_id=u.id AND d.active=1
    LEFT JOIN driver_permissions p ON p.user_id=u.id
    LEFT JOIN driver_vehicle_assignments a ON a.driver_user_id=u.id AND a.active=1
    LEFT JOIN vehicles v ON v.id=a.vehicle_id AND v.active=1
    WHERE u.role='DRIVER' AND u.organization_id=? AND u.active=1
    GROUP BY u.id ORDER BY u.name`).all(user.organization_id);
}

export function updateFleetDriverPermissions(user, driverUserId, input) {
  assertWorkspaceAccess(user);
  const platformManager=hasPlatformPermission(user,PLATFORM_PERMISSIONS.OPERATIONS);
  if (!platformManager&&(user.role !== USER_ROLES.TRANSPORTER || !user.organization_id)) throw new Error('FORBIDDEN');
  const db = getDb();
  const driver = platformManager
    ? db.prepare(`SELECT u.id FROM users u JOIN drivers d ON d.user_id=u.id
      WHERE u.id=? AND u.role='DRIVER' AND u.organization_id IS NOT NULL AND u.active=1 AND d.active=1`).get(driverUserId)
    : db.prepare(`SELECT u.id FROM users u JOIN drivers d ON d.user_id=u.id
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

export function assignFleetDriverVehicle(user, driverUserId, vehicleId) {
  assertWorkspaceAccess(user);
  if (user.role !== USER_ROLES.TRANSPORTER || !user.organization_id) throw new Error('FORBIDDEN');
  const db=getDb();
  const driver=db.prepare(`SELECT u.id FROM users u JOIN drivers d ON d.user_id=u.id
    WHERE u.id=? AND u.role='DRIVER' AND u.organization_id=? AND u.active=1 AND d.active=1`)
    .get(driverUserId,user.organization_id);
  if(!driver)throw new Error('NOT_FOUND');
  const selectedVehicleId=String(vehicleId||'').trim();
  const vehicle=selectedVehicleId?db.prepare(`SELECT id FROM vehicles
    WHERE id=? AND organization_id=? AND active=1`).get(selectedVehicleId,user.organization_id):null;
  if(selectedVehicleId&&!vehicle)throw new Error('NOT_FOUND');
  const previous=db.prepare(`SELECT driver_user_id,vehicle_id FROM driver_vehicle_assignments
    WHERE active=1 AND (driver_user_id=? OR vehicle_id=?)`).all(driver.id,selectedVehicleId||'__none__');
  const assignedAt=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE driver_vehicle_assignments SET active=0
      WHERE active=1 AND (driver_user_id=? OR vehicle_id=?)`).run(driver.id,selectedVehicleId||'__none__');
    if(selectedVehicleId){
      db.prepare(`INSERT INTO driver_vehicle_assignments
        (id,driver_user_id,vehicle_id,assigned_by,assigned_at,active) VALUES (?,?,?,?,?,1)
        ON CONFLICT(driver_user_id,vehicle_id) DO UPDATE SET
          assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at,active=1`)
        .run(randomId('driver-vehicle-'),driver.id,selectedVehicleId,user.id,assignedAt);
    }
    audit(db,user,'DRIVER_VEHICLE_ASSIGNED','user',driver.id,{
      vehicleId:selectedVehicleId||null,
      displaced:previous.filter(item=>item.driver_user_id!==driver.id||item.vehicle_id!==selectedVehicleId)
    });
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const SUPPORT_MEMBER_ROLES=new Set([
  USER_ROLES.SHIPPER,
  USER_ROLES.RECEIVER,
  USER_ROLES.TRANSPORTER,
  USER_ROLES.DRIVER
]);

function supportEvent(db,conversationId,actorUserId,eventType,details={}) {
  db.prepare(`INSERT INTO support_events
    (id,conversation_id,actor_user_id,event_type,details,created_at) VALUES (?,?,?,?,?,?)`)
    .run(randomId('support-event-'),conversationId,actorUserId||null,eventType,JSON.stringify(details),nowIso());
}

function supportConversationBase() {
  return `SELECT c.id,c.customer_user_id,c.assigned_agent_user_id,c.category,c.status,c.created_at,c.updated_at,
      c.last_message_at,c.assigned_at,c.customer_last_read_at,c.agent_last_read_at,c.closed_at,
      customer.name AS customer_name,customer.role AS customer_role,
      COALESCE(customer_org.name,customer_profile.business_name,'Individual account') AS customer_workspace_name,
      agent.name AS assigned_agent_name,
      (SELECT SUBSTR(message.body,1,120) FROM support_messages message
        WHERE message.conversation_id=c.id ORDER BY message.created_at DESC,message.id DESC LIMIT 1) AS last_message_preview,
      (SELECT COUNT(*) FROM support_messages message WHERE message.conversation_id=c.id) AS message_count
    FROM support_conversations c
    JOIN users customer ON customer.id=c.customer_user_id
    LEFT JOIN organizations customer_org ON customer_org.id=customer.organization_id
    LEFT JOIN provider_profiles customer_profile ON customer_profile.id=customer.provider_profile_id
    LEFT JOIN users agent ON agent.id=c.assigned_agent_user_id`;
}

function assignSupportConversation(db,conversationId) {
  const agent=db.prepare(`SELECT profile.user_id,profile.max_open_conversations,
      COUNT(open_conversation.id) AS open_count
    FROM support_agent_profiles profile
    JOIN users user ON user.id=profile.user_id AND user.role='SUPPORT' AND user.active=1
    LEFT JOIN support_conversations open_conversation
      ON open_conversation.assigned_agent_user_id=profile.user_id AND open_conversation.status='OPEN'
    WHERE profile.active=1 AND profile.available=1 AND profile.can_manage_support=1
    GROUP BY profile.user_id,profile.max_open_conversations,profile.last_assigned_at
    HAVING COUNT(open_conversation.id)<profile.max_open_conversations
    ORDER BY open_count ASC,
      CASE WHEN profile.last_assigned_at IS NULL THEN 0 ELSE 1 END,
      profile.last_assigned_at ASC,profile.user_id ASC
    LIMIT 1`).get();
  if(!agent)return null;
  const timestamp=nowIso();
  const updated=db.prepare(`UPDATE support_conversations
    SET assigned_agent_user_id=?,status='OPEN',assigned_at=?,updated_at=?
    WHERE id=? AND status='WAITING' AND assigned_agent_user_id IS NULL`)
    .run(agent.user_id,timestamp,timestamp,conversationId);
  if(!updated.changes)return null;
  db.prepare('UPDATE support_agent_profiles SET last_assigned_at=?,updated_at=? WHERE user_id=?')
    .run(timestamp,timestamp,agent.user_id);
  supportEvent(db,conversationId,null,'ASSIGNED',{agentUserId:agent.user_id});
  notify(db,agent.user_id,'Support conversation assigned','A customer conversation is ready in your support inbox.');
  return agent.user_id;
}

function assignWaitingSupportConversations(db,limit=100) {
  let assigned=0;
  const waiting=db.prepare(`SELECT id FROM support_conversations
    WHERE status='WAITING' AND assigned_agent_user_id IS NULL
    ORDER BY created_at,id LIMIT ?`).all(Math.max(1,Math.min(Number(limit)||100,100)));
  for(const conversation of waiting) {
    if(!assignSupportConversation(db,conversation.id))break;
    assigned+=1;
  }
  return assigned;
}

function supportAgentRecord(db,userId) {
  return db.prepare(`SELECT profile.*,user.name,user.email,user.active AS user_active,
      (SELECT COUNT(*) FROM support_conversations conversation
        WHERE conversation.assigned_agent_user_id=profile.user_id AND conversation.status='OPEN') AS open_count
    FROM support_agent_profiles profile
    JOIN users user ON user.id=profile.user_id AND user.role='SUPPORT'
    WHERE profile.user_id=?`).get(userId);
}

function assertSupportMessageRate(db,userId) {
  const cutoff=new Date(Date.now()-60_000).toISOString();
  const count=db.prepare(`SELECT COUNT(*) AS n FROM support_messages
    WHERE sender_user_id=? AND created_at>=?`).get(userId,cutoff).n;
  if(count>=20)throw new Error('SUPPORT_MESSAGE_RATE_LIMITED');
}

export function createSupportConversation(user,input) {
  if(!SUPPORT_MEMBER_ROLES.has(user?.role))throw new Error('FORBIDDEN');
  const category=validateSupportCategory(input.category);
  const body=validateSupportMessage(input.body);
  const db=getDb();
  const timestamp=nowIso();
  const id=randomId('support-');
  db.exec('BEGIN IMMEDIATE');
  try {
    if(db.prepare(`SELECT 1 FROM support_conversations
      WHERE customer_user_id=? AND status IN ('WAITING','OPEN')`).get(user.id)) {
      throw new Error('SUPPORT_CONVERSATION_ALREADY_OPEN');
    }
    assertSupportMessageRate(db,user.id);
    db.prepare(`INSERT INTO support_conversations
      (id,customer_user_id,category,status,created_at,updated_at,last_message_at,customer_last_read_at)
      VALUES (?,?,?,'WAITING',?,?,?,?)`)
      .run(id,user.id,category,timestamp,timestamp,timestamp,timestamp);
    db.prepare(`INSERT INTO support_messages
      (id,conversation_id,sender_user_id,body,created_at) VALUES (?,?,?,?,?)`)
      .run(randomId('support-message-'),id,user.id,body,timestamp);
    supportEvent(db,id,user.id,'CREATED',{category});
    const assignedAgentId=assignSupportConversation(db,id);
    audit(db,user,'SUPPORT_CONVERSATION_CREATED','support_conversation',id,{category,assigned:Boolean(assignedAgentId)});
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export function listMemberSupportConversations(user,options={}) {
  if(!SUPPORT_MEMBER_ROLES.has(user?.role))throw new Error('FORBIDDEN');
  const db=getDb();
  const status=String(options.status||'ALL').toUpperCase();
  if(!['ALL','CLOSED'].includes(status))throw new Error('INVALID_SUPPORT_VIEW');
  const statusClause=status==='CLOSED'?` AND c.status='CLOSED'`:'';
  return paginateQuery(db,`${supportConversationBase()} WHERE c.customer_user_id=?${statusClause}`,[user.id],'updated_at DESC,id',options);
}

export function getOpenMemberSupportConversation(user) {
  if(!SUPPORT_MEMBER_ROLES.has(user?.role))throw new Error('FORBIDDEN');
  return getDb().prepare(`${supportConversationBase()}
    WHERE c.customer_user_id=? AND c.status IN ('WAITING','OPEN')
    ORDER BY c.updated_at DESC,c.id LIMIT 1`).get(user.id)||null;
}

export function listSupportInbox(user,view='ASSIGNED',options={}) {
  if(![USER_ROLES.SUPPORT,USER_ROLES.ADMIN].includes(user?.role))throw new Error('FORBIDDEN');
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.SUPPORT);
  const normalized=String(view||'ASSIGNED').toUpperCase();
  if(!['ASSIGNED','WAITING','CLOSED','ALL'].includes(normalized))throw new Error('INVALID_SUPPORT_VIEW');
  const db=getDb();
  const args=[];
  let where='1=1';
  if(user.role===USER_ROLES.SUPPORT){
    if(normalized==='WAITING')where=`c.status='WAITING' AND c.assigned_agent_user_id IS NULL`;
    else if(normalized==='CLOSED'){where=`c.status='CLOSED' AND c.assigned_agent_user_id=?`;args.push(user.id);}
    else {where=`c.status='OPEN' AND c.assigned_agent_user_id=?`;args.push(user.id);}
  }else if(normalized==='WAITING')where=`c.status='WAITING'`;
  else if(normalized==='ASSIGNED')where=`c.status='OPEN'`;
  else if(normalized==='CLOSED')where=`c.status='CLOSED'`;
  const orderBy=normalized==='WAITING'
    ? 'created_at ASC,id'
    : `CASE status WHEN 'WAITING' THEN 0 WHEN 'OPEN' THEN 1 ELSE 2 END,last_message_at DESC,id`;
  const result=paginateQuery(db,`${supportConversationBase()} WHERE ${where}`,args,orderBy,options);
  const agent=user.role===USER_ROLES.SUPPORT?supportAgentRecord(db,user.id):null;
  const counts=user.role===USER_ROLES.SUPPORT
    ? {
        assigned:db.prepare(`SELECT COUNT(*) AS n FROM support_conversations WHERE assigned_agent_user_id=? AND status='OPEN'`).get(user.id).n,
        waiting:db.prepare(`SELECT COUNT(*) AS n FROM support_conversations WHERE status='WAITING'`).get().n,
        closed:db.prepare(`SELECT COUNT(*) AS n FROM support_conversations WHERE assigned_agent_user_id=? AND status='CLOSED'`).get(user.id).n
      }
    : {
        assigned:db.prepare(`SELECT COUNT(*) AS n FROM support_conversations WHERE status='OPEN'`).get().n,
        waiting:db.prepare(`SELECT COUNT(*) AS n FROM support_conversations WHERE status='WAITING'`).get().n,
        closed:db.prepare(`SELECT COUNT(*) AS n FROM support_conversations WHERE status='CLOSED'`).get().n
      };
  return {...result,view:normalized,agent,counts};
}

export function getSupportConversation(user,conversationId,{messageLimit=50,markRead=true}={}) {
  if(!user)throw new Error('FORBIDDEN');
  if(user.role===USER_ROLES.SUPPORT)assertPlatformPermission(user,PLATFORM_PERMISSIONS.SUPPORT);
  const db=getDb();
  const conversation=db.prepare(`${supportConversationBase()} WHERE c.id=?`).get(conversationId);
  if(!conversation)throw new Error('NOT_FOUND');
  const customerOwns=SUPPORT_MEMBER_ROLES.has(user.role)&&conversation.customer_user_id===user.id;
  const agentOwns=user.role===USER_ROLES.SUPPORT&&conversation.assigned_agent_user_id===user.id;
  if(!customerOwns&&!agentOwns&&user.role!==USER_ROLES.ADMIN)throw new Error('NOT_FOUND');
  const boundedLimit=Math.max(1,Math.min(Number(messageLimit)||50,50));
  conversation.messages=db.prepare(`SELECT * FROM (
      SELECT message.id,message.conversation_id,message.sender_user_id,message.body,message.created_at,
        sender.name AS sender_name,sender.role AS sender_role
      FROM support_messages message JOIN users sender ON sender.id=message.sender_user_id
      WHERE message.conversation_id=?
      ORDER BY message.created_at DESC,message.id DESC LIMIT ?
    ) ORDER BY created_at,id`).all(conversation.id,boundedLimit);
  conversation.events=user.role===USER_ROLES.ADMIN
    ? db.prepare(`SELECT event_type,created_at FROM support_events WHERE conversation_id=? ORDER BY created_at,id LIMIT 100`).all(conversation.id)
    : [];
  if(markRead){
    const column=customerOwns?'customer_last_read_at':'agent_last_read_at';
    db.prepare(`UPDATE support_conversations SET ${column}=? WHERE id=?`).run(nowIso(),conversation.id);
  }
  return conversation;
}

export function sendSupportMessage(user,conversationId,body) {
  if(user?.role===USER_ROLES.SUPPORT)assertPlatformPermission(user,PLATFORM_PERMISSIONS.SUPPORT);
  const cleanBody=validateSupportMessage(body);
  const db=getDb();
  const conversation=db.prepare('SELECT * FROM support_conversations WHERE id=?').get(conversationId);
  if(!conversation)throw new Error('NOT_FOUND');
  const customerOwns=SUPPORT_MEMBER_ROLES.has(user?.role)&&conversation.customer_user_id===user.id;
  const agentOwns=user?.role===USER_ROLES.SUPPORT&&conversation.assigned_agent_user_id===user.id;
  if(!customerOwns&&!agentOwns&&user?.role!==USER_ROLES.ADMIN)throw new Error('NOT_FOUND');
  if(conversation.status==='CLOSED')throw new Error('SUPPORT_CONVERSATION_CLOSED');
  if(user.role===USER_ROLES.SUPPORT&&conversation.status!=='OPEN')throw new Error('NOT_FOUND');
  const timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    assertSupportMessageRate(db,user.id);
    db.prepare(`INSERT INTO support_messages
      (id,conversation_id,sender_user_id,body,created_at) VALUES (?,?,?,?,?)`)
      .run(randomId('support-message-'),conversation.id,user.id,cleanBody,timestamp);
    db.prepare(`UPDATE support_conversations SET updated_at=?,last_message_at=?,
      customer_last_read_at=CASE WHEN customer_user_id=? THEN ? ELSE customer_last_read_at END,
      agent_last_read_at=CASE WHEN assigned_agent_user_id=? THEN ? ELSE agent_last_read_at END
      WHERE id=?`).run(timestamp,timestamp,user.id,timestamp,user.id,timestamp,conversation.id);
    supportEvent(db,conversation.id,user.id,'MESSAGE_SENT',{senderRole:user.role});
    const recipientId=customerOwns?conversation.assigned_agent_user_id:conversation.customer_user_id;
    if(recipientId)notify(db,recipientId,'New support message','Open Loadgistic Support to read the reply.');
    audit(db,user,'SUPPORT_MESSAGE_SENT','support_conversation',conversation.id,{});
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function claimSupportConversation(user,conversationId) {
  if(user?.role!==USER_ROLES.SUPPORT)throw new Error('FORBIDDEN');
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.SUPPORT);
  const db=getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const agent=supportAgentRecord(db,user.id);
    if(!agent||!agent.user_active||!agent.active||!agent.available)throw new Error('SUPPORT_AGENT_UNAVAILABLE');
    if(agent.open_count>=agent.max_open_conversations)throw new Error('SUPPORT_AGENT_AT_CAPACITY');
    const conversation=db.prepare(`SELECT id FROM support_conversations
      WHERE status='WAITING' AND assigned_agent_user_id IS NULL
      ORDER BY created_at,id LIMIT 1`).get();
    if(!conversation||conversation.id!==conversationId)throw new Error('SUPPORT_CONVERSATION_NOT_WAITING');
    const timestamp=nowIso();
    const updated=db.prepare(`UPDATE support_conversations
      SET status='OPEN',assigned_agent_user_id=?,assigned_at=?,updated_at=?
      WHERE id=? AND status='WAITING' AND assigned_agent_user_id IS NULL`)
      .run(user.id,timestamp,timestamp,conversation.id);
    if(!updated.changes)throw new Error('SUPPORT_CONVERSATION_NOT_WAITING');
    db.prepare('UPDATE support_agent_profiles SET last_assigned_at=?,updated_at=? WHERE user_id=?')
      .run(timestamp,timestamp,user.id);
    supportEvent(db,conversation.id,user.id,'CLAIMED',{});
    audit(db,user,'SUPPORT_CONVERSATION_CLAIMED','support_conversation',conversation.id,{});
    notify(db,db.prepare('SELECT customer_user_id FROM support_conversations WHERE id=?').get(conversation.id).customer_user_id,
      'Support agent assigned','A Loadgistic support agent is ready to help.');
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function closeSupportConversation(user,conversationId) {
  if(!user)throw new Error('FORBIDDEN');
  if(user.role===USER_ROLES.SUPPORT)assertPlatformPermission(user,PLATFORM_PERMISSIONS.SUPPORT);
  const db=getDb();
  const conversation=db.prepare('SELECT * FROM support_conversations WHERE id=?').get(conversationId);
  const customerOwns=SUPPORT_MEMBER_ROLES.has(user.role)&&conversation?.customer_user_id===user.id;
  const agentOwns=user.role===USER_ROLES.SUPPORT&&conversation?.assigned_agent_user_id===user.id;
  if(!conversation||(!customerOwns&&!agentOwns&&user.role!==USER_ROLES.ADMIN))throw new Error('NOT_FOUND');
  if(conversation.status==='CLOSED')throw new Error('SUPPORT_CONVERSATION_CLOSED');
  const timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE support_conversations SET status='CLOSED',closed_at=?,closed_by=?,updated_at=? WHERE id=?`)
      .run(timestamp,user.id,timestamp,conversation.id);
    supportEvent(db,conversation.id,user.id,'CLOSED',{});
    audit(db,user,'SUPPORT_CONVERSATION_CLOSED','support_conversation',conversation.id,{});
    if(customerOwns&&conversation.assigned_agent_user_id){
      notify(db,conversation.assigned_agent_user_id,'Customer ended support chat','The conversation is closed and one queue slot is available.');
    }else{
      notify(db,conversation.customer_user_id,'Support conversation closed','You can start a new support conversation whenever you need help.');
    }
    assignWaitingSupportConversations(db,1);
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function updateSupportAvailability(user,available) {
  if(user?.role!==USER_ROLES.SUPPORT)throw new Error('FORBIDDEN');
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.SUPPORT);
  const db=getDb();
  const profile=supportAgentRecord(db,user.id);
  if(!profile||!profile.active||!profile.user_active)throw new Error('SUPPORT_AGENT_UNAVAILABLE');
  const timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE support_agent_profiles SET available=?,updated_at=? WHERE user_id=?')
      .run(available?1:0,timestamp,user.id);
    audit(db,user,'SUPPORT_AGENT_AVAILABILITY_CHANGED','support_agent',user.id,{available:Boolean(available)});
    if(available)assignWaitingSupportConversations(db,profile.max_open_conversations-profile.open_count);
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listSupportAgents(user,options={}) {
  if(user?.role!==USER_ROLES.ADMIN)throw new Error('FORBIDDEN');
  return paginateQuery(getDb(),`SELECT profile.user_id,profile.active,profile.available,profile.max_open_conversations,
      profile.can_manage_customers,profile.can_manage_operations,profile.can_manage_trust,
      profile.can_manage_billing,profile.can_manage_support,
      profile.last_assigned_at,profile.created_at,profile.updated_at,
      account.name,account.email,account.active AS user_active,
      (SELECT COUNT(*) FROM support_conversations conversation
        WHERE conversation.assigned_agent_user_id=profile.user_id AND conversation.status='OPEN') AS open_count,
      (SELECT COUNT(*) FROM support_conversations conversation
        WHERE conversation.assigned_agent_user_id=profile.user_id AND conversation.status='CLOSED') AS closed_count
    FROM support_agent_profiles profile JOIN users account ON account.id=profile.user_id
    WHERE account.role='SUPPORT'`,[],'user_active DESC,active DESC,name,user_id',options);
}

export function createSupportAgent(user,input) {
  if(user?.role!==USER_ROLES.ADMIN)throw new Error('FORBIDDEN');
  const name=String(input.name||'').trim();
  const email=String(input.email||'').trim().toLowerCase();
  const password=String(input.password||'');
  const maxOpen=validateSupportAgentLimit(input.maxOpenConversations);
  if(!name||!email||!password)throw new Error('MISSING_REQUIRED_FIELDS');
  if(password.length<10)throw new Error('PASSWORD_TOO_SHORT');
  if(findUserByEmail(email))throw new Error('EMAIL_ALREADY_EXISTS');
  const db=getDb();
  const id=randomId('support-user-');
  const timestamp=nowIso();
  const permissions={
    customers:Boolean(input.canManageCustomers),operations:Boolean(input.canManageOperations),
    trust:Boolean(input.canManageTrust),billing:Boolean(input.canManageBilling),support:Boolean(input.canManageSupport??true)
  };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO users
      (id,email,password_hash,name,role,active,created_at) VALUES (?,?,?,?, 'SUPPORT',1,?)`)
      .run(id,email,hashPassword(password),name,timestamp);
    db.prepare(`INSERT INTO support_agent_profiles
      (user_id,active,available,max_open_conversations,can_manage_customers,can_manage_operations,
       can_manage_trust,can_manage_billing,can_manage_support,created_at,updated_at)
      VALUES (?,1,?,?,?,?,?,?,?,?,?)`).run(id,permissions.support?1:0,maxOpen,permissions.customers?1:0,
        permissions.operations?1:0,permissions.trust?1:0,permissions.billing?1:0,permissions.support?1:0,timestamp,timestamp);
    audit(db,user,'SUPPORT_AGENT_CREATED','support_agent',id,{maxOpenConversations:maxOpen,permissions});
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export function updateSupportAgent(user,agentUserId,input) {
  if(user?.role!==USER_ROLES.ADMIN)throw new Error('FORBIDDEN');
  const db=getDb();
  const agent=supportAgentRecord(db,agentUserId);
  if(!agent)throw new Error('NOT_FOUND');
  const maxOpen=validateSupportAgentLimit(input.maxOpenConversations);
  const active=Boolean(input.active);
  const permissions={
    customers:Boolean(input.canManageCustomers??agent.can_manage_customers),operations:Boolean(input.canManageOperations??agent.can_manage_operations),
    trust:Boolean(input.canManageTrust??agent.can_manage_trust),billing:Boolean(input.canManageBilling??agent.can_manage_billing),
    support:Boolean(input.canManageSupport??agent.can_manage_support)
  };
  const available=active&&permissions.support&&Boolean(input.available);
  const timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE support_agent_profiles SET active=?,available=?,max_open_conversations=?,
      can_manage_customers=?,can_manage_operations=?,can_manage_trust=?,can_manage_billing=?,can_manage_support=?,updated_at=?
      WHERE user_id=?`).run(active?1:0,available?1:0,maxOpen,permissions.customers?1:0,permissions.operations?1:0,
        permissions.trust?1:0,permissions.billing?1:0,permissions.support?1:0,timestamp,agent.user_id);
    db.prepare('UPDATE users SET active=? WHERE id=?').run(active?1:0,agent.user_id);
    if(!active||!permissions.support){
      const open=db.prepare(`SELECT id FROM support_conversations
        WHERE assigned_agent_user_id=? AND status='OPEN'`).all(agent.user_id);
      db.prepare(`UPDATE support_conversations SET status='WAITING',assigned_agent_user_id=NULL,
        assigned_at=NULL,agent_last_read_at=NULL,updated_at=? WHERE assigned_agent_user_id=? AND status='OPEN'`)
        .run(timestamp,agent.user_id);
      for(const conversation of open)supportEvent(db,conversation.id,user.id,'REQUEUED',{disabledAgentUserId:agent.user_id});
    }
    audit(db,user,'SUPPORT_AGENT_UPDATED','support_agent',agent.user_id,{active,available,maxOpenConversations:maxOpen,permissions});
    assignWaitingSupportConversations(db);
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function provisionApplicationWorkspace(db, application, timestamp, sponsoredFree = false) {
  if (application.organization_id || application.provider_profile_id) {
    return {organizationId:application.organization_id||null,providerProfileId:application.provider_profile_id||null};
  }
  const handle = `${slugify(application.business_name)}-${Math.random().toString(16).slice(2,6)}`;
  const trialEndsAt = accessPeriodEnd(timestamp,TRIAL_DAYS);
  if (application.application_type === 'INDEPENDENT_PROVIDER') {
    const providerId = randomId('provider-');
    db.prepare(`INSERT INTO provider_profiles (id,user_id,business_name,handle,verified_identity,verified_license,vehicle_documents_verified,vehicle_type,corridors,phone,city,about,public_visibility,created_at) VALUES (?,?,?,?,0,0,0,NULL,NULL,NULL,NULL,?,'PUBLIC',?)`)
      .run(providerId,application.user_id,application.business_name,handle,'Complete your profile and submit documents to earn trust badges.',timestamp);
    db.prepare(`INSERT INTO company_pages (id,organization_id,provider_profile_id,headline,about,services,corridors,operating_regions,contact_phone,contact_email,published,updated_at) VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?)`)
      .run(randomId('page-'),providerId,'Self-managed freight provider','Complete this Public Profile Info before publishing.','','','','','',0,timestamp);
    db.prepare('UPDATE users SET provider_profile_id=?,active=1 WHERE id=?').run(providerId,application.user_id);
    db.prepare(`INSERT INTO subscriptions
      (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at,updated_at)
      VALUES (?,NULL,?,'plan-solo','TRIAL','FLAT_MONTHLY',?,?,?)`)
      .run(randomId('sub-'),providerId,timestamp,trialEndsAt,timestamp);
    return {organizationId:null,providerProfileId:providerId,trialEndsAt};
  }
  const orgId = randomId('org-');
  db.prepare(`INSERT INTO organizations (id,name,handle,type,verified,industry,description,phone,email,city,public_visibility,created_at) VALUES (?,?,?,?,0,NULL,?,NULL,NULL,NULL,'PUBLIC',?)`)
    .run(orgId,application.business_name,handle,application.application_type,'Complete your profile and submit documents to earn trust badges.',timestamp);
  db.prepare(`INSERT INTO memberships (id,user_id,organization_id,membership_role) VALUES (?,?,?,'OWNER')`).run(randomId('mem-'),application.user_id,orgId);
  db.prepare(`INSERT INTO company_pages (id,organization_id,provider_profile_id,headline,about,services,corridors,operating_regions,contact_phone,contact_email,published,updated_at) VALUES (?,?,NULL,?,?,?,?,?,?,?,0,?)`)
    .run(randomId('page-'),orgId,'Business logistics profile','Complete this Public Profile Info before publishing.','','','','','',timestamp);
  db.prepare('UPDATE users SET organization_id=?,active=1 WHERE id=?').run(orgId,application.user_id);
  const planId = application.application_type === 'TRANSPORT_COMPANY' ? 'plan-transport' : 'plan-business';
  const subscriptionStatus = sponsoredFree ? 'SPONSORED' : 'TRIAL';
  const billingModel = sponsoredFree ? 'SPONSORED_FREE' : 'FLAT_MONTHLY';
  db.prepare(`INSERT INTO subscriptions
    (id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at,updated_at)
    VALUES (?,?,NULL,?,?,?,?,?,?)`)
    .run(randomId('sub-'),orgId,planId,subscriptionStatus,billingModel,timestamp,sponsoredFree ? null : trialEndsAt,timestamp);
  return {organizationId:orgId,providerProfileId:null,trialEndsAt:sponsoredFree?null:trialEndsAt};
}

export function getAdminOperations(user, query = '', options = {}) {
  const db=getDb();
  const view=String(options.view||'WORKSPACES').toUpperCase();
  if(!['USERS','WORKSPACES','TRUCKS','DRIVERS','LOADS','CAPACITY','NETWORK','ROUTES','SUBSCRIPTIONS'].includes(view))throw new Error('INVALID_ADMIN_OPERATIONS_VIEW');
  const viewPermission=['USERS','WORKSPACES'].includes(view)?PLATFORM_PERMISSIONS.CUSTOMERS
    : view==='SUBSCRIPTIONS'?PLATFORM_PERMISSIONS.BILLING:PLATFORM_PERMISSIONS.OPERATIONS;
  assertPlatformPermission(user,viewPermission);
  const term=String(query||'').trim().toLowerCase().slice(0,80);
  const pattern=`%${term}%`;
  const matches=(expression)=>`(?='' OR lower(${expression}) LIKE ?)`;
  const searchArgs=[term,pattern];
  const userBase=`SELECT u.id,u.name,u.email,u.phone,u.role,u.active,u.created_at,
      COALESCE(o.name,p.business_name,'Loadgistic') AS workspace_name
    FROM users u
    LEFT JOIN organizations o ON o.id=u.organization_id
    LEFT JOIN provider_profiles p ON p.id=u.provider_profile_id
    WHERE ${matches("u.name || ' ' || u.email || ' ' || u.role || ' ' || COALESCE(o.name,'') || ' ' || COALESCE(p.business_name,'')")}`;
  const organizationBase=`SELECT o.id,'ORGANIZATION' AS record_kind,o.name,o.type,o.city,o.public_visibility,
      (SELECT COUNT(*) FROM users u WHERE u.organization_id=o.id) AS user_count,
      (SELECT COUNT(*) FROM vehicles v WHERE v.organization_id=o.id AND v.active=1) AS truck_count,
      (SELECT COUNT(*) FROM shipments s WHERE COALESCE(s.load_owner_organization_id,s.shipper_organization_id)=o.id OR s.provider_organization_id=o.id) AS load_count,
      (SELECT status FROM subscriptions sub WHERE sub.organization_id=o.id ORDER BY sub.updated_at DESC LIMIT 1) AS subscription_status
    FROM organizations o
    WHERE ${matches("o.name || ' ' || o.type")}`;
  const providerBase=`SELECT p.id,'PROVIDER_PROFILE' AS record_kind,p.business_name AS name,'SELF_MANAGED_DRIVER' AS type,p.city,p.public_visibility,
      (SELECT COUNT(*) FROM users u WHERE u.provider_profile_id=p.id) AS user_count,
      (SELECT COUNT(*) FROM vehicles v WHERE v.provider_profile_id=p.id AND v.active=1) AS truck_count,
      (SELECT COUNT(*) FROM shipments s WHERE s.provider_profile_id=p.id) AS load_count,
      (SELECT status FROM subscriptions sub WHERE sub.provider_profile_id=p.id ORDER BY sub.updated_at DESC LIMIT 1) AS subscription_status
    FROM provider_profiles p
    WHERE ${matches("p.business_name")}`;
  const vehicleBase=`SELECT v.id,v.platform_number,v.make,v.model,v.cargo_configuration,v.plate,v.active,
      COALESCE(o.name,p.business_name) AS owner_name,
      c.id AS capacity_id,COALESCE(c.market_status,c.status) AS capacity_status,c.location_area,c.updated_at AS capacity_updated_at,c.available_again_date
    FROM vehicles v
    LEFT JOIN organizations o ON o.id=v.organization_id
    LEFT JOIN provider_profiles p ON p.id=v.provider_profile_id
    LEFT JOIN capacities c ON c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC LIMIT 1)
    WHERE ${matches("COALESCE(v.platform_number,'') || ' ' || COALESCE(v.make,'') || ' ' || COALESCE(v.model,'') || ' ' || COALESCE(v.cargo_configuration,'') || ' ' || COALESCE(v.plate,'') || ' ' || COALESCE(o.name,'') || ' ' || COALESCE(p.business_name,'')")}`;
  const driverBase=`SELECT u.id,u.name,u.email,u.active,o.name AS owner_name,v.platform_number,
      COALESCE(dp.can_browse_load_board,1) AS can_browse_load_board,
      COALESCE(dp.can_contact_businesses,1) AS can_contact_businesses,
      COALESCE(dp.can_negotiate_loads,1) AS can_negotiate_loads,
      COALESCE(dp.can_manage_capacity,1) AS can_manage_capacity
    FROM users u JOIN organizations o ON o.id=u.organization_id
    LEFT JOIN driver_permissions dp ON dp.user_id=u.id
    LEFT JOIN driver_vehicle_assignments assignment ON assignment.driver_user_id=u.id AND assignment.active=1
    LEFT JOIN vehicles v ON v.id=assignment.vehicle_id
    WHERE u.role='DRIVER' AND ${matches("u.name || ' ' || u.email || ' ' || o.name || ' ' || COALESCE(v.platform_number,'')")}`;
  const loadBase=`SELECT s.id,s.code,s.title,s.origin,s.destination,s.load_type,s.operational_status,s.updated_at,
      owner.name AS owner_name,COALESCE(provider.name,profile.business_name) AS provider_name
    FROM shipments s
    JOIN organizations owner ON owner.id=COALESCE(s.load_owner_organization_id,s.shipper_organization_id)
    LEFT JOIN organizations provider ON provider.id=s.provider_organization_id
    LEFT JOIN provider_profiles profile ON profile.id=s.provider_profile_id
    WHERE ${matches("s.code || ' ' || s.title || ' ' || owner.name || ' ' || COALESCE(provider.name,'') || ' ' || COALESCE(profile.business_name,'')")}`;
  const capacityBase=`SELECT c.id,COALESCE(c.market_status,c.status) AS status,c.available_percent,c.visibility,c.location_area,c.updated_at,c.available_again_date,
      v.platform_number,v.make,v.model,COALESCE(o.name,p.business_name) AS owner_name
    FROM capacities c
    JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    WHERE c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC LIMIT 1)
      AND ${matches("COALESCE(v.platform_number,'') || ' ' || COALESCE(v.make,'') || ' ' || COALESCE(v.model,'') || ' ' || COALESCE(o.name,'') || ' ' || COALESCE(p.business_name,'')")}`;
  const relationshipBase=`SELECT rel.id,'RELATIONSHIP' AS record_kind,business.name AS owner_name,
      COALESCE(provider.name,profile.business_name) AS target_name,rel.status,
      rel.requested_by_side AS detail,rel.updated_at
    FROM partner_relationships rel JOIN organizations business ON business.id=rel.owner_organization_id
    LEFT JOIN organizations provider ON provider.id=rel.provider_organization_id
    LEFT JOIN provider_profiles profile ON profile.id=rel.provider_profile_id
    WHERE ${matches("business.name || ' ' || COALESCE(provider.name,'') || ' ' || COALESCE(profile.business_name,'') || ' ' || rel.status")}`;
  const favoriteBase=`SELECT favorite.id,'BUSINESS_FAVORITE' AS record_kind,owner.name AS owner_name,
      target.name AS target_name,'FAVORITE' AS status,'Business favorite' AS detail,favorite.created_at AS updated_at
    FROM member_favorites favorite JOIN organizations owner ON owner.id=favorite.owner_organization_id
    JOIN organizations target ON target.id=favorite.target_organization_id
    WHERE ${matches("owner.name || ' ' || target.name")}`;
  const profileRouteBase=`SELECT route.id,'PROFILE_ROUTE' AS record_kind,COALESCE(owner.name,profile.business_name) AS owner_name,
      route.origin AS origin,route.destination AS destination,NULL AS radius_km,route.created_at
    FROM profile_routes route LEFT JOIN organizations owner ON owner.id=route.organization_id
    LEFT JOIN provider_profiles profile ON profile.id=route.provider_profile_id
    WHERE ${matches("COALESCE(owner.name,'') || ' ' || COALESCE(profile.business_name,'') || ' ' || route.origin || ' ' || route.destination")}`;
  const serviceAreaBase=`SELECT area.id,'SERVICE_AREA' AS record_kind,COALESCE(owner.name,profile.business_name) AS owner_name,
      area.place_label AS origin,NULL AS destination,area.radius_km,area.created_at
    FROM service_areas area LEFT JOIN organizations owner ON owner.id=area.organization_id
    LEFT JOIN provider_profiles profile ON profile.id=area.provider_profile_id
    WHERE ${matches("COALESCE(owner.name,'') || ' ' || COALESCE(profile.business_name,'') || ' ' || area.place_label")}`;
  const subscriptionBase=`SELECT subscription.id,subscription.status,subscription.billing_model,subscription.starts_at,
      subscription.ends_at,subscription.updated_at,plan.name AS plan_name,
      COALESCE(owner.name,profile.business_name) AS owner_name,owner.type AS organization_type
    FROM subscriptions subscription JOIN plans plan ON plan.id=subscription.plan_id
    LEFT JOIN organizations owner ON owner.id=subscription.organization_id
    LEFT JOIN provider_profiles profile ON profile.id=subscription.provider_profile_id
    WHERE ${matches("COALESCE(owner.name,'') || ' ' || COALESCE(profile.business_name,'') || ' ' || plan.name || ' ' || subscription.status")}`;
  const counts={
    users:db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    workspaces:db.prepare('SELECT (SELECT COUNT(*) FROM organizations)+(SELECT COUNT(*) FROM provider_profiles) AS n').get().n,
    trucks:db.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n,
    loads:db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n,
    board_capacity:db.prepare(`SELECT COUNT(DISTINCT c.vehicle_id) AS n FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
      WHERE v.active=1 AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
        AND (COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL') OR (COALESCE(c.market_status,c.status)='BUSY' AND c.available_again_date>=?))`).get(todayInEthiopia()).n,
    network:db.prepare('SELECT (SELECT COUNT(*) FROM partner_relationships)+(SELECT COUNT(*) FROM member_favorites) AS n').get().n,
    routes:db.prepare('SELECT (SELECT COUNT(*) FROM profile_routes)+(SELECT COUNT(*) FROM service_areas) AS n').get().n
    ,subscriptions:db.prepare('SELECT COUNT(*) AS n FROM subscriptions').get().n
  };
  const pageOptions={page:options.page,pageSize:20};
  const selected=view==='USERS'
    ? paginateQuery(db,userBase,searchArgs,'active DESC,created_at DESC,id',pageOptions)
    : view==='WORKSPACES'
      ? paginateQuery(db,`${organizationBase} UNION ALL ${providerBase}`,[...searchArgs,...searchArgs],'name COLLATE NOCASE,id',pageOptions)
      : view==='TRUCKS'
        ? paginateQuery(db,vehicleBase,searchArgs,'active DESC,platform_number,id',pageOptions)
        : view==='DRIVERS'
          ? paginateQuery(db,driverBase,searchArgs,'active DESC,name,id',pageOptions)
        : view==='LOADS'
          ? paginateQuery(db,loadBase,searchArgs,'updated_at DESC,id',pageOptions)
          : view==='CAPACITY'
            ? paginateQuery(db,capacityBase,searchArgs,'updated_at DESC,id',pageOptions)
            : view==='NETWORK'
              ? paginateQuery(db,`${relationshipBase} UNION ALL ${favoriteBase}`,[...searchArgs,...searchArgs],'updated_at DESC,id',pageOptions)
              : view==='ROUTES'
                ? paginateQuery(db,`${profileRouteBase} UNION ALL ${serviceAreaBase}`,[...searchArgs,...searchArgs],'created_at DESC,id',pageOptions)
                : paginateQuery(db,subscriptionBase,searchArgs,'updated_at DESC,id',pageOptions);
  audit(db,user,'ADMIN_OPERATIONS_VIEWED','platform',null,{queryUsed:Boolean(term),view});
  return {
    counts,
    view,
    items:selected.items,
    pagination:selected,
    query:term
  };
}

export function moderateAdminRecord(user,recordType,recordId,command){
  const db=getDb();
  const type=String(recordType||'').toUpperCase();
  const action=String(command||'').toUpperCase();
  assertPlatformPermission(user,type==='SUBSCRIPTION'?PLATFORM_PERMISSIONS.BILLING:PLATFORM_PERMISSIONS.OPERATIONS);
  const timestamp=nowIso();
  if(type==='RELATIONSHIP'&&action==='DISCONNECT'){
    const result=db.prepare(`UPDATE partner_relationships SET status='FAVORITE',business_favorite=0,
      provider_favorite=0,responded_at=?,updated_at=? WHERE id=?`).run(timestamp,timestamp,recordId);
    if(!result.changes)throw new Error('NOT_FOUND');
  }else if(type==='BUSINESS_FAVORITE'&&action==='REMOVE'){
    if(!db.prepare('DELETE FROM member_favorites WHERE id=?').run(recordId).changes)throw new Error('NOT_FOUND');
  }else if(type==='PROFILE_ROUTE'&&action==='REMOVE'){
    if(!db.prepare('DELETE FROM profile_routes WHERE id=?').run(recordId).changes)throw new Error('NOT_FOUND');
  }else if(type==='SERVICE_AREA'&&action==='REMOVE'){
    if(!db.prepare('DELETE FROM service_areas WHERE id=?').run(recordId).changes)throw new Error('NOT_FOUND');
  }else if(type==='CAPACITY'&&action==='OFF_DUTY'){
    const result=db.prepare(`UPDATE capacities SET status='OFF_DUTY',market_status='OFF_DUTY',on_duty=0,
      visibility='HIDDEN',updated_at=?,expires_at=? WHERE id=?`).run(timestamp,timestamp,recordId);
    if(!result.changes)throw new Error('NOT_FOUND');
  }else if(type==='SUBSCRIPTION'&&['PAID','EXPIRE','SPONSOR'].includes(action)){
    const subscription=db.prepare(`SELECT subscription.*,owner.type AS organization_type
      FROM subscriptions subscription LEFT JOIN organizations owner ON owner.id=subscription.organization_id WHERE subscription.id=?`).get(recordId);
    if(!subscription)throw new Error('NOT_FOUND');
    if(action==='SPONSOR'&&!['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER'].includes(subscription.organization_type))throw new Error('SPONSORED_ACCESS_BUSINESS_ONLY');
    if(action==='PAID')db.prepare(`UPDATE subscriptions SET status='ACTIVE',billing_model='FLAT_MONTHLY',starts_at=?,ends_at=?,updated_at=? WHERE id=?`)
      .run(timestamp,accessPeriodEnd(timestamp,PAID_ACCESS_DAYS),timestamp,recordId);
    if(action==='EXPIRE')db.prepare(`UPDATE subscriptions SET status='EXPIRED',ends_at=?,updated_at=? WHERE id=?`).run(timestamp,timestamp,recordId);
    if(action==='SPONSOR')db.prepare(`UPDATE subscriptions SET status='SPONSORED',billing_model='SPONSORED_FREE',ends_at=NULL,updated_at=? WHERE id=?`).run(timestamp,recordId);
  }else throw new Error('INVALID_ADMIN_RECORD_COMMAND');
  audit(db,user,'ADMIN_RECORD_MODERATED',type.toLowerCase(),recordId,{command:action});
}

export function setAdminRecordActive(user, recordType, recordId, active) {
  assertPlatformPermission(user,recordType==='USER'?PLATFORM_PERMISSIONS.CUSTOMERS:PLATFORM_PERMISSIONS.OPERATIONS);
  const db=getDb();
  const enabled=Boolean(active);
  if(['USER','DRIVER'].includes(recordType)){
    const target=db.prepare('SELECT id,role,active FROM users WHERE id=?').get(recordId);
    if(!target)throw new Error('NOT_FOUND');
    if(recordType==='DRIVER'&&target.role!==USER_ROLES.DRIVER)throw new Error('INVALID_ADMIN_RECORD_TYPE');
    if(user.role!==USER_ROLES.ADMIN&&[USER_ROLES.ADMIN,USER_ROLES.SUPPORT].includes(target.role))throw new Error('FORBIDDEN');
    if(target.id===user.id&&!enabled)throw new Error('ADMIN_SELF_SUSPENSION_DENIED');
    if(target.role===USER_ROLES.SUPPORT){
      const profile=supportAgentRecord(db,target.id);
      if(!profile)throw new Error('NOT_FOUND');
      updateSupportAgent(user,target.id,{
        active:enabled,
        available:enabled&&Boolean(profile.available),
        maxOpenConversations:profile.max_open_conversations
      });
      return;
    }
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

export function grantSponsoredBusinessAccess(user, organizationId) {
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.BILLING);
  const db=getDb();
  const organization=db.prepare(`SELECT id,type FROM organizations WHERE id=?`).get(organizationId);
  if(!organization)throw new Error('NOT_FOUND');
  if(!['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER'].includes(organization.type))throw new Error('SPONSORED_ACCESS_BUSINESS_ONLY');
  const subscription=db.prepare(`SELECT id,status FROM subscriptions WHERE organization_id=? ORDER BY updated_at DESC LIMIT 1`).get(organization.id);
  if(!subscription)throw new Error('NOT_FOUND');
  if(subscription.status==='SPONSORED')return;
  const timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare(`UPDATE subscriptions SET status='SPONSORED',billing_model='SPONSORED_FREE',ends_at=NULL,updated_at=? WHERE id=?`)
      .run(timestamp,subscription.id);
    audit(db,user,'SPONSORED_ACCESS_GRANTED','organization',organization.id,{subscriptionId:subscription.id});
    db.exec('COMMIT');
  }catch(error){
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listAudit(user) {
  if (user.role !== USER_ROLES.ADMIN) throw new Error('FORBIDDEN');
  return getDb().prepare(`SELECT a.*,u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 100`).all();
}

export function saveUpload(file, prefix = 'file') {
  return storePrivateUpload(file,prefix);
}

export function addProof(user, shipmentId, proofType, upload, note = '') {
  assertWorkspaceAccess(user);
  const shipment = getShipmentParty(user,shipmentId);
  if (!shipment) throw new Error('NOT_FOUND');
  const db = getDb();
  return insertProofFile(db,user,shipment,proofType,upload,note);
}

export function getProofFile(user, proofId) {
  assertWorkspaceAccess(user);
  const db = getDb();
  const proof = db.prepare('SELECT * FROM proof_files WHERE id=?').get(proofId);
  if (!proof) return null;
  const shipment = getShipmentParty(user,proof.shipment_id);
  if (!shipment) return null;
  return proof;
}

export function getBusinessTrackingAccessCode(user,shipmentId) {
  assertWorkspaceAccess(user);
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
      .run(applicationId,userId,input.businessName,input.applicationType,'APPROVED',input.notes || null,timestamp,timestamp);
    const workspace=provisionApplicationWorkspace(db,{
      user_id:userId,
      business_name:input.businessName,
      application_type:input.applicationType,
      organization_id:null,
      provider_profile_id:null
    },timestamp,false);
    audit(db,{id:userId,organization_id:workspace.organizationId,provider_profile_id:workspace.providerProfileId},'ACCOUNT_SELF_PROVISIONED','application',applicationId,{
      applicationType:input.applicationType,
      accessStatus:'TRIAL',
      accessEndsAt:workspace.trialEndsAt
    });
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
  const subscription = workspaceSubscription(db,user);
  const access = user.role === USER_ROLES.ADMIN
    ? {granted:true,status:'ADMIN',ends_at:null,days_remaining:null}
    : subscriptionAccess(subscription);
  if (!subscription) return { subscription: null, proofs: [], access };
  const proofs = db.prepare(`SELECT * FROM payment_proofs WHERE subscription_id=? ORDER BY submitted_at DESC`).all(subscription.id);
  return { subscription, proofs, access };
}

export function submitPaymentProof(user, amountEtb, reference, upload = /** @type {null|{path:string,name:string,originalName:string,mimeType:string,size:number}} */ (null)) {
  const db = getDb();
  const summary = getBillingSummary(user);
  if (!summary.subscription) throw new Error('SUBSCRIPTION_NOT_FOUND');
  if (summary.access.status === 'SPONSORED') throw new Error('PAYMENT_NOT_REQUIRED');
  const amountMinor = Number(amountEtb);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error('INVALID_ETB_AMOUNT');
  const id = randomId('pay-');
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO payment_proofs (id,subscription_id,amount_minor,reference,file_path,original_name,mime_type,status,submitted_at,reviewed_at) VALUES (?,?,?,?,?,?,?,'PENDING',?,NULL)`)
      .run(id,summary.subscription.id,Math.round(amountMinor*100),reference || null,upload?.path || null,upload?.originalName||null,upload?.mimeType||null,timestamp);
    if (!summary.access.granted) {
      db.prepare(`UPDATE subscriptions SET status='PAYMENT_UNDER_REVIEW',updated_at=? WHERE id=?`)
        .run(timestamp,summary.subscription.id);
    }
    audit(db,user,'PAYMENT_PROOF_SUBMITTED','payment_proof',id,{ amountEtb: amountMinor });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export function listPaymentProofs(user, options = /** @type {any} */ (null)) {
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.BILLING);
  const db=getDb();
  const baseSelect=`SELECT pp.*,p.name AS plan_name,o.name AS organization_name,pr.business_name AS provider_name,
      s.status AS subscription_status,s.ends_at AS subscription_ends_at
    FROM payment_proofs pp JOIN subscriptions s ON s.id=pp.subscription_id JOIN plans p ON p.id=s.plan_id
    LEFT JOIN organizations o ON o.id=s.organization_id LEFT JOIN provider_profiles pr ON pr.id=s.provider_profile_id`;
  if (!options) return db.prepare(`${baseSelect} ORDER BY pp.submitted_at DESC`).all();
  const status = String(options.status||'ALL').toUpperCase();
  const search = String(options.q||'').trim().toLowerCase();
  const args=[];
  let where='1=1';
  if(status!=='ALL'){where+=' AND pp.status=?';args.push(status);}
  if(search){
    where+=` AND lower(COALESCE(o.name,'') || ' ' || COALESCE(pr.business_name,'') || ' ' || p.name || ' ' ||
      COALESCE(pp.reference,'') || ' ' || pp.status) LIKE ?`;
    args.push(`%${search}%`);
  }
  return paginateQuery(db,`${baseSelect} WHERE ${where}`,args,'submitted_at DESC',options);
}

export function getPaymentProofFile(user,proofId){
  const db=getDb();
  const proof=db.prepare(`SELECT pp.*,s.organization_id,s.provider_profile_id
    FROM payment_proofs pp JOIN subscriptions s ON s.id=pp.subscription_id WHERE pp.id=?`).get(proofId);
  if(!proof||!proof.file_path)return null;
  if(hasPlatformPermission(user,PLATFORM_PERMISSIONS.BILLING))return proof;
  const ownsOrganization=Boolean(user.organization_id&&proof.organization_id===user.organization_id);
  const ownsProfile=Boolean(user.provider_profile_id&&proof.provider_profile_id===user.provider_profile_id);
  return ownsOrganization||ownsProfile?proof:null;
}

export function reviewPaymentProof(user, proofId, status) {
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.BILLING);
  if (!['APPROVED','REJECTED','MORE_INFO'].includes(status)) throw new Error('INVALID_STATUS');
  const db = getDb();
  const proof = db.prepare('SELECT * FROM payment_proofs WHERE id=?').get(proofId);
  if (!proof) throw new Error('NOT_FOUND');
  if (['APPROVED','REJECTED'].includes(proof.status)) throw new Error('PAYMENT_PROOF_ALREADY_REVIEWED');
  db.exec('BEGIN IMMEDIATE');
  try {
    const timestamp = nowIso();
    db.prepare('UPDATE payment_proofs SET status=?,reviewed_at=? WHERE id=?').run(status,timestamp,proofId);
    let accessEndsAt = null;
    if (status === 'APPROVED') {
      accessEndsAt = accessPeriodEnd(timestamp,PAID_ACCESS_DAYS);
      db.prepare(`UPDATE subscriptions
        SET status='ACTIVE',billing_model='FLAT_MONTHLY',starts_at=?,ends_at=?,updated_at=?
        WHERE id=?`).run(timestamp,accessEndsAt,timestamp,proof.subscription_id);
    } else {
      const subscription = db.prepare('SELECT * FROM subscriptions WHERE id=?').get(proof.subscription_id);
      if (!subscriptionAccess(subscription).granted) {
        db.prepare(`UPDATE subscriptions SET status=?,updated_at=? WHERE id=?`)
          .run(status === 'MORE_INFO' ? 'PAYMENT_UNDER_REVIEW' : 'PAYMENT_REQUIRED',timestamp,proof.subscription_id);
      }
    }
    audit(db,user,'PAYMENT_PROOF_REVIEWED','payment_proof',proofId,{ status,accessEndsAt });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
