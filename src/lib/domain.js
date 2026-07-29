export const USER_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  SHIPPER: 'SHIPPER',
  RECEIVER: 'RECEIVER',
  TRANSPORTER: 'TRANSPORTER',
  DRIVER: 'DRIVER'
});

export const SERVICE_MODES = Object.freeze({
  FREIGHT: 'FREIGHT'
});

export const DISTRIBUTION_MODES = Object.freeze({
  DIRECT_TO_PROVIDER: 'DIRECT_TO_PROVIDER',
  SAVED_PARTNERS: 'SAVED_PARTNERS',
  OPEN_MARKET: 'OPEN_MARKET'
});

export const PRICE_MODES = Object.freeze({
  FIXED_PRICE: 'FIXED_PRICE',
  QUOTE_REQUESTED: 'QUOTE_REQUESTED',
  TARGET_PRICE: 'TARGET_PRICE'
});

export const CAPACITY_STATUSES = Object.freeze({
  EMPTY: 'EMPTY',
  PARTIAL: 'PARTIAL',
  OFF_DUTY: 'OFF_DUTY'
});

export const MOVEMENT_SCOPES = Object.freeze({
  LOCAL: 'LOCAL',
  INTERCITY: 'INTERCITY',
  BOTH: 'BOTH'
});

export const FREIGHT_TRANSITIONS = Object.freeze({
  POSTED: ['CONTACTED', 'WITHDRAWN', 'CANCELLED'],
  SENT: ['CONTACTED', 'DECLINED', 'CANCELLED'],
  CONTACTED: ['AGREED', 'DECLINED', 'CANCELLED'],
  AGREED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_TRANSIT', 'ON_HOLD', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'ISSUE', 'ON_HOLD'],
  DELIVERED: ['COMPLETED', 'ISSUE'],
  ON_HOLD: ['ASSIGNED', 'IN_TRANSIT', 'CANCELLED'],
  ISSUE: ['ON_HOLD', 'CANCELLED'],
  COMPLETED: [],
  DECLINED: [],
  WITHDRAWN: [],
  CANCELLED: []
});

export function normalizeEtb(value) {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('INVALID_ETB_AMOUNT');
  return Math.round(amount * 100);
}

