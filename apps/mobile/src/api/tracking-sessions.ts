import {guestTrackingSession} from '../../../../src/lib/tracking-sessions/client.ts';
import {trackingSessionViewSchema,trackingSessionAccessSchema,trackingSessionIssueSchema,trackingSessionListSchema,type TrackingSessionView,type TrackingSessionAccess} from '../../../../src/lib/tracking-sessions/contracts.ts';
export {trackingSessionViewSchema,trackingSessionAccessSchema,trackingSessionIssueSchema,trackingSessionListSchema};
export type {TrackingSessionView,TrackingSessionAccess};
export function trackingData<T>(value:unknown,schema:{parse:(value:unknown)=>T}):T{
 if(!value||typeof value!=='object'||Array.isArray(value)||(value as {ok?:unknown}).ok!==true)throw Error('Could not read Tracking. Please try again.');
 return schema.parse((value as {data?:unknown}).data);
}
export function guestTrackingView(value:unknown,sessionId?:string){return guestTrackingSession(trackingSessionViewSchema.parse(value),sessionId);}
