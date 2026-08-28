import { ensureSeededDailyFeaturedProviderDay, getDb } from './db.js';
import { readPrivateUpload, removePrivateUpload, storePrivateUpload } from './private-storage.js';
import {
  USER_ROLES,
  SERVICE_MODES,
  DISTRIBUTION_MODES,
  PRICE_MODES,
  MOVEMENT_SCOPES,
  validatePriceMode,
  validateCapacity,
  validateAcceptedLoads,
  validateCapacityServiceRadius,
  validateFreightLoadType,
  validateMovementScope,
  validateServiceRadius,
  validateSupportAgentLimit,
  validateSupportCategory,
  validateSupportMessage,
  normalizePrivateContactEmail,
  normalizeOptionalCallbackPhone,
  pointInServiceArea,
  serviceAreasOverlap,
  distanceBetweenKm,
  assertTransition,
  capacitySignalFreshness,
  capacityUpdatePresentation,
  loadBoardDeadlineState,
  LOAD_BOARD_GRACE_DAYS,
  isPendingDirectRequest,
  roleCanCreateShipment,
  roleCanPublishCapacity,
  roleCanBrowseLoads
} from './domain.js';
import {
  hashPassword,
  hashTrackingAccessCode,
  randomCode,
  randomId,
  trackingAccessCode,
  verifyReviewAccessCode,
  privateContactDigest,
  sharedCapacityOtpCode,
  guestSupportAccessCode,
  verifyPrivateAccessCode
} from './security.js';
import { bestGeographicRouteMatch, capacityRouteAlignmentMatch, capacityRoutePointMatch, corridorAlignmentMatch, geographicRouteMatch, normalizePlace, serviceAreaGeometryMatch } from './route-matching.js';
import { ETHIOPIA_PLACES, getPlaceCoordinate as getBuiltInPlaceCoordinate } from './ethiopia-places.js';
import { BUSINESS_SEARCH_PRIVACY_KM, possibleDistanceRange, validateCapacityPrivacyRadius } from './location-privacy.js';
import { buildAlongRouteChains, poolCompatibleLoads } from './pstl.js';
import { placeIdentity, placeLabel, placeLocalName, qualifyAreaLabel } from './place-labels.js';
import { accessPeriodEnd, PAID_ACCESS_DAYS, subscriptionAccess, TRIAL_DAYS } from './subscription-access.js';
import { providerRegionLabel, regionalExpoGroupForDate, regionalExpoWeekForDate, validateProviderRegionCode } from './provider-regions.js';
import { buildFeaturedDaySchedule, DEFAULT_FEATURED_SCHEDULE_CONFIG, validateFeaturedScheduleConfig } from './expo-broadcast.js';
import { getManagedDriverAccess, getManagedWorkspaceAccess } from './identity/workspace-access.js';
import {
  grantSupabasePrivateCapacityAccess,
  listSupabaseLoadgisticSharedCapacity,
  listSupabasePendingAccessEmailDeliveries,
  listSupabasePrivateCapacityNetwork,
  listSupabaseSharedCapacity,
  recordSupabaseAccessEmailDeliveryAttempt,
  requestSupabaseSharedCapacityOtp,
  revokeSupabasePrivateCapacityAccess,
  searchSupabasePlaces,
  setSupabaseLoadgisticCapacityAccess,
  verifySupabaseSharedCapacityAccess
} from './repository/supabase.js';

const SPONSORED_PROVIDER_LIMIT=5;

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

