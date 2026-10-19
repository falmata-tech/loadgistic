import type {AccountSession} from '../session/contract';

export type Destination={href:string;label:string;icon:'map'|'route'|'users'|'info'|'home'|'truck'|'network'|'help'|'more'|'user'|'documents'|'billing'|'profile'|'location'|'shield'};
// Mirrors the web's PublicMobileNav and AppShell. This is display policy only.
export const publicDestinations:Destination[]=[
 {href:'/',label:'Capacity',icon:'map'},
 {href:'/visitor-tracking',label:'Track',icon:'route'},
 {href:'/featured',label:'Featured',icon:'users'},
 {href:'/about',label:'About',icon:'info'},
];
const home:Destination={href:'/account',label:'Home',icon:'home'};
const settings:Destination={href:'/account-settings',label:'Account',icon:'user'};
const tracking:Destination={href:'/shipments',label:'Tracking',icon:'route'};
const network:Destination={href:'/network',label:'Network',icon:'network'};
const support:Destination={href:'/support',label:'Support',icon:'help'};
const workspacePaths=new Set(['/account','/account-settings','/account-details','/account-security','/driver-photo','/fleet','/manage-capacity','/regular-service','/shipments','/shipment-detail','/shipment-manage','/network','/support','/support-chat','/billing','/documents','/profile','/workspaces','/business-capacity','/business-tracking','/business-account','/business-shipment']);
export function hasWorkspace(session:AccountSession|null){return session?.state==='ACTIVE'&&(['TRANSPORTER','DRIVER'].includes(session.user.role)||session.user.role==='CUSTOMER'&&Boolean(session.user.selectedBusinessWorkspace));}
export function workspaceHome(session:AccountSession|null){const workspace=session?.user.role==='CUSTOMER'?session.user.selectedBusinessWorkspace:null;return workspace?(workspace.permissions.capacity?'/business-capacity':workspace.permissions.tracking?'/business-tracking':'/business-account'):'/account';}
export function workspaceCapabilities(session:AccountSession|null){
 const user=session?.user,active=hasWorkspace(session);
 const legacyOwner=user?.role==='TRANSPORTER'||['OWNER_OPERATOR','SELF_MANAGED_DRIVER'].includes(user?.operatingModel||'');
 const ownsProviderAccount=active&&(typeof user?.ownsProviderAccount==='boolean'?user.ownsProviderAccount:legacyOwner);
 return {ownsProviderAccount,canManageFleet:ownsProviderAccount&&(typeof user?.canManageFleet==='boolean'?user.canManageFleet:true),drivesTruck:active&&(typeof user?.drivesTruck==='boolean'?user.drivesTruck:user?.role==='DRIVER'),currentDriverId:user?.currentDriverId||null,currentDrivenVehicleId:user?.currentDrivenVehicleId||null};
}
export function workspaceRoleLabel(session:AccountSession|null):string{
 if(!hasWorkspace(session))return '';
 if(session!.user.role==='CUSTOMER')return session!.user.selectedBusinessWorkspace?.membershipRole==='OWNER'?'Owner':session!.user.selectedBusinessWorkspace?.membershipRole==='ADMIN'?'Business admin':'Team member';
 if(session!.user.operatingModel==='COMPANY_DRIVER')return 'Company driver';
 return 'Transport Provider';
}
export function isWorkspace(path:string,session:AccountSession|null){return hasWorkspace(session)&&workspacePaths.has(path);}
export function workspaceDestinations(session:AccountSession|null):Destination[]{
 if(!hasWorkspace(session))return [];
 if(session!.user.role==='CUSTOMER'){
  const permissions=session!.user.selectedBusinessWorkspace!.permissions;
  return [...(permissions.capacity?[{href:'/business-capacity',label:'Capacity',icon:'map'} as Destination]:[]),...(permissions.tracking?[{href:'/business-tracking',label:'Tracking',icon:'route'} as Destination]:[]),{href:'/business-account',label:'Account',icon:'user'}];
 }
 if(!session!.access?.granted)return [home,support,settings];
 const capabilities=workspaceCapabilities(session);
 const vehicles:Destination=!capabilities.canManageFleet
  ?{href:'/manage-capacity',label:'My vehicle',icon:'truck'}
  :{href:'/fleet',label:'Fleet',icon:'truck'};
 return capabilities.canManageFleet&&!capabilities.drivesTruck?[home,tracking,network,settings]:[home,vehicles,tracking,network,settings];
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
 if(session?.user.role==='CUSTOMER')return path==='/business-capacity'?path:['/business-tracking','/business-shipment'].includes(path)?'/business-tracking':'/business-account';
 if(['/shipments','/shipment-detail','/shipment-manage'].includes(path))return '/shipments';
 if(['/support','/support-chat'].includes(path))return '/support';
 if(['/manage-capacity','/regular-service','/fleet'].includes(path)){
  const capabilities=workspaceCapabilities(session||null);
  return capabilities.canManageFleet?(capabilities.drivesTruck?'/fleet':'/account'):'/manage-capacity';
 }
 if(['/account','/network'].includes(path))return path;
 return '/account-settings';
}
