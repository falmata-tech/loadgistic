import type {NativePushContext,NativePushPayload,NativePushOutcome} from './native-push-policy.js';
export type NativePushStore={claim:(workerId:string,limit:number)=>Promise<{id:string;state:string;ticketId:string|null}[]>;context:(id:string,workerId:string)=>Promise<NativePushContext|null>;finish:(id:string,workerId:string,result:NativePushOutcome)=>Promise<boolean>};
export type NativePushProvider={send:(messages:NativePushPayload[])=>Promise<unknown[]>;receipts:(ids:string[])=>Promise<Record<string,unknown>>};
export function processNativePushBatch(input:{workerId:string;store:NativePushStore;provider:NativePushProvider;translate?:(locale:string,text:string)=>string}):Promise<{claimed:number;sent:number;receipts:number;cancelled:number;failed:number}>;