function travelDayLabel(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-US',{
    weekday:'long',month:'short',day:'numeric',timeZone:'UTC'
  }).format(new Date(`${value}T12:00:00.000Z`));
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
  if(process.env.DATA_BACKEND==='supabase'){
    return getManagedWorkspaceAccess(user,at);
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

function privateNetworkVehicle(db,user,vehicleId) {
  if(!user||![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role))throw new Error('FORBIDDEN');
  if(user.role===USER_ROLES.TRANSPORTER){
    const vehicle=db.prepare(`SELECT * FROM vehicles WHERE id=? AND organization_id=? AND active=1`).get(vehicleId,user.organization_id);
    if(!vehicle)throw new Error('NOT_FOUND');
    return vehicle;
  }
  if(isSelfManagedDriver(user)){
    const vehicle=db.prepare(`SELECT * FROM vehicles WHERE id=? AND provider_profile_id=? AND active=1`).get(vehicleId,user.provider_profile_id);
    if(!vehicle)throw new Error('NOT_FOUND');
    return vehicle;
  }
  if(!getDriverAccess(user)?.can_manage_capacity)throw new Error('FORBIDDEN');
  const vehicle=db.prepare(`SELECT v.* FROM vehicles v
    JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id AND a.active=1
    WHERE v.id=? AND v.organization_id=? AND a.driver_user_id=? AND v.active=1`).get(vehicleId,user.organization_id,user.id);
  if(!vehicle)throw new Error('NOT_FOUND');
  return vehicle;
}

export function getDriverAccess(user) {
  if (isSelfManagedDriver(user)) {
    return {
      kind:'SELF_MANAGED',
      can_browse_load_board:false,
      can_contact_businesses:false,
      can_negotiate_loads:false,
      can_manage_capacity:true,
      can_manage_tracking:true
    };
  }
  if (!isCompanyDriver(user)) return null;
  if(process.env.DATA_BACKEND==='supabase'){
    return getManagedDriverAccess(user);
  }
  const stored = getDb().prepare('SELECT * FROM driver_permissions WHERE user_id=?').get(user.id);
  return {
    kind:'COMPANY',
    can_browse_load_board:false,
    can_contact_businesses:false,
    can_negotiate_loads:false,
    can_manage_capacity:Boolean(stored?.can_manage_capacity ?? 1),
    can_manage_tracking:Boolean(stored?.can_manage_tracking ?? 1)
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

export async function searchPlaces(query,limit=20) {
  const normalized = normalizePlace(placeLocalName(query));
  if (normalized.length < 2) return [];
  const boundedLimit = Math.max(1,Math.min(Number(limit)||20,50));
  if(process.env.DATA_BACKEND==='supabase')return searchSupabasePlaces(query,normalized,boundedLimit);
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
    const coordinate=getBuiltInPlaceCoordinate(reference.slice('builtin:'.length))
      || getBuiltInPlaceCoordinate(fallbackLabel);
    if (coordinate) return {place_ref:reference,place_label:placeLabel(coordinate.name),center_lat:coordinate.lat,center_lng:coordinate.lng};
    const stored=getDb().prepare(`WITH geometry_documents(document) AS (
        SELECT current_route_points_json FROM capacities
        UNION ALL SELECT capacity_area_boundary_json FROM capacities
        UNION ALL SELECT route_points_json FROM profile_routes
        UNION ALL SELECT area_boundary_json FROM profile_routes
      )
      SELECT json_extract(point.value,'$.label') AS label,
        json_extract(point.value,'$.lat') AS lat,
        json_extract(point.value,'$.lng') AS lng
      FROM geometry_documents,json_each(
        CASE WHEN json_valid(geometry_documents.document) THEN geometry_documents.document ELSE '[]' END
      ) AS point
      WHERE json_extract(point.value,'$.place_ref')=?
        AND json_type(point.value,'$.lat') IN ('integer','real')
        AND json_type(point.value,'$.lng') IN ('integer','real')
      LIMIT 1`).get(reference);
    if (!stored) throw new Error('INVALID_LOCALITY');
    return {place_ref:reference,place_label:placeLabel(stored.label||fallbackLabel),center_lat:Number(stored.lat),center_lng:Number(stored.lng)};
  }
  const place=getDb().prepare(`SELECT id,name,parent_name,country_name,latitude,longitude FROM place_catalog WHERE id=?`).get(reference);
  if (!place) throw new Error('INVALID_LOCALITY');
  const qualified=place.parent_name&&normalizePlace(place.parent_name)!==normalizePlace(place.name)
    ? `${place.name}, ${place.parent_name}, ${place.country_name}`
    : `${place.name}, ${place.country_name}`;
  return {place_ref:place.id,place_label:qualified,center_lat:place.latitude,center_lng:place.longitude};
}

function resolvePlaceSequence(items,min,max,errorCode) {
  if(!Array.isArray(items)||items.length<min||items.length>max)throw new Error(errorCode);
  const points=items.map(item=>resolvePlaceReference(item?.placeRef,item?.label)).map(place=>({
    place_ref:place.place_ref,label:place.place_label,lat:Number(place.center_lat),lng:Number(place.center_lng)
  }));
  if(new Set(points.map(point=>point.place_ref)).size!==points.length)throw new Error('CAPACITY_PLACE_DUPLICATE');
  return points;
}

function parsePlacePoints(value,min=0,max=5) {
  try{
    const points=JSON.parse(String(value||'[]'));
    if(!Array.isArray(points)||points.length<min||points.length>max)return [];
    return points.filter(point=>point&&point.place_ref&&point.label&&Number.isFinite(Number(point.lat))&&Number.isFinite(Number(point.lng))).map(point=>({...point,lat:Number(point.lat),lng:Number(point.lng)}));
  }catch{return [];}
}

function routePointLabel(points,separator=' → '){return points.map(point=>point.label).join(separator);}

function nearestCapacityPlace(lat,lng) {
  const db=getDb();
  const imported=db.prepare(`SELECT id,name,parent_name,country_name,latitude,longitude
    FROM place_catalog
    WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
    ORDER BY ((latitude-?)*(latitude-?))+((longitude-?)*(longitude-?)),population DESC
    LIMIT 1`).get(lat-1.5,lat+1.5,lng-1.5,lng+1.5,lat,lat,lng,lng);
  if(imported){
    const qualified=imported.parent_name&&normalizePlace(imported.parent_name)!==normalizePlace(imported.name)
      ? `${imported.name}, ${imported.parent_name}, ${imported.country_name}`
      : `${imported.name}, ${imported.country_name}`;
    return {place_ref:imported.id,place_label:qualified,center_lat:imported.latitude,center_lng:imported.longitude};
  }
  const builtIn=ETHIOPIA_PLACES.map(place=>({
    ...place,
    distance:((place.lat-lat)*(place.lat-lat))+((place.lng-lng)*(place.lng-lng))
  })).sort((a,b)=>a.distance-b.distance)[0];
  if(!builtIn)throw new Error('CAPACITY_DRIVER_LOCATION_REQUIRED');
  return {place_ref:`builtin:${normalizePlace(builtIn.name)}`,place_label:placeLabel(builtIn.name),center_lat:builtIn.lat,center_lng:builtIn.lng};
}

function capacityDeviceLocation(input,movementScope) {
  if(input.locationSource!=='DEVICE_OBSCURED')throw new Error('CAPACITY_DRIVER_LOCATION_REQUIRED');
  const lat=Number(input.approximateLat);
  const lng=Number(input.approximateLng);
  const precisionKm=Number(input.locationPrecisionKm);
  if(!Number.isFinite(lat)||lat<3||lat>15||!Number.isFinite(lng)||lng<32||lng>49){
    throw new Error('INVALID_APPROXIMATE_LOCATION');
  }
  try { validateCapacityPrivacyRadius(movementScope,precisionKm); }
  catch { throw new Error('INVALID_APPROXIMATE_LOCATION'); }
  return {lat,lng,precisionKm,place:nearestCapacityPlace(lat,lng),updatedAt:nowIso()};
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
  const db=getDb();
  const user=db.prepare(`
    SELECT u.*, o.name AS organization_name, o.handle AS organization_handle, o.type AS organization_type,
           p.business_name AS provider_business_name, p.handle AS provider_handle,
           (SELECT a.application_type FROM applications a WHERE a.user_id=u.id ORDER BY a.created_at DESC LIMIT 1) AS application_type,
           CASE WHEN u.role='DRIVER' AND u.provider_profile_id IS NOT NULL THEN 'SELF_MANAGED'
                WHEN u.role='DRIVER' AND u.organization_id IS NOT NULL THEN 'COMPANY' END AS driver_kind,
           COALESCE(dp.can_browse_load_board,1) AS can_browse_load_board,
           COALESCE(dp.can_contact_businesses,1) AS can_contact_businesses,
           COALESCE(dp.can_negotiate_loads,1) AS can_negotiate_loads,
           COALESCE(dp.can_manage_capacity,1) AS can_manage_capacity,
           COALESCE(dp.can_manage_tracking,1) AS can_manage_tracking,
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
  if(!user)return null;
  if(user.role===USER_ROLES.TRANSPORTER)user.provider_operating_model='FLEET_TRANSPORTER';
  if(user.driver_kind==='COMPANY')user.provider_operating_model='COMPANY_DRIVER';
  if(user.driver_kind==='SELF_MANAGED')user.provider_operating_model=independentProviderOperatingModel(db,user);
  return user;
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
      'Review Disputes': db.prepare(`SELECT COUNT(*) AS n FROM provider_reviews WHERE dispute_status='PENDING'`).get().n,
      Providers: db.prepare(`SELECT (SELECT COUNT(*) FROM organizations WHERE type='TRANSPORT_COMPANY')+(SELECT COUNT(*) FROM provider_profiles) AS n`).get().n,
      'Tracked Shipments': db.prepare('SELECT COUNT(*) AS n FROM provider_shipments').get().n,
      'Board Capacity': db.prepare(`SELECT COUNT(*) AS n FROM capacities c
        WHERE c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
          AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')`).get().n
    };
    data.actions = [
      { href: '/admin/operations', label: 'Open platform operations', description: 'Inspect one focused client, truck, shipment, or capacity view.' },
      { href: '/admin/reviews?tab=ratings', label: 'Review rating disputes', description: 'Investigate transporter disputes without hiding published customer ratings.' },
      { href: '/admin/reviews?tab=documents', label: 'Review trust documents', description: 'Verify identities, licenses, drivers, and trucks.' },
      { href: '/', label: 'View public Truck Market', description: 'Inspect published capacity and transporter pages as a visitor sees them.' }
    ];
    data.recent = db.prepare(`SELECT id,code,cargo_summary AS title,operational_status,origin,destination,created_at FROM provider_shipments ORDER BY created_at DESC LIMIT 6`).all();
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
      { href: '/', label: 'Open Capacity Board', description: 'See fresh truck availability on active routes.' }
    ];
    data.recent = listVisibleShipments(user,6);
    return data;
  }

  const scope = providerScope(user);
  if (!scope) return data;
  const shipmentDriverClause=isCompanyDriver(user)?' AND assigned_driver_user_id=?':'';
  const shipmentArgs=isCompanyDriver(user)?[scope.id,user.id]:[scope.id];
  data.counts = {
    'Active Tracking': db.prepare(`SELECT COUNT(*) AS n FROM provider_shipments WHERE ${scope.organizationId?'provider_organization_id':'provider_profile_id'}=?${shipmentDriverClause} AND operational_status<>'COMPLETED'`).get(...shipmentArgs).n,
    'Completed Tracking': db.prepare(`SELECT COUNT(*) AS n FROM provider_shipments WHERE ${scope.organizationId?'provider_organization_id':'provider_profile_id'}=?${shipmentDriverClause} AND operational_status='COMPLETED'`).get(...shipmentArgs).n,
    'On-duty Trucks': db.prepare(`SELECT COUNT(*) AS n FROM capacities c WHERE c.${scope.column}=?
      AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
      AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')`).get(scope.id).n,
    'Published Reviews': db.prepare(`SELECT COUNT(*) AS n FROM provider_reviews WHERE ${scope.organizationId?'provider_organization_id':'provider_profile_id'}=? AND status='PUBLISHED'`).get(scope.id).n
  };
  data.actions = [
    { href: '/app/provider-shipments/new', label: 'Start Tracking', description: 'Create a transporter-managed Tracking session after agreeing transport work offline.' },
    { href: user.role === USER_ROLES.TRANSPORTER ? '/app/fleet' : '/app/home', label: 'Update capacity', description: 'Publish Empty or Partial truck availability.' },
    { href: '/app/company-page', label: 'Update public page', description: 'Keep your services, business information, and public contact choices current.' }
  ];
  data.recent = listProviderShipments(user,{limit:6});
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
export function transitionShipment(user, shipmentId, nextStatus, note = '', evidence = null) {
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
  const location = trackingLocation();
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
  const assignedDriver=user.role===USER_ROLES.DRIVER
    && shipment.assigned_driver_user_id===user.id
    && ((isCompanyDriver(user)&&shipment.provider_organization_id===user.organization_id)
      || (isSelfManagedDriver(user)&&shipment.provider_profile_id===user.provider_profile_id));
  if (!assignedDriver || !['ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE'].includes(shipment.operational_status)) throw new Error('FORBIDDEN');
  const needsLocation = shipment.tracking_mode === 'LOCATION_AND_STATUS';
  if (!needsLocation) throw new Error('TRACKING_LOCATION_NOT_ENABLED');
  if(input.locationSource!=='DEVICE_OBSCURED')throw new Error('TRACKING_DEVICE_LOCATION_REQUIRED');
  const location = trackingLocation(input,true,true,shipment.load_type==='FTL'?20:40);
  const timestamp = nowIso();
  const latest=db.prepare(`SELECT created_at FROM shipment_events WHERE shipment_id=? AND event_type='LOCATION' ORDER BY created_at DESC LIMIT 1`).get(shipment.id);
  if(latest&&Date.now()-new Date(latest.created_at).getTime()<10*60*1000)return {recorded:false,reason:'THROTTLED'};
  db.exec('BEGIN IMMEDIATE');
  try{
    insertTrackingEvent(db,shipment,user,'LOCATION','Automatic device location',location,timestamp);
    db.prepare('UPDATE shipments SET updated_at=? WHERE id=?').run(timestamp,shipment.id);
    audit(db,user,'SHIPMENT_TRACKING_UPDATED','shipment',shipment.id,{ trackingMode: shipment.tracking_mode, locationSource: location.source, locationPrecisionKm: location.precisionKm });
    db.exec('COMMIT');
  }catch(error){
    db.exec('ROLLBACK');
    throw error;
  }
  return {recorded:true};
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
    const modeLabel=trackingMode==='LOCATION_AND_STATUS'?'automatic location and status':'status only';
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
  const records=db.prepare(`SELECT verification_type,reviewed_at,expires_on FROM verification_requests
    WHERE subject_type=? AND subject_id=? AND status='APPROVED' ORDER BY reviewed_at DESC,submitted_at DESC`).all(subjectType,subjectId);
  return verificationBadgesFromApproved(subjectType,records);
}

function verificationBadgesFromApproved(subjectType,records) {
  const normalized=records instanceof Set
    ? [...records].map(verification_type=>({verification_type,reviewed_at:null,expires_on:null}))
    : records;
  const latestByType=new Map();
  for(const record of normalized||[])if(!latestByType.has(record.verification_type))latestByType.set(record.verification_type,record);
  if (subjectType === 'VEHICLE') {
    const record=latestByType.get('VEHICLE_AUTHORIZATION')||latestByType.get('VEHICLE_OWNERSHIP');
    const expired=Boolean(record?.expires_on&&record.expires_on<todayInEthiopia());
    return [{type:record?.verification_type||'VEHICLE_OWNERSHIP',verified:Boolean(record&&!expired),expired,reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null}];
  }
  const required = subjectType === 'ORGANIZATION'
    ? ['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']
    : subjectType === 'PROVIDER_PROFILE'
      ? ['IDENTITY','DRIVER_IDENTITY']
      : ['IDENTITY','DRIVER_IDENTITY'];
  return required.map(type => {
    const record=latestByType.get(type);
    const expired=Boolean(record?.expires_on&&record.expires_on<todayInEthiopia());
    return {type,verified:Boolean(record&&!expired),expired,reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null};
  });
}

function verificationBadgesBySubject(db,subjects) {
  if(!subjects.length)return new Map();
  const where=subjects.map(()=>'(subject_type=? AND subject_id=?)').join(' OR ');
  const args=subjects.flatMap(subject=>[subject.type,subject.id]);
  const approvedBySubject=new Map();
  for(const row of db.prepare(`SELECT subject_type,subject_id,verification_type,reviewed_at,expires_on FROM verification_requests
    WHERE status='APPROVED' AND (${where}) ORDER BY reviewed_at DESC,submitted_at DESC`).all(...args)){
    const key=`${row.subject_type}:${row.subject_id}`;
    if(!approvedBySubject.has(key))approvedBySubject.set(key,[]);
    approvedBySubject.get(key).push(row);
  }
  return new Map(subjects.map(subject=>{
    const key=`${subject.type}:${subject.id}`;
    return [key,verificationBadgesFromApproved(subject.type,approvedBySubject.get(key)||[])];
  }));
}

function truckAuthorizationBadge(db,subjectType,subjectId,vehicleId,vehicleLabel) {
  const record=db.prepare(`SELECT reviewed_at,expires_on FROM verification_requests
    WHERE subject_type=? AND subject_id=? AND verification_type='VEHICLE_AUTHORIZATION'
      AND related_vehicle_id=? AND status='APPROVED'
    ORDER BY reviewed_at DESC,submitted_at DESC LIMIT 1`).get(subjectType,subjectId,vehicleId);
  const expired=Boolean(record?.expires_on&&record.expires_on<todayInEthiopia());
  return {type:'TRUCK_AUTHORIZATION',verified:Boolean(record&&!expired),expired,reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null,vehicleId,vehicleLabel};
}

function publicTruckEvidenceBadge(db,row,vehicles,providerKind) {
  if(row.provider_organization_id||!row.provider_profile_id||!vehicles.length)return null;
  if(providerKind==='OWNER_OPERATOR'){
    const candidates=vehicles.map(vehicle=>{
      const record=db.prepare(`SELECT reviewed_at,expires_on FROM verification_requests
        WHERE subject_type='VEHICLE' AND subject_id=? AND verification_type='VEHICLE_OWNERSHIP' AND status='APPROVED'
        ORDER BY reviewed_at DESC,submitted_at DESC LIMIT 1`).get(vehicle.id);
      const expired=Boolean(record?.expires_on&&record.expires_on<todayInEthiopia());
      return {type:'VEHICLE_OWNERSHIP',verified:Boolean(record&&!expired),expired,reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null,vehicleLabel:vehicle.platform_number};
    });
    return candidates.find(candidate=>candidate.verified)||candidates.find(candidate=>candidate.expired)||candidates[0];
  }
  const candidates=vehicles.flatMap(vehicle=>[
    truckAuthorizationBadge(db,'PROVIDER_PROFILE',row.provider_profile_id,vehicle.id,vehicle.platform_number),
    ...(row.profile_user_id?[truckAuthorizationBadge(db,'DRIVER',row.profile_user_id,vehicle.id,vehicle.platform_number)]:[])
  ]);
  return candidates.find(candidate=>candidate.verified)||candidates.find(candidate=>candidate.expired)||candidates[0];
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
      (SELECT GROUP_CONCAT(CASE WHEN r.geometry='RADIUS' THEN r.area_center_label || ' · Service area' ELSE r.origin || ' ↔ ' || r.destination END,'; ') FROM profile_routes r WHERE r.organization_id=o.id) AS preferred_routes_text,
      (SELECT COUNT(*) FROM vehicles v WHERE v.organization_id=o.id AND v.active=1) AS fleet_size,
      (SELECT COUNT(DISTINCT c.vehicle_id) FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
       WHERE v.organization_id=o.id AND v.active=1 AND c.visibility='OPEN'
         AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
         AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')) AS active_capacity_count,
      0 AS review_count,NULL AS average_rating
      FROM organizations o JOIN company_pages cp ON cp.organization_id=o.id AND cp.published=1 WHERE o.type='TRANSPORT_COMPANY'`);
  }
  if (kind === 'ALL' || kind === 'DRIVER') {
    selects.push(`SELECT p.id,'profile' AS ref_kind,p.business_name AS name,p.handle,'INDEPENDENT_PROVIDER' AS type,
      p.city,p.city_place_ref,p.city_lat,p.city_lng,cp.headline,p.about,cp.services,cp.operating_regions,
      cp.contact_phone,cp.contact_email,u.name AS owner_name,0 AS is_business,
      (SELECT GROUP_CONCAT(CASE WHEN r.geometry='RADIUS' THEN r.area_center_label || ' · Service area' ELSE r.origin || ' ↔ ' || r.destination END,'; ') FROM profile_routes r WHERE r.provider_profile_id=p.id) AS preferred_routes_text,
      (SELECT COUNT(*) FROM vehicles v WHERE v.provider_profile_id=p.id AND v.active=1) AS fleet_size,
      (SELECT COUNT(DISTINCT c.vehicle_id) FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
       WHERE v.provider_profile_id=p.id AND v.active=1 AND c.visibility='OPEN'
         AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
         AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')) AS active_capacity_count,
      0 AS review_count,NULL AS average_rating
      FROM provider_profiles p JOIN users u ON u.id=p.user_id JOIN company_pages cp ON cp.provider_profile_id=p.id AND cp.published=1 WHERE p.public_visibility='PUBLIC'`);
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
    c.id AS capacity_id,COALESCE(c.market_status,c.status) AS status,c.available_percent,c.visibility,c.updated_at,c.expires_at,u.name AS updated_by_name
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
    && capacity.status === 'EMPTY'
    && (!requireCurrentDate || (capacity.travel_date ? capacity.travel_date >= todayInEthiopia() : capacity.updated_at >= hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12))))
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
      source_label:'Planned empty route',
      route_date:capacity.travel_date,
      planned_space_status:capacity.planned_space_status || 'FULL',
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
            FROM capacities WHERE provider_organization_id=? AND COALESCE(market_status,status) IN ('EMPTY','PARTIAL')`).all(owner.id)
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
            FROM capacities WHERE provider_profile_id=? AND COALESCE(market_status,status) IN ('EMPTY','PARTIAL')`).all(owner.id)
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
  if (isCompanyDriver(user) || ![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role)) throw new Error('FORBIDDEN');
  const condition = isProvider ? 'provider_profile_id=?' : 'organization_id=?';
  const id = isProvider ? user.provider_profile_id : user.organization_id;
  if (!id) throw new Error('FORBIDDEN');
  const published = input.published ? 1 : 0;
  const existingPage=db.prepare(`SELECT base_region_code FROM company_pages WHERE ${condition}`).get(id);
  const baseRegionCode=input.baseRegionCode?validateProviderRegionCode(input.baseRegionCode):existingPage?.base_region_code||null;
  const basePlace=input.basePlaceRef||input.basePlaceLabel
    ? resolvePlaceReference(input.basePlaceRef,input.basePlaceLabel)
    : null;
  if(published&&!basePlace){
    const existingBase=db.prepare(`SELECT city_place_ref FROM ${isProvider?'provider_profiles':'organizations'} WHERE id=?`).get(id);
    if(!existingBase?.city_place_ref)throw new Error('BASE_LOCATION_REQUIRED');
  }
  if(published&&!baseRegionCode)throw new Error('PROVIDER_BASE_REGION_REQUIRED');
  const website=String(input.contactWebsite||'').trim();if(website&&!/^https:\/\//i.test(website))throw new Error('INVALID_WEBSITE_URL');
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE company_pages SET headline=?,about=?,services=?,base_region_code=?,contact_phone=?,contact_whatsapp=?,contact_email=?,contact_website=?,
      show_contact_phone=?,show_contact_whatsapp=?,show_contact_email=?,show_contact_website=?,published=?,updated_at=? WHERE ${condition}`)
      .run(input.headline || '',input.about || '',input.services || '',baseRegionCode,input.contactPhone||'',input.contactWhatsapp||'',input.contactEmail||'',website,
        input.showContactPhone?1:0,input.showContactWhatsapp?1:0,input.showContactEmail?1:0,input.showContactWebsite?1:0,published,timestamp,id);
    if(basePlace){
      db.prepare(`UPDATE ${isProvider?'provider_profiles':'organizations'}
        SET city=?,city_place_ref=?,city_lat=?,city_lng=? WHERE id=?`)
        .run(basePlace.place_label,basePlace.place_ref,basePlace.center_lat,basePlace.center_lng,id);
    }
    audit(db,user,'COMPANY_PAGE_UPDATED','company_page',id,{
      basePlaceRef:basePlace?.place_ref||null,baseRegionCode,published,publicContacts:{phone:Boolean(input.showContactPhone),whatsapp:Boolean(input.showContactWhatsapp),email:Boolean(input.showContactEmail),website:Boolean(input.showContactWebsite)}
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function providerPageOwner(user) {
  if(isCompanyDriver(user)||![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user?.role))throw new Error('FORBIDDEN');
  if(isSelfManagedDriver(user)&&user.provider_profile_id)return {column:'provider_profile_id',id:user.provider_profile_id};
  if(user.organization_id)return {column:'organization_id',id:user.organization_id};
  throw new Error('FORBIDDEN');
}

export async function updateProviderProfileImage(user,file) {
  assertWorkspaceAccess(user);
  const owner=providerPageOwner(user);
  if(!file||typeof file.arrayBuffer!=='function'||!file.size)throw new Error('PROFILE_IMAGE_REQUIRED');
  if(!['image/jpeg','image/png','image/webp'].includes(String(file.type||'').toLowerCase()))throw new Error('PROFILE_IMAGE_TYPE_INVALID');
  const stored=await storePrivateUpload(file,'provider-profile');
  if(!stored)throw new Error('PROFILE_IMAGE_REQUIRED');
  const db=getDb();
  const current=db.prepare(`SELECT id,profile_image_path FROM company_pages WHERE ${owner.column}=?`).get(owner.id);
  if(!current){await removePrivateUpload(stored.path);throw new Error('NOT_FOUND');}
  const timestamp=nowIso();
  try{
    db.exec('BEGIN IMMEDIATE');
    db.prepare(`UPDATE company_pages SET profile_image_path=?,profile_image_mime=?,profile_image_updated_at=?,updated_at=? WHERE id=?`)
      .run(stored.path,stored.mimeType,timestamp,timestamp,current.id);
    audit(db,user,'PROVIDER_PROFILE_IMAGE_UPDATED','company_page',current.id,{mimeType:stored.mimeType,size:stored.size});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');await removePrivateUpload(stored.path);throw error;}
  if(current.profile_image_path){try{await removePrivateUpload(current.profile_image_path);}catch{/* orphan cleanup is operationally recoverable */}}
}

export async function removeProviderProfileImage(user) {
  assertWorkspaceAccess(user);
  const owner=providerPageOwner(user);
  const db=getDb();
  const current=db.prepare(`SELECT id,profile_image_path FROM company_pages WHERE ${owner.column}=?`).get(owner.id);
  if(!current)throw new Error('NOT_FOUND');
  const timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare('UPDATE company_pages SET profile_image_path=NULL,profile_image_mime=NULL,profile_image_updated_at=?,updated_at=? WHERE id=?').run(timestamp,timestamp,current.id);
    audit(db,user,'PROVIDER_PROFILE_IMAGE_REMOVED','company_page',current.id,{});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  if(current.profile_image_path){try{await removePrivateUpload(current.profile_image_path);}catch{/* orphan cleanup is operationally recoverable */}}
}

export function getPublicProviderProfileImage(handle) {
  return getDb().prepare(`SELECT cp.profile_image_path AS file_path,cp.profile_image_mime AS mime_type,cp.profile_image_updated_at
    FROM company_pages cp
    LEFT JOIN organizations o ON o.id=cp.organization_id
    LEFT JOIN provider_profiles p ON p.id=cp.provider_profile_id
    WHERE COALESCE(o.handle,p.handle)=? AND cp.published=1 AND cp.profile_image_path IS NOT NULL
      AND (p.id IS NOT NULL OR o.type='TRANSPORT_COMPANY')`).get(String(handle||''));
}

function seededTransporterPortraitUrl(filename) {
  const value=String(filename||'');
  return /^[a-z0-9-]+\.png$/.test(value)?`/marketing/transporters/${value}`:null;
}

function publicProviderProfileImageUrl(row) {
  if(row.profile_image_path)return `/api/public/providers/${encodeURIComponent(row.handle)}/image?v=${encodeURIComponent(row.profile_image_updated_at||'1')}`;
  return seededTransporterPortraitUrl(row.profile_image_preset);
}

export function getOwnCompanyPage(user) {
  assertWorkspaceAccess(user);
  const db = getDb();
  if (isCompanyDriver(user)) throw new Error('FORBIDDEN');
  const page = isSelfManagedDriver(user)
    ? db.prepare(`SELECT cp.*,p.id,p.handle,p.business_name AS name,p.city,p.city_place_ref,p.city_lat,p.city_lng,
      'provider' AS page_kind,0 AS is_business FROM company_pages cp JOIN provider_profiles p ON p.id=cp.provider_profile_id WHERE cp.provider_profile_id=?`).get(user.provider_profile_id)
    : db.prepare(`SELECT cp.*,o.id,o.handle,o.name,o.city,o.city_place_ref,o.city_lat,o.city_lng,'organization' AS page_kind,
      CASE WHEN o.type IN ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER') THEN 1 ELSE 0 END AS is_business
      FROM company_pages cp JOIN organizations o ON o.id=cp.organization_id WHERE cp.organization_id=?`).get(user.organization_id);
  if(!page)return null;
  page.profile_image_url=publicProviderProfileImageUrl(page);
  page.profile_image_is_custom=Boolean(page.profile_image_path);
  return attachProfileCoverage(db,page);
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
  ORGANIZATION: ['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS'],
  PROVIDER_PROFILE: ['IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION'],
  DRIVER: ['IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION'],
  VEHICLE: ['VEHICLE_OWNERSHIP']
});

function independentProviderOperatingModel(db,user) {
  if(user?.application_type==='OWNER_OPERATOR')return 'OWNER_OPERATOR';
  if(user?.application_type==='SELF_MANAGED_DRIVER')return 'SELF_MANAGED_DRIVER';
  if(!user?.provider_profile_id)return 'SELF_MANAGED_DRIVER';
  const ownsTruck=db.prepare(`SELECT 1 FROM vehicles v JOIN verification_requests vr
    ON vr.subject_type='VEHICLE' AND vr.subject_id=v.id AND vr.verification_type='VEHICLE_OWNERSHIP' AND vr.status='APPROVED'
    WHERE v.provider_profile_id=? AND v.active=1 AND (vr.expires_on IS NULL OR vr.expires_on>=?) LIMIT 1`)
    .get(user.provider_profile_id,todayInEthiopia());
  return ownsTruck?'OWNER_OPERATOR':'SELF_MANAGED_DRIVER';
}

function ownsVerificationSubject(db,user,subjectType,subjectId) {
  if (user.role === USER_ROLES.ADMIN) return true;
  if (subjectType === 'ORGANIZATION') return Boolean(user.role !== USER_ROLES.DRIVER && user.organization_id && user.organization_id === subjectId);
  if (subjectType === 'PROVIDER_PROFILE') return Boolean(user.provider_profile_id && user.provider_profile_id === subjectId);
  if (subjectType === 'DRIVER') return Boolean(
    isCompanyDriver(user)
      ? subjectId===user.id&&db.prepare('SELECT 1 FROM drivers WHERE user_id=? AND active=1').get(user.id)
      : user.organization_id && db.prepare('SELECT 1 FROM drivers WHERE user_id=? AND organization_id=?').get(subjectId,user.organization_id)
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
    const driver=db.prepare('SELECT user_id,name FROM drivers WHERE user_id=? AND organization_id=? AND active=1').get(user.id,user.organization_id);
    const vehicles=db.prepare(`SELECT v.id,v.make || ' ' || v.model || ' · ' || v.platform_number AS label
      FROM driver_vehicle_assignments a JOIN vehicles v ON v.id=a.vehicle_id
      WHERE a.driver_user_id=? AND a.active=1 AND v.active=1 ORDER BY v.label`).all(user.id).map(vehicle=>({...vehicle}));
    if(driver)subjects.push({subject_type:'DRIVER',subject_id:driver.user_id,name:driver.name,type:`Company driver · ${user.organization_name}`,vehicles});
  } else if (user.organization_id) {
    subjects.push({subject_type:'ORGANIZATION',subject_id:user.organization_id,name:user.organization_name,type:'Fleet transporter'});
    const drivers=db.prepare(`SELECT 'DRIVER' AS subject_type,d.user_id AS subject_id,d.name,'Company driver' AS type
      FROM drivers d WHERE d.organization_id=? AND d.active=1 AND d.user_id IS NOT NULL ORDER BY d.name`).all(user.organization_id);
    for(const driver of drivers)driver.vehicles=db.prepare(`SELECT v.id,v.make || ' ' || v.model || ' · ' || v.platform_number AS label
      FROM driver_vehicle_assignments a JOIN vehicles v ON v.id=a.vehicle_id
      WHERE a.driver_user_id=? AND a.active=1 AND v.active=1 ORDER BY v.label`).all(driver.subject_id).map(vehicle=>({...vehicle}));
    subjects.push(...drivers);
  }
  if (user.provider_profile_id) {
    const vehicles=db.prepare(`SELECT id,make || ' ' || model || ' · ' || platform_number AS label
      FROM vehicles WHERE provider_profile_id=? AND active=1 ORDER BY label`).all(user.provider_profile_id).map(vehicle=>({...vehicle}));
    const operatingModel=independentProviderOperatingModel(db,user);
    if(operatingModel==='OWNER_OPERATOR'){
      subjects.push({subject_type:'PROVIDER_PROFILE',subject_id:user.provider_profile_id,name:user.provider_business_name,type:'Owner-operator',verification_types:['IDENTITY','DRIVER_IDENTITY'],vehicles});
      subjects.push(...vehicles.map(vehicle=>({subject_type:'VEHICLE',subject_id:vehicle.id,name:vehicle.label,type:'Truck ownership',verification_types:['VEHICLE_OWNERSHIP'],vehicles:[]})));
    }else{
      subjects.push({subject_type:'PROVIDER_PROFILE',subject_id:user.provider_profile_id,name:user.provider_business_name,type:'Self-managed driver',verification_types:['IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION'],vehicles});
    }
  }
  const requests = db.prepare(`SELECT vr.*,reviewer.name AS reviewer_name FROM verification_requests vr
    LEFT JOIN users reviewer ON reviewer.id=vr.reviewed_by WHERE submitted_by=? ORDER BY submitted_at DESC`).all(user.id);
  const badgesBySubject=verificationBadgesBySubject(db,subjects.map(subject=>({type:subject.subject_type,id:subject.subject_id})));
  return {
    subjects: subjects.map(subject => {
      const badges=badgesBySubject.get(`${subject.subject_type}:${subject.subject_id}`)||[];
      const verifiedTypes=new Set(badges.filter(badge=>badge.verified).map(badge=>badge.type));
      const pairingBadges=(subject.verification_types||VERIFICATION_TYPES[subject.subject_type]).includes('VEHICLE_AUTHORIZATION')
        ?(subject.vehicles||[]).map(vehicle=>truckAuthorizationBadge(db,subject.subject_type,subject.subject_id,vehicle.id,vehicle.label))
        :[];
      const allowedTypes=(subject.verification_types||VERIFICATION_TYPES[subject.subject_type]).filter(type=>type==='VEHICLE_AUTHORIZATION'
        ? pairingBadges.some(badge=>!badge.verified)
        : !verifiedTypes.has(type));
      return {...subject,allowed_types:allowedTypes,badges:[...badges,...pairingBadges]};
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
  const relatedVehicleId=String(input.relatedVehicleId||'').trim();
  const expiresOn=String(input.expiresOn||'').trim();
  if (!VERIFICATION_TYPES[subjectType]?.includes(verificationType)) throw new Error('INVALID_VERIFICATION_TYPE');
  if (!ownsVerificationSubject(db,user,subjectType,subjectId)) throw new Error('FORBIDDEN');
  if(user.provider_profile_id){
    const operatingModel=independentProviderOperatingModel(db,user);
    if(verificationType==='VEHICLE_OWNERSHIP'&&operatingModel!=='OWNER_OPERATOR')throw new Error('INVALID_VERIFICATION_TYPE');
    if(verificationType==='VEHICLE_AUTHORIZATION'&&operatingModel==='OWNER_OPERATOR')throw new Error('INVALID_VERIFICATION_TYPE');
  }
  if (!documentName || !upload) throw new Error('VERIFICATION_DOCUMENT_REQUIRED');
  if(verificationType==='VEHICLE_AUTHORIZATION'){
    if(!relatedVehicleId||!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)||expiresOn<=todayInEthiopia())throw new Error('TRUCK_AUTHORIZATION_DETAILS_REQUIRED');
    const ownsPair=subjectType==='PROVIDER_PROFILE'
      ? db.prepare('SELECT 1 FROM vehicles WHERE id=? AND provider_profile_id=? AND active=1').get(relatedVehicleId,subjectId)
      : db.prepare(`SELECT 1 FROM driver_vehicle_assignments a JOIN vehicles v ON v.id=a.vehicle_id
          WHERE a.driver_user_id=? AND a.vehicle_id=? AND a.active=1 AND v.active=1`).get(subjectId,relatedVehicleId);
    if(!ownsPair)throw new Error('FORBIDDEN');
  }
  const existing = db.prepare(`SELECT 1 FROM verification_requests WHERE subject_type=? AND subject_id=? AND verification_type=?
    AND COALESCE(related_vehicle_id,'')=? AND status IN ('PENDING','APPROVED')
    AND (expires_on IS NULL OR expires_on>=?)`).get(subjectType,subjectId,verificationType,relatedVehicleId,todayInEthiopia());
  if (existing) throw new Error('VERIFICATION_ALREADY_SUBMITTED');
  const id = randomId('verification-');
  db.prepare(`INSERT INTO verification_requests
    (id,subject_type,subject_id,verification_type,related_vehicle_id,expires_on,document_name,file_path,original_name,mime_type,status,submitted_by,reviewed_by,review_note,submitted_at,reviewed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,'PENDING',?,NULL,NULL,?,NULL)`)
    .run(id,subjectType,subjectId,verificationType,relatedVehicleId||null,expiresOn||null,documentName,upload.path,upload.originalName,upload.mimeType,user.id,nowIso());
  audit(db,user,'VERIFICATION_SUBMITTED','verification_request',id,{subjectType,subjectId,verificationType,relatedVehicleId:relatedVehicleId||null,expiresOn:expiresOn||null});
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
      option_label:`${route.platform_number} · ${route.source_label} · ${route.route_kind==='CURRENT_PARTIAL'?'Live now':travelDayLabel(route.route_date)||'No travel day selected'} · ${route.planned_space_status === 'FULL' ? 'Full' : 'Partial'}`
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
  if (!isPendingDirectRequest({
    distributionMode:shipment.distribution_mode,
    commercialStatus:shipment.commercial_status,
    operationalStatus:shipment.operational_status
  })) throw new Error('DIRECT_REQUEST_NOT_PENDING');
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
  COALESCE(c.market_status,c.status) AS market_status,
  c.origin,c.destination,c.origin_place_ref,c.origin_lat,c.origin_lng,c.destination_place_ref,c.destination_lat,c.destination_lng,
  c.corridor,c.travel_date,c.visibility,c.updated_by,c.updated_at,c.expires_at,
  c.location_area,c.location_place_ref,c.location_updated_at,c.location_precision_km,c.location_source,c.accepts_full_load,c.accepts_partial_load,
  c.accepts_multi_stop,c.proof_recorded_at,c.current_route_origin,c.current_route_destination,
  c.current_origin_place_ref,c.current_origin_lat,c.current_origin_lng,
  c.current_destination_place_ref,c.current_destination_lat,c.current_destination_lng,
  c.current_route_points_json,c.capacity_area_center_place_ref,c.capacity_area_center_label,
  c.capacity_area_center_lat,c.capacity_area_center_lng,c.capacity_area_boundary_json,
  c.current_route_date,c.planned_space_status,c.accepts_multi_pick,c.accepts_multi_drop,c.movement_scope,
  c.local_place_ref,c.local_place_label,c.local_center_lat,c.local_center_lng,c.local_radius_km,
  v.label AS vehicle_label,v.category AS vehicle_category,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,
  v.cargo_configuration,o.name AS organization_name,o.handle AS organization_handle,
  p.business_name AS provider_name,p.handle AS provider_handle,u.name AS updated_by_name,
  cp.contact_phone AS provider_contact_phone,
  CASE WHEN c.photo_path IS NOT NULL AND trim(c.photo_path)<>'' THEN 1 ELSE 0 END AS proof_available,
  (SELECT GROUP_CONCAT(CASE WHEN r.geometry='RADIUS' THEN r.area_center_label || ' · Service area' ELSE r.origin || ' ↔ ' || r.destination END,' • ') FROM profile_routes r
    WHERE r.organization_id=c.provider_organization_id OR r.provider_profile_id=c.provider_profile_id) AS preferred_routes_label`;

function marketCapacityRow(row, freshHours, additions = {}) {
  const status=row.market_status||row.status;
  const capacityAge=capacityUpdatePresentation(row.updated_at);
  const locationAge=capacityUpdatePresentation(row.location_updated_at,{kind:'location'});
  return {
    ...row,
    ...additions,
    status,
    proof_available:Boolean(row.proof_available),
    freshness: capacitySignalFreshness(status,row.updated_at,null,freshHours),
    capacity_update_stage:capacityAge.stage,
    capacity_updated_label:capacityAge.label,
    capacity_confirmation_needed:capacityAge.confirmAvailability,
    location_update_stage:locationAge.stage,
    location_updated_label:locationAge.label,
    location_is_last_reported:locationAge.lastReported,
    expiry_state:'CURRENT'
  };
}

function capacityBoardQuery(user,filters={}) {
  let where=`v.active=1
    AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
    AND (c.provider_profile_id IS NOT NULL OR EXISTS(
      SELECT 1 FROM driver_vehicle_assignments board_assignment
      WHERE board_assignment.vehicle_id=v.id AND board_assignment.active=1
    ))
    AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')`;
  const args=[];
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
    for(const reversed of [false,true]){
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
  if(filters.loadType==='FTL')where+=` AND c.accepts_full_load=1`;
  if(filters.loadType==='PTL')where+=` AND c.accepts_partial_load=1`;
  if(filters.vehicleCategory){where+=` AND (v.cargo_configuration=? OR v.category=?)`;args.push(filters.vehicleCategory,filters.vehicleCategory);}
  if(Number(filters.minAvailable)>0){where+=` AND c.available_percent>=?`;args.push(Number(filters.minAvailable));}
  if(filters.visibility){where+=` AND c.visibility=?`;args.push(filters.visibility);}
  if(filters.freshness==='FRESH'){where+=` AND c.updated_at>=?`;args.push(hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12)));}
  if(filters.freshness==='UPDATE_NEEDED'){where+=` AND c.updated_at<?`;args.push(hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12)));}
  if(filters.stopOption==='MULTI_PICK')where+=` AND c.accepts_multi_pick=1`;
  if(filters.stopOption==='MULTI_DROP')where+=` AND c.accepts_multi_drop=1`;
  if(filters.proof==='RECORDED')where+=` AND c.photo_path IS NOT NULL AND trim(c.photo_path)<>''`;
  const currentAreaPlace=selectedBoardPlace(filters.currentAreaPlaceRef,filters.currentArea);
  const currentAreaRadius=boardFilterRadius(filters.currentAreaRadiusKm);
  const currentAreaMatchExpression=currentAreaPlace
    ? `geo_distance_km(${Number(currentAreaPlace.center_lat)},${Number(currentAreaPlace.center_lng)},c.location_lat,c.location_lng)<=${currentAreaRadius}+COALESCE(c.location_precision_km,40)`
    : null;
  if(currentAreaMatchExpression&&filters.currentAreaMode==='REQUIRE')where+=` AND ${currentAreaMatchExpression}`;
  const nearLat=Number(filters.nearLat);
  const nearLng=Number(filters.nearLng);
  const nearRadiusKm=[3,5,10,20,50].includes(Number(filters.nearRadiusKm))?Number(filters.nearRadiusKm):10;
  const canUseNear=[USER_ROLES.SHIPPER,USER_ROLES.RECEIVER].includes(user.role);
  const hasNear=canUseNear&&Number.isFinite(nearLat)&&nearLat>=3&&nearLat<=15&&Number.isFinite(nearLng)&&nearLng>=32&&nearLng<=49;
  const nearDistanceExpression=hasNear?`geo_distance_km(${nearLat},${nearLng},c.location_lat,c.location_lng)`:null;
  if(nearDistanceExpression){
    where+=` AND c.movement_scope IN ('LOCAL','BOTH') AND c.location_lat IS NOT NULL AND c.location_lng IS NOT NULL
      AND ${nearDistanceExpression}<=${nearRadiusKm}+COALESCE(c.location_precision_km,40)+${BUSINESS_SEARCH_PRIVACY_KM}`;
  }
  const from=`FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    LEFT JOIN company_pages cp ON cp.organization_id=c.provider_organization_id OR cp.provider_profile_id=c.provider_profile_id
    JOIN users u ON u.id=c.updated_by`;
  return {where,args,from,currentAreaMatchExpression,nearDistanceExpression};
}

function capacityBoardRows(user,filters={},limit=null,offset=0) {
  const query=capacityBoardQuery(user,filters);
  const areaProjection=query.currentAreaMatchExpression?`,${query.currentAreaMatchExpression} AS current_area_match`:'';
  const nearProjection=query.nearDistanceExpression?`,${query.nearDistanceExpression} AS near_center_distance_km,c.location_lat AS shared_location_lat,c.location_lng AS shared_location_lng`:'';
  const areaOrder=query.nearDistanceExpression?'near_center_distance_km ASC,':query.currentAreaMatchExpression&&filters.currentAreaMode==='PREFER'?'current_area_match DESC,':'';
  const rows=getDb().prepare(`SELECT ${CAPACITY_BOARD_COLUMNS}${areaProjection}${nearProjection} ${query.from} WHERE ${query.where}
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
  for(const row of rows)ownerSubjects.push(row.provider_organization_id
    ? {type:'ORGANIZATION',id:row.provider_organization_id}
    : {type:'PROVIDER_PROFILE',id:row.provider_profile_id});
  const vehicleIds=[...new Set(rows.map(row=>row.vehicle_id).filter(Boolean))];
  const assignments=vehicleIds.length?getDb().prepare(`SELECT a.vehicle_id,u.id AS driver_user_id,u.name AS driver_name
    FROM driver_vehicle_assignments a JOIN users u ON u.id=a.driver_user_id
    WHERE a.active=1 AND a.vehicle_id IN (${vehicleIds.map(()=>'?').join(',')})`).all(...vehicleIds):[];
  const assignmentByVehicle=new Map(assignments.map(assignment=>[assignment.vehicle_id,assignment]));
  const driverSubjects=assignments.map(assignment=>({type:'DRIVER',id:assignment.driver_user_id}));
  const trustBadges=verificationBadgesBySubject(getDb(),[...ownerSubjects,...driverSubjects]);
  return rows.map(row=>{
    const ownerKey=row.provider_organization_id?`org:${row.provider_organization_id}`:`profile:${row.provider_profile_id}`;
    const ownerSubject=row.provider_organization_id?`ORGANIZATION:${row.provider_organization_id}`:`PROVIDER_PROFILE:${row.provider_profile_id}`;
    const assignment=assignmentByVehicle.get(row.vehicle_id);
    const distanceRange=query.nearDistanceExpression
      ? possibleDistanceRange(row.near_center_distance_km,row.location_precision_km,BUSINESS_SEARCH_PRIVACY_KM)
      : null;
    return marketCapacityRow(row,Number(process.env.CAPACITY_FRESH_HOURS||12),{
      relationshipVisible:row.visibility==='SAVED_PARTNERS',
      preferred_routes:routesByOwner.get(ownerKey)||[],
      owner_verification_badges:trustBadges.get(ownerSubject)||[],
      vehicle_verification_badges:[truckAuthorizationBadge(getDb(),assignment?'DRIVER':'PROVIDER_PROFILE',assignment?.driver_user_id||row.provider_profile_id,row.vehicle_id,row.platform_number)],
      assigned_driver_name:assignment?.driver_name||null,
      driver_verification_badges:assignment?trustBadges.get(`DRIVER:${assignment.driver_user_id}`)||[]:[],
      possible_distance_min_km:distanceRange?.minKm??null,
      possible_distance_max_km:distanceRange?.maxKm??null
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
  const routes=capacityRouteCandidates(row,{requireCurrentDate:true});
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
    freshness:filters.freshness,
    stopOption:filters.stopOption,
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
      COALESCE(c.market_status,c.status) AS status,c.available_percent,
      c.origin,c.destination,c.travel_date,c.updated_at,c.location_area,c.location_updated_at,
      c.accepts_full_load,c.accepts_partial_load,c.proof_recorded_at,
      c.current_route_origin,c.current_route_destination,c.planned_space_status,
      c.accepts_multi_pick,c.accepts_multi_drop,c.movement_scope,c.local_place_label,c.local_radius_km,
      COALESCE(v.cargo_configuration,v.category) AS cargo_configuration,
      CASE WHEN c.photo_path IS NOT NULL AND trim(c.photo_path)<>'' THEN 1 ELSE 0 END AS proof_available,
      (SELECT GROUP_CONCAT(CASE WHEN r.geometry='RADIUS' THEN r.area_center_label || ' · Service area' ELSE r.origin || ' ↔ ' || r.destination END,' • ') FROM profile_routes r
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
      freshness:capacitySignalFreshness(row.status,row.updated_at,null,Number(process.env.CAPACITY_FRESH_HOURS||12))
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

function encodePublicCursor(row) {
  return Buffer.from(JSON.stringify([row.updated_at,row.id]),'utf8').toString('base64url');
}

function decodePublicCursor(value) {
  if (!value) return null;
  try {
    const parsed=JSON.parse(Buffer.from(String(value),'base64url').toString('utf8'));
    if(!Array.isArray(parsed)||parsed.length!==2||!parsed.every(item=>typeof item==='string'))return null;
    return {updatedAt:parsed[0],id:parsed[1]};
  } catch { return null; }
}

function publicProviderReviewSummary(db,organizationId,profileId) {
  const row=organizationId
    ? db.prepare(`SELECT COUNT(*) AS review_count,ROUND(AVG(rating),1) AS average_rating
        FROM provider_reviews WHERE provider_organization_id=? AND status='PUBLISHED'`).get(organizationId)
    : db.prepare(`SELECT COUNT(*) AS review_count,ROUND(AVG(rating),1) AS average_rating
        FROM provider_reviews WHERE provider_profile_id=? AND status='PUBLISHED'`).get(profileId);
  return {review_count:Number(row?.review_count||0),average_rating:row?.average_rating==null?null:Number(row.average_rating)};
}

function publicOwnerKey(row){return row.provider_organization_id?`org:${row.provider_organization_id}`:`profile:${row.provider_profile_id}`;}

function attachPublicCapacitySignals(rows) {
  if(!rows.length)return [];
  const db=getDb();
  const organizationIds=[...new Set(rows.map(row=>row.provider_organization_id).filter(Boolean))];
  const profileIds=[...new Set(rows.map(row=>row.provider_profile_id).filter(Boolean))];
  const clauses=[];const args=[];
  if(organizationIds.length){clauses.push(`organization_id IN (${organizationIds.map(()=>'?').join(',')})`);args.push(...organizationIds);}
  if(profileIds.length){clauses.push(`provider_profile_id IN (${profileIds.map(()=>'?').join(',')})`);args.push(...profileIds);}
  const corridors=clauses.length?db.prepare(`SELECT id,organization_id,provider_profile_id,geometry,origin,destination,route_points_json,
    origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng,
    area_center_place_ref,area_center_label,area_center_lat,area_center_lng,area_boundary_json
    FROM profile_routes WHERE ${clauses.join(' OR ')} ORDER BY created_at DESC,id`).all(...args):[];
  const corridorsByOwner=new Map();
  for(const corridor of corridors){const key=corridor.organization_id?`org:${corridor.organization_id}`:`profile:${corridor.provider_profile_id}`;if(!corridorsByOwner.has(key))corridorsByOwner.set(key,[]);if(corridorsByOwner.get(key).length<1)corridorsByOwner.get(key).push({...corridor,geometry:corridor.geometry==='RADIUS'?'RADIUS':'ROUTE',route_points:parsePlacePoints(corridor.route_points_json,corridor.geometry==='RADIUS'?0:2,5),area_boundary:parsePlacePoints(corridor.area_boundary_json,corridor.geometry==='RADIUS'?3:0,5)});}
  return rows.map(row=>({
    ...row,
    current_route_points:parsePlacePoints(row.current_route_points_json,row.availability_geometry==='ROUTE'?2:0,5),
    capacity_area_boundary:parsePlacePoints(row.capacity_area_boundary_json,row.availability_geometry==='RADIUS'?3:0,5),
    recurring_corridors:corridorsByOwner.get(publicOwnerKey(row))||[]
  }));
}

export function listPublicCapacityCursor(filters={},options={}) {
  const db=getDb();
  const authorizedVehicleIds=Array.isArray(options.authorizedVehicleIds)
    ? [...new Set(options.authorizedVehicleIds.map(String).filter(Boolean))]
    : null;
  const anonymousProjection=authorizedVehicleIds===null;
  const pageSize=Math.max(12,Math.min(authorizedVehicleIds?100:16,Number(options.pageSize)||14));
  const cursor=decodePublicCursor(options.cursor);
  const where=[`v.active=1`,`cp.published=1`,
    `c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)`,
    `COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')`,
    `(p.id IS NOT NULL OR o.type='TRANSPORT_COMPANY')`];
  const args=[];
  if(authorizedVehicleIds){
    if(!authorizedVehicleIds.length)where.push('0=1');
    else{where.push(`c.vehicle_id IN (${authorizedVehicleIds.map(()=>'?').join(',')})`);args.push(...authorizedVehicleIds);}
  }else where.push(`(c.visibility='OPEN' OR EXISTS(SELECT 1 FROM profile_routes public_regular
    WHERE public_regular.organization_id=c.provider_organization_id OR public_regular.provider_profile_id=c.provider_profile_id))`);
  if(cursor){where.push(`(c.updated_at<? OR (c.updated_at=? AND c.id<?))`);args.push(cursor.updatedAt,cursor.updatedAt,cursor.id);}
  if(filters.capacityId){where.push(`c.id=?`);args.push(String(filters.capacityId));}
  if(filters.providerOrganizationId){where.push(`c.provider_organization_id=?`);args.push(String(filters.providerOrganizationId));}
  if(filters.providerProfileId){where.push(`c.provider_profile_id=?`);args.push(String(filters.providerProfileId));}
  if(filters.provider){where.push(`lower(COALESCE(o.handle,p.handle,''))=?`);args.push(String(filters.provider).trim().toLowerCase());}
  if(filters.status&&['EMPTY','PARTIAL'].includes(String(filters.status))){where.push(`COALESCE(c.market_status,c.status)=?`);args.push(String(filters.status));}
  if(filters.status==='PARTIAL'&&filters.geometry==='RADIUS')where.push(`0=1`);
  const hasRouteSearch=Boolean(filters.originPlaceRef||filters.destinationPlaceRef);
  if(filters.geometry&&['RADIUS','ROUTE'].includes(String(filters.geometry))&&!(filters.geometry==='ROUTE'&&hasRouteSearch)){
    where.push(`((c.visibility='OPEN' AND c.availability_geometry=?) OR EXISTS(SELECT 1 FROM profile_routes geometry_signal
      WHERE (geometry_signal.organization_id=c.provider_organization_id OR geometry_signal.provider_profile_id=c.provider_profile_id)
        AND geometry_signal.geometry=?))`);args.push(String(filters.geometry),String(filters.geometry));
  }
  if(filters.vehicleCategory){where.push(`COALESCE(v.cargo_configuration,v.category)=?`);args.push(String(filters.vehicleCategory));}
  if(filters.loadType==='FTL')where.push(`${anonymousProjection?"c.visibility='OPEN' AND ":''}c.accepts_full_load=1`);
  if(filters.loadType==='PTL')where.push(`${anonymousProjection?"c.visibility='OPEN' AND ":''}c.accepts_partial_load=1`);
  if(filters.stopOption==='MULTI_PICK')where.push(`${anonymousProjection?"c.visibility='OPEN' AND ":''}c.accepts_multi_pick=1`);
  if(filters.stopOption==='MULTI_DROP')where.push(`${anonymousProjection?"c.visibility='OPEN' AND ":''}c.accepts_multi_drop=1`);
  if(filters.freshness==='FRESH'){where.push(`c.updated_at>=?`);args.push(hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12)));}
  if(filters.freshness==='UPDATE_NEEDED'){where.push(`c.updated_at<?`);args.push(hoursFromNow(-Number(process.env.CAPACITY_FRESH_HOURS||12)));}
  if(filters.q){
    const pattern=`%${String(filters.q).trim().toLowerCase()}%`;
    where.push(`(lower(COALESCE(o.name,p.business_name,'')) LIKE ? OR lower(COALESCE(v.platform_number,'')) LIKE ?
      OR lower(COALESCE(v.make,'')) LIKE ? OR lower(COALESCE(v.model,'')) LIKE ?
      OR lower(COALESCE(v.cargo_configuration,v.category,'')) LIKE ? OR (c.visibility='OPEN' AND (lower(COALESCE(c.location_area,'')) LIKE ?
      OR lower(COALESCE(c.capacity_area_center_label,'')) LIKE ? OR lower(COALESCE(c.current_route_points_json,'')) LIKE ?
      OR lower(COALESCE(c.capacity_area_boundary_json,'')) LIKE ?))
      OR EXISTS(SELECT 1 FROM profile_routes search_route
        WHERE (search_route.organization_id=c.provider_organization_id OR search_route.provider_profile_id=c.provider_profile_id)
          AND (lower(COALESCE(search_route.route_points_json,'')) LIKE ? OR lower(COALESCE(search_route.area_center_label,'')) LIKE ?
            OR lower(COALESCE(search_route.area_boundary_json,'')) LIKE ?)))`);
    args.push(...Array(12).fill(pattern));
  }
  const originPlace=selectedBoardPlace(filters.originPlaceRef,filters.origin);
  const destinationPlace=selectedBoardPlace(filters.destinationPlaceRef,filters.destination);
  if(originPlace&&destinationPlace){
    const originRadius=boardFilterRadius(filters.originRadiusKm);
    const destinationRadius=boardFilterRadius(filters.destinationRadiusKm);
    const directionMode=filters.directionMode==='EITHER'?'EITHER':'DIRECT';
    const matchArgs=[originPlace.center_lat,originPlace.center_lng,destinationPlace.center_lat,destinationPlace.center_lng];
    where.push(`(
      (c.visibility='OPEN' AND c.availability_geometry='ROUTE' AND geo_capacity_route_match(?,?,?,?,c.current_route_points_json,?,?,?)=1)
      OR EXISTS(SELECT 1 FROM profile_routes public_route WHERE (public_route.organization_id=c.provider_organization_id OR public_route.provider_profile_id=c.provider_profile_id)
        AND public_route.geometry='ROUTE' AND geo_capacity_route_match(?,?,?,?,public_route.route_points_json,?,?,'EITHER')=1)
      OR (c.visibility='OPEN' AND COALESCE(c.market_status,c.status)='EMPTY' AND c.availability_geometry='RADIUS'
        AND geo_service_area_match(?,?,c.capacity_area_boundary_json,?)=1
        AND geo_service_area_match(?,?,c.capacity_area_boundary_json,?)=1)
      OR (COALESCE(c.market_status,c.status)='EMPTY' AND EXISTS(SELECT 1 FROM profile_routes public_area
        WHERE (public_area.organization_id=c.provider_organization_id OR public_area.provider_profile_id=c.provider_profile_id)
          AND public_area.geometry='RADIUS'
          AND geo_service_area_match(?,?,public_area.area_boundary_json,?)=1
          AND geo_service_area_match(?,?,public_area.area_boundary_json,?)=1))
    )`);
    args.push(...matchArgs,originRadius,destinationRadius,directionMode,...matchArgs,originRadius,destinationRadius,
      originPlace.center_lat,originPlace.center_lng,originRadius,destinationPlace.center_lat,destinationPlace.center_lng,destinationRadius,
      originPlace.center_lat,originPlace.center_lng,originRadius,destinationPlace.center_lat,destinationPlace.center_lng,destinationRadius);
  }else if(originPlace||destinationPlace){
    const point=originPlace||destinationPlace;
    const radius=boardFilterRadius(originPlace?filters.originRadiusKm:filters.destinationRadiusKm);
    where.push(`(
      (c.visibility='OPEN' AND c.availability_geometry='ROUTE' AND geo_capacity_route_point_match(?,?,c.current_route_points_json,?)=1)
      OR EXISTS(SELECT 1 FROM profile_routes public_route WHERE (public_route.organization_id=c.provider_organization_id OR public_route.provider_profile_id=c.provider_profile_id)
        AND public_route.geometry='ROUTE' AND geo_capacity_route_point_match(?,?,public_route.route_points_json,?)=1)
      OR (c.visibility='OPEN' AND COALESCE(c.market_status,c.status)='EMPTY' AND c.availability_geometry='RADIUS'
        AND geo_service_area_match(?,?,c.capacity_area_boundary_json,?)=1)
      OR (COALESCE(c.market_status,c.status)='EMPTY' AND EXISTS(SELECT 1 FROM profile_routes public_area
        WHERE (public_area.organization_id=c.provider_organization_id OR public_area.provider_profile_id=c.provider_profile_id)
          AND public_area.geometry='RADIUS' AND geo_service_area_match(?,?,public_area.area_boundary_json,?)=1))
    )`);
    args.push(point.center_lat,point.center_lng,radius,point.center_lat,point.center_lng,radius,
      point.center_lat,point.center_lng,radius,point.center_lat,point.center_lng,radius);
  }
  const currentAreaPlace=selectedBoardPlace(filters.currentAreaPlaceRef,filters.currentArea);
  if(currentAreaPlace){where.push(`(
    (c.visibility='OPEN' AND c.availability_geometry='RADIUS' AND geo_service_area_match(?,?,c.capacity_area_boundary_json,?)=1)
    OR EXISTS(SELECT 1 FROM profile_routes public_area WHERE (public_area.organization_id=c.provider_organization_id OR public_area.provider_profile_id=c.provider_profile_id)
      AND public_area.geometry='RADIUS' AND geo_service_area_match(?,?,public_area.area_boundary_json,?)=1)
  )`);const radius=boardFilterRadius(filters.currentAreaRadiusKm);args.push(currentAreaPlace.center_lat,currentAreaPlace.center_lng,radius,currentAreaPlace.center_lat,currentAreaPlace.center_lng,radius);}
  const nearLat=Number(filters.nearLat),nearLng=Number(filters.nearLng);
  const hasNear=Number.isFinite(nearLat)&&nearLat>=3&&nearLat<=15&&Number.isFinite(nearLng)&&nearLng>=32&&nearLng<=49;
  const nearRadius=[5,10,20,50,100].includes(Number(filters.nearRadiusKm))?Number(filters.nearRadiusKm):20;
  if(hasNear){where.push(`${anonymousProjection?"c.visibility='OPEN' AND ":''}c.location_lat IS NOT NULL AND c.location_lng IS NOT NULL AND geo_distance_km(?,?,c.location_lat,c.location_lng)<=?+COALESCE(c.location_precision_km,20)+?`);args.push(nearLat,nearLng,nearRadius,BUSINESS_SEARCH_PRIVACY_KM);}
  const rows=db.prepare(`SELECT c.id,c.vehicle_id,c.provider_organization_id,c.provider_profile_id,
      COALESCE(c.market_status,c.status) AS status,c.visibility,
      c.availability_geometry,
      c.updated_at,c.location_area,c.location_lat,c.location_lng,c.location_precision_km,c.work_radius_km,c.location_updated_at,
      ${hasNear?`geo_distance_km(${nearLat},${nearLng},c.location_lat,c.location_lng)`:'NULL'} AS near_center_distance_km,
      c.current_route_origin,c.current_route_destination,c.current_origin_place_ref,c.current_origin_lat,c.current_origin_lng,
      c.current_destination_place_ref,c.current_destination_lat,c.current_destination_lng,
      c.current_route_points_json,c.capacity_area_center_place_ref,c.capacity_area_center_label,
      c.capacity_area_center_lat,c.capacity_area_center_lng,c.capacity_area_boundary_json,
      c.accepts_full_load,c.accepts_partial_load,c.accepts_multi_pick,c.accepts_multi_drop,
      v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,COALESCE(v.cargo_configuration,v.category) AS cargo_configuration,
      COALESCE(o.name,p.business_name) AS provider_name,COALESCE(o.handle,p.handle) AS provider_handle,p.user_id AS profile_user_id,
      assignment.driver_user_id AS assigned_driver_user_id,COALESCE(assigned_driver.name,profile_user.name) AS assigned_driver_name,
      COALESCE(fleet_driver.phone,CASE WHEN cp.show_contact_phone=1 THEN cp.contact_phone END) AS assigned_driver_phone,
      CASE WHEN cp.show_contact_phone=1 THEN cp.contact_phone END AS contact_phone,
      CASE WHEN cp.show_contact_whatsapp=1 THEN cp.contact_whatsapp END AS contact_whatsapp,
      CASE WHEN cp.show_contact_email=1 THEN cp.contact_email END AS contact_email,
      CASE WHEN cp.show_contact_website=1 THEN cp.contact_website END AS contact_website
    FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    LEFT JOIN organizations o ON o.id=c.provider_organization_id
    LEFT JOIN provider_profiles p ON p.id=c.provider_profile_id
    LEFT JOIN users profile_user ON profile_user.id=p.user_id
    LEFT JOIN driver_vehicle_assignments assignment ON assignment.vehicle_id=v.id AND assignment.active=1
    LEFT JOIN users assigned_driver ON assigned_driver.id=assignment.driver_user_id
    LEFT JOIN drivers fleet_driver ON fleet_driver.user_id=assignment.driver_user_id AND fleet_driver.active=1
    JOIN company_pages cp ON cp.organization_id=c.provider_organization_id OR cp.provider_profile_id=c.provider_profile_id
    WHERE ${where.join(' AND ')} ORDER BY c.updated_at DESC,c.id DESC LIMIT ?`).all(...args,pageSize+1);
  const hasMore=rows.length>pageSize;
  const selected=rows.slice(0,pageSize).map(row=>{
    const review=publicProviderReviewSummary(db,row.provider_organization_id,row.provider_profile_id);
    const distance=hasNear?possibleDistanceRange(row.near_center_distance_km,row.location_precision_km,BUSINESS_SEARCH_PRIVACY_KM):null;
    const capacityAge=capacityUpdatePresentation(row.updated_at);
    return {...row,...review,near_center_distance_km:undefined,possible_distance_min_km:distance?.minKm??null,possible_distance_max_km:distance?.maxKm??null,accepts_full_load:Boolean(row.accepts_full_load),accepts_partial_load:Boolean(row.accepts_partial_load),accepts_multi_pick:Boolean(row.accepts_multi_pick),accepts_multi_drop:Boolean(row.accepts_multi_drop),updated_label:publicBoardTime(row.updated_at),capacity_update_stage:capacityAge.stage,capacity_updated_label:capacityAge.label,capacity_confirmation_needed:capacityAge.confirmAvailability};
  });
  const items=attachPublicCapacitySignals(selected).map(baseItem=>{
    const providerKind=baseItem.provider_organization_id?'FLEET_TRANSPORTER':providerOperatingModel(db,baseItem);
    const driverSubjectType=baseItem.provider_organization_id?'DRIVER':'PROVIDER_PROFILE';
    const driverSubjectId=baseItem.provider_organization_id?baseItem.assigned_driver_user_id:baseItem.provider_profile_id;
    const driverBadges=driverSubjectId?verificationBadges(db,driverSubjectType,driverSubjectId):verificationBadgesFromApproved('DRIVER',new Set());
    const truckBadges=providerKind==='OWNER_OPERATOR'
      ? verificationBadges(db,'VEHICLE',baseItem.vehicle_id)
      : [truckAuthorizationBadge(db,driverSubjectType,driverSubjectId||'',baseItem.vehicle_id,baseItem.platform_number)];
    const driverFirstName=String(baseItem.assigned_driver_name||'').trim().split(/\s+/)[0]||null;
    const currentGeometryVisible=baseItem.visibility==='OPEN'||!anonymousProjection;
    const locationAge=currentGeometryVisible?capacityUpdatePresentation(baseItem.location_updated_at,{kind:'location'}):null;
    const item={...baseItem,visibility:undefined,assigned_driver_name:undefined,assigned_driver_user_id:undefined,profile_user_id:undefined,
      assigned_driver_first_name:driverFirstName,assigned_driver_phone:baseItem.assigned_driver_phone||null,
      driver_kind:providerKind==='FLEET_TRANSPORTER'?'COMPANY_DRIVER':providerKind,
      driver_kind_label:providerKind==='FLEET_TRANSPORTER'?'Company driver':providerOperatingModelLabel(providerKind),
      driver_verification_badges:driverBadges,truck_verification_badges:truckBadges,
      current_signal_visibility:baseItem.visibility==='PRIVATE'?'PRIVATE_NETWORK':'PUBLIC_MARKET',
      current_signal_geometry_visible:currentGeometryVisible,
      location_update_stage:locationAge?.stage??null,location_updated_label:locationAge?.label??null,
      location_is_last_reported:locationAge?.lastReported??null};
    if(!currentGeometryVisible)Object.assign(item,{
      availability_geometry:null,
      location_area:null,location_lat:null,location_lng:null,location_precision_km:null,work_radius_km:null,location_updated_at:null,
      current_route_origin:null,current_route_destination:null,current_origin_place_ref:null,current_origin_lat:null,current_origin_lng:null,
      current_destination_place_ref:null,current_destination_lat:null,current_destination_lng:null,current_route_points:[],
      capacity_area_center_place_ref:null,capacity_area_center_label:null,capacity_area_center_lat:null,capacity_area_center_lng:null,capacity_area_boundary:[],
      accepts_full_load:false,accepts_partial_load:false,accepts_multi_pick:false,accepts_multi_drop:false,
      location_update_stage:null,location_updated_label:null,location_is_last_reported:null
    });
    if(originPlace&&destinationPlace){
      const query={origin_lat:originPlace.center_lat,origin_lng:originPlace.center_lng,destination_lat:destinationPlace.center_lat,destination_lng:destinationPlace.center_lng};
      const candidates=[];
      if(item.availability_geometry==='ROUTE')candidates.push({route_points:item.current_route_points,source:'Current capacity route',directionMode:filters.directionMode==='EITHER'?'EITHER':'DIRECT'});
      for(const route of item.recurring_corridors.filter(signal=>signal.geometry==='ROUTE'))candidates.push({route_points:route.route_points,source:'Regular capacity route',directionMode:'EITHER'});
      const matches=candidates.map(candidate=>({...candidate,...capacityRouteAlignmentMatch(query,candidate.route_points,{originRadiusKm:filters.originRadiusKm,destinationRadiusKm:filters.destinationRadiusKm,directionMode:candidate.directionMode})})).filter(candidate=>candidate.matched).sort((first,second)=>first.origin_distance_km+first.destination_distance_km-(second.origin_distance_km+second.destination_distance_km));
      const areas=[];
      if(item.status==='EMPTY'&&item.availability_geometry==='RADIUS')areas.push({boundary:item.capacity_area_boundary,source:'Current Service area'});
      if(item.status==='EMPTY')for(const signal of item.recurring_corridors.filter(signal=>signal.geometry==='RADIUS'))areas.push({boundary:signal.area_boundary,source:'Regular Service area'});
      const areaMatches=areas.map(area=>{const origin=serviceAreaGeometryMatch({lat:originPlace.center_lat,lng:originPlace.center_lng},area.boundary,{searchRadiusKm:filters.originRadiusKm});const destination=serviceAreaGeometryMatch({lat:destinationPlace.center_lat,lng:destinationPlace.center_lng},area.boundary,{searchRadiusKm:filters.destinationRadiusKm});return {...area,origin,destination,matched:origin.matched&&destination.matched,total_distance_km:Number(origin.distance_km||0)+Number(destination.distance_km||0)};}).filter(area=>area.matched).sort((first,second)=>first.total_distance_km-second.total_distance_km);
      const routeEvidence=matches[0]?`${matches[0].source} aligns · ${Math.round(matches[0].origin_distance_km)} km / ${Math.round(matches[0].destination_distance_km)} km`:null;
      const areaEvidence=areaMatches[0]?`${areaMatches[0].source} covers both shipment endpoints`:null;
      return {...item,geographic_match_label:routeEvidence||areaEvidence};
    }
    if(originPlace||destinationPlace){
      const point=originPlace||destinationPlace;
      const radiusKm=originPlace?filters.originRadiusKm:filters.destinationRadiusKm;
      const candidates=[];
      if(item.availability_geometry==='ROUTE')candidates.push({route_points:item.current_route_points,source:'Current capacity route'});
      for(const route of item.recurring_corridors.filter(signal=>signal.geometry==='ROUTE'))candidates.push({route_points:route.route_points,source:'Regular capacity route'});
      const match=candidates.map(candidate=>({...candidate,...capacityRoutePointMatch({lat:point.center_lat,lng:point.center_lng},candidate.route_points,{radiusKm})})).find(candidate=>candidate.matched);
      const areas=[];
      if(item.status==='EMPTY'&&item.availability_geometry==='RADIUS')areas.push({boundary:item.capacity_area_boundary,source:'Current Service area'});
      if(item.status==='EMPTY')for(const signal of item.recurring_corridors.filter(signal=>signal.geometry==='RADIUS'))areas.push({boundary:signal.area_boundary,source:'Regular Service area'});
      const areaMatch=areas.map(area=>({...area,...serviceAreaGeometryMatch({lat:point.center_lat,lng:point.center_lng},area.boundary,{searchRadiusKm:radiusKm})})).filter(area=>area.matched).sort((first,second)=>Number(first.distance_km||0)-Number(second.distance_km||0))[0];
      const matchLabel=match?`${match.source} passes within ${Math.round(match.distance_km)} km of ${point.place_label}`:areaMatch?`${areaMatch.source} reaches ${point.place_label}${areaMatch.inside?'':' nearby'}`:null;
      return {...item,geographic_match_label:matchLabel};
    }
    if(currentAreaPlace){
      const areas=[];
      if(item.availability_geometry==='RADIUS')areas.push({boundary:item.capacity_area_boundary,source:'Current Service area'});
      for(const signal of item.recurring_corridors.filter(signal=>signal.geometry==='RADIUS'))areas.push({boundary:signal.area_boundary,source:'Regular Service area'});
      const matches=areas.map(area=>({...area,...serviceAreaGeometryMatch({lat:currentAreaPlace.center_lat,lng:currentAreaPlace.center_lng},area.boundary,{searchRadiusKm:filters.currentAreaRadiusKm})})).filter(match=>match.matched).sort((first,second)=>first.distance_km-second.distance_km);
      return {...item,geographic_match_label:`${matches[0]?.source||'Service area'} reaches ${currentAreaPlace.place_label||filters.currentArea}${matches[0]?.inside?'':' nearby'}`};
    }
    if(hasNear)return {...item,geographic_match_label:`${item.location_is_last_reported?'Last reported approximate location':'Approximate truck location'} is within your selected proximity · ${item.location_updated_label||'location update unavailable'}`};
    return item;
  });
  return {items,nextCursor:hasMore?encodePublicCursor(selected.at(-1)):null,hasMore,pageSize};
}

