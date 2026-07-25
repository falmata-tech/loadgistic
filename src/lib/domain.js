export const USER_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  SHIPPER: 'SHIPPER',
  RECEIVER: 'RECEIVER',
  PARCEL: 'PARCEL',
  TRANSPORTER: 'TRANSPORTER',
  DRIVER: 'DRIVER'
});

export const SERVICE_MODES = Object.freeze({
  PARCEL: 'PARCEL',
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
  FULL: 'FULL'
});

export const PARCEL_TRANSITIONS = Object.freeze({
  NEW: ['CONTACTED', 'CANCELLED'],
  CONTACTED: ['COLLECTED', 'ON_HOLD', 'CANCELLED'],
  COLLECTED: ['IN_ROUTE', 'ISSUE', 'CANCELLED'],
  IN_ROUTE: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'ISSUE', 'ON_HOLD'],
  READY_FOR_PICKUP: ['COMPLETED', 'RETURNING', 'ISSUE'],
  OUT_FOR_DELIVERY: ['COMPLETED', 'RETURNING', 'ISSUE'],
  ON_HOLD: ['CONTACTED', 'COLLECTED', 'IN_ROUTE', 'CANCELLED'],
  ISSUE: ['ON_HOLD', 'RETURNING', 'CANCELLED'],
  RETURNING: ['RETURNED'],
  RETURNED: [],
  COMPLETED: [],
  CANCELLED: []
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
  if (status === CAPACITY_STATUSES.FULL) return 0;
  const percentage = Number(availablePercent);
  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 99) {
    throw new Error('CAPACITY_PERCENT_REQUIRED');
  }
  return percentage;
}

export function canTransition(serviceMode, currentStatus, nextStatus) {
  const transitions = serviceMode === SERVICE_MODES.PARCEL ? PARCEL_TRANSITIONS : FREIGHT_TRANSITIONS;
  return Boolean(transitions[currentStatus]?.includes(nextStatus));
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
  const transitions = serviceMode === SERVICE_MODES.PARCEL ? PARCEL_TRANSITIONS : FREIGHT_TRANSITIONS;
  return transitions[currentStatus] || [];
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
  if (status === CAPACITY_STATUSES.FULL) return 'Full · Not currently available';
  return `Partial · ${percent}% available`;
}

export function roleCanCreateShipment(role) {
  return role === USER_ROLES.SHIPPER || role === USER_ROLES.RECEIVER || role === USER_ROLES.ADMIN;
}

export function roleCanPublishCapacity(role) {
  return role === USER_ROLES.TRANSPORTER || role === USER_ROLES.DRIVER || role === USER_ROLES.ADMIN;
}

export function roleCanOperateParcel(role) {
  return role === USER_ROLES.PARCEL || role === USER_ROLES.ADMIN;
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
