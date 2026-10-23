import type {TrackingLease} from './background-state';
export function readTrackingLeases():Promise<TrackingLease[]>;
export function replaceTrackingLeases(leases:TrackingLease[]):Promise<void>;
export function deviceTrackingId():Promise<string>;
export function revokeTrackingLease(lease:TrackingLease):Promise<void>;
export function stopBackgroundTracking():Promise<void>;
export function startBackgroundTracking(copy:{title:string;body:string}):Promise<void>;
