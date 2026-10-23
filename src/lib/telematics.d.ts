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
export function assertPhysicalGatewayAvailable(user:ProviderActor&{role:string;active:boolean},gatewayId:string):Promise<void>;
export function assertSyntheticGatewayAvailable(user:ProviderActor&{role:string;active:boolean},gatewayId:string):Promise<void>;
export function getAdminDemoFixtureChoices(user:ProviderActor&{role:string;active:boolean},ownerId:string,kind:'ORGANIZATION'|'PROVIDER_PROFILE'):Promise<Array<{imei:string;label:string;linked:boolean;registration:'CREATE'|'READ'}>>;
export function assertAdminDemoFixtureBinding(user:ProviderActor&{role:string;active:boolean},command:{imei:string;protocol:string;protocolDeviceId:string;synthetic:boolean;ownerOrganizationId?:string;ownerProviderProfileId?:string}):Promise<{label:string;registration:'CREATE'|'READ'}>;
export function reconcileAdminProvisionedDevice(user:ProviderActor&{role:string;active:boolean},command:{gatewayId:string;gatewayDeviceId:number;ownerOrganizationId?:string;ownerProviderProfileId?:string;imei:string;protocol:string;protocolDeviceId:string;label:string;synthetic:boolean;modelProfile:string}):Promise<{id:string;revision:string;reused:true}|null>;
export function getAdminProviderDevices(user:ProviderActor&{role:string;active:boolean},ownerId:string,kind:'ORGANIZATION'|'PROVIDER_PROFILE',page?:number):Promise<{owner:{id:string;name:string;record_kind:string;type:string};items:Array<{id:string;label:string;imei:string;protocol:string;synthetic:boolean;active:boolean;last_seen_at:string|null;revision:string;assignedVehicleLabel:string|null}>;total:number;page:number;pageCount:number}>;
export function searchAdminTransportProviders(user:ProviderActor&{role:string;active:boolean},term:string,page?:number,pageSize?:number):Promise<{items:Array<{id:string;name:string;record_kind:'ORGANIZATION'|'PROVIDER_PROFILE';type:string}>;pagination:{page:number;pageCount:number;total:number}}>;
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