export function formatEtb(minor) {
  if (minor === null || minor === undefined) return null;
  return `ETB ${(minor / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function validatePriceMode({ priceMode, priceEtb, targetPriceEtb }) {
  if (!Object.values(PRICE_MODES).includes(priceMode)) throw new Error('INVALID_PRICE_MODE');
  if (priceMode === PRICE_MODES.FIXED_PRICE && normalizeEtb(priceEtb) === null) {
    throw new Error('FIXED_PRICE_REQUIRED');
  }
  if (priceMode === PRICE_MODES.TARGET_PRICE && normalizeEtb(targetPriceEtb) === null) {
    throw new Error('TARGET_PRICE_REQUIRED');
  }
  return {
    priceMinor: priceMode === PRICE_MODES.FIXED_PRICE ? normalizeEtb(priceEtb) : null,
    targetMinor: priceMode === PRICE_MODES.TARGET_PRICE ? normalizeEtb(targetPriceEtb) : null
  };
}

export function validateCapacity(status, availablePercent) {
  if (!Object.values(CAPACITY_STATUSES).includes(status)) throw new Error('INVALID_CAPACITY_STATUS');
  if (status === CAPACITY_STATUSES.EMPTY) return 100;
  if (status === CAPACITY_STATUSES.OFF_DUTY) return 0;
  const percentage = Number(availablePercent);
  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 99) {
    throw new Error('CAPACITY_PERCENT_REQUIRED');
  }
  return percentage;
}

export function validateAcceptedLoads(status, acceptedLoads) {
  if (status === CAPACITY_STATUSES.OFF_DUTY) return { acceptsFullLoad: false, acceptsPartialLoad: false };
  if (acceptedLoads === 'FTL') return { acceptsFullLoad: true, acceptsPartialLoad: false };
  if (acceptedLoads === 'PTL') return { acceptsFullLoad: false, acceptsPartialLoad: true };
  if (acceptedLoads === 'BOTH') return { acceptsFullLoad: true, acceptsPartialLoad: true };
  throw new Error('ACCEPTED_LOADS_REQUIRED');
}

export function validateFreightLoadType(serviceMode, loadType) {
  if (serviceMode !== SERVICE_MODES.FREIGHT) throw new Error('INVALID_SERVICE_MODE');
  if (!['FTL','PTL'].includes(loadType)) throw new Error('FREIGHT_LOAD_TYPE_REQUIRED');
  return loadType;
}

export function validateMovementScope(value, { allowBoth = false } = {}) {
  const allowed = allowBoth
    ? [MOVEMENT_SCOPES.LOCAL, MOVEMENT_SCOPES.INTERCITY, MOVEMENT_SCOPES.BOTH]
    : [MOVEMENT_SCOPES.LOCAL, MOVEMENT_SCOPES.INTERCITY];
  if (!allowed.includes(value)) throw new Error('INVALID_MOVEMENT_SCOPE');
  return value;
}

export function validateServiceRadius(value) {
  const radius = Number(value);
  if (!Number.isInteger(radius) || radius < 5 || radius > 100) {
    throw new Error('INVALID_SERVICE_RADIUS');
  }
  return radius;
}

export function distanceBetweenKm(first, second) {
  const lat1 = Number(first?.lat);
  const lng1 = Number(first?.lng);
  const lat2 = Number(second?.lat);
  const lng2 = Number(second?.lng);
  if (![lat1,lng1,lat2,lng2].every(Number.isFinite)) return null;
  const toRadians = value => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2-lat1);
  const deltaLng = toRadians(lng2-lng1);
  const a = Math.sin(deltaLat/2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng/2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export function pointInServiceArea(point, area) {
  const distance = distanceBetweenKm(point,{lat:area?.center_lat,lng:area?.center_lng});
  return distance !== null && distance <= Number(area?.radius_km);
}

export function serviceAreasOverlap(first, second) {
  const distance = distanceBetweenKm(
    {lat:first?.center_lat,lng:first?.center_lng},
    {lat:second?.center_lat,lng:second?.center_lng}
  );
  return distance !== null && distance <= Number(first?.radius_km) + Number(second?.radius_km);
}

export function canTransition(serviceMode, currentStatus, nextStatus) {
  if (serviceMode !== SERVICE_MODES.FREIGHT) return false;
  return Boolean(FREIGHT_TRANSITIONS[currentStatus]?.includes(nextStatus));
}

export function assertTransition(serviceMode, currentStatus, nextStatus) {
  if (!canTransition(serviceMode, currentStatus, nextStatus)) {
    const error = new Error('INVALID_STATUS_TRANSITION');
    error.currentStatus = currentStatus;
    error.nextStatus = nextStatus;
    throw error;
  }
}

export function nextStatuses(serviceMode, currentStatus) {
  if (serviceMode !== SERVICE_MODES.FREIGHT) return [];
  return FREIGHT_TRANSITIONS[currentStatus] || [];
}

export function capacityFreshness(updatedAt, expiresAt, freshHours = 12) {
  const now = Date.now();
  const updated = new Date(updatedAt).getTime();
  const expires = new Date(expiresAt).getTime();
  if (now >= expires) return 'EXPIRED';
  if (now - updated <= freshHours * 60 * 60 * 1000) return 'FRESH';
  return 'UPDATE_NEEDED';
}

export function capacityLabel(status, percent) {
  if (status === CAPACITY_STATUSES.EMPTY) return 'Empty · 100% available';
  if (status === CAPACITY_STATUSES.OFF_DUTY) return 'Off duty · Not shown';
  return `Partial · ${percent}% available`;
}

export function roleCanCreateShipment(role) {
  return role === USER_ROLES.SHIPPER || role === USER_ROLES.RECEIVER;
}

export function roleCanPublishCapacity(role) {
  return role === USER_ROLES.TRANSPORTER || role === USER_ROLES.DRIVER || role === USER_ROLES.ADMIN;
}

export function roleCanBrowseLoads(role) {
  return role === USER_ROLES.TRANSPORTER || role === USER_ROLES.DRIVER || role === USER_ROLES.ADMIN;
}

export function statusLabel(value) {
  return String(value || '')
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
