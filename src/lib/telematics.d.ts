import type {FleetDeviceWorkspace} from './telematics-workspace';
export type ProviderActor={id:string};
export type GatewayProof={digest:string;nonce:string;bodyDigest:string;issuedAt:string};
export type TelemetryAttributes={ignition?:boolean;battery?:number;power?:number;alarm?:'sos'|'powerCut'|'overspeed'|'vibration'|'lowBattery'|'tampering'};
export type NormalizedTelemetry={eventKey:string;gatewayDeviceId:number;protocol:'gt06'|'teltonika'|'h02'|'jt808';protocolDeviceId:string;
 observedAt:string;receivedAt:string;valid:boolean;latitude:number;longitude:number;speedKph:number;course:number|null;attributes:TelemetryAttributes};
export interface TelematicsDevicePort{
 workspace(actor:ProviderActor,options?:{page?:number}):Promise<FleetDeviceWorkspace>;
 provision(actor:ProviderActor,command:unknown):Promise<unknown>;
 assign(actor:ProviderActor,command:unknown):Promise<unknown>;
 selectSource(actor:ProviderActor,command:unknown):Promise<unknown>;
 requestCommand(actor:ProviderActor,command:unknown):Promise<unknown>;
}
export interface TelemetryIngestPort{
 authorize(proof:GatewayProof):Promise<unknown>;
 ingest(gatewayDigest:string,position:NormalizedTelemetry):Promise<unknown>;
 claim(gatewayDigest:string):Promise<unknown>;
 result(gatewayDigest:string,command:unknown):Promise<unknown>;
}
export function getTelematicsWorkspace(user:ProviderActor,options?:{page?:number}):Promise<unknown>;
export function getCapacityLocationEditor(user:ProviderActor,vehicleId:string):Promise<unknown>;
export function adminProvisionDevice(user:ProviderActor,input:unknown):Promise<unknown>;
export function assignOwnedDevice(user:ProviderActor,input:unknown):Promise<unknown>;
export function selectVehicleLocationSource(user:ProviderActor,input:unknown):Promise<unknown>;
export function requestDeviceCommand(user:ProviderActor,input:unknown):Promise<unknown>;
export function ingestGatewayPosition(gatewayDigest:string,input:unknown):Promise<unknown>;
export function claimGatewayCommands(gatewayDigest:string):Promise<unknown>;
export function recordGatewayCommandResult(gatewayDigest:string,command:unknown):Promise<unknown>;
export function authorizeGatewayRequest(auth:GatewayProof):Promise<unknown>;
export function pruneGatewayHistory(gatewayDigest:string):Promise<unknown>;
/** Internal local helper; no public route exposes synthetic step-up authorization. */
export function authorizeSyntheticEngineStepUp(user:ProviderActor,input:unknown):Promise<unknown>;