export function getPublicCapacityDetail(id) {
  return listPublicCapacityCursor({capacityId:id},{pageSize:12}).items[0]||null;
}

export function listPrivateCapacityNetwork(user) {
  assertWorkspaceAccess(user);
  if(process.env.DATA_BACKEND==='supabase')return listSupabasePrivateCapacityNetwork(user);
  const db=getDb();
  let vehicles=[];
  if(user.role===USER_ROLES.TRANSPORTER){
    vehicles=db.prepare(`SELECT v.id,v.platform_number,v.make,v.model,COALESCE(v.cargo_configuration,v.category) AS cargo_configuration,
      a.driver_user_id,u.name AS driver_name
      FROM vehicles v LEFT JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id AND a.active=1
      LEFT JOIN users u ON u.id=a.driver_user_id
      WHERE v.organization_id=? AND v.active=1 ORDER BY v.platform_number`).all(user.organization_id);
  }else if(isSelfManagedDriver(user)){
    vehicles=db.prepare(`SELECT v.id,v.platform_number,v.make,v.model,COALESCE(v.cargo_configuration,v.category) AS cargo_configuration,
      ? AS driver_user_id,? AS driver_name FROM vehicles v WHERE v.provider_profile_id=? AND v.active=1 ORDER BY v.platform_number`)
      .all(user.id,user.name,user.provider_profile_id);
  }else if(isCompanyDriver(user)){
    vehicles=db.prepare(`SELECT v.id,v.platform_number,v.make,v.model,COALESCE(v.cargo_configuration,v.category) AS cargo_configuration,
      a.driver_user_id,? AS driver_name FROM vehicles v JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id AND a.active=1
      WHERE a.driver_user_id=? AND v.organization_id=? AND v.active=1 ORDER BY v.platform_number`).all(user.name,user.id,user.organization_id);
  }else throw new Error('FORBIDDEN');
  const vehicleIds=vehicles.map(vehicle=>vehicle.id);
  if(!vehicleIds.length)return [];
  const grants=db.prepare(`SELECT g.*,creator.name AS created_by_name,revoker.name AS revoked_by_name
    FROM capacity_access_grants g JOIN users creator ON creator.id=g.created_by
    LEFT JOIN users revoker ON revoker.id=g.revoked_by
    WHERE g.vehicle_id IN (${vehicleIds.map(()=>'?').join(',')})
    ORDER BY g.revoked_at IS NOT NULL,g.created_at DESC`).all(...vehicleIds);
  const byVehicle=new Map();
  for(const grant of grants){
    const safe={...grant,recipient_email_digest:undefined};
    if(!byVehicle.has(grant.vehicle_id))byVehicle.set(grant.vehicle_id,[]);
    byVehicle.get(grant.vehicle_id).push(safe);
  }
  return vehicles.map(vehicle=>({...vehicle,grants:byVehicle.get(vehicle.id)||[]}));
}

