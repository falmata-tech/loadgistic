import {createSessionToken,verifySessionToken} from '../security.js';
const id='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const subject=new RegExp('^tracking-link:('+id+'):([a-f0-9]{64}):([a-f0-9]{64}):(\\d+)$','i');
export const TRACKING_LINK_GRANT_COOKIE='lg_tracking_link_grant';
export const TRACKING_LINK_GRANT_MS=5*60_000;
export function issueTrackingLinkGrant(sessionId,credentials,linkExpiresAt,now=Date.now()){
 const expiresAt=Math.min(Date.parse(linkExpiresAt),now+TRACKING_LINK_GRANT_MS),seconds=Math.floor((expiresAt-now)/1000);
 const value=`tracking-link:${sessionId}:${credentials.linkDigest}:${credentials.codeDigest}:${now}`;
 if(!subject.test(value)||!Number.isFinite(seconds)||seconds<=0)throw Error('TRACKING_ACCESS_DENIED');
 return {grant:createSessionToken(value,seconds),expiresAt:new Date(expiresAt).toISOString()};
}
export function parseTrackingLinkGrant(token,now=Date.now()){
 if(typeof token!=='string'||token.length>2048||token.split('.').length!==2)return null;
 const payload=verifySessionToken(token),match=subject.exec(String(payload?.sub||''));if(!match)return null;
 const startedAt=Number(match[4]),expiresAt=Math.min(Number(payload.exp)*1000,startedAt+TRACKING_LINK_GRANT_MS);
 if(!Number.isSafeInteger(startedAt)||startedAt>now||!Number.isFinite(expiresAt)||expiresAt<=now)return null;
 return {sessionId:match[1],linkDigest:match[2],codeDigest:match[3],startedAt,expiresAt};
}
