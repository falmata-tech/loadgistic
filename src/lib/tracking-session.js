// Server-checked signed subject; a legacy shipment cookie never becomes email-wide.
export const TRACKING_IDLE_MS=5*60*1000;
export const TRACKING_ABSOLUTE_MS=5*60*1000;
export const TRACKING_RENEW_AFTER_MS=60*1000;
export function trackingSessionSubject(recipientDigest,startedAt){
 if(!/^[a-f0-9]{64}$/.test(recipientDigest)||!Number.isSafeInteger(startedAt))throw new Error('INVALID_TRACKING_SESSION');
 return `tracking-email:${recipientDigest}:${startedAt}`;
}
export function parseTrackingSession(payload,now=Date.now()){
 const match=String(payload?.sub||'').match(/^tracking-email:([a-f0-9]{64}):(\d+)$/);
 if(!match)return null;
 const startedAt=Number(match[2]);const expiresAt=Math.min(Number(payload.exp)*1000,startedAt+TRACKING_ABSOLUTE_MS);
 if(!Number.isSafeInteger(startedAt)||startedAt>now||!Number.isFinite(expiresAt)||expiresAt<=now)return null;
 return {recipientDigest:match[1],startedAt,expiresAt};
}
export function trackingSessionSeconds(startedAt,now=Date.now()){
 return Math.max(0,Math.floor(Math.min(TRACKING_IDLE_MS,startedAt+TRACKING_ABSOLUTE_MS-now)/1000));
}

export function trackingSessionExpired(now,lastActivityAt,serverExpiresAt){
 return now>=Math.min(lastActivityAt+TRACKING_IDLE_MS,serverExpiresAt);
}
export function trackingSessionNeedsRenewal(now,lastRenewedAt){return now-lastRenewedAt>=TRACKING_RENEW_AFTER_MS;}
