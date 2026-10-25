import {redirect} from 'next/navigation';

import {Text} from '@/components/localization';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { canManageProviderVehicles } from '@/lib/fleet.js';
import { getWorkspaceAccess } from '@/lib/workspace.js';
import { LogoutButton } from '@/components/logout-button';
import { PageHeader } from '@/components/page-header';
import { Activity, BadgeCheck, ClipboardCheck, Database, ExternalLink, Headphones, LayoutGrid, MapPinned, Network, Sparkles, Satellite, Truck, UserRound, Users } from 'lucide-react';

export default async function WorkspaceMenuPage(){
  const user=await requireUser(undefined,{allowLimited:true});
  if(['TRANSPORTER','DRIVER'].includes(user.role))redirect('/app/more');
  const access=await getWorkspaceAccess(user);
  const provider=['TRANSPORTER','DRIVER'].includes(user.role);
  const administrator=user.role==='ADMIN';
  const ownsProfile=provider&&user.driver_kind!=='COMPANY';
  const managesTrucks=canManageProviderVehicles(user);
  const links=[
    ...(managesTrucks?[{href:'/app/fleet',label:user.role==='TRANSPORTER'?'My Fleet':'My vehicles',detail:'Add vehicles and open each vehicle’s capacity workspace.',Icon:Truck}]:[]),
    ...(ownsProfile?[{href:'/app/company-page',label:'Public profile',detail:'Manage the transporter page customers see.',Icon:UserRound}]:[]),
    ...(provider?[{href:'/app/verification',label:'Verification',detail:'Review document status and submit updates.',Icon:BadgeCheck}]:[]),
    ...(administrator?[
      {href:'/admin',label:'Administration overview',detail:'Open platform records and current work queues.',Icon:Activity},
      {href:'/admin/operations',label:'Accounts',detail:'Open an account to see its workspace, vehicles and related work.',Icon:Database},
      {href:'/admin/reviews',label:'Review Center',detail:'Documents and shipment reviews.',Icon:ClipboardCheck},
      {href:'/admin/featured',label:'Featured & sponsors',detail:'Manage the public programme, schedule, and sponsors.',Icon:Sparkles},
      {href:'/admin/devices',label:'GPS devices',detail:'Connect trackers to provider fleets',Icon:Satellite},
      {href:'/admin/support?tab=team',label:'Team',detail:'Staff accounts and responsibilities',Icon:Users}
    ]:[]),
    ...(provider||user.role==='ADMIN'?[{href:user.role==='ADMIN'?'/admin/support':'/app/support',label:'Support',detail:'Open help and current conversations.',Icon:Headphones}]:[]),
    {href:'/app/more',label:'Account',detail:'Your details, profile and security.',Icon:UserRound},
    {href:'/',label:'Open capacity',detail:'Open the public transport-capacity map.',Icon:MapPinned,public:true},
    {href:'/featured',label:'Public featured programme',detail:'Preview today’s transporter programme.',Icon:Sparkles,public:true}
  ];
  const visible=links.filter(link=>access.granted||(provider&&link.href==='/app/support')||['/app/more','/','/featured'].includes(link.href));
  const groups=[{label:'Management',items:visible.filter(link=>!link.public&&link.href!=='/app/more')},{label:'Account',items:visible.filter(link=>link.href==='/app/more')},{label:'Explore',items:visible.filter(link=>link.public)}];
  return <div className="page workspace-menu-page"><PageHeader icon={LayoutGrid} title={<Text message="More"/>}/>{groups.filter(group=>group.items.length).map(group=><section className="workspace-menu-group" key={group.label}><h2><Text message={group.label}/></h2><div className="workspace-menu-grid">{group.items.map(({href,label,detail,Icon,public:publicLink})=><Link href={href} className="workspace-menu-card" key={href}><span><Icon aria-hidden="true"/></span><div><strong><Text message={label}/></strong><p><Text message={detail}/></p></div>{publicLink?<ExternalLink aria-hidden="true"/>:null}</Link>)}</div></section>)}<div className="workspace-menu-signout"><LogoutButton/></div></div>;
}