export function grantPrivateCapacityAccess(user,input) {
  assertWorkspaceAccess(user);
  if(process.env.DATA_BACKEND==='supabase')return grantSupabasePrivateCapacityAccess(user,input);
  const db=getDb();
  const vehicle=privateNetworkVehicle(db,user,String(input.vehicleId||''));
  const email=normalizePrivateContactEmail(input.email);
  const digest=privateContactDigest(email);
  const existing=db.prepare(`SELECT * FROM capacity_access_grants WHERE vehicle_id=? AND audience_type='EMAIL'
    AND recipient_email_digest=? AND revoked_at IS NULL`).get(vehicle.id,digest);
  if(existing)return {...existing,recipient_email_digest:undefined,created:false};
  const id=randomId('cag-'),timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare(`INSERT INTO capacity_access_grants
      (id,vehicle_id,audience_type,recipient_email,recipient_email_digest,created_by,created_at)
      VALUES (?,?,'EMAIL',?,?,?,?)`).run(id,vehicle.id,email,digest,user.id,timestamp);
    audit(db,user,'PRIVATE_CAPACITY_GRANTED','capacity_access_grant',id,{vehicleId:vehicle.id,audience:'EMAIL'});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return {id,vehicle_id:vehicle.id,audience_type:'EMAIL',recipient_email:email,created:true};
}

export function setLoadgisticCapacityAccess(user,vehicleId,enabled) {
  assertWorkspaceAccess(user);
  if(process.env.DATA_BACKEND==='supabase')return setSupabaseLoadgisticCapacityAccess(user,vehicleId,enabled);
  const db=getDb();
  const vehicle=privateNetworkVehicle(db,user,String(vehicleId||''));
  const digest=privateContactDigest('loadgistic-platform');
  const existing=db.prepare(`SELECT * FROM capacity_access_grants WHERE vehicle_id=? AND audience_type='LOADGISTIC'
    AND recipient_email_digest=? AND revoked_at IS NULL`).get(vehicle.id,digest);
  if(enabled&&existing)return existing.id;
  const timestamp=nowIso();
  if(enabled){
    const id=randomId('cag-');
    db.prepare(`INSERT INTO capacity_access_grants
      (id,vehicle_id,audience_type,recipient_email,recipient_email_digest,created_by,created_at)
      VALUES (?,?,'LOADGISTIC',NULL,?,?,?)`).run(id,vehicle.id,digest,user.id,timestamp);
    audit(db,user,'LOADGISTIC_CAPACITY_SHARED','capacity_access_grant',id,{vehicleId:vehicle.id});
    return id;
  }
  if(existing){
    db.prepare(`UPDATE capacity_access_grants SET revoked_at=?,revoked_by=? WHERE id=?`).run(timestamp,user.id,existing.id);
    audit(db,user,'PRIVATE_CAPACITY_REVOKED','capacity_access_grant',existing.id,{vehicleId:vehicle.id,audience:'LOADGISTIC'});
  }
  return existing?.id||null;
}

export function revokePrivateCapacityAccess(user,grantId) {
  assertWorkspaceAccess(user);
  if(process.env.DATA_BACKEND==='supabase')return revokeSupabasePrivateCapacityAccess(user,grantId);
  const db=getDb();
  const grant=db.prepare(`SELECT * FROM capacity_access_grants WHERE id=?`).get(grantId);
  if(!grant)throw new Error('NOT_FOUND');
  privateNetworkVehicle(db,user,grant.vehicle_id);
  if(grant.revoked_at)return;
  const timestamp=nowIso();
  db.prepare(`UPDATE capacity_access_grants SET revoked_at=?,revoked_by=? WHERE id=?`).run(timestamp,user.id,grant.id);
  audit(db,user,'PRIVATE_CAPACITY_REVOKED','capacity_access_grant',grant.id,{vehicleId:grant.vehicle_id,audience:grant.audience_type});
}

export function requestSharedCapacityOtp(email) {
  if(process.env.DATA_BACKEND==='supabase')return requestSupabaseSharedCapacityOtp(email);
  const normalized=normalizePrivateContactEmail(email),digest=privateContactDigest(normalized);
  const db=getDb(),timestamp=nowIso();
  const eligible=db.prepare(`SELECT 1 FROM capacity_access_grants WHERE audience_type='EMAIL' AND recipient_email_digest=?
    AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?) LIMIT 1`).get(digest,timestamp);
  if(!eligible)return {accepted:true,deliveryQueued:false};
  const id=randomId('shared-otp-'),expiresAt=new Date(Date.now()+10*60*1000).toISOString(),code=sharedCapacityOtpCode(id);
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare(`UPDATE shared_capacity_email_otps SET superseded_at=? WHERE recipient_email_digest=?
      AND used_at IS NULL AND superseded_at IS NULL AND expires_at>?`).run(timestamp,digest,timestamp);
    db.prepare(`INSERT INTO shared_capacity_email_otps
      (id,recipient_email,recipient_email_digest,code_digest,attempt_count,expires_at,created_at)
      VALUES (?,?,?,?,0,?,?)`).run(id,normalized,digest,hashTrackingAccessCode(code),expiresAt,timestamp);
    db.prepare(`INSERT INTO access_email_deliveries
      (id,delivery_kind,entity_id,recipient_email,status,attempts,created_at,updated_at)
      VALUES (?,'SHARED_CAPACITY',?,?,'QUEUED',0,?,?)`).run(randomId('delivery-'),id,normalized,timestamp,timestamp);
    audit(db,null,'SHARED_CAPACITY_OTP_REQUESTED','shared_capacity_email_otp',id,{eligible:true});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return {accepted:true,deliveryQueued:true,challengeId:id,accessCode:code};
}

export function verifySharedCapacityAccess(email,code) {
  if(process.env.DATA_BACKEND==='supabase')return verifySupabaseSharedCapacityAccess(email,code);
  const normalized=normalizePrivateContactEmail(email),digest=privateContactDigest(normalized);
  const db=getDb(),timestamp=nowIso();
  const challenge=db.prepare(`SELECT * FROM shared_capacity_email_otps WHERE recipient_email_digest=?
    AND used_at IS NULL AND superseded_at IS NULL ORDER BY created_at DESC LIMIT 1`).get(digest);
  const usable=challenge&&challenge.expires_at>timestamp&&Number(challenge.attempt_count)<5;
  const valid=usable&&challenge.code_digest===hashTrackingAccessCode(String(code||'').trim())
    &&verifyPrivateAccessCode(sharedCapacityOtpCode(challenge.id),code);
  if(!valid){
    if(challenge&&challenge.used_at===null&&challenge.superseded_at===null&&Number(challenge.attempt_count)<5){
      db.prepare(`UPDATE shared_capacity_email_otps SET attempt_count=MIN(5,attempt_count+1) WHERE id=?`).run(challenge.id);
    }
    throw new Error('SHARED_CAPACITY_ACCESS_DENIED');
  }
  const active=db.prepare(`SELECT 1 FROM capacity_access_grants WHERE audience_type='EMAIL' AND recipient_email_digest=?
    AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?) LIMIT 1`).get(digest,timestamp);
  if(!active)throw new Error('SHARED_CAPACITY_ACCESS_DENIED');
  db.prepare(`UPDATE shared_capacity_email_otps SET used_at=? WHERE id=? AND used_at IS NULL`).run(timestamp,challenge.id);
  audit(db,null,'SHARED_CAPACITY_OTP_VERIFIED','shared_capacity_email_otp',challenge.id,{});
  return {emailDigest:digest};
}

export function listSharedCapacity(emailDigest,filters={}) {
  if(process.env.DATA_BACKEND==='supabase')return listSupabaseSharedCapacity(emailDigest,filters,{pageSize:100,cursor:filters.cursor});
  const db=getDb();
  const rows=db.prepare(`SELECT DISTINCT vehicle_id FROM capacity_access_grants WHERE audience_type='EMAIL'
    AND recipient_email_digest=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)`).all(emailDigest,nowIso());
  return listPublicCapacityCursor(filters,{authorizedVehicleIds:rows.map(row=>row.vehicle_id),pageSize:100,cursor:filters.cursor});
}

export function listLoadgisticSharedCapacity(user,filters={}) {
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.OPERATIONS);
  if(process.env.DATA_BACKEND==='supabase')return listSupabaseLoadgisticSharedCapacity(user,filters,{pageSize:100,cursor:filters.cursor});
  const rows=getDb().prepare(`SELECT DISTINCT vehicle_id FROM capacity_access_grants WHERE audience_type='LOADGISTIC'
    AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)`).all(nowIso());
  return listPublicCapacityCursor(filters,{authorizedVehicleIds:rows.map(row=>row.vehicle_id),pageSize:100,cursor:filters.cursor});
}

export function getPublicProvider(handle) {
  const db=getDb();
  const row=db.prepare(`SELECT cp.*,COALESCE(o.name,p.business_name) AS name,COALESCE(o.handle,p.handle) AS handle,
      COALESCE(o.city,p.city) AS city,o.id AS provider_organization_id,p.id AS provider_profile_id,p.user_id AS profile_user_id,profile_user.name AS profile_user_name
    FROM company_pages cp LEFT JOIN organizations o ON o.id=cp.organization_id LEFT JOIN provider_profiles p ON p.id=cp.provider_profile_id
    LEFT JOIN users profile_user ON profile_user.id=p.user_id
    WHERE COALESCE(o.handle,p.handle)=? AND cp.published=1 AND (p.id IS NOT NULL OR o.type='TRANSPORT_COMPANY')`).get(handle);
  if(!row)return null;
  const safe={
    name:row.name,handle:row.handle,headline:row.headline,about:row.about,services:row.services,city:row.city,
    theme_primary:row.theme_primary,theme_accent:row.theme_accent,youtube_video_id:row.youtube_video_id,
    contact_phone:row.show_contact_phone?row.contact_phone:null,
    contact_whatsapp:row.show_contact_whatsapp?row.contact_whatsapp:null,
    contact_email:row.show_contact_email?row.contact_email:null,
    contact_website:row.show_contact_website?row.contact_website:null,
    provider_organization_id:row.provider_organization_id,provider_profile_id:row.provider_profile_id,
    profile_image_url:publicProviderProfileImageUrl(row)
  };
  const ownerColumn=row.provider_organization_id?'provider_organization_id':'provider_profile_id';
  const ownerId=row.provider_organization_id||row.provider_profile_id;
  const capacityFilters=row.provider_organization_id?{providerOrganizationId:ownerId}:{providerProfileId:ownerId};
  const all=[];
  let capacityCursor=null;
  do{
    const page=listPublicCapacityCursor(capacityFilters,{pageSize:16,cursor:capacityCursor});
    all.push(...page.items);
    capacityCursor=page.hasMore&&all.length<96?page.nextCursor:null;
  }while(capacityCursor);
  const vehicles=db.prepare(`SELECT vehicle.id,vehicle.platform_number,vehicle.make,vehicle.model,COALESCE(vehicle.cargo_configuration,vehicle.category) AS cargo_configuration,
      assignment.driver_user_id,assigned_driver.name AS driver_name,fleet_driver.phone AS driver_phone
    FROM vehicles vehicle
    LEFT JOIN driver_vehicle_assignments assignment ON assignment.vehicle_id=vehicle.id AND assignment.active=1
    LEFT JOIN users assigned_driver ON assigned_driver.id=assignment.driver_user_id
    LEFT JOIN drivers fleet_driver ON fleet_driver.user_id=assignment.driver_user_id AND fleet_driver.active=1
    WHERE vehicle.active=1 AND vehicle.${row.provider_organization_id?'organization_id':'provider_profile_id'}=? ORDER BY vehicle.platform_number`).all(ownerId);
  const reviews=db.prepare(`SELECT id,rating,note,created_at,dispute_status FROM provider_reviews WHERE ${ownerColumn}=? AND status='PUBLISHED' ORDER BY created_at DESC LIMIT 20`).all(ownerId);
  const badges=[...verificationBadges(db,row.provider_organization_id?'ORGANIZATION':'PROVIDER_PROFILE',ownerId)];
  const providerKind=providerOperatingModel(db,row);
  const truckEvidenceBadge=publicTruckEvidenceBadge(db,row,vehicles,providerKind);
  if(truckEvidenceBadge)badges.push(truckEvidenceBadge);
  const trucks=vehicles.map(vehicle=>{
    const capacity=all.find(item=>item.vehicle_id===vehicle.id)||null;
    if(!capacity){
      const driverSubjectType=row.provider_organization_id?'DRIVER':'PROVIDER_PROFILE';
      const driverSubjectId=row.provider_organization_id?vehicle.driver_user_id:row.provider_profile_id;
      const driverKind=row.provider_organization_id?'COMPANY_DRIVER':providerKind;
      const driverName=vehicle.driver_name||row.profile_user_name||'';
      const driverBadges=driverSubjectId?verificationBadges(db,driverSubjectType,driverSubjectId):verificationBadgesFromApproved('DRIVER',new Set());
      const truckBadges=driverKind==='OWNER_OPERATOR'?verificationBadges(db,'VEHICLE',vehicle.id):[truckAuthorizationBadge(db,driverSubjectType,driverSubjectId||'',vehicle.id,vehicle.platform_number)];
      return {platform_number:vehicle.platform_number,make:vehicle.make,model:vehicle.model,cargo_configuration:vehicle.cargo_configuration,
        assigned_driver_first_name:String(driverName).trim().split(/\s+/)[0]||null,assigned_driver_phone:vehicle.driver_phone||(row.show_contact_phone?row.contact_phone:null),
        driver_kind:driverKind,driver_kind_label:driverKind==='COMPANY_DRIVER'?'Company driver':providerOperatingModelLabel(driverKind),
        driver_verification_badges:driverBadges,truck_verification_badges:truckBadges,capacity:null};
    }
    const {vehicle_id:privateVehicleId,provider_organization_id:privateOrganizationId,provider_profile_id:privateProfileId,...publicCapacity}=capacity;
    return {platform_number:vehicle.platform_number,make:vehicle.make,model:vehicle.model,cargo_configuration:vehicle.cargo_configuration,capacity:publicCapacity};
  });
  return {...safe,provider_kind:providerKind,provider_kind_label:providerOperatingModelLabel(providerKind),vehicles:trucks.map(({capacity,...vehicle})=>vehicle),trucks,capacities:all,reviews,verification_badges:badges,...publicProviderReviewSummary(db,row.provider_organization_id,row.provider_profile_id)};
}

function isApprovedFeaturedDocument(db,subjectType,subjectId,verificationType,vehicleId=null) {
  const vehicleClause=vehicleId?' AND related_vehicle_id=?':'';
  const args=[subjectType,subjectId,verificationType,todayInEthiopia()];
  if(vehicleId)args.push(vehicleId);
  return Boolean(db.prepare(`SELECT 1 FROM verification_requests
    WHERE subject_type=? AND subject_id=? AND verification_type=? AND status='APPROVED'
      AND (expires_on IS NULL OR expires_on>=?)${vehicleClause}
    ORDER BY reviewed_at DESC,submitted_at DESC LIMIT 1`).get(...args));
}

function selfManagedProviderHasTruckEvidence(db,row) {
  const vehicles=db.prepare('SELECT id FROM vehicles WHERE provider_profile_id=? AND active=1').all(row.provider_profile_id);
  return vehicles.some(vehicle=>isApprovedFeaturedDocument(db,'VEHICLE',vehicle.id,'VEHICLE_OWNERSHIP')
    || isApprovedFeaturedDocument(db,'PROVIDER_PROFILE',row.provider_profile_id,'VEHICLE_AUTHORIZATION',vehicle.id)
    || (row.profile_user_id&&isApprovedFeaturedDocument(db,'DRIVER',row.profile_user_id,'VEHICLE_AUTHORIZATION',vehicle.id)));
}

