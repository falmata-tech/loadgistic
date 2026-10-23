import type {TrackingLease} from './background-state';
// The browser preview cannot implement an OS background-location service.
export async function readTrackingLeases():Promise<TrackingLease[]>{return[];}
export async function replaceTrackingLeases(_leases:TrackingLease[]){}
export async function deviceTrackingId(){throw Error('Background location requires the installed app.');}
export async function revokeTrackingLease(_lease:TrackingLease){}
export async function stopBackgroundTracking(){}
export async function startBackgroundTracking(_copy:{title:string;body:string}){throw Error('Background location requires the installed app.');}
