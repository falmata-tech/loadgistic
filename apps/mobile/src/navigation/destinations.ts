import type {AccountSession} from '../session/contract';
import {initialCapacityIdentity} from '../api/discovery.ts';
import {transporterSearchQuery} from '../../../../src/lib/transporter-search.js';
import {providerHomeTab} from '../../../../src/lib/provider-workspace.js';

export type Destination={href:string;label:string;icon:'map'|'route'|'users'|'info'|'home'|'truck'|'network'|'help'|'more'|'user'|'documents'|'tracking'|'featured'|'billing'|'profile'|'location'|'shield'};
// Mirrors the web's PublicMobileNav and AppShell. This is display policy only.
export const publicDestinations:Destination[]=[
 {href:'/',label:'Capacity',icon:'map'},
 {href:'/featured',label:'Featured',icon:'featured'},
];
export const aboutDestination:Destination={href:'/about',label:'About',icon:'info'};
export const visitorDestinations:Destination[]=[publicDestinations[0],{href:'/visitor-tracking',label:'Track',icon:'route'},publicDestinations[1],aboutDestination];
const home:Destination={href:'/account',label:'Home',icon:'home'};
const settings:Destination={href:'/account-settings',label:'Account',icon:'user'};
const tracking:Destination={href:'/shipments',label:'Tracking',icon:'tracking'};
const network:Destination={href:'/network',label:'Network',icon:'network'};
const support:Destination={href:'/support',label:'Support',icon:'help'};
const workspacePaths=new Set(['/account','/account-settings','/account-details','/account-security','/driver-photo','/fleet','/manage-capacity','/regular-service','/shipments','/shipment-detail','/shipment-manage','/network','/directory','/shared-capacity','/support','/support-chat','/billing','/documents','/profile','/workspaces','/business-capacity','/business-tracking','/business-account','/business-shipment']);
export function hasWorkspace(session:AccountSession|null){return session?.state==='ACTIVE'&&(['TRANSPORTER','DRIVER'].includes(session.user.role)||session.user.role==='CUSTOMER'&&Boolean(session.user.selectedBusinessWorkspace));}
export function hasProviderHome(session:AccountSession|null){return session?.state==='ACTIVE'&&session.access?.granted===true&&['TRANSPORTER','DRIVER'].includes(session.user.role);}
export function providerMarketContext(params:Record<string,unknown>={}){return {initialQuery:transporterSearchQuery(params.q)||'',initialFilters:initialCapacityIdentity(params)};}
export function providerHomeHref(session:AccountSession|null,params:Record<string,unknown>={}){
 const {initialQuery,initialFilters}=providerMarketContext(params);
 const tab=initialQuery||initialFilters.provider||initialFilters.truck?'market':providerHomeTab(workspaceCapabilities(session),undefined);
 const query=new URLSearchParams({tab});
 if(initialQuery)query.set('q',initialQuery);
 for(const key of ['provider','truck'] as const)if(initialFilters[key])query.set(key,initialFilters[key]!);
 return `/account?${query}`;
}
export function workspaceHome(session:AccountSession|null){const workspace=session?.user.role==='CUSTOMER'?session.user.selectedBusinessWorkspace:null;return workspace?(workspace.permissions.capacity?'/business-capacity':workspace.permissions.tracking?'/business-tracking':'/business-account'):hasProviderHome(session)?providerHomeHref(session):'/account';}
export function navigationTarget(path:string,href:string,session:AccountSession|null){
 if(href==='/account'&&hasProviderHome(session))return path==='/account'?null:providerHomeHref(session);
 return path===href?null:href;
}
export function workspaceCapabilities(session:AccountSession|null){
 const user=session?.user,active=hasWorkspace(session);
 const legacyOwner=user?.role==='TRANSPORTER'||['OWNER_OPERATOR','SELF_MANAGED_DRIVER'].includes(user?.operatingModel||'');
 const ownsProviderAccount=active&&(typeof user?.ownsProviderAccount==='boolean'?user.ownsProviderAccount:legacyOwner);
 return {ownsProviderAccount,canManageFleet:ownsProviderAccount&&(typeof user?.canManageFleet==='boolean'?user.canManageFleet:true),drivesTruck:active&&(typeof user?.drivesTruck==='boolean'?user.drivesTruck:user?.role==='DRIVER'),currentDriverId:user?.currentDriverId||null,currentDrivenVehicleId:user?.currentDrivenVehicleId||null};
}
export function workspaceRoleLabel(session:AccountSession|null):string{
 if(!hasWorkspace(session))return '';
 if(session!.user.role==='CUSTOMER')return session!.user.selectedBusinessWorkspace?.membershipRole==='OWNER'?'Owner':session!.user.selectedBusinessWorkspace?.membershipRole==='ADMIN'?'Workspace admin':'Team member';
 if(session!.user.operatingModel==='COMPANY_DRIVER')return 'Fleet driver';
 return 'Transport Provider';
}
export function isWorkspace(path:string,session:AccountSession|null){return hasWorkspace(session)&&workspacePaths.has(path);}
export function workspaceDestinations(session:AccountSession|null):Destination[]{
 if(!hasWorkspace(session))return [];
 if(session!.user.role==='CUSTOMER'){
  const permissions=session!.user.selectedBusinessWorkspace!.permissions;
  return [{href:'/directory',label:'Network',icon:'network'},...(permissions.tracking?[{href:'/business-tracking',label:'Tracking',icon:'tracking'} as Destination]:[]),{href:'/business-account',label:'Account',icon:'user'}];
 }
 if(!session!.access?.granted)return [home,support,settings];
 return [home,network,tracking,{href:'/featured',label:'Featured',icon:'featured'},support,settings];
}
export function phoneDestinations(session:AccountSession|null):Destination[]{
 if(!hasWorkspace(session))return visitorDestinations;
 const workspace=workspaceDestinations(session);
 if(hasWorkspace(session)&&['TRANSPORTER','DRIVER'].includes(session!.user.role))return [workspace.find(item=>item.href==='/account'),workspace.find(item=>item.href==='/network'),workspace.find(item=>item.href==='/shipments'),{href:'#menu',label:'More',icon:'more'}].filter(Boolean) as Destination[];
 if(hasWorkspace(session)&&session!.user.role==='CUSTOMER')return [publicDestinations[0],workspace.find(item=>item.href==='/directory'),workspace.find(item=>item.href==='/business-tracking'),{href:'#menu',label:'More',icon:'more'}].filter(Boolean) as Destination[];
 return [publicDestinations[0],publicDestinations[1],{href:'#menu',label:'More',icon:'more'}];
}
export type AccountSection='DETAILS'|'SECURITY'|'PROFILE';
export function accountSections(session:AccountSession|null):AccountSection[]{
 if(!hasWorkspace(session))return [];
 if(!session!.access?.granted)return ['DETAILS','SECURITY'];
 const ownsProfile=workspaceCapabilities(session).ownsProviderAccount;
 return ['DETAILS','SECURITY',...(ownsProfile?['PROFILE'] as AccountSection[]:[])];
}
export function activeDestination(path:string,workspace:boolean,session?:AccountSession|null):string{
 if(!workspace){if(['/visitor-tracking','/visitor-shipment'].includes(path))return '/visitor-tracking';if(path==='/featured')return '/featured';if(path==='/about')return '/about';return path==='/'||path==='/transporter'?'/':'';}
 if(session?.user.role==='CUSTOMER')return path==='/directory'?'/directory':['/shared-capacity','/business-capacity'].includes(path)?'/':['/business-tracking','/business-shipment'].includes(path)?'/business-tracking':'/business-account';
 if(['/shipments','/shipment-detail','/shipment-manage'].includes(path))return '/shipments';
 if(['/support','/support-chat'].includes(path))return '/support';
 if(path==='/shared-capacity')return '/';
 if(path==='/fleet')return '/account';
 if(['/manage-capacity','/regular-service'].includes(path)){
  return '/account';
 }
 if(['/account','/network'].includes(path))return path;
 return '/account-settings';
}
