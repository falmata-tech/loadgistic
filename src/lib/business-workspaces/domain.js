// FEAT-ENT-001. Input rules only; current membership is always checked in SQL.
export class BusinessWorkspaceError extends Error {
  constructor(code){super(code);this.name='BusinessWorkspaceError';this.code=code;}
}
export function businessId(value){
 if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
 return value.toLowerCase();
}
function object(input,keys){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!keys.includes(key)))throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
 return input;
}
function text(value,min,max){
 if(typeof value!=='string'||value.trim().length<min||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
 return value.trim();
}
function flag(value){if(typeof value!=='boolean')throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');return value;}
function memberRole(value){if(!['ADMIN','STAFF'].includes(value))throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');return value;}
export function businessCreation(input){
 const row=object(input,['name','handle','kind','city']);
 const handle=text(row.handle,3,60).toLowerCase();
 if(!/^[a-z0-9][a-z0-9_-]{2,59}$/.test(handle)||!['BROKER','SHIPPER','RECEIVER'].includes(row.kind))throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
 return {name:text(row.name,2,100),handle,kind:row.kind,city:row.city===undefined||row.city===null?null:text(row.city,0,100)||null};
}
export function businessCommand(input){
 const row=object(input,['action','expectedVersion','name','city','email','role','capacity','tracking','userId','invitationId','active']);
 if(!Number.isSafeInteger(row.expectedVersion)||row.expectedVersion<1||row.expectedVersion>999999999999999)throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
 const base={action:row.action,expectedVersion:row.expectedVersion};let result;
 switch(row.action){
  case 'UPDATE_DETAILS':result={...base,name:text(row.name,2,100),city:row.city==null?null:text(row.city,0,100)||null};break;
  case 'INVITE':{
   const email=text(row.email,3,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
   result={...base,email,role:memberRole(row.role),capacity:flag(row.capacity),tracking:flag(row.tracking)};break;
  }
  case 'UPDATE_MEMBER':result={...base,userId:businessId(row.userId),role:memberRole(row.role),capacity:flag(row.capacity),tracking:flag(row.tracking),active:flag(row.active)};break;
  case 'REMOVE_MEMBER':case 'TRANSFER_OWNERSHIP':result={...base,userId:businessId(row.userId)};break;
  case 'REVOKE_INVITATION':result={...base,invitationId:businessId(row.invitationId)};break;
  case 'LEAVE':case 'ARCHIVE':result=base;break;
  default:throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
 }
 // Reject foreign authority/unused fields instead of silently ignoring them.
 if(Object.keys(row).some(key=>!(key in result)))throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
 return result;
}
export function businessSearch(input){return text(input,0,80);}
export function businessCacheKey(actorId,workspaceId,membershipRevision){
 if(!Number.isSafeInteger(membershipRevision)||membershipRevision<1)throw new BusinessWorkspaceError('INVALID_BUSINESS_INPUT');
 return `business:${businessId(actorId)}:${businessId(workspaceId)}:${membershipRevision}`;
}
