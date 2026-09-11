export const SHARED_CAPACITY_IDLE_MS=30*60*1000;
export const SHARED_CAPACITY_RENEW_AFTER_MS=60*1000;

export function sharedCapacityDeadline(lastActivityAt,serverExpiresAt){
  return Math.min(lastActivityAt+SHARED_CAPACITY_IDLE_MS,serverExpiresAt);
}

export function sharedCapacitySessionExpired(now,lastActivityAt,serverExpiresAt){
  return now>=sharedCapacityDeadline(lastActivityAt,serverExpiresAt);
}

export function sharedCapacitySessionNeedsRenewal(now,lastRenewedAt){
  return now-lastRenewedAt>=SHARED_CAPACITY_RENEW_AFTER_MS;
}