function providerOperatingModel(db,row){
  if(row.provider_organization_id)return 'FLEET_TRANSPORTER';
  if(!row.provider_profile_id)return 'TRANSPORT_PROVIDER';
  const vehicles=db.prepare('SELECT id FROM vehicles WHERE provider_profile_id=? AND active=1 ORDER BY id').all(row.provider_profile_id);
  if(vehicles.some(vehicle=>isApprovedFeaturedDocument(db,'VEHICLE',vehicle.id,'VEHICLE_OWNERSHIP')))return 'OWNER_OPERATOR';
  if(vehicles.some(vehicle=>isApprovedFeaturedDocument(db,'PROVIDER_PROFILE',row.provider_profile_id,'VEHICLE_AUTHORIZATION',vehicle.id)
    || (row.profile_user_id&&isApprovedFeaturedDocument(db,'DRIVER',row.profile_user_id,'VEHICLE_AUTHORIZATION',vehicle.id))))return 'SELF_MANAGED_DRIVER';
  return 'SELF_MANAGED_DRIVER';
}

function providerOperatingModelLabel(value){
  if(value==='FLEET_TRANSPORTER')return 'Fleet transporter';
  if(value==='SELF_MANAGED_DRIVER')return 'Self-managed driver';
  if(value==='OWNER_OPERATOR')return 'Owner-operator';
  return 'Transporter';
}

function featuredProviderEligibility(db,row) {
  const reasons=[];
  if(!row.page_published)reasons.push('Public profile is not published');
  if(!row.has_public_contact)reasons.push('No public contact method is enabled');
  if(!row.base_place_ref||!row.base_place_label)reasons.push('General base city or town is not published');
  if(!row.base_region_code)reasons.push('Base region or city administration is not published');
  if(!row.fleet_size)reasons.push('No active truck is listed');
  if(row.provider_organization_id){
    for(const [type,label] of [['IDENTITY','National ID'],['BUSINESS_LICENSE','Business license'],['BUSINESS_ADDRESS','Business address']]){
      if(!isApprovedFeaturedDocument(db,'ORGANIZATION',row.provider_organization_id,type))reasons.push(`${label} is not approved`);
    }
  }else if(row.provider_profile_id){
    if(!isApprovedFeaturedDocument(db,'PROVIDER_PROFILE',row.provider_profile_id,'IDENTITY'))reasons.push('National ID is not approved');
    if(!isApprovedFeaturedDocument(db,'PROVIDER_PROFILE',row.provider_profile_id,'DRIVER_IDENTITY'))reasons.push("Driver's license is not approved");
    if(!selfManagedProviderHasTruckEvidence(db,row))reasons.push('Truck ownership or authorization is not approved');
  }else reasons.push('Provider ownership is missing');
  return {eligible:reasons.length===0,reasons};
}

function featuredProviderRows(db,regionCodes) {
  const regions=Array.isArray(regionCodes)?regionCodes.filter(Boolean):[];
  if(!regions.length)return [];
  return db.prepare(`SELECT o.id AS provider_organization_id,p.id AS provider_profile_id,p.user_id AS profile_user_id,
      COALESCE(o.name,p.business_name) AS provider_name,COALESCE(o.handle,p.handle) AS provider_handle,
      COALESCE(o.city,p.city) AS base_place_label,COALESCE(o.city_place_ref,p.city_place_ref) AS base_place_ref,
      cp.headline,cp.about,cp.services,cp.operating_regions,cp.base_region_code,cp.published AS page_published,
      CASE WHEN cp.profile_image_path IS NOT NULL THEN 1 ELSE 0 END AS has_profile_image,cp.profile_image_path,cp.profile_image_preset,cp.profile_image_updated_at,
      CASE WHEN (cp.show_contact_phone=1 AND trim(COALESCE(cp.contact_phone,''))<>'')
        OR (cp.show_contact_whatsapp=1 AND trim(COALESCE(cp.contact_whatsapp,''))<>'')
        OR (cp.show_contact_email=1 AND trim(COALESCE(cp.contact_email,''))<>'')
        OR (cp.show_contact_website=1 AND trim(COALESCE(cp.contact_website,''))<>'') THEN 1 ELSE 0 END AS has_public_contact,
      (SELECT COUNT(*) FROM vehicles owned WHERE owned.active=1 AND (owned.organization_id=o.id OR owned.provider_profile_id=p.id)) AS fleet_size,
      (SELECT COUNT(*) FROM vehicles owned JOIN capacities latest ON latest.vehicle_id=owned.id
        WHERE owned.active=1 AND (owned.organization_id=o.id OR owned.provider_profile_id=p.id)
          AND latest.id=(SELECT current.id FROM capacities current WHERE current.vehicle_id=owned.id ORDER BY current.updated_at DESC,current.id DESC LIMIT 1)
          AND COALESCE(latest.market_status,latest.status) IN ('EMPTY','PARTIAL')) AS active_capacity_count
    FROM company_pages cp
    LEFT JOIN organizations o ON o.id=cp.organization_id
    LEFT JOIN provider_profiles p ON p.id=cp.provider_profile_id
    WHERE cp.base_region_code IN (${regions.map(()=>'?').join(',')})
      AND (p.id IS NOT NULL OR o.type='TRANSPORT_COMPANY')
    ORDER BY provider_name`).all(...regions);
}

function decorateFeaturedProvider(db,row) {
  const review=publicProviderReviewSummary(db,row.provider_organization_id,row.provider_profile_id);
  const providerKind=providerOperatingModel(db,row);
  const corridors=db.prepare(`SELECT geometry,route_points_json,area_center_label,area_boundary_json FROM profile_routes WHERE ${row.provider_organization_id?'organization_id':'provider_profile_id'}=? ORDER BY created_at DESC,id DESC LIMIT 1`).all(row.provider_organization_id||row.provider_profile_id).map(signal=>signal.geometry==='RADIUS'?`${signal.area_center_label||'Service area'} · ${routePointLabel(parsePlacePoints(signal.area_boundary_json,3,5),'–')}`:routePointLabel(parsePlacePoints(signal.route_points_json,2,5),'–'));
  return {
    provider_key:row.provider_organization_id?`organization:${row.provider_organization_id}`:`profile:${row.provider_profile_id}`,
    name:row.provider_name,handle:row.provider_handle,base_place:row.base_place_label,base_region:providerRegionLabel(row.base_region_code),headline:row.headline,
    profile_image_url:row.has_profile_image?`/api/public/providers/${encodeURIComponent(row.provider_handle)}/image?v=${encodeURIComponent(row.profile_image_updated_at||'1')}`:seededTransporterPortraitUrl(row.profile_image_preset),
    provider_kind:providerKind,provider_kind_label:providerOperatingModelLabel(providerKind),
    about:row.about,services:row.services,operating_regions:row.operating_regions,corridors,
    fleet_size:row.fleet_size,active_capacity_count:row.active_capacity_count,...review
  };
}

export function listFeaturedProviderCandidates(user,date=todayInEthiopia()) {
  if(user?.role!==USER_ROLES.ADMIN)throw new Error('FORBIDDEN');
  const db=getDb();
  const expo=regionalExpoGroupForDate(validateFeaturedDate(date));
  return featuredProviderRows(db,expo.regionCodes).map(row=>({...decorateFeaturedProvider(db,row),...featuredProviderEligibility(db,row)}));
}

function validateFeaturedDate(value) {
  const date=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(`${date}T12:00:00.000Z`).getTime()))throw new Error('FEATURED_DATE_INVALID');
  return date;
}

function validateFeaturedTikTokUrl(value) {
  const raw=String(value||'').trim();
  if(!raw)return null;
  let url;
  try{url=new URL(raw);}catch{throw new Error('FEATURED_TIKTOK_URL_INVALID');}
  const hostname=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||!(hostname==='tiktok.com'||hostname.endsWith('.tiktok.com')))throw new Error('FEATURED_TIKTOK_URL_INVALID');
  return url.toString();
}

function validateExpoText(value,min,max,errorCode) {
  const text=String(value||'').trim();
  if(!text)return null;
  if(text.length<min||text.length>max)throw new Error(errorCode);
  return text;
}

function sponsorshipProviderKey(row) {
  return row.provider_organization_id?`organization:${row.provider_organization_id}`:`profile:${row.provider_profile_id}`;
}

function providerSponsorshipRows(db,expo,date,{includeFuture=false}={}) {
  const dateClause=includeFuture?'placement.ends_on>=?':'placement.starts_on<=? AND placement.ends_on>=?';
  const args=includeFuture?[expo.key,date]:[expo.key,date,date];
  return db.prepare(`SELECT placement.*,sponsor.sponsor_kind,sponsor.provider_organization_id,sponsor.provider_profile_id,
    sponsor.business_name,sponsor.description,sponsor.website_url,sponsor.phone,sponsor.active AS sponsor_active
    FROM sponsor_placements placement JOIN sponsors sponsor ON sponsor.id=placement.sponsor_id
    WHERE placement.expo_group_key=? AND placement.active=1 AND sponsor.active=1 AND ${dateClause}
    ORDER BY placement.starts_on,placement.position,placement.id`).all(...args);
}

function sponsoredProviderProjection(db,expo,date) {
  const available=new Map(featuredProviderRows(db,expo.regionCodes).map(row=>[sponsorshipProviderKey(row),row]));
  const providers=[];
  for(const sponsorship of providerSponsorshipRows(db,expo,date)){
    if(sponsorship.sponsor_kind==='ADVERTISER'){
      providers.push({sponsor_kind:'ADVERTISER',name:sponsorship.business_name,description:sponsorship.description,website_url:sponsorship.website_url||null,phone:sponsorship.phone||null,sponsor_position:sponsorship.position,sponsored:true});
      continue;
    }
    const row=available.get(sponsorshipProviderKey(sponsorship));
    if(!row||!featuredProviderEligibility(db,row).eligible)continue;
    const {provider_key:privateProviderKey,...safeProvider}=decorateFeaturedProvider(db,row);
    providers.push({...safeProvider,sponsor_kind:'TRANSPORTER',sponsor_position:sponsorship.position,sponsored:true});
  }
  return providers.slice(0,SPONSORED_PROVIDER_LIMIT);
}

function sponsorName(row){return row.sponsor_kind==='ADVERTISER'?row.business_name:row.candidate?.name||null;}

function assignSponsorsToSchedule(schedule,sponsors){
  const names=sponsors.map(sponsor=>sponsorName(sponsor)||sponsor.name).filter(Boolean);
  let index=0;
  return {...schedule,entries:schedule.entries.map(entry=>{
    if(entry.type!=='SPONSOR_BREAK'||!names.length)return entry;
    const name=names[index%names.length];index+=1;
    return {...entry,sponsor_name:name,label:`Sponsor · ${name}`};
  })};
}

function validateSponsorWebsite(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  let url;
  try{url=new URL(raw);}catch{throw new Error('SPONSOR_WEBSITE_INVALID');}
  if(url.protocol!=='https:')throw new Error('SPONSOR_WEBSITE_INVALID');
  return url.toString();
}

function featuredScheduleJson(value,fallback){
  if(value&&typeof value==='object')return value;
  try{return JSON.parse(String(value||''));}catch{return fallback;}
}

function featuredScheduleForDay(day,featureDate,keys,now=Date.now(),{publicProjection=false,keyAliases=null}={}){
  const mode=String(day?.schedule_mode||'AUTO').toUpperCase();
  const config=featuredScheduleJson(day?.schedule_config_json,{});
  let manualSchedule=featuredScheduleJson(day?.manual_schedule_json,[]);
  if(publicProjection&&mode==='MANUAL'){
    const allowed=new Set(keys);
    manualSchedule=Array.isArray(manualSchedule)?manualSchedule.map(item=>({...item,providerKey:keyAliases?.get(String(item?.providerKey||''))||String(item?.providerKey||'')})).filter(item=>allowed.has(item.providerKey)):[];
  }
  try{return buildFeaturedDaySchedule(featureDate,keys,{mode,config,manualSchedule},now);}
  catch(error){
    if(publicProjection&&mode==='MANUAL')return buildFeaturedDaySchedule(featureDate,keys,{mode:'AUTO',config},now);
    throw error;
  }
}

export function saveFeaturedProviderDay(user,input={}) {
  if(user?.role!==USER_ROLES.ADMIN)throw new Error('FORBIDDEN');
  const featureDate=validateFeaturedDate(input.featureDate);
  const expo=regionalExpoGroupForDate(featureDate);
  const status=input.publish?'PUBLISHED':'DRAFT';
  const tiktokUrl=validateFeaturedTikTokUrl(input.tiktokUrl);
  const publicHeadline=validateExpoText(input.publicHeadline,3,90,'FEATURED_HEADLINE_INVALID');
  const publicIntroduction=validateExpoText(input.publicIntroduction,10,240,'FEATURED_INTRODUCTION_INVALID');
  const providerKeys=(Array.isArray(input.providerKeys)?input.providerKeys:[]).map(String).filter(Boolean);
  if(status==='PUBLISHED'&&!providerKeys.length)throw new Error('FEATURED_PROVIDER_REQUIRED');
  if(new Set(providerKeys).size!==providerKeys.length)throw new Error('FEATURED_PROVIDER_DUPLICATE');
  const db=getDb();
  const available=new Map(featuredProviderRows(db,expo.regionCodes).map(row=>[
    row.provider_organization_id?`organization:${row.provider_organization_id}`:`profile:${row.provider_profile_id}`,row
  ]));
  const selected=[];
  for(const providerKey of providerKeys){
    const row=available.get(providerKey);
    if(!row)throw new Error('FEATURED_PROVIDER_INVALID');
    const eligibility=featuredProviderEligibility(db,row);
    if(!eligibility.eligible)throw new Error(`FEATURED_PROVIDER_INELIGIBLE:${row.provider_name}: ${eligibility.reasons.join(', ')}`);
    selected.push(row);
  }
  const scheduleMode=String(input.scheduleMode||'AUTO').toUpperCase();
  const scheduleConfig=validateFeaturedScheduleConfig(input.scheduleConfig||{});
  let manualSchedule=input.manualSchedule;
  if(typeof manualSchedule==='string'){
    try{manualSchedule=JSON.parse(manualSchedule||'[]');}catch{throw new Error('FEATURED_MANUAL_SCHEDULE_INVALID');}
  }
  if(!Array.isArray(manualSchedule))manualSchedule=[];
  const schedule=buildFeaturedDaySchedule(featureDate,providerKeys,{mode:scheduleMode,config:scheduleConfig,manualSchedule});
  const storedConfig=schedule.config;
  const storedManual=scheduleMode==='MANUAL'?manualSchedule:[];
  const existing=db.prepare('SELECT id FROM featured_provider_days WHERE feature_date=?').get(featureDate);
  const dayId=existing?.id||randomId('featured-day-');
  const timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare(`INSERT INTO featured_provider_days
      (id,feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,expo_region_codes,public_headline,public_introduction,tiktok_url,broadcast_start_time,broadcast_end_time,schedule_mode,schedule_config_json,manual_schedule_json,status,created_by,published_by,created_at,updated_at,published_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(feature_date) DO UPDATE SET base_place_ref=excluded.base_place_ref,base_place_label=excluded.base_place_label,
        expo_group_key=excluded.expo_group_key,expo_group_label=excluded.expo_group_label,expo_region_codes=excluded.expo_region_codes,
        public_headline=excluded.public_headline,public_introduction=excluded.public_introduction,tiktok_url=excluded.tiktok_url,
        broadcast_start_time=excluded.broadcast_start_time,broadcast_end_time=excluded.broadcast_end_time,
        schedule_mode=excluded.schedule_mode,schedule_config_json=excluded.schedule_config_json,manual_schedule_json=excluded.manual_schedule_json,
        status=excluded.status,published_by=excluded.published_by,updated_at=excluded.updated_at,published_at=excluded.published_at`)
      .run(dayId,featureDate,`expo:${expo.key}`,expo.title,expo.key,expo.title,JSON.stringify(expo.regionCodes),publicHeadline,publicIntroduction,tiktokUrl,storedConfig.dayStart,storedConfig.dayEnd,scheduleMode,JSON.stringify(storedConfig),JSON.stringify(storedManual),status,user.id,status==='PUBLISHED'?user.id:null,timestamp,timestamp,status==='PUBLISHED'?timestamp:null);
    db.prepare('DELETE FROM featured_provider_slots WHERE day_id=?').run(dayId);
    const insertSlot=db.prepare(`INSERT INTO featured_provider_slots
      (id,day_id,slot_position,provider_organization_id,provider_profile_id,created_by,created_at)
      VALUES (?,?,?,?,?,?,?)`);
    selected.forEach((row,index)=>insertSlot.run(randomId('featured-slot-'),dayId,index+1,row.provider_organization_id,row.provider_profile_id,user.id,timestamp));
    audit(db,user,status==='PUBLISHED'?'FEATURED_DAY_PUBLISHED':'FEATURED_DAY_SAVED','FEATURED_PROVIDER_DAY',dayId,{featureDate,expoGroupKey:expo.key,providerCount:selected.length,scheduleMode,scheduleConfig:storedConfig,manualIntervalCount:storedManual.length});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return getAdminFeaturedProviderDay(user,featureDate);
}

export function getAdminFeaturedProviderDay(user,date=todayInEthiopia()) {
  if(user?.role!==USER_ROLES.ADMIN)throw new Error('FORBIDDEN');
  const featureDate=validateFeaturedDate(date);
  const expo=regionalExpoGroupForDate(featureDate);
  const db=getDb();
  const day=db.prepare('SELECT * FROM featured_provider_days WHERE feature_date=?').get(featureDate)||null;
  const slots=day?db.prepare('SELECT * FROM featured_provider_slots WHERE day_id=? ORDER BY slot_position').all(day.id):[];
  const candidates=listFeaturedProviderCandidates(user,featureDate);
  const byProvider=new Map(candidates.map(candidate=>[candidate.provider_key,candidate]));
  const slotEvaluations=slots.map(slot=>{const key=slot.provider_organization_id?`organization:${slot.provider_organization_id}`:`profile:${slot.provider_profile_id}`;return {...slot,candidate:byProvider.get(key)||null,eligible:Boolean(byProvider.get(key)?.eligible)};});
  const sponsorships=providerSponsorshipRows(db,expo,featureDate,{includeFuture:true}).map(sponsorship=>{
    const candidate=sponsorship.sponsor_kind==='TRANSPORTER'?byProvider.get(sponsorshipProviderKey(sponsorship))||null:null;
    return {...sponsorship,provider_key:sponsorship.sponsor_kind==='TRANSPORTER'?sponsorshipProviderKey(sponsorship):null,candidate,
      sponsor_name:sponsorship.sponsor_kind==='ADVERTISER'?sponsorship.business_name:candidate?.name||'Transporter unavailable',
      eligible:sponsorship.sponsor_kind==='ADVERTISER'||Boolean(candidate?.eligible)};
  });
  const slotKeys=slots.map(slot=>slot.provider_organization_id?`organization:${slot.provider_organization_id}`:`profile:${slot.provider_profile_id}`);
  const schedule=assignSponsorsToSchedule(featuredScheduleForDay(day,featureDate,slotKeys),sponsorships.filter(item=>item.eligible&&item.starts_on<=featureDate&&item.ends_on>=featureDate));
  return {day,slots,slotEvaluations,candidates,sponsorships,expo,schedule,walkthroughs:schedule.walkthroughs};
}

