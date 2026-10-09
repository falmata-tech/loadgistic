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
const workspacePaths=new Set(['/account','/account-settings','/account-details','/account-security','/driver-photo','/fleet','/manage-capacity','/regular-service','/shipments','/shipment-detail','/shipment-manage','/network','/support','/support-chat','/billing','/documents','/profile']);
export function hasWorkspace(session:AccountSession|null){return session?.state==='ACTIVE'&&['TRANSPORTER','DRIVER'].includes(session.user.role);}
export function workspaceRoleLabel(session:AccountSession|null):string{
 if(!hasWorkspace(session))return '';
 if(session!.user.role==='TRANSPORTER')return 'Fleet transporter';
 if(session!.user.operatingModel==='COMPANY_DRIVER')return 'Company driver';
 return 'Independent driver';
}
export function isWorkspace(path:string,session:AccountSession|null){return hasWorkspace(session)&&workspacePaths.has(path);}
export function workspaceDestinations(session:AccountSession|null):Destination[]{
 if(!hasWorkspace(session))return [];
 if(!session!.access?.granted)return [home,support,settings];
 const vehicles:Destination=session!.user.operatingModel==='COMPANY_DRIVER'
  ?{href:'/manage-capacity',label:'My truck',icon:'truck'}
  :{href:'/fleet',label:session!.user.role==='DRIVER'?'My truck':'Fleet',icon:'truck'};
 return session!.user.role==='TRANSPORTER'?[home,tracking,network,settings]:[home,vehicles,tracking,network,settings];
}
export type AccountSection='DETAILS'|'SECURITY'|'PROFILE';
export function accountSections(session:AccountSession|null):AccountSection[]{
 if(!hasWorkspace(session))return [];
 if(!session!.access?.granted)return ['DETAILS','SECURITY'];
 const ownsProfile=session!.user.operatingModel!=='COMPANY_DRIVER';
 return ['DETAILS','SECURITY',...(ownsProfile?['PROFILE'] as AccountSection[]:[])];
}
export function activeDestination(path:string,workspace:boolean,session?:AccountSession|null):string{
 if(!workspace){if(['/visitor-tracking','/visitor-shipment'].includes(path))return '/visitor-tracking';if(path==='/featured')return '/featured';if(path==='/about')return '/about';return path==='/'||path==='/transporter'?'/':'';}
 if(['/shipments','/shipment-detail','/shipment-manage'].includes(path))return '/shipments';
 if(['/support','/support-chat'].includes(path))return '/support';
 if(['/manage-capacity','/regular-service','/fleet'].includes(path))return session?.user.role==='TRANSPORTER'?'/account':session?.user.operatingModel==='COMPANY_DRIVER'?'/manage-capacity':'/fleet';
 if(['/account','/network'].includes(path))return path;
 return '/account-settings';
}
