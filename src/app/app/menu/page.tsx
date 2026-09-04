import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { canManageProviderVehicles } from '@/lib/fleet.js';
import { getWorkspaceAccess } from '@/lib/workspace.js';
import { LogoutButton } from '@/components/logout-button';
import { PageHeader } from '@/components/page-header';
import { Activity, BadgeCheck, ClipboardCheck, CreditCard, Database, ExternalLink, Headphones, LayoutGrid, MapPinned, Network, Sparkles, Truck, UserRound } from 'lucide-react';

export default async function WorkspaceMenuPage(){
  const user=await requireUser(undefined,{allowLimited:true});
  const access=await getWorkspaceAccess(user);
  const provider=['TRANSPORTER','DRIVER'].includes(user.role);
  const administrator=user.role==='ADMIN';
  const ownsProfile=provider&&user.driver_kind!=='COMPANY';
  const managesTrucks=canManageProviderVehicles(user);
  const links=[
    ...(managesTrucks?[{href:'/app/fleet',label:user.role==='TRANSPORTER'?'My Fleet':'My trucks',detail:'Add trucks and open each truck’s capacity workspace.',Icon:Truck}]:[]),
    ...(ownsProfile?[{href:'/app/company-page',label:'Public profile',detail:'Manage the transporter page customers see.',Icon:UserRound}]:[]),
    ...(provider?[{href:'/app/verification',label:'Verification',detail:'Review document status and submit updates.',Icon:BadgeCheck}]:[]),
    ...(administrator?[
      {href:'/admin',label:'Administration overview',detail:'Open platform records and current work queues.',Icon:Activity},
      {href:'/admin/operations',label:'Platform records',detail:'Find users, clients, trucks, Drivers, Tracking, Capacity, routes, and plans.',Icon:Database},
      {href:'/admin/reviews',label:'Review Center',detail:'Review documents, ratings, and payment evidence.',Icon:ClipboardCheck},
      {href:'/admin/capacity-network',label:'Private capacity',detail:'View availability shared with Loadgistic.',Icon:Network},
      {href:'/admin/featured',label:'Featured & sponsors',detail:'Manage the public programme, schedule, and sponsors.',Icon:Sparkles}
    ]:[]),
    ...(provider||user.role==='ADMIN'?[{href:user.role==='ADMIN'?'/admin/support':'/app/support',label:'Support',detail:'Open help and current conversations.',Icon:Headphones}]:[]),
    {href:'/app/more',label:'Account & plan',detail:'Private account, access, and payment details.',Icon:CreditCard},
    {href:'/',label:'Open capacity',detail:'Open the public transport-capacity map.',Icon:MapPinned,public:true},
    {href:'/featured',label:'Public featured programme',detail:'Preview today’s transporter programme.',Icon:Sparkles,public:true}
  ];
  return <div className="page workspace-menu-page"><PageHeader icon={LayoutGrid} title="More" subtitle="Account, public profile, support, and public discovery."/><section className="workspace-menu-grid">{links.filter(link=>access.granted||['/app/more','/','/featured'].includes(link.href)).map(({href,label,detail,Icon,public:publicLink})=><Link href={href} className="workspace-menu-card" key={href}><span><Icon aria-hidden="true"/></span><div><strong>{label}</strong><p>{detail}</p></div>{publicLink?<ExternalLink aria-hidden="true"/>:null}</Link>)}</section><div className="workspace-menu-signout"><LogoutButton/></div></div>;
}
