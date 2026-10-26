import {ClipboardCheck, Headphones, Home, Info, MapPinned, Network, Route, Sparkles, UserRound, Users} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

export type SiteNavigationUser={
 id:string;role:string;name:string;active?:boolean;accountName?:string;
 canManageFleet?:boolean;drivesTruck?:boolean;
 capacityAllowed?:boolean;trackingAllowed?:boolean;
 canManageSupport?:boolean;canManageFeatured?:boolean;
 canManageCustomers?:boolean;canManageOperations?:boolean;canManageTrust?:boolean;
};
export type SiteDestination={key:string;href:string;label:string;icon:LucideIcon};
export const publicDestinations:SiteDestination[]=[
 {key:'capacity',href:'/',label:'Capacity',icon:MapPinned},
 {key:'featured',href:'/featured',label:'Featured',icon:Sparkles},
];
export const aboutDestination:SiteDestination={key:'about',href:'/about',label:'About',icon:Info};
export const visitorDestinations:SiteDestination[]=[publicDestinations[0],{key:'track',href:'/track',label:'Track',icon:Route},publicDestinations[1],aboutDestination];
export function accountHref(user:SiteNavigationUser|null){
 if(!user)return '/login';
 if(user.role==='CUSTOMER')return '/app/business/account';
 if(user.role==='ADMIN')return '/admin';
 if(user.role==='SUPPORT')return '/support';
 return '/app/more';
}
export function memberDestinations(user:SiteNavigationUser|null):SiteDestination[]{
 if(!user)return [];
 if(user.role==='CUSTOMER')return [
  {key:'directory',href:'/app/network',label:'Network',icon:Network},
  ...(user.trackingAllowed?[{key:'my-tracking',href:'/app/business/tracking',label:'Tracking',icon:ClipboardCheck}]:[]),
  {key:'account',href:accountHref(user),label:'Account',icon:UserRound}
 ];
 if(['DRIVER','TRANSPORTER'].includes(user.role))return [
  {key:'my-work',href:'/app/home',label:'Home',icon:Home},
  {key:'directory',href:'/app/network',label:'Network',icon:Network},
  {key:'my-tracking',href:'/app/provider-shipments',label:'Tracking',icon:ClipboardCheck},
  {key:'support',href:'/app/support',label:'Support',icon:Headphones},
  {key:'account',href:accountHref(user),label:'Account',icon:UserRound}
 ];
 if(user.role==='ADMIN')return [
  {key:'admin',href:'/admin',label:'Admin',icon:Home},
  {key:'accounts',href:'/admin/operations',label:'Accounts',icon:Users},
  {key:'featured-admin',href:'/admin/featured',label:'Featured settings',icon:Sparkles},
  {key:'reviews',href:'/admin/reviews',label:'Reviews',icon:ClipboardCheck},
  {key:'support',href:'/admin/support',label:'Support',icon:Headphones}
 ];
 if(user.role==='SUPPORT')return [
  ...(user.canManageSupport?[{key:'support',href:'/support',label:'Support',icon:Headphones}]:[]),
  ...(user.canManageFeatured?[{key:'featured-admin',href:'/admin/featured',label:'Featured settings',icon:Sparkles}]:[]),
  ...(user.canManageCustomers||user.canManageOperations?[{key:'accounts',href:'/admin/operations',label:'Accounts',icon:Users}]:[]),
  ...(user.canManageTrust?[{key:'reviews',href:'/admin/reviews',label:'Reviews',icon:ClipboardCheck}]:[])
 ];
 return [];
}
export function phonePrimaryDestinations(user:SiteNavigationUser|null):SiteDestination[]{
 if(!user)return visitorDestinations;
 const items=memberDestinations(user);
 if(['DRIVER','TRANSPORTER'].includes(user.role))return [items.find(item=>item.key==='my-work'),items.find(item=>item.key==='directory'),items.find(item=>item.key==='my-tracking')].filter(Boolean) as SiteDestination[];
 if(user.role==='CUSTOMER')return [publicDestinations[0],items.find(item=>item.key==='directory'),items.find(item=>item.key==='my-tracking')].filter(Boolean) as SiteDestination[];
 return [publicDestinations[0],publicDestinations[1],items[0]].filter(Boolean) as SiteDestination[];
}
export function activeSiteDestination(path:string,user:SiteNavigationUser|null){
 const destinations=[...visitorDestinations,...memberDestinations(user)];
 if(['DRIVER','TRANSPORTER'].includes(user?.role||'')&&(path==='/app/home'||path.startsWith('/app/home/')||path==='/app/fleet'||path.startsWith('/app/fleet/')))return 'my-work';
 if(path==='/')return 'capacity';
 if(path==='/shared-capacity'||path==='/app/shared-capacity')return 'capacity';
 if(path.startsWith('/providers/')||path.startsWith('/@'))return 'capacity';
 return destinations.filter(item=>item.href!=='/'&&(path===item.href||path.startsWith(`${item.href}/`)))
  .sort((a,b)=>b.href.length-a.href.length)[0]?.key||'';
}
