import type {IconName} from '../components/app-icon';

export type BusinessAccountActionId='TEAM'|'DETAILS'|'DOCUMENTS'|'LEAVE'|'SWITCH'|'PERSONAL'|'SECURITY'|'SUPPORT';
export type BusinessAccountAction={id:BusinessAccountActionId;message:string;icon:IconName};
export type BusinessAccountGroup={id:'business'|'account';title:string;icon:IconName;actions:BusinessAccountAction[];signOut?:boolean};

export function businessAccountGroups(permissions:{team:boolean;owner:boolean}|null):BusinessAccountGroup[]{
 const business:BusinessAccountAction[]=[
  ...(permissions?.team?[{id:'TEAM',message:'Team',icon:'users'} as const]:[]),
  ...(permissions?[{id:'DETAILS',message:'Workspace details',icon:'profile'} as const]:[]),
  ...(permissions?.owner?[{id:'DOCUMENTS',message:'Documents',icon:'documents'} as const]:[]),
  ...(permissions&&!permissions.owner?[{id:'LEAVE',message:'Leave workspace',icon:'logout'} as const]:[]),
  {id:'SWITCH',message:'Switch workspace',icon:'network'},
 ];
 const account:BusinessAccountAction[]=[
  {id:'PERSONAL',message:'Account details',icon:'user'},
  {id:'SECURITY',message:'Email and account security',icon:'shield'},
  {id:'SUPPORT',message:'Software support',icon:'help'},
 ];
 return [
  {id:'business',title:'Shipper / broker workspace',icon:'profile',actions:business},
  {id:'account',title:'Your account',icon:'user',actions:account,signOut:true},
 ];
}
