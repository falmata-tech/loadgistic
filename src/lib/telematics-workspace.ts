// Shared browser/native port: deliberately independent of server dependencies.
export type FleetPosition={latitude:number;longitude:number;speedKph:number;course:number|null;ignition:boolean|null;battery:number|null;power?:number|null;alarm?:string|null;observedAt:string;receivedAt:string};
export type FleetDevice={id:string;label:string;imei:string;protocol:string;protocolDeviceId:string;gatewayDeviceId:number;modelProfile:string;synthetic:boolean;active:boolean;revision:string;vehicleId:string|null;lastSeenAt:string|null;connection:'ONLINE'|'STALE'|'UNKNOWN';capabilities:string[];position:FleetPosition|null;lastAlarm?:string|null;alarmAt?:string|null};
export type FleetPhone={installationId:string;connected:boolean;lastObservedAt:string|null;expiresAt:string;accuracyMeters:number|null;speedKph:number|null;headingDegrees:number|null};
export type LocationSource='GPS'|'MOBILE'|null;
export type DriverLocationSelection={vehicleId:string;source:LocationSource;precisionKm:number;revision:string;canSetPhoneLocation:boolean;canChangeLocationSource:boolean};
export type FleetLocation={id:string;label:string;selection:{source:LocationSource;deviceId:string|null;revision:string;precisionKm:number;selectedAt:string|null;canChangeLocationSource:boolean};phone?:FleetPhone|null;published:{source:LocationSource;updatedAt:string|null}|null};
export type FleetDeviceWorkspace={canManage:true;page:number;pageSize:20;total:number;pageCount:number;devices:FleetDevice[];vehicles:FleetLocation[];commands:{id:string;deviceId:string;command:string;state:string;requestedAt:string;expiresAt:string}[]};
const fail=():never=>{throw Error('Invalid GPS device response.');};
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:fail();
const text=(value:unknown):string=>typeof value==='string'?value:fail();
const number=(value:unknown,min=-Infinity,max=Infinity):number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:fail();
const integer=(value:unknown,min=1):number=>Number.isSafeInteger(value)?number(value,min):fail();
const bool=(value:unknown):boolean=>typeof value==='boolean'?value:fail();
const id=(value:unknown):string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)?value:fail();
const stamp=(value:unknown):string=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:fail();
const nullable=<T>(value:unknown,parse:(input:unknown)=>T):T|null=>value==null?null:parse(value);
const list=(value:unknown,max:number):unknown[]=>Array.isArray(value)&&value.length<=max?value:fail();
function retiredSource(value:unknown):boolean{return value==='MANUAL'||value==='MANUAL_ADMIN';}
function source(value:unknown):LocationSource{return value==='GPS'||value==='MOBILE'?value:value===null||retiredSource(value)?null:fail();}
function precision(value:unknown):number{const radius=number(value);return [1,3,5,10,20,40].includes(radius)?radius:fail();}
function canChangeSource(row:Record<string,unknown>):boolean{return row.canChangeLocationSource!==undefined?bool(row.canChangeLocationSource):row.driverSelectedManual!==undefined?!bool(row.driverSelectedManual):true;}
export function parseDriverLocationSelection(value:unknown,vehicleId:string):DriverLocationSelection{
 try{const row=object(value);if(row.vehicleId!==vehicleId||!vehicleId||row.manualPoint!=null&&!retiredSource(row.source))fail();return {vehicleId,source:source(row.source),precisionKm:precision(row.precisionKm),revision:stamp(row.revision),canSetPhoneLocation:bool(row.canSetPhoneLocation),canChangeLocationSource:row.canChangeLocationSource===undefined?bool(row.canSetPhoneLocation):bool(row.canChangeLocationSource)};}
 catch{throw Error('Location details changed. Close and reopen this editor.');}
}
function phone(value:unknown):FleetPhone{const p=object(value),heading=nullable(p.headingDegrees,v=>number(v,0,360));if(heading!==null&&heading>=360)fail();return{installationId:id(p.installationId),connected:bool(p.connected),lastObservedAt:nullable(p.lastObservedAt,stamp),expiresAt:stamp(p.expiresAt),accuracyMeters:nullable(p.accuracyMeters,v=>number(v,0,40000)),speedKph:nullable(p.speedKph,v=>number(v,0,300)),headingDegrees:heading};}
function position(value:unknown):FleetPosition{const p=object(value);return {latitude:number(p.latitude,-90,90),longitude:number(p.longitude,-180,180),speedKph:number(p.speedKph,0,300),course:nullable(p.course,v=>number(v,0,360)),ignition:nullable(p.ignition,bool),battery:nullable(p.battery,v=>number(v,0,100)),power:nullable(p.power,v=>number(v,0,1000)),alarm:nullable(p.alarm,text),observedAt:stamp(p.observedAt),receivedAt:stamp(p.receivedAt)};}
export function parseFleetDeviceWorkspace(value:unknown):FleetDeviceWorkspace{
 const row=object(value);if(row.canManage!==true||row.pageSize!==20)fail();
 return {canManage:true,page:integer(row.page),pageSize:20,total:integer(row.total,0),pageCount:integer(row.pageCount),
  devices:list(row.devices,20).map(value=>{const d=object(value),connection=d.connection;if(!['ONLINE','STALE','UNKNOWN'].includes(String(connection)))fail();return {id:id(d.id),label:text(d.label),imei:text(d.imei),protocol:text(d.protocol),protocolDeviceId:text(d.protocolDeviceId),gatewayDeviceId:integer(d.gatewayDeviceId),modelProfile:text(d.modelProfile),synthetic:bool(d.synthetic),active:bool(d.active),revision:stamp(d.revision),vehicleId:nullable(d.vehicleId,id),lastSeenAt:nullable(d.lastSeenAt,stamp),connection:connection as FleetDevice['connection'],capabilities:list(d.capabilities,5).map(text).filter(c=>['LOCATE','REBOOT','REPORT_INTERVAL','ENGINE_CUT','ENGINE_RESTORE'].includes(c)),position:nullable(d.position,position),lastAlarm:nullable(d.lastAlarm,text),alarmAt:nullable(d.alarmAt,stamp)};}),
  vehicles:list(row.vehicles,100).map(value=>{const v=object(value),s=object(v.selection),p=v.published==null?null:object(v.published),selectedSource=source(s.source);if(s.manualPoint!=null&&!retiredSource(s.source))fail();return {id:id(v.id),label:text(v.label),selection:{source:selectedSource,deviceId:nullable(s.deviceId,id),revision:stamp(s.revision),precisionKm:precision(s.precisionKm),selectedAt:selectedSource===null?nullable(s.selectedAt,stamp):stamp(s.selectedAt),canChangeLocationSource:canChangeSource(s)},phone:nullable(v.phone,phone),published:p?{source:nullable(p.source,source),updatedAt:nullable(p.updatedAt,stamp)}:null};}),
  commands:list(row.commands,50).map(value=>{const c=object(value);return {id:id(c.id),deviceId:id(c.deviceId),command:text(c.command),state:text(c.state),requestedAt:stamp(c.requestedAt),expiresAt:stamp(c.expiresAt)};})};
}
export function readFleetDeviceWorkspace(value:unknown):FleetDeviceWorkspace|null{try{return parseFleetDeviceWorkspace(value);}catch{return null;}}
