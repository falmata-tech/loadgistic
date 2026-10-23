import type {AccountSession} from './contract';
export type NativePushInput={session:AccountSession|null;busy:boolean;request:(path:string,body?:unknown)=>Promise<unknown>;guest:{id:string;token:string;validUntil:number}|null;guestReady:boolean;locale:string};
export type NativePushStatus='OFF'|'ON'|'BUSY'|'DENIED'|'UNAVAILABLE'|'UNSUPPORTED';
export type NativePushControls={status:NativePushStatus;optedIn:boolean;error:string;toggle:()=>Promise<void>};
