import type {BusinessWorkspaceContext,BusinessWorkspaceDirectory,BusinessWorkspaceSummary,BusinessMember,BusinessPendingInvitation} from '../../../../src/lib/business-workspaces/contracts';
import {parseVisitorShipment,type VisitorShipment} from './runtime-content.ts';
import type {TrackingSummary} from './tracking';
import {parseCapacityPage,type CapacitySignal} from './public-capacity.ts';
import {discoveryParams,type TruckFilters} from './discovery.ts';
export type {BusinessWorkspaceContext,BusinessWorkspaceDirectory,BusinessWorkspaceSummary,BusinessMember,BusinessPendingInvitation};
type Row=Record<string,unknown>;
const invalid=()=>new Error('Could not load this workspace. Please try again.');
const row=(value:unknown):Row=>{if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();return value as Row;};
const strings=(value:Row,keys:string[])=>keys.every(key=>typeof value[key]==='string');
const positive=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>0;
export function parseBusinessSummary(value:unknown,actorId:string):BusinessWorkspaceSummary{
 const data=row(value),permissions=row(data.permissions);
 if(data.actorId!==actorId||data.actorRole!=='CUSTOMER'||!strings(data,['id','name','handle'])||!['BROKER','SHIPPER','RECEIVER'].includes(String(data.kind))
  ||!['OWNER','ADMIN','STAFF'].includes(String(data.membershipRole))||!positive(data.version)||!positive(data.membershipRevision)||data.city!==null&&typeof data.city!=='string'
  ||['capacity','tracking','team','owner'].some(key=>typeof permissions[key]!=='boolean')
  ||permissions.owner!==(data.membershipRole==='OWNER')||permissions.team!==['OWNER','ADMIN'].includes(String(data.membershipRole)))throw invalid();
 return data as unknown as BusinessWorkspaceSummary;
}
export function parseBusinessContext(value:unknown,actorId:string):BusinessWorkspaceContext{
 const data=row(value);if(data.actorId!==actorId||!Array.isArray(data.workspaces)||!Array.isArray(data.invitations))throw invalid();
 const workspaces=data.workspaces.map(item=>parseBusinessSummary(item,actorId));
 if(new Set(workspaces.map(item=>item.id)).size!==workspaces.length||data.selectedWorkspaceId!==null&&!workspaces.some(item=>item.id===data.selectedWorkspaceId))throw invalid();
 if(data.invitations.some(value=>{const item=row(value);return !strings(item,['id','workspaceId','businessName','handle','expiresAt'])||!['ADMIN','STAFF'].includes(String(item.role))||typeof item.capacity!=='boolean'||typeof item.tracking!=='boolean';}))throw invalid();
 return {...data,workspaces} as unknown as BusinessWorkspaceContext;
}
export function parseBusinessDirectory(value:unknown,actorId:string,workspaceId:string):BusinessWorkspaceDirectory{
 const data=row(value),workspace=parseBusinessSummary(data.workspace,actorId);
 if(workspace.id!==workspaceId||!Array.isArray(data.members)||!Array.isArray(data.invitations))throw invalid();
 for(const value of data.members){const member=row(value);if(!strings(member,['userId','firstName'])||!['OWNER','ADMIN','STAFF'].includes(String(member.role))||!positive(member.revision)
  ||['active','capacity','tracking'].some(key=>typeof member[key]!=='boolean')||member.email!==undefined&&(!workspace.permissions.team||typeof member.email!=='string')
  ||member.erased!==undefined&&member.erased!==true||member.erased===true&&(member.active||member.email!==undefined))throw invalid();}
 if(!workspace.permissions.team&&data.invitations.length)throw invalid();
 for(const value of data.invitations){const item=row(value);if(!strings(item,['id','email','role','status','expiresAt'])||!['ADMIN','STAFF'].includes(String(item.role))||!['PENDING','EXPIRED'].includes(String(item.status))||typeof item.capacity!=='boolean'||typeof item.tracking!=='boolean'||item.emailSentAt!==null&&typeof item.emailSentAt!=='string')throw invalid();}
 return {...data,workspace} as unknown as BusinessWorkspaceDirectory;
}
export type BusinessTrackingList={workspaceId:string;total:number;page:number;pageCount:number;shipments:TrackingSummary[]};
export function parseBusinessTrackingList(value:unknown,workspaceId:string):BusinessTrackingList{
 const data=row(value);if(data.workspaceId!==workspaceId||!Number.isSafeInteger(data.total)||Number(data.total)<0||!positive(data.page)||!positive(data.pageCount)||!Array.isArray(data.shipments)
  ||data.shipments.some(value=>!strings(row(value),['id','code','origin','destination','cargo','status','driver','truck','updatedAt'])))throw invalid();
 return data as unknown as BusinessTrackingList;
}
export type BusinessTrackingDetail=VisitorShipment&{workspaceId:string;isOwner:boolean;canViewLocation:boolean;ownerActionsRequireVerification:true};
export function parseBusinessTrackingDetail(value:unknown,workspaceId:string,shipmentId:string):BusinessTrackingDetail{
 const data=row(value),shipment=parseVisitorShipment(data);
 if(data.workspaceId!==workspaceId||shipment.id!==shipmentId||typeof data.isOwner!=='boolean'||typeof data.canViewLocation!=='boolean'
  ||data.ownerActionsRequireVerification!==true||shipment.canApprove||shipment.canReview||shipment.canShare||shipment.events.some(event=>event.hasProof)
  ||data.canViewLocation===false&&shipment.location!==null)throw invalid();
 return data as unknown as BusinessTrackingDetail;
}
export async function loadBusinessCapacity(workspaceId:string,signal:AbortSignal,onPage:(items:CapacitySignal[])=>void,request:(path:string)=>Promise<unknown>,filters:TruckFilters={}):Promise<void>{
 let cursor='';const seen=new Set<string>(),items=new Map<string,CapacitySignal>();
 do{
  const params=discoveryParams('',filters);if(cursor)params.set('cursor',cursor);
  const page=parseCapacityPage(await request(`/api/business-workspaces/${encodeURIComponent(workspaceId)}/capacity?${params}`));
  if(signal.aborted)return;
  for(const item of page.items)items.set(item.id,item);onPage([...items.values()]);
  if(!page.hasMore)return;cursor=page.nextCursor!;if(seen.has(cursor))throw invalid();seen.add(cursor);
 }while(!signal.aborted);
}