export function saveProviderSponsorship(user,input={}) {
  if(user?.role!==USER_ROLES.ADMIN)throw new Error('FORBIDDEN');
  const featureDate=validateFeaturedDate(input.featureDate);
  const startsOn=validateFeaturedDate(input.startsOn);
  const endsOn=validateFeaturedDate(input.endsOn);
  if(startsOn>endsOn)throw new Error('SPONSORSHIP_DATE_RANGE_INVALID');
  const span=(new Date(`${endsOn}T12:00:00.000Z`).getTime()-new Date(`${startsOn}T12:00:00.000Z`).getTime())/86400000;
  if(span>365)throw new Error('SPONSORSHIP_DATE_RANGE_INVALID');
  const position=Number(input.position);
  if(!Number.isInteger(position)||position<1||position>SPONSORED_PROVIDER_LIMIT)throw new Error('SPONSORSHIP_POSITION_INVALID');
  const sponsorKind=String(input.sponsorKind||'TRANSPORTER').toUpperCase();
  if(!['TRANSPORTER','ADVERTISER'].includes(sponsorKind))throw new Error('SPONSORSHIP_KIND_INVALID');
  const providerKey=String(input.providerKey||'');
  const expo=regionalExpoGroupForDate(featureDate);
  const db=getDb();
  let provider=null;
  let businessName=null,description=null,websiteUrl=null,phone=null;
  if(sponsorKind==='TRANSPORTER'){
    const available=new Map(featuredProviderRows(db,expo.regionCodes).map(row=>[sponsorshipProviderKey(row),row]));
    provider=available.get(providerKey);
    if(!provider)throw new Error('SPONSORSHIP_PROVIDER_INVALID');
    const eligibility=featuredProviderEligibility(db,provider);
    if(!eligibility.eligible)throw new Error(`SPONSORSHIP_PROVIDER_INELIGIBLE:${provider.provider_name}: ${eligibility.reasons.join(', ')}`);
  }else{
    businessName=String(input.businessName||'').trim();
    description=String(input.description||'').trim();
    if(businessName.length<2||businessName.length>100)throw new Error('SPONSOR_NAME_INVALID');
    if(description.length<10||description.length>240)throw new Error('SPONSOR_DESCRIPTION_INVALID');
    websiteUrl=validateSponsorWebsite(input.websiteUrl);
    phone=normalizeOptionalCallbackPhone(input.phone);
    if(!websiteUrl&&!phone)throw new Error('SPONSOR_CONTACT_REQUIRED');
  }
  const sponsorshipId=String(input.sponsorshipId||'').trim()||randomId('provider-sponsor-');
  const existing=input.sponsorshipId?db.prepare('SELECT * FROM sponsor_placements WHERE id=?').get(sponsorshipId):null;
  if(input.sponsorshipId&&!existing)throw new Error('SPONSORSHIP_NOT_FOUND');
  const sponsorId=existing?.sponsor_id||(sponsorKind==='TRANSPORTER'?(provider.provider_organization_id?`sponsor-organization-${provider.provider_organization_id}`:`sponsor-profile-${provider.provider_profile_id}`):randomId('sponsor-advertiser-'));
  const timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare(`INSERT INTO sponsors
      (id,sponsor_kind,provider_organization_id,provider_profile_id,business_name,description,website_url,phone,active,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET sponsor_kind=excluded.sponsor_kind,provider_organization_id=excluded.provider_organization_id,
        provider_profile_id=excluded.provider_profile_id,business_name=excluded.business_name,description=excluded.description,
        website_url=excluded.website_url,phone=excluded.phone,active=1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
      .run(sponsorId,sponsorKind,provider?.provider_organization_id||null,provider?.provider_profile_id||null,businessName,description,websiteUrl,phone,user.id,user.id,timestamp,timestamp);
    const overlap=db.prepare(`SELECT id FROM sponsor_placements WHERE active=1 AND expo_group_key=? AND starts_on<=? AND ends_on>=? AND id<>?
      AND (position=? OR sponsor_id=?) LIMIT 1`).get(expo.key,endsOn,startsOn,sponsorshipId,position,sponsorId);
    if(overlap)throw new Error('SPONSORSHIP_OVERLAP');
    db.prepare(`INSERT INTO sponsor_placements
      (id,sponsor_id,expo_group_key,starts_on,ends_on,position,active,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,1,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET expo_group_key=excluded.expo_group_key,starts_on=excluded.starts_on,ends_on=excluded.ends_on,
        position=excluded.position,sponsor_id=excluded.sponsor_id,
        active=1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
      .run(sponsorshipId,sponsorId,expo.key,startsOn,endsOn,position,user.id,user.id,timestamp,timestamp);
    audit(db,user,'SPONSORSHIP_SAVED','SPONSORSHIP',sponsorshipId,{expoGroupKey:expo.key,startsOn,endsOn,position,sponsorKind,providerKey:sponsorKind==='TRANSPORTER'?providerKey:null});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return getAdminFeaturedProviderDay(user,featureDate);
}

export function disableProviderSponsorship(user,sponsorshipId) {
  if(user?.role!==USER_ROLES.ADMIN)throw new Error('FORBIDDEN');
  const db=getDb();
  const sponsorship=db.prepare('SELECT * FROM sponsor_placements WHERE id=?').get(String(sponsorshipId||''));
  if(!sponsorship)throw new Error('SPONSORSHIP_NOT_FOUND');
  const timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare('UPDATE sponsor_placements SET active=0,updated_by=?,updated_at=? WHERE id=?').run(user.id,timestamp,sponsorship.id);
    audit(db,user,'SPONSORSHIP_DISABLED','SPONSORSHIP',sponsorship.id,{expoGroupKey:sponsorship.expo_group_key});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return sponsorship;
}

export function getDailyFeaturedProviders(date=todayInEthiopia()) {
  const featureDate=validateFeaturedDate(date);
  const expo=regionalExpoGroupForDate(featureDate);
  const db=getDb();
  let day=db.prepare("SELECT * FROM featured_provider_days WHERE feature_date=? AND status='PUBLISHED'").get(featureDate);
  if(!day&&featureDate===todayInEthiopia()){
    ensureSeededDailyFeaturedProviderDay(featureDate);
    day=db.prepare("SELECT * FROM featured_provider_days WHERE feature_date=? AND status='PUBLISHED'").get(featureDate);
  }
  if(!day||(day.expo_group_key&&day.expo_group_key!==expo.key))return {
    feature_date:featureDate,
    base_place:expo.title,
    expo_group:expo,
    week:regionalExpoWeekForDate(featureDate),
    headline:'Daily Featured Transporters',
    introduction:`Today’s ${expo.title} transporter roster is being prepared.`,
    tiktok_url:null,
    broadcast_start_time:DEFAULT_FEATURED_SCHEDULE_CONFIG.dayStart,
    broadcast_end_time:DEFAULT_FEATURED_SCHEDULE_CONFIG.dayEnd,
    schedule:buildFeaturedDaySchedule(featureDate,0),
    walkthroughs:[],
    sponsored_providers:[],
    providers:[],
    published:false
  };
  const matchingRows=new Map(featuredProviderRows(db,expo.regionCodes).map(row=>[
    row.provider_organization_id?`organization:${row.provider_organization_id}`:`profile:${row.provider_profile_id}`,row
  ]));
  const slots=db.prepare('SELECT * FROM featured_provider_slots WHERE day_id=? ORDER BY slot_position').all(day.id);
  const providers=[];
  const publicProviderKeys=[];
  const publicKeyAliases=new Map();
  for(const slot of slots){
    const providerKey=slot.provider_organization_id?`organization:${slot.provider_organization_id}`:`profile:${slot.provider_profile_id}`;
    const row=matchingRows.get(providerKey);
    if(!row)continue;
    const eligibility=featuredProviderEligibility(db,row);
    if(!eligibility.eligible)continue;
    const {provider_key:privateProviderKey,...safeProvider}=decorateFeaturedProvider(db,row);
    providers.push({...safeProvider,position:slot.slot_position});
    publicProviderKeys.push(safeProvider.handle);
    publicKeyAliases.set(providerKey,safeProvider.handle);
  }
  const sponsoredProviders=sponsoredProviderProjection(db,expo,featureDate);
  const schedule=assignSponsorsToSchedule(featuredScheduleForDay(day,featureDate,publicProviderKeys,Date.now(),{publicProjection:true,keyAliases:publicKeyAliases}),sponsoredProviders);
  return {
    feature_date:day.feature_date,
    base_place:expo.title,
    expo_group:expo,
    week:regionalExpoWeekForDate(featureDate),
    headline:day.public_headline||'Daily Featured Transporters',
    introduction:day.public_introduction||`Meet transporters based in ${expo.title}, then find their current trucks in the Truck Market.`,
    tiktok_url:day.tiktok_url,
    broadcast_start_time:schedule.config.dayStart,
    broadcast_end_time:schedule.config.dayEnd,
    schedule,
    walkthroughs:schedule.walkthroughs,
    sponsored_providers:sponsoredProviders,
    providers,
    published:true
  };
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
    cargo_configuration:row.cargo_configuration||row.vehicle_category,
    accepts_full_load:Boolean(row.accepts_full_load),
    accepts_partial_load:Boolean(row.accepts_partial_load),
    accepts_multi_pick:Boolean(row.accepts_multi_pick),
    accepts_multi_drop:Boolean(row.accepts_multi_drop),
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
      return { ...row, status,
        current_route_points:parsePlacePoints(row.current_route_points_json,row.availability_geometry==='ROUTE'?2:0,5),
        capacity_area_boundary:parsePlacePoints(row.capacity_area_boundary_json,row.availability_geometry==='RADIUS'?3:0,5),
        proof_available: Boolean(row.photo_path), freshness: capacitySignalFreshness(status,row.updated_at,null,freshHours), expiry_state:'CURRENT', isOwn: true };
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
      ? db.prepare(`SELECT id,geometry,origin,destination,route_points_json,area_center_label,area_boundary_json FROM profile_routes WHERE ${condition} ORDER BY created_at,id LIMIT 1`).all(ownerId).map(row=>({...row,route_points:parsePlacePoints(row.route_points_json,row.geometry==='RADIUS'?0:2,5),area_boundary:parsePlacePoints(row.area_boundary_json,row.geometry==='RADIUS'?3:0,5)}))
      : []
  };
}

export function listOwnVehicles(user) {
  assertWorkspaceAccess(user);
  const db = getDb();
  let rows=[];
  if (isSelfManagedDriver(user)) rows=db.prepare('SELECT * FROM vehicles WHERE provider_profile_id=? AND active=1').all(user.provider_profile_id);
  else if (isCompanyDriver(user)) rows=db.prepare(`SELECT v.* FROM vehicles v JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id
    WHERE a.driver_user_id=? AND a.active=1 AND v.organization_id=? AND v.active=1 ORDER BY v.label`).all(user.id,user.organization_id);
  else if (user.role === USER_ROLES.TRANSPORTER) rows=db.prepare('SELECT * FROM vehicles WHERE organization_id=? AND active=1').all(user.organization_id);
  return rows.map(row=>({...row}));
}

export function listOwnRecurringCorridors(user) {
  assertWorkspaceAccess(user);const scope=providerScope(user);if(!scope)return [];const db=getDb(),ownerColumn=scope.column==='provider_organization_id'?'organization_id':'provider_profile_id';
  return db.prepare(`SELECT * FROM profile_routes WHERE ${ownerColumn}=? ORDER BY created_at DESC,id LIMIT 1`).all(scope.id).map(row=>({...row,geometry:row.geometry==='RADIUS'?'RADIUS':'ROUTE',route_points:parsePlacePoints(row.route_points_json,row.geometry==='RADIUS'?0:2,5),area_boundary:parsePlacePoints(row.area_boundary_json,row.geometry==='RADIUS'?3:0,5)}));
}

export function addRecurringCorridor(user,input) {
  assertWorkspaceAccess(user);if(isCompanyDriver(user)||![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role))throw new Error('FORBIDDEN');
  const db=getDb(),scope=providerScope(user);if(!scope)throw new Error('FORBIDDEN');
  const ownerColumn=scope.organizationId?'organization_id':'provider_profile_id',ownerId=scope.organizationId||scope.profileId;
  const count=Number(db.prepare(`SELECT COUNT(*) AS n FROM profile_routes WHERE ${ownerColumn}=?`).get(ownerId).n);if(count>=1)throw new Error('REGULAR_CAPACITY_LIMIT');
  const geometry=String(input.geometry||'ROUTE').toUpperCase();if(!['ROUTE','RADIUS'].includes(geometry))throw new Error('INVALID_AVAILABILITY_GEOMETRY');
  let points=[],boundary=[],center=null;
  if(geometry==='ROUTE')points=resolvePlaceSequence(input.routePlaces,2,5,'CAPACITY_ROUTE_POINTS_REQUIRED');
  else{
    center=resolvePlaceReference(input.areaCenterPlaceRef,input.areaCenter);
    boundary=resolvePlaceSequence(input.areaBoundaryPlaces,3,5,'CAPACITY_AREA_BOUNDARY_REQUIRED');
    if(boundary.some(point=>point.place_ref===center.place_ref))throw new Error('CAPACITY_PLACE_DUPLICATE');
  }
  const first=geometry==='ROUTE'?points[0]:{label:center.place_label,place_ref:center.place_ref,lat:Number(center.center_lat),lng:Number(center.center_lng)};
  const last=geometry==='ROUTE'?points.at(-1):first;
  const id=randomId('route-');db.prepare(`INSERT INTO profile_routes
    (id,organization_id,provider_profile_id,geometry,origin,destination,created_by,created_at,
      origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng,route_points_json,
      area_center_place_ref,area_center_label,area_center_lat,area_center_lng,area_boundary_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,scope.organizationId,scope.profileId,geometry,first.label,last.label,user.id,nowIso(),first.place_ref,first.lat,first.lng,last.place_ref,last.lat,last.lng,JSON.stringify(points),center?.place_ref||null,center?.place_label||null,center?.center_lat??null,center?.center_lng??null,JSON.stringify(boundary));
  audit(db,user,'REGULAR_CAPACITY_SIGNAL_ADDED','profile_route',id,{geometry,pointCount:geometry==='ROUTE'?points.length:boundary.length});return id;
}

export function removeRecurringCorridor(user,id) {
  assertWorkspaceAccess(user);if(isCompanyDriver(user))throw new Error('FORBIDDEN');const db=getDb(),scope=providerScope(user);if(!scope)throw new Error('FORBIDDEN');const ownerColumn=scope.organizationId?'organization_id':'provider_profile_id',ownerId=scope.organizationId||scope.profileId;const route=db.prepare(`DELETE FROM profile_routes WHERE id=? AND ${ownerColumn}=?`).run(id,ownerId);if(!route.changes)throw new Error('NOT_FOUND');audit(db,user,'REGULAR_CAPACITY_SIGNAL_REMOVED','profile_route',id,{});
}

function providerShipmentOwnerClause(scope,alias='s') {return scope.organizationId?`${alias}.provider_organization_id=?`:`${alias}.provider_profile_id=?`;}

export function createProviderShipment(user,input) {
  assertWorkspaceAccess(user);if(![USER_ROLES.TRANSPORTER,USER_ROLES.DRIVER].includes(user.role))throw new Error('FORBIDDEN');
  if(isCompanyDriver(user)&&!getDriverAccess(user)?.can_manage_tracking)throw new Error('FORBIDDEN');
  const db=getDb(),scope=providerScope(user);if(!scope)throw new Error('FORBIDDEN');
  const vehicle=db.prepare(`SELECT * FROM vehicles WHERE id=? AND ${scope.organizationId?'organization_id':'provider_profile_id'}=? AND active=1`).get(input.vehicleId,scope.id);if(!vehicle)throw new Error('INVALID_VEHICLE');
  const assignedDriver=scope.organizationId?db.prepare(`SELECT driver_user_id FROM driver_vehicle_assignments WHERE vehicle_id=? AND active=1`).get(vehicle.id)?.driver_user_id:user.id;if(!assignedDriver)throw new Error('DRIVER_REQUIRED_FOR_SHIPMENT');if(isCompanyDriver(user)&&assignedDriver!==user.id)throw new Error('FORBIDDEN');
  const email=value=>{const clean=String(value||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)||clean.length>254)throw new Error('INVALID_EMAIL');return clean;};
  const customerEmail=email(input.customerEmail);
  const origin=resolvePlaceReference(input.originPlaceRef,input.origin),destination=resolvePlaceReference(input.destinationPlaceRef,input.destination);if(origin.place_ref===destination.place_ref)throw new Error('ROUTE_LOCATIONS_MUST_DIFFER');
  const cargo=String(input.cargoSummary||'').trim();if(cargo.length<3||cargo.length>500)throw new Error('INVALID_CARGO_SUMMARY');
  const trackingMode=String(input.trackingMode||'STATUS_ONLY').toUpperCase();
  if(!['STATUS_ONLY','LOCATION_AND_STATUS'].includes(trackingMode))throw new Error('INVALID_TRACKING_MODE');
  const pickup=String(input.expectedPickupDate||'').trim()||null,delivery=String(input.expectedDeliveryDate||'').trim()||null;if(pickup&&delivery&&delivery<pickup)throw new Error('INVALID_DELIVERY_DATE');
  const id=randomId('pshp-'),code=randomCode('LGX'),trackingCode=trackingAccessCode(id),timestamp=nowIso();
  db.exec('BEGIN IMMEDIATE');try{
    db.prepare(`INSERT INTO provider_shipments (id,code,provider_organization_id,provider_profile_id,assigned_vehicle_id,assigned_driver_user_id,origin,origin_place_ref,origin_lat,origin_lng,destination,destination_place_ref,destination_lat,destination_lng,cargo_summary,shipper_email,receiver_email,expected_pickup_date,expected_delivery_date,tracking_mode,operational_status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'CREATED',?,?,?)`).run(id,code,scope.organizationId,scope.profileId,vehicle.id,assignedDriver,origin.place_label,origin.place_ref,origin.center_lat,origin.center_lng,destination.place_label,destination.place_ref,destination.center_lat,destination.center_lng,cargo,customerEmail,customerEmail,pickup,delivery,trackingMode,user.id,timestamp,timestamp);
    db.prepare(`INSERT INTO shipment_party_grants (id,shipment_id,party_role,code_hash,expires_at,revoked_at,created_at) VALUES (?,?,?,?,NULL,NULL,?)`).run(randomId('grant-'),id,'SHIPPER',hashTrackingAccessCode(trackingCode),timestamp);
    db.prepare(`INSERT INTO email_deliveries (id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,attempts,last_error,next_attempt_at,sent_at,created_at,updated_at) VALUES (?,?,?,'TRACKING_ACCESS',?,?,'PENDING',0,NULL,?,NULL,?,?)`).run(randomId('email-'),id,'SHIPPER',customerEmail,`tracking-access:${id}`,timestamp,timestamp,timestamp);
    db.prepare(`INSERT INTO provider_shipment_events (id,shipment_id,status,event_type,note,created_by,created_at) VALUES (?,?,?,'STATUS',?,?,?)`).run(randomId('pevt-'),id,'CREATED','Tracking session created',user.id,timestamp);
    audit(db,user,'PROVIDER_SHIPMENT_CREATED','provider_shipment',id,{vehicleId:vehicle.id,assignedDriver,trackingMode});db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return {id,code,trackingCode,trackingPath:'/track'};
}

export function listProviderShipments(user,options={}) {
  assertWorkspaceAccess(user);const scope=providerScope(user);if(!scope)return [];
  if(isCompanyDriver(user)&&!getDriverAccess(user)?.can_manage_tracking)return [];
  const driverClause=isCompanyDriver(user)?' AND s.assigned_driver_user_id=?':'';const args=isCompanyDriver(user)?[scope.id,user.id]:[scope.id];
  return getDb().prepare(`SELECT s.*,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,u.name AS driver_name
    FROM provider_shipments s JOIN vehicles v ON v.id=s.assigned_vehicle_id JOIN users u ON u.id=s.assigned_driver_user_id
    WHERE ${providerShipmentOwnerClause(scope)}${driverClause} ORDER BY s.updated_at DESC LIMIT ?`).all(...args,Math.max(1,Math.min(100,Number(options.limit)||50)));
}

export function getProviderShipment(user,id) {
  assertWorkspaceAccess(user);const db=getDb(),scope=providerScope(user);if(!scope)return null;const driverClause=isCompanyDriver(user)?' AND s.assigned_driver_user_id=?':'';const args=isCompanyDriver(user)?[id,id,scope.id,user.id]:[id,id,scope.id];
  if(isCompanyDriver(user)&&!getDriverAccess(user)?.can_manage_tracking)return null;
  const shipment=db.prepare(`SELECT s.*,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,u.name AS driver_name FROM provider_shipments s JOIN vehicles v ON v.id=s.assigned_vehicle_id JOIN users u ON u.id=s.assigned_driver_user_id WHERE (s.id=? OR s.code=?) AND ${providerShipmentOwnerClause(scope)}${driverClause}`).get(...args);if(!shipment)return null;
  shipment.events=db.prepare(`SELECT id,status,note,proof_path IS NOT NULL AS has_proof,created_at FROM provider_shipment_events WHERE shipment_id=? AND event_type='STATUS' ORDER BY created_at,id`).all(shipment.id);shipment.latest_location=db.prepare(`SELECT location_area,location_lat,location_lng,location_precision_km,created_at FROM provider_shipment_events WHERE shipment_id=? AND location_source='DEVICE_OBSCURED' ORDER BY created_at DESC,id DESC LIMIT 1`).get(shipment.id)||null;shipment.email_deliveries=db.prepare(`SELECT party_role,delivery_kind,status,attempts,last_error,sent_at,updated_at FROM email_deliveries WHERE shipment_id=? ORDER BY created_at`).all(shipment.id);shipment.review=db.prepare(`SELECT * FROM provider_reviews WHERE shipment_id=?`).get(shipment.id)||null;shipment.tracking_access_code=shipment.guest_expires_at&&shipment.guest_expires_at<=nowIso()?null:trackingAccessCode(shipment.id);shipment.tracking_path='/track';return shipment;
}

const PROVIDER_SHIPMENT_TRANSITIONS=Object.freeze({CREATED:['TO_PICKUP','LOADING','ISSUE'],TO_PICKUP:['LOADING','ISSUE'],LOADING:['IN_TRANSIT','ISSUE'],IN_TRANSIT:['UNLOADING','ISSUE'],UNLOADING:['COMPLETED','ISSUE'],ISSUE:['TO_PICKUP','LOADING','IN_TRANSIT','UNLOADING']});
function providerTrackingLocation(shipment,user,input={},required=false){
  const assignedDriver=user.role===USER_ROLES.DRIVER&&shipment.assigned_driver_user_id===user.id;
  if(required&&!assignedDriver)throw new Error('ASSIGNED_DRIVER_LOCATION_REQUIRED');
  if(!input||input.locationSource!=='DEVICE_OBSCURED'){
    if(required)throw new Error('TRACKING_DEVICE_LOCATION_REQUIRED');
    return null;
  }
  if(!assignedDriver)throw new Error('DEVICE_LOCATION_DRIVER_ONLY');
  const lat=Number(input.approximateLat),lng=Number(input.approximateLng);
  const precisionKm=validateCapacityPrivacyRadius('BOTH',input.locationPrecisionKm);
  const area=qualifyAreaLabel(input.locationArea);
  if(!area||!Number.isFinite(lat)||lat<3||lat>15||!Number.isFinite(lng)||lng<32||lng>49)throw new Error('INVALID_APPROXIMATE_LOCATION');
  return {area,lat,lng,precisionKm,source:'DEVICE_OBSCURED'};
}

function insertProviderTrackingLocationEvent(db,shipment,user,location,eventType='LOCATION',note='Approximate location refreshed',timestamp=nowIso()){
  db.prepare(`INSERT INTO provider_shipment_events (id,shipment_id,status,event_type,note,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(randomId('pevt-'),shipment.id,shipment.operational_status,eventType,note,location.area,location.lat,location.lng,location.precisionKm,location.source,user.id,timestamp);
}

export function updateProviderShipmentStatus(user,id,nextStatus,note='',proof=/** @type {null|{path:string,originalName:string,mimeType:string}} */(null),locationInput=/** @type {any} */(null)) {
  const shipment=getProviderShipment(user,id);if(!shipment)throw new Error('NOT_FOUND');const next=String(nextStatus||'').toUpperCase();if(!PROVIDER_SHIPMENT_TRANSITIONS[shipment.operational_status]?.includes(next))throw new Error('INVALID_STATUS_TRANSITION');
  if(proof&&!['LOADING','UNLOADING','ISSUE'].includes(next))throw new Error('PROOF_NOT_ALLOWED_FOR_STATUS');const cleanNote=String(note||'').trim();if(next==='ISSUE'&&!cleanNote)throw new Error('ISSUE_NOTE_REQUIRED');
  const travelStatus=['TO_PICKUP','IN_TRANSIT'].includes(next);const location=shipment.tracking_mode==='LOCATION_AND_STATUS'&&travelStatus?providerTrackingLocation(shipment,user,locationInput||{},true):null;
  const db=getDb(),lastEventAt=db.prepare(`SELECT MAX(created_at) AS created_at FROM provider_shipment_events WHERE shipment_id=?`).get(shipment.id)?.created_at;
  const timestamp=new Date(Math.max(Date.now(),lastEventAt?Date.parse(lastEventAt)+1:0)).toISOString(),complete=next==='COMPLETED',guestExpires=complete?new Date(Date.now()+30*86_400_000).toISOString():null;db.exec('BEGIN IMMEDIATE');try{
    db.prepare(`UPDATE provider_shipments SET operational_status=?,updated_at=?,completed_at=CASE WHEN ? THEN ? ELSE completed_at END,guest_expires_at=CASE WHEN ? THEN ? ELSE guest_expires_at END WHERE id=?`).run(next,timestamp,complete?1:0,timestamp,complete?1:0,guestExpires,shipment.id);
    db.prepare(`INSERT INTO provider_shipment_events (id,shipment_id,status,event_type,note,proof_path,proof_original_name,proof_mime_type,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,created_at) VALUES (?,?,?,'STATUS',?,?,?,?,?,?,?,?,?,?,?)`).run(randomId('pevt-'),shipment.id,next,cleanNote||null,proof?.path||null,proof?.originalName||null,proof?.mimeType||null,location?.area||null,location?.lat??null,location?.lng??null,location?.precisionKm??null,location?.source||null,user.id,timestamp);
    if(complete){db.prepare(`UPDATE shipment_party_grants SET expires_at=? WHERE shipment_id=? AND revoked_at IS NULL`).run(guestExpires,shipment.id);db.prepare(`INSERT OR IGNORE INTO email_deliveries (id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,attempts,last_error,next_attempt_at,sent_at,created_at,updated_at) VALUES (?,?,?,'COMPLETION',?,?,'PENDING',0,NULL,?,NULL,?,?)`).run(randomId('email-'),shipment.id,'SHIPPER',shipment.shipper_email,`completion:${shipment.id}:OWNER`,timestamp,timestamp,timestamp);}
    audit(db,user,'PROVIDER_SHIPMENT_STATUS_UPDATED','provider_shipment',shipment.id,{from:shipment.operational_status,to:next,hasProof:Boolean(proof),locationShared:Boolean(location),locationPrecisionKm:location?.precisionKm||null});db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}return {id:shipment.id,status:next,guestExpires};
}

export function updateProviderShipmentLocation(user,id,input){
  const shipment=getProviderShipment(user,id);if(!shipment)throw new Error('NOT_FOUND');
  if(shipment.tracking_mode!=='LOCATION_AND_STATUS'||!['TO_PICKUP','IN_TRANSIT'].includes(shipment.operational_status))throw new Error('TRACKING_LOCATION_NOT_ENABLED');
  const location=providerTrackingLocation(shipment,user,input,true);const db=getDb();
  const latest=db.prepare(`SELECT created_at FROM provider_shipment_events WHERE shipment_id=? AND location_source='DEVICE_OBSCURED' ORDER BY created_at DESC LIMIT 1`).get(shipment.id);
  if(latest&&Date.now()-new Date(latest.created_at).getTime()<10*60*1000)return {recorded:false,reason:'THROTTLED'};
  const timestamp=nowIso();db.exec('BEGIN IMMEDIATE');try{insertProviderTrackingLocationEvent(db,shipment,user,location,'LOCATION','Approximate location refreshed',timestamp);db.prepare('UPDATE provider_shipments SET updated_at=? WHERE id=?').run(timestamp,shipment.id);audit(db,user,'PROVIDER_SHIPMENT_LOCATION_UPDATED','provider_shipment',shipment.id,{status:shipment.operational_status,locationPrecisionKm:location.precisionKm});db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  return {recorded:true,updatedAt:timestamp,locationArea:location.area,locationPrecisionKm:location.precisionKm};
}

export function unlockProviderTracking(code) {
  const db=getDb();
  purgeExpiredGuestShipmentData(db);
  const digest=hashTrackingAccessCode(code),now=nowIso();
  const row=db.prepare(`SELECT s.id AS shipment_id,g.party_role,g.expires_at,g.revoked_at FROM shipment_party_grants g JOIN provider_shipments s ON s.id=g.shipment_id WHERE g.code_hash=?`).get(digest);
  if(!row||row.revoked_at||row.expires_at&&row.expires_at<=now)throw new Error('INVALID_TRACKING_CODE');
  return {id:row.shipment_id,partyRole:row.party_role};
}

export function unlockProviderReview(shipmentId,code) {
  const db=getDb();purgeExpiredGuestShipmentData(db);const id=String(shipmentId||'').trim();
  const shipment=db.prepare(`SELECT id FROM provider_shipments WHERE id=? AND operational_status='COMPLETED' AND guest_expires_at>?`).get(id,nowIso());
  if(!shipment||!verifyReviewAccessCode(id,code))throw new Error('REVIEW_NOT_ALLOWED');
  return {id:shipment.id};
}

export function getProviderGuestTracking(id,partyRole) {
  const db=getDb(),now=nowIso();
  purgeExpiredGuestShipmentData(db);
  const shipment=db.prepare(`SELECT s.id,s.code,s.origin,s.origin_lat,s.origin_lng,s.destination,s.destination_lat,s.destination_lng,s.cargo_summary,s.tracking_mode,s.operational_status,s.expected_pickup_date,s.expected_delivery_date,s.completed_at,s.guest_expires_at,v.platform_number,v.make AS vehicle_make,v.model AS vehicle_model,COALESCE(o.name,p.business_name) AS provider_name,COALESCE(o.handle,p.handle) AS provider_handle FROM provider_shipments s JOIN vehicles v ON v.id=s.assigned_vehicle_id LEFT JOIN organizations o ON o.id=s.provider_organization_id LEFT JOIN provider_profiles p ON p.id=s.provider_profile_id JOIN shipment_party_grants g ON g.shipment_id=s.id AND g.party_role=? WHERE s.id=? AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>?)`).get(partyRole,id,now);
  if(!shipment)return null;
  shipment.events=db.prepare(`SELECT id,status,note,created_at FROM provider_shipment_events WHERE shipment_id=? AND event_type='STATUS' ORDER BY created_at,id`).all(id);
  shipment.current_location=null;
  if(shipment.tracking_mode==='LOCATION_AND_STATUS'&&['TO_PICKUP','IN_TRANSIT'].includes(shipment.operational_status))shipment.current_location=db.prepare(`SELECT location_area,location_lat,location_lng,location_precision_km,created_at AS updated_at FROM provider_shipment_events WHERE shipment_id=? AND location_source='DEVICE_OBSCURED' ORDER BY created_at DESC,id DESC LIMIT 1`).get(id)||null;
  shipment.party_role=partyRole;
  shipment.can_review=partyRole==='SHIPPER'&&shipment.operational_status==='COMPLETED'&&!db.prepare('SELECT 1 FROM provider_reviews WHERE shipment_id=?').get(id);
  shipment.review=partyRole==='SHIPPER'?db.prepare(`SELECT rating,note,status,dispute_status,created_at FROM provider_reviews WHERE shipment_id=?`).get(id)||null:null;
  return shipment;
}

function purgeExpiredGuestShipmentData(db=getDb()) {
  const expired=db.prepare(`SELECT id FROM provider_shipments WHERE guest_expires_at IS NOT NULL AND guest_expires_at<=? AND (shipper_email NOT LIKE 'expired+%@redacted.invalid' OR receiver_email NOT LIKE 'expired+%@redacted.invalid')`).all(nowIso());
  if(!expired.length)return 0;
  db.exec('BEGIN IMMEDIATE');
  try{
    for(const row of expired){
      db.prepare('DELETE FROM shipment_party_grants WHERE shipment_id=?').run(row.id);
      db.prepare('DELETE FROM email_deliveries WHERE shipment_id=?').run(row.id);
      db.prepare(`UPDATE provider_shipments SET shipper_email=?,receiver_email=? WHERE id=?`).run(`expired+shipper-${row.id}@redacted.invalid`,`expired+receiver-${row.id}@redacted.invalid`,row.id);
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return expired.length;
}

export function purgeExpiredProviderShipmentGuests() {
  return purgeExpiredGuestShipmentData(getDb());
}

export function listPendingEmailDeliveries(limit=20) {
  const count=Math.max(1,Math.min(100,Number(limit)||20));
  return getDb().prepare(`SELECT e.*,s.code,s.origin,s.destination,s.cargo_summary,s.operational_status,s.completed_at,COALESCE(o.name,p.business_name) AS provider_name
    FROM email_deliveries e JOIN provider_shipments s ON s.id=e.shipment_id
    LEFT JOIN organizations o ON o.id=s.provider_organization_id LEFT JOIN provider_profiles p ON p.id=s.provider_profile_id
    WHERE e.status IN ('PENDING','FAILED') AND (e.next_attempt_at IS NULL OR e.next_attempt_at<=?) AND e.attempts<6 ORDER BY e.created_at LIMIT ?`).all(nowIso(),count);
}

export function recordEmailDeliveryAttempt(id,{sent,error}={}) {
  const db=getDb(),timestamp=nowIso();
  const row=db.prepare('SELECT attempts FROM email_deliveries WHERE id=?').get(id);
  if(!row)throw new Error('NOT_FOUND');
  const attempts=row.attempts+1;
  const retryAt=sent?null:new Date(Date.now()+Math.min(24,2**attempts)*60*60*1000).toISOString();
  db.prepare(`UPDATE email_deliveries SET status=?,attempts=?,last_error=?,next_attempt_at=?,sent_at=?,updated_at=? WHERE id=?`).run(sent?'SENT':'FAILED',attempts,sent?null:String(error||'DELIVERY_FAILED').slice(0,500),retryAt,sent?timestamp:null,timestamp,id);
}

export function listPendingAccessEmailDeliveries(limit=20) {
  if(process.env.DATA_BACKEND==='supabase')return listSupabasePendingAccessEmailDeliveries(limit);
  const count=Math.max(1,Math.min(100,Number(limit)||20));
  return getDb().prepare(`SELECT * FROM access_email_deliveries
    WHERE status IN ('QUEUED','FAILED') AND (next_attempt_at IS NULL OR next_attempt_at<=?) AND attempts<6
    ORDER BY created_at LIMIT ?`).all(nowIso(),count);
}

export function recordAccessEmailDeliveryAttempt(id,{sent,error}={}) {
  if(process.env.DATA_BACKEND==='supabase')return recordSupabaseAccessEmailDeliveryAttempt(id,{sent,error});
  const db=getDb(),timestamp=nowIso();
  const row=db.prepare('SELECT attempts FROM access_email_deliveries WHERE id=?').get(id);
  if(!row)throw new Error('NOT_FOUND');
  const attempts=Number(row.attempts)+1;
  const retryAt=sent?null:new Date(Date.now()+Math.min(24,2**attempts)*60*60*1000).toISOString();
  db.prepare(`UPDATE access_email_deliveries SET status=?,attempts=?,last_error=?,next_attempt_at=?,sent_at=?,updated_at=? WHERE id=?`)
    .run(sent?'SENT':'FAILED',attempts,sent?null:String(error||'DELIVERY_FAILED').slice(0,500),retryAt,sent?timestamp:null,timestamp,id);
}

export function submitProviderReview(shipmentId,partyRole,rating,note='') {
  if(partyRole!=='SHIPPER')throw new Error('REVIEW_NOT_ALLOWED');const db=getDb(),shipment=db.prepare(`SELECT * FROM provider_shipments WHERE id=? AND operational_status='COMPLETED' AND guest_expires_at>?`).get(shipmentId,nowIso());if(!shipment)throw new Error('REVIEW_NOT_ALLOWED');const value=Number(rating);if(!Number.isInteger(value)||value<1||value>5)throw new Error('INVALID_RATING');const clean=String(note||'').trim().slice(0,1000);const id=randomId('preview-');try{db.prepare(`INSERT INTO provider_reviews (id,shipment_id,provider_organization_id,provider_profile_id,rating,note,status,dispute_status,created_at) VALUES (?,?,?,?,?,?,'PUBLISHED','NONE',?)`).run(id,shipment.id,shipment.provider_organization_id,shipment.provider_profile_id,value,clean||null,nowIso());}catch(error){if(String(error?.message||'').includes('UNIQUE'))throw new Error('REVIEW_ALREADY_SUBMITTED');throw error;}return id;
}

export function disputeProviderReview(user,reviewId,reason) {
  assertWorkspaceAccess(user);if(isCompanyDriver(user))throw new Error('FORBIDDEN');const db=getDb(),scope=providerScope(user);if(!scope)throw new Error('FORBIDDEN');const review=db.prepare(`SELECT * FROM provider_reviews WHERE id=? AND ${scope.organizationId?'provider_organization_id':'provider_profile_id'}=?`).get(reviewId,scope.id);if(!review)throw new Error('NOT_FOUND');if(review.rating>3)throw new Error('REVIEW_DISPUTE_NOT_ALLOWED');if(review.dispute_status!=='NONE')throw new Error('REVIEW_ALREADY_DISPUTED');const clean=String(reason||'').trim();if(clean.length<5)throw new Error('REVIEW_DISPUTE_REASON_REQUIRED');db.prepare(`UPDATE provider_reviews SET dispute_status='PENDING',dispute_reason=?,disputed_at=? WHERE id=?`).run(clean,nowIso(),review.id);audit(db,user,'PROVIDER_REVIEW_DISPUTED','provider_review',review.id,{rating:review.rating});
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
  const activeAssignment=vehicle.organization_id
    ? db.prepare(`SELECT driver_user_id FROM driver_vehicle_assignments WHERE vehicle_id=? AND active=1`).get(vehicle.id)
    : null;
  if(vehicle.organization_id&&input.status!=='OFF_DUTY'&&!activeAssignment)throw new Error('DRIVER_REQUIRED_FOR_CAPACITY');
  const assignedDriverId=vehicle.provider_profile_id?user.id:activeAssignment?.driver_user_id;
  const percent = validateCapacity(input.status);
  const acceptedLoads = validateAcceptedLoads(input.status,input.acceptedLoads);
  const movementScope=MOVEMENT_SCOPES.BOTH;
  const acceptsMultiPick=Boolean(input.acceptsMultiPick||input.acceptsMultiStop);
  const acceptsMultiDrop=Boolean(input.acceptsMultiDrop||input.acceptsMultiStop);
  const availabilityGeometry=input.status==='OFF_DUTY'?null:String(input.availabilityGeometry||'RADIUS').toUpperCase();
  if(availabilityGeometry&&!['RADIUS','ROUTE'].includes(availabilityGeometry))throw new Error('INVALID_AVAILABILITY_GEOMETRY');
  if(input.status==='PARTIAL'&&availabilityGeometry!=='ROUTE')throw new Error('PARTIAL_CAPACITY_ROUTE_REQUIRED');
  const currentRoutePoints=availabilityGeometry==='ROUTE'?resolvePlaceSequence(input.currentRoutePlaces,2,5,'CAPACITY_ROUTE_POINTS_REQUIRED'):[];
  const capacityAreaCenter=availabilityGeometry==='RADIUS'?resolvePlaceReference(input.capacityAreaCenterPlaceRef,input.capacityAreaCenter):null;
  const capacityAreaBoundary=availabilityGeometry==='RADIUS'?resolvePlaceSequence(input.capacityAreaBoundaryPlaces,3,5,'CAPACITY_AREA_BOUNDARY_REQUIRED'):[];
  if(capacityAreaCenter&&capacityAreaBoundary.some(point=>point.place_ref===capacityAreaCenter.place_ref))throw new Error('CAPACITY_PLACE_DUPLICATE');
  const workRadiusKm=capacityAreaCenter?Math.min(500,Math.max(5,Math.ceil(Math.max(...capacityAreaBoundary.map(point=>distanceBetweenKm({lat:capacityAreaCenter.center_lat,lng:capacityAreaCenter.center_lng},point)))))):null;
  const routeIntent=availabilityGeometry==='ROUTE'?'SPECIFIC':'RADIUS';
  const hasCurrentRoute=input.status!=='OFF_DUTY'&&availabilityGeometry==='ROUTE';
  const hasPlannedRoute=false;
  const currentOriginPlace=hasCurrentRoute?currentRoutePoints[0]:null;
  const currentDestinationPlace=hasCurrentRoute?currentRoutePoints.at(-1):null;
  const plannedOriginPlace=hasPlannedRoute?resolvePlaceReference(input.originPlaceRef,input.origin):null;
  const plannedDestinationPlace=hasPlannedRoute?resolvePlaceReference(input.destinationPlaceRef,input.destination):null;
  if(hasPlannedRoute&&plannedOriginPlace.place_ref===plannedDestinationPlace.place_ref)throw new Error('ROUTE_LOCATIONS_MUST_DIFFER');
  if(hasPlannedRoute&&input.travelDate&&input.travelDate<todayInEthiopia())throw new Error('INVALID_ROUTE_DATE');
  const visibility = input.visibility==='PRIVATE'?'PRIVATE':'OPEN';
  if(user.role===USER_ROLES.TRANSPORTER&&input.locationSource==='DEVICE_OBSCURED')throw new Error('DEVICE_LOCATION_DRIVER_ONLY');
  let driverLocation=null;
  if(input.status!=='OFF_DUTY'){
    if(user.role===USER_ROLES.DRIVER){
      if(assignedDriverId!==user.id)throw new Error('FORBIDDEN');
      driverLocation=capacityDeviceLocation(input,movementScope);
    }else{
      const source=db.prepare(`SELECT location_lat,location_lng,location_precision_km,location_updated_at
        FROM capacities WHERE vehicle_id=? AND updated_by=? AND location_source='DEVICE_OBSCURED'
          AND location_lat IS NOT NULL AND location_lng IS NOT NULL
        ORDER BY COALESCE(location_updated_at,updated_at) DESC,id DESC LIMIT 1`).get(vehicle.id,assignedDriverId||'');
      if(!source)throw new Error('CAPACITY_DRIVER_LOCATION_REQUIRED');
      driverLocation={lat:Number(source.location_lat),lng:Number(source.location_lng),precisionKm:Number(source.location_precision_km),place:nearestCapacityPlace(Number(source.location_lat),Number(source.location_lng)),updatedAt:source.location_updated_at};
    }
  }
  const localPlace=input.status!=='OFF_DUTY'
    ? {...driverLocation.place,radius_km:Math.min(Number(workRadiusKm)||50,100)}
    : null;
  const expiresHours = Number(process.env.CAPACITY_EXPIRES_HOURS || 24);
  const timestamp = nowIso();
  const expiresAt = hoursFromNow(expiresHours);
  const id = randomId('cap-');
  const origin=null;
  const destination=null;
  const currentRouteOrigin=currentOriginPlace?.label||null;
  const currentRouteDestination=currentDestinationPlace?.label||null;
  const legacyStatus=input.status==='PARTIAL'&&movementScope===MOVEMENT_SCOPES.LOCAL
      ? 'EMPTY'
      : input.status;
  const locationArea=input.status==='OFF_DUTY'?null:`Around ${driverLocation.place.place_label}`;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE capacities SET expires_at=? WHERE vehicle_id=? AND expires_at>?`).run(timestamp,vehicle.id,timestamp);
    db.prepare(`INSERT INTO capacities
      (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,proof_recorded_at,current_route_origin,current_route_destination,current_route_date,planned_space_status,accepts_multi_pick,accepts_multi_drop,movement_scope,local_place_ref,local_place_label,local_center_lat,local_center_lng,local_radius_km,
       origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng,
      current_origin_place_ref,current_origin_lat,current_origin_lng,current_destination_place_ref,current_destination_lat,current_destination_lng,location_place_ref,
      market_status,available_again_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,scope.organizationId,scope.profileId,vehicle.id,legacyStatus,percent,origin,destination,origin&&destination?`${origin} → ${destination}`:null,hasPlannedRoute?(input.travelDate||null):null,null,visibility,photo?.path || null,user.id,timestamp,expiresAt,locationArea,input.status === 'OFF_DUTY' ? null : driverLocation.updatedAt,
        driverLocation?.lat??null,driverLocation?.lng??null,driverLocation?.precisionKm??null,
        input.status==='OFF_DUTY'?null:'DEVICE_OBSCURED',acceptedLoads.acceptsFullLoad ? 1 : 0,acceptedLoads.acceptsPartialLoad ? 1 : 0,0,(acceptsMultiPick||acceptsMultiDrop) ? 1 : 0,photo?.path ? timestamp : null,currentRouteOrigin,currentRouteDestination,null,hasPlannedRoute?(acceptedLoads.acceptsFullLoad&&acceptedLoads.acceptsPartialLoad?'BOTH':acceptedLoads.acceptsPartialLoad?'PARTIAL':'FULL'):null,acceptsMultiPick?1:0,acceptsMultiDrop?1:0,movementScope,localPlace?.place_ref||null,localPlace?.place_label||null,localPlace?.center_lat??null,localPlace?.center_lng??null,localPlace?.radius_km??null,
        plannedOriginPlace?.place_ref||null,plannedOriginPlace?.center_lat??null,plannedOriginPlace?.center_lng??null,
        plannedDestinationPlace?.place_ref||null,plannedDestinationPlace?.center_lat??null,plannedDestinationPlace?.center_lng??null,
        currentOriginPlace?.place_ref||null,currentOriginPlace?.lat??null,currentOriginPlace?.lng??null,
        currentDestinationPlace?.place_ref||null,currentDestinationPlace?.lat??null,currentDestinationPlace?.lng??null,
        driverLocation?.place.place_ref||null,input.status,null);
    db.prepare(`UPDATE capacities SET availability_geometry=?,work_radius_km=?,travel_date=NULL,origin=NULL,destination=NULL,
      origin_place_ref=NULL,origin_lat=NULL,origin_lng=NULL,destination_place_ref=NULL,destination_lat=NULL,destination_lng=NULL
      WHERE id=?`).run(availabilityGeometry,workRadiusKm,id);
    db.prepare(`UPDATE capacities SET current_route_points_json=?,capacity_area_center_place_ref=?,capacity_area_center_label=?,
      capacity_area_center_lat=?,capacity_area_center_lng=?,capacity_area_boundary_json=? WHERE id=?`).run(
        JSON.stringify(currentRoutePoints),capacityAreaCenter?.place_ref||null,capacityAreaCenter?.place_label||null,
        capacityAreaCenter?.center_lat??null,capacityAreaCenter?.center_lng??null,JSON.stringify(capacityAreaBoundary),id);
    audit(db,user,'CAPACITY_PUBLISHED','capacity',id,{ status: input.status, visibility, percent, vehicleId: vehicle.id, availabilityGeometry, workRadiusKm, locationArea, locationSource:driverLocation?'DEVICE_OBSCURED':null, locationPrecisionKm:driverLocation?.precisionKm||null, acceptedLoads:input.status==='PARTIAL'?'PTL':input.status==='EMPTY'?input.acceptedLoads:null, routeIntent, currentRouteLive:hasCurrentRoute, acceptsMultiPick, acceptsMultiDrop });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export function refreshCapacityLocation(user,input) {
  assertWorkspaceAccess(user);
  if(user.role!==USER_ROLES.DRIVER)throw new Error('DEVICE_LOCATION_DRIVER_ONLY');
  const db=getDb();
  const scope=providerScope(user);
  if(!scope)throw new Error('FORBIDDEN');
  const vehicle=isCompanyDriver(user)
    ? db.prepare(`SELECT v.* FROM vehicles v JOIN driver_vehicle_assignments a ON a.vehicle_id=v.id
        WHERE v.id=? AND v.organization_id=? AND v.active=1 AND a.driver_user_id=? AND a.active=1`).get(input.vehicleId,scope.id,user.id)
    : db.prepare(`SELECT * FROM vehicles WHERE id=? AND provider_profile_id=? AND active=1`).get(input.vehicleId,scope.id);
  if(!vehicle)throw new Error('INVALID_VEHICLE');
  const current=db.prepare(`SELECT * FROM capacities WHERE vehicle_id=? ORDER BY updated_at DESC,id DESC LIMIT 1`).get(vehicle.id);
  if(!current||!['EMPTY','PARTIAL'].includes(current.market_status||current.status))throw new Error('CAPACITY_LOCATION_ACTIVE_REQUIRED');
  const location=capacityDeviceLocation(input,MOVEMENT_SCOPES.BOTH);
  const area=`Around ${location.place.place_label}`;
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare(`UPDATE capacities SET location_area=?,location_place_ref=?,location_updated_at=?,location_lat=?,location_lng=?,location_precision_km=?,location_source=? WHERE id=?`)
      .run(area,location.place.place_ref,location.updatedAt,location.lat,location.lng,location.precisionKm,'DEVICE_OBSCURED',current.id);
    audit(db,user,'CAPACITY_LOCATION_REFRESHED','capacity',current.id,{vehicleId:vehicle.id,locationSource:'DEVICE_OBSCURED',locationPrecisionKm:location.precisionKm});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return {capacityId:current.id,vehicleId:vehicle.id,locationArea:area,approximateLat:location.lat,approximateLng:location.lng,locationPrecisionKm:location.precisionKm,locationUpdatedAt:location.updatedAt};
}

export function setAssignedVehicleDuty(user, vehicleId, onDuty, input={}) {
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
  const legacyStatus=status==='PARTIAL'&&source?.movement_scope==='LOCAL'?'EMPTY':status;
  const percent = onDuty ? source.available_percent : 0;
  let driverLocation=null;
  if(onDuty){
    if(user.role===USER_ROLES.DRIVER){
      driverLocation=capacityDeviceLocation(input);
    }else{
      const assigned=db.prepare(`SELECT driver_user_id FROM driver_vehicle_assignments WHERE vehicle_id=? AND active=1`).get(vehicleId);
      const latest=assigned?db.prepare(`SELECT location_lat,location_lng,location_precision_km,location_updated_at
        FROM capacities WHERE vehicle_id=? AND updated_by=? AND location_source='DEVICE_OBSCURED'
          AND location_lat IS NOT NULL AND location_lng IS NOT NULL
        ORDER BY COALESCE(location_updated_at,updated_at) DESC,id DESC LIMIT 1`).get(vehicleId,assigned.driver_user_id):null;
      if(!latest)throw new Error('CAPACITY_DRIVER_LOCATION_REQUIRED');
      driverLocation={lat:Number(latest.location_lat),lng:Number(latest.location_lng),precisionKm:Number(latest.location_precision_km),place:nearestCapacityPlace(Number(latest.location_lat),Number(latest.location_lng)),updatedAt:latest.location_updated_at};
    }
  }
  const localPlace=onDuty&&['LOCAL','BOTH'].includes(source.movement_scope)
    ? {...driverLocation.place,radius_km:validateCapacityServiceRadius(source.local_radius_km)}
    : null;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE capacities SET expires_at=? WHERE vehicle_id=? AND expires_at>?`).run(timestamp,vehicleId,timestamp);
    db.prepare(`INSERT INTO capacities
      (id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,origin,destination,corridor,travel_date,next_available,visibility,photo_path,updated_by,updated_at,expires_at,location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,proof_recorded_at,current_route_origin,current_route_destination,current_route_date,planned_space_status,accepts_multi_pick,accepts_multi_drop,movement_scope,local_place_ref,local_place_label,local_center_lat,local_center_lng,local_radius_km,
       origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng,
      current_origin_place_ref,current_origin_lat,current_origin_lng,current_destination_place_ref,current_destination_lat,current_destination_lng,location_place_ref,
      market_status,available_again_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,scope.organizationId,scope.profileId,vehicleId,legacyStatus,percent,source?.origin || null,source?.destination || null,source?.corridor || null,null,source?.next_available || null,source?.visibility || 'OPEN',null,user.id,timestamp,expiresAt,onDuty ? `Around ${driverLocation.place.place_label}` : null,onDuty ? driverLocation.updatedAt : null,onDuty ? driverLocation.lat : null,onDuty ? driverLocation.lng : null,onDuty ? driverLocation.precisionKm : null,onDuty ? 'DEVICE_OBSCURED' : null,onDuty ? source.accepts_full_load : 0,onDuty ? source.accepts_partial_load : 0,0,onDuty ? source.accepts_multi_stop : 0,null,onDuty?source.current_route_origin:null,onDuty?source.current_route_destination:null,null,onDuty?source.planned_space_status:null,onDuty?source.accepts_multi_pick:0,onDuty?source.accepts_multi_drop:0,onDuty?source.movement_scope||'INTERCITY':'INTERCITY',localPlace?.place_ref||null,localPlace?.place_label||null,localPlace?.center_lat??null,localPlace?.center_lng??null,localPlace?.radius_km??null,
        onDuty?source.origin_place_ref:null,onDuty?source.origin_lat:null,onDuty?source.origin_lng:null,
        onDuty?source.destination_place_ref:null,onDuty?source.destination_lat:null,onDuty?source.destination_lng:null,
        onDuty?source.current_origin_place_ref:null,onDuty?source.current_origin_lat:null,onDuty?source.current_origin_lng:null,
        onDuty?source.current_destination_place_ref:null,onDuty?source.current_destination_lat:null,onDuty?source.current_destination_lng:null,
        onDuty?driverLocation.place.place_ref:null,status,null);
    db.prepare(`UPDATE capacities SET availability_geometry=?,work_radius_km=?,current_route_points_json=?,
      capacity_area_center_place_ref=?,capacity_area_center_label=?,capacity_area_center_lat=?,capacity_area_center_lng=?,capacity_area_boundary_json=? WHERE id=?`).run(
        onDuty?source.availability_geometry:null,onDuty?source.work_radius_km:null,onDuty?source.current_route_points_json:'[]',
        onDuty?source.capacity_area_center_place_ref:null,onDuty?source.capacity_area_center_label:null,
        onDuty?source.capacity_area_center_lat:null,onDuty?source.capacity_area_center_lng:null,
        onDuty?source.capacity_area_boundary_json:'[]',id);
    audit(db,user,onDuty ? 'VEHICLE_SET_ON_DUTY' : 'VEHICLE_SET_OFF_DUTY','vehicle',vehicleId,{restoredCapacityId:onDuty ? source.id : null,locationSource:onDuty?'DEVICE_OBSCURED':null});
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
  const drivers=db.prepare(`SELECT u.id,u.name,u.email,d.phone,d.license_verified,
    COALESCE(p.can_manage_capacity,1) AS can_manage_capacity,
    COALESCE(p.can_manage_tracking,1) AS can_manage_tracking,
    MAX(a.vehicle_id) AS assigned_vehicle_id,
    GROUP_CONCAT(v.make || ' ' || v.model || ' · ' || COALESCE(v.plate,''),'; ') AS assigned_vehicles
    FROM users u JOIN drivers d ON d.user_id=u.id AND d.active=1
    LEFT JOIN driver_permissions p ON p.user_id=u.id
    LEFT JOIN driver_vehicle_assignments a ON a.driver_user_id=u.id AND a.active=1
    LEFT JOIN vehicles v ON v.id=a.vehicle_id AND v.active=1
    WHERE u.role='DRIVER' AND u.organization_id=? AND u.active=1
    GROUP BY u.id ORDER BY u.name`).all(user.organization_id);
  return drivers.map(driver=>({
    ...driver,
    verification_badges:verificationBadges(db,'DRIVER',driver.id),
    truck_verification_badges:driver.assigned_vehicle_id
      ?[truckAuthorizationBadge(db,'DRIVER',driver.id,driver.assigned_vehicle_id,driver.assigned_vehicles)]
      :[]
  }));
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
    capacity:Boolean(input.canManageCapacity),
    tracking:Boolean(input.canManageTracking)
  };
  db.prepare(`INSERT INTO driver_permissions
    (user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,can_manage_tracking,updated_by,updated_at)
    VALUES (?,0,0,0,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      can_browse_load_board=0,
      can_contact_businesses=0,
      can_negotiate_loads=0,
      can_manage_capacity=excluded.can_manage_capacity,
      can_manage_tracking=excluded.can_manage_tracking,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at`)
    .run(driver.id,values.capacity ? 1 : 0,values.tracking ? 1 : 0,user.id,nowIso());
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

function guestSupportEvent(db,conversationId,actorUserId,eventType,details={}){
  db.prepare(`INSERT INTO guest_support_events (id,conversation_id,actor_user_id,event_type,details,created_at)
    VALUES (?,?,?,?,?,?)`).run(randomId('guest-support-event-'),conversationId,actorUserId||null,eventType,JSON.stringify(details),nowIso());
}

function assignGuestSupportConversation(db,conversationId){
  const agents=db.prepare(`SELECT profile.user_id,profile.max_open_conversations,profile.last_assigned_at,
      (SELECT COUNT(*) FROM support_conversations c WHERE c.assigned_agent_user_id=profile.user_id AND c.status='OPEN')+
      (SELECT COUNT(*) FROM guest_support_conversations g WHERE g.assigned_agent_user_id=profile.user_id AND g.status='OPEN') AS open_count
    FROM support_agent_profiles profile JOIN users u ON u.id=profile.user_id
    WHERE profile.active=1 AND profile.available=1 AND profile.can_manage_support=1 AND u.active=1
    ORDER BY open_count ASC,CASE WHEN profile.last_assigned_at IS NULL THEN 0 ELSE 1 END,profile.last_assigned_at,profile.user_id`).all();
  const agent=agents.find(item=>Number(item.open_count)<Number(item.max_open_conversations));
  if(!agent)return null;
  const timestamp=nowIso();
  const result=db.prepare(`UPDATE guest_support_conversations SET assigned_agent_user_id=?,status='OPEN',assigned_at=?,updated_at=?
    WHERE id=? AND status='WAITING' AND assigned_agent_user_id IS NULL`).run(agent.user_id,timestamp,timestamp,conversationId);
  if(!result.changes)return null;
  db.prepare(`UPDATE support_agent_profiles SET last_assigned_at=?,updated_at=? WHERE user_id=?`).run(timestamp,timestamp,agent.user_id);
  guestSupportEvent(db,conversationId,null,'ASSIGNED',{agentUserId:agent.user_id});
  notify(db,agent.user_id,'Assisted matching conversation','A guest has asked Loadgistic for help finding capacity.');
  return agent.user_id;
}

export function getAssistedMatchingAvailability(){
  const db=getDb();
  const agents=db.prepare(`SELECT profile.user_id,profile.max_open_conversations,
      (SELECT COUNT(*) FROM support_conversations c WHERE c.assigned_agent_user_id=profile.user_id AND c.status='OPEN')+
      (SELECT COUNT(*) FROM guest_support_conversations g WHERE g.assigned_agent_user_id=profile.user_id AND g.status='OPEN') AS open_count
    FROM support_agent_profiles profile JOIN users u ON u.id=profile.user_id
    WHERE profile.active=1 AND profile.available=1 AND profile.can_manage_support=1 AND u.active=1`).all();
  const available=agents.filter(agent=>Number(agent.open_count)<Number(agent.max_open_conversations));
  return {available:Boolean(available.length),availableTeamMembers:available.length};
}

export function createGuestSupportConversation(input,upload=/** @type {null|{path:string,name:string,originalName:string,mimeType:string,size:number}} */(null)){
  const email=normalizePrivateContactEmail(input.email),emailDigest=privateContactDigest(email);
  const phone=normalizeOptionalCallbackPhone(input.phone),body=validateSupportMessage(input.body);
  if(!phone)throw new Error('CALLBACK_PHONE_REQUIRED');
  const db=getDb(),timestamp=nowIso();
  const existing=db.prepare(`SELECT id FROM guest_support_conversations WHERE email_digest=? AND status IN ('WAITING','OPEN')`).get(emailDigest);
  if(existing)throw new Error('GUEST_CONVERSATION_ALREADY_OPEN');
  const id=randomId('guest-support-'),messageId=randomId('guest-support-message-');
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare(`INSERT INTO guest_support_conversations
      (id,email,email_digest,phone,status,created_at,updated_at,last_message_at,guest_last_read_at)
      VALUES (?,?,?,?,'WAITING',?,?,?,?)`).run(id,email,emailDigest,phone,timestamp,timestamp,timestamp,timestamp);
    db.prepare(`INSERT INTO guest_support_messages (id,conversation_id,sender_kind,sender_user_id,body,created_at)
      VALUES (?,?,'GUEST',NULL,?,?)`).run(messageId,id,body,timestamp);
    if(upload)db.prepare(`INSERT INTO guest_support_attachments
      (id,conversation_id,message_id,file_path,original_name,mime_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(randomId('guest-support-file-'),id,messageId,upload.path,upload.originalName,upload.mimeType,upload.size,timestamp);
    guestSupportEvent(db,id,null,'CREATED',{hasPhone:Boolean(phone),hasAttachment:Boolean(upload)});
    assignGuestSupportConversation(db,id);
    db.prepare(`INSERT INTO access_email_deliveries
      (id,delivery_kind,entity_id,recipient_email,status,attempts,created_at,updated_at)
      VALUES (?,'GUEST_SUPPORT',?,?,'QUEUED',0,?,?)`).run(randomId('delivery-'),id,email,timestamp,timestamp);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return {id,emailDigest,accessCode:guestSupportAccessCode(id)};
}

export function verifyGuestSupportAccess(email,code){
  const normalized=normalizePrivateContactEmail(email),emailDigest=privateContactDigest(normalized);
  const conversations=getDb().prepare(`SELECT id FROM guest_support_conversations WHERE email_digest=? ORDER BY created_at DESC LIMIT 20`).all(emailDigest);
  const conversation=conversations.find(item=>verifyPrivateAccessCode(guestSupportAccessCode(item.id),code));
  if(!conversation)throw new Error('GUEST_SUPPORT_ACCESS_DENIED');
  return {conversationId:conversation.id,emailDigest};
}

function guestConversationProjection(db,conversation){
  if(!conversation)return null;
  const messages=db.prepare(`SELECT m.*,a.id AS attachment_id,a.original_name AS attachment_name,a.mime_type AS attachment_mime_type
    FROM guest_support_messages m LEFT JOIN guest_support_attachments a ON a.message_id=m.id
    WHERE m.conversation_id=? ORDER BY m.created_at,m.id LIMIT 300`).all(conversation.id);
  const unreadTeamCount=db.prepare(`SELECT COUNT(*) AS count FROM guest_support_messages WHERE conversation_id=? AND sender_kind='TEAM'
    AND (? IS NULL OR created_at>?)`).get(conversation.id,conversation.guest_last_read_at||null,conversation.guest_last_read_at||null).count;
  return {...conversation,messages,message_count:messages.length,unread_team_count:Number(unreadTeamCount||0)};
}

export function getGuestSupportConversationForGuest(conversationId,emailDigest,options={}){
  const db=getDb();
  let conversation=db.prepare(`SELECT c.*,agent.name AS assigned_agent_name FROM guest_support_conversations c
    LEFT JOIN users agent ON agent.id=c.assigned_agent_user_id WHERE c.id=? AND c.email_digest=?`).get(conversationId,emailDigest);
  if(!conversation)throw new Error('NOT_FOUND');
  if(options.markRead!==false){const readAt=nowIso();db.prepare(`UPDATE guest_support_conversations SET guest_last_read_at=? WHERE id=?`).run(readAt,conversation.id);conversation={...conversation,guest_last_read_at:readAt};}
  return guestConversationProjection(db,conversation);
}

export function getGuestSupportConversationForTeam(user,conversationId){
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.SUPPORT);
  const db=getDb();
  const conversation=user.role===USER_ROLES.SUPPORT
    ? db.prepare(`SELECT c.*,agent.name AS assigned_agent_name FROM guest_support_conversations c LEFT JOIN users agent ON agent.id=c.assigned_agent_user_id WHERE c.id=? AND c.assigned_agent_user_id=?`).get(conversationId,user.id)
    : db.prepare(`SELECT c.*,agent.name AS assigned_agent_name FROM guest_support_conversations c LEFT JOIN users agent ON agent.id=c.assigned_agent_user_id WHERE c.id=?`).get(conversationId);
  if(!conversation)throw new Error('NOT_FOUND');
  db.prepare(`UPDATE guest_support_conversations SET agent_last_read_at=? WHERE id=?`).run(nowIso(),conversation.id);
  return guestConversationProjection(db,conversation);
}

export function listGuestSupportInbox(user,view='ASSIGNED',options={}){
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.SUPPORT);
  const normalized=String(view||'ASSIGNED').toUpperCase();
  if(!['ASSIGNED','WAITING','CLOSED','ALL'].includes(normalized))throw new Error('INVALID_SUPPORT_VIEW');
  const db=getDb(),args=[];let where='1=1';
  if(user.role===USER_ROLES.SUPPORT){
    if(normalized==='WAITING')where=`c.status='WAITING' AND c.assigned_agent_user_id IS NULL`;
    else if(normalized==='CLOSED'){where=`c.status='CLOSED' AND c.assigned_agent_user_id=?`;args.push(user.id);}
    else {where=`c.status='OPEN' AND c.assigned_agent_user_id=?`;args.push(user.id);}
  }else if(normalized==='WAITING')where=`c.status='WAITING'`;
  else if(normalized==='ASSIGNED')where=`c.status='OPEN'`;
  else if(normalized==='CLOSED')where=`c.status='CLOSED'`;
  const base=`SELECT c.id,c.email,c.phone,c.status,c.created_at,c.updated_at,c.last_message_at,c.assigned_agent_user_id,
    agent.name AS assigned_agent_name,(SELECT SUBSTR(m.body,1,120) FROM guest_support_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message_preview
    FROM guest_support_conversations c LEFT JOIN users agent ON agent.id=c.assigned_agent_user_id`;
  return paginateQuery(db,`${base} WHERE ${where}`,args,'last_message_at DESC,id',options);
}

export function claimGuestSupportConversation(user,conversationId){
  if(user.role!==USER_ROLES.SUPPORT)throw new Error('FORBIDDEN');
  assertPlatformPermission(user,PLATFORM_PERMISSIONS.SUPPORT);
  const db=getDb(),agent=supportAgentRecord(db,user.id);
  if(!agent?.active||!agent.available)throw new Error('SUPPORT_AGENT_UNAVAILABLE');
  const guestOpen=db.prepare(`SELECT COUNT(*) AS n FROM guest_support_conversations WHERE assigned_agent_user_id=? AND status='OPEN'`).get(user.id).n;
  if(Number(agent.open_count)+Number(guestOpen)>=Number(agent.max_open_conversations))throw new Error('SUPPORT_AGENT_AT_CAPACITY');
  const timestamp=nowIso();
  const result=db.prepare(`UPDATE guest_support_conversations SET assigned_agent_user_id=?,status='OPEN',assigned_at=?,updated_at=?
    WHERE id=? AND status='WAITING' AND assigned_agent_user_id IS NULL`).run(user.id,timestamp,timestamp,conversationId);
  if(!result.changes)throw new Error('SUPPORT_CONVERSATION_NOT_WAITING');
  guestSupportEvent(db,conversationId,user.id,'CLAIMED',{});
}

export function sendGuestSupportMessage(actor,conversationId,body,emailDigest=/** @type {null|string} */(null),upload=/** @type {null|{path:string,name:string,originalName:string,mimeType:string,size:number}} */(null)){
  const clean=validateSupportMessage(body),db=getDb();
  const conversation=emailDigest
    ? db.prepare(`SELECT * FROM guest_support_conversations WHERE id=? AND email_digest=?`).get(conversationId,emailDigest)
    : getGuestSupportConversationForTeam(actor,conversationId);
  if(!conversation)throw new Error('NOT_FOUND');
  if(conversation.status==='CLOSED')throw new Error('SUPPORT_CONVERSATION_CLOSED');
  const timestamp=nowIso(),messageId=randomId('guest-support-message-'),senderKind=emailDigest?'GUEST':'TEAM';
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare(`INSERT INTO guest_support_messages (id,conversation_id,sender_kind,sender_user_id,body,created_at) VALUES (?,?,?,?,?,?)`)
      .run(messageId,conversationId,senderKind,emailDigest?null:actor.id,clean,timestamp);
    if(upload)db.prepare(`INSERT INTO guest_support_attachments
      (id,conversation_id,message_id,file_path,original_name,mime_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(randomId('guest-support-file-'),conversationId,messageId,upload.path,upload.originalName,upload.mimeType,upload.size,timestamp);
    db.prepare(`UPDATE guest_support_conversations SET updated_at=?,last_message_at=? WHERE id=?`).run(timestamp,timestamp,conversationId);
    guestSupportEvent(db,conversationId,emailDigest?null:actor.id,'MESSAGE_SENT',{senderKind,hasAttachment:Boolean(upload)});
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return messageId;
}

export function closeGuestSupportConversation(user,conversationId){
  const conversation=getGuestSupportConversationForTeam(user,conversationId);
  if(conversation.status==='CLOSED')return;
  const db=getDb(),timestamp=nowIso();
  const result=db.prepare(`UPDATE guest_support_conversations SET status='CLOSED',closed_at=?,closed_by_user_id=?,updated_at=?
    WHERE id=? AND status IN ('WAITING','OPEN')`).run(timestamp,user.id,timestamp,conversationId);
  if(result.changes)guestSupportEvent(db,conversationId,user.id,'CLOSED',{});
}

export function endGuestSupportConversation(conversationId,emailDigest){
  const db=getDb(),conversation=db.prepare(`SELECT id,status FROM guest_support_conversations WHERE id=? AND email_digest=?`).get(conversationId,emailDigest);
  if(!conversation)throw new Error('NOT_FOUND');
  if(conversation.status==='CLOSED')return;
  const timestamp=nowIso();
  const result=db.prepare(`UPDATE guest_support_conversations SET status='CLOSED',closed_at=?,closed_by_user_id=NULL,updated_at=?
    WHERE id=? AND status IN ('WAITING','OPEN')`).run(timestamp,timestamp,conversationId);
  if(result.changes)guestSupportEvent(db,conversationId,null,'GUEST_CLOSED',{});
}

export async function readGuestSupportAttachment(actor,conversationId,attachmentId,emailDigest=/** @type {null|string} */(null)){
  const db=getDb();
  if(emailDigest){
    const allowed=db.prepare(`SELECT 1 FROM guest_support_conversations WHERE id=? AND email_digest=?`).get(conversationId,emailDigest);
    if(!allowed)throw new Error('NOT_FOUND');
  }else getGuestSupportConversationForTeam(actor,conversationId);
  const attachment=db.prepare(`SELECT * FROM guest_support_attachments WHERE id=? AND conversation_id=?`).get(attachmentId,conversationId);
  if(!attachment)throw new Error('NOT_FOUND');
  const bytes=await readPrivateUpload(attachment.file_path);
  if(!bytes)throw new Error('NOT_FOUND');
  return {bytes,mimeType:attachment.mime_type,originalName:attachment.original_name};
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
  if (['INDEPENDENT_PROVIDER','OWNER_OPERATOR','SELF_MANAGED_DRIVER'].includes(application.application_type)) {
    const providerId = randomId('provider-');
    db.prepare(`INSERT INTO provider_profiles (id,user_id,business_name,handle,verified_identity,verified_license,vehicle_documents_verified,vehicle_type,corridors,phone,city,about,public_visibility,created_at) VALUES (?,?,?,?,0,0,0,NULL,NULL,NULL,NULL,?,'PUBLIC',?)`)
      .run(providerId,application.user_id,application.business_name,handle,'Complete your profile and submit documents to earn trust badges.',timestamp);
    const headline=application.application_type==='OWNER_OPERATOR'?'Owner-operated freight services':'Self-managed freight services';
    db.prepare(`INSERT INTO company_pages (id,organization_id,provider_profile_id,headline,about,services,corridors,operating_regions,contact_phone,contact_email,published,updated_at) VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?)`)
      .run(randomId('page-'),providerId,headline,'Complete this Public Profile Info before publishing.','','','','','',0,timestamp);
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
  if(!['USERS','WORKSPACES','TRUCKS','DRIVERS','TRACKING','CAPACITY','ROUTES','SUBSCRIPTIONS'].includes(view))throw new Error('INVALID_ADMIN_OPERATIONS_VIEW');
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
      (SELECT COUNT(*) FROM provider_shipments s WHERE s.provider_organization_id=o.id) AS tracking_count,
      (SELECT status FROM subscriptions sub WHERE sub.organization_id=o.id ORDER BY sub.updated_at DESC LIMIT 1) AS subscription_status
    FROM organizations o
    WHERE ${matches("o.name || ' ' || o.type")}`;
  const providerBase=`SELECT p.id,'PROVIDER_PROFILE' AS record_kind,p.business_name AS name,'SELF_MANAGED_DRIVER' AS type,p.city,p.public_visibility,
      (SELECT COUNT(*) FROM users u WHERE u.provider_profile_id=p.id) AS user_count,
      (SELECT COUNT(*) FROM vehicles v WHERE v.provider_profile_id=p.id AND v.active=1) AS truck_count,
      (SELECT COUNT(*) FROM provider_shipments s WHERE s.provider_profile_id=p.id) AS tracking_count,
      (SELECT status FROM subscriptions sub WHERE sub.provider_profile_id=p.id ORDER BY sub.updated_at DESC LIMIT 1) AS subscription_status
    FROM provider_profiles p
    WHERE ${matches("p.business_name")}`;
  const vehicleBase=`SELECT v.id,v.platform_number,v.make,v.model,v.cargo_configuration,v.plate,v.active,
      COALESCE(o.name,p.business_name) AS owner_name,
      c.id AS capacity_id,COALESCE(c.market_status,c.status) AS capacity_status,c.location_area,c.updated_at AS capacity_updated_at
    FROM vehicles v
    LEFT JOIN organizations o ON o.id=v.organization_id
    LEFT JOIN provider_profiles p ON p.id=v.provider_profile_id
    LEFT JOIN capacities c ON c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC LIMIT 1)
    WHERE ${matches("COALESCE(v.platform_number,'') || ' ' || COALESCE(v.make,'') || ' ' || COALESCE(v.model,'') || ' ' || COALESCE(v.cargo_configuration,'') || ' ' || COALESCE(v.plate,'') || ' ' || COALESCE(o.name,'') || ' ' || COALESCE(p.business_name,'')")}`;
  const driverBase=`SELECT u.id,u.name,u.email,u.active,o.name AS owner_name,v.platform_number,
      COALESCE(dp.can_manage_capacity,1) AS can_manage_capacity,
      COALESCE(dp.can_manage_tracking,1) AS can_manage_tracking
    FROM users u JOIN organizations o ON o.id=u.organization_id
    LEFT JOIN driver_permissions dp ON dp.user_id=u.id
    LEFT JOIN driver_vehicle_assignments assignment ON assignment.driver_user_id=u.id AND assignment.active=1
    LEFT JOIN vehicles v ON v.id=assignment.vehicle_id
    WHERE u.role='DRIVER' AND ${matches("u.name || ' ' || u.email || ' ' || o.name || ' ' || COALESCE(v.platform_number,'')")}`;
  const trackingBase=`SELECT s.id,s.code,s.cargo_summary,s.origin,s.destination,s.operational_status,s.updated_at,
      COALESCE(provider.name,profile.business_name) AS provider_name,
      COALESCE(provider.handle,profile.handle) AS provider_handle,
      vehicle.platform_number,driver.name AS driver_name
    FROM provider_shipments s
    LEFT JOIN organizations provider ON provider.id=s.provider_organization_id
    LEFT JOIN provider_profiles profile ON profile.id=s.provider_profile_id
    JOIN vehicles vehicle ON vehicle.id=s.assigned_vehicle_id
    JOIN users driver ON driver.id=s.assigned_driver_user_id
    WHERE ${matches("s.code || ' ' || s.cargo_summary || ' ' || s.origin || ' ' || s.destination || ' ' || COALESCE(provider.name,'') || ' ' || COALESCE(profile.business_name,'') || ' ' || vehicle.platform_number || ' ' || driver.name")}`;
  const capacityBase=`SELECT c.id,COALESCE(c.market_status,c.status) AS status,c.available_percent,c.visibility,c.location_area,c.updated_at,
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
    tracking:db.prepare('SELECT COUNT(*) AS n FROM provider_shipments').get().n,
    board_capacity:db.prepare(`SELECT COUNT(DISTINCT c.vehicle_id) AS n FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
      WHERE v.active=1 AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
        AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')`).get().n,
    network:db.prepare('SELECT (SELECT COUNT(*) FROM partner_relationships)+(SELECT COUNT(*) FROM member_favorites) AS n').get().n,
    routes:db.prepare('SELECT COUNT(*) AS n FROM profile_routes').get().n
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
        : view==='TRACKING'
          ? paginateQuery(db,trackingBase,searchArgs,'updated_at DESC,id',pageOptions)
          : view==='CAPACITY'
            ? paginateQuery(db,capacityBase,searchArgs,'updated_at DESC,id',pageOptions)
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
    TRANSPORT_COMPANY: 'TRANSPORTER',
    OWNER_OPERATOR: 'DRIVER',
    SELF_MANAGED_DRIVER: 'DRIVER'
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
