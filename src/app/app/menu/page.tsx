import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getWorkspaceAccess } from '@/lib/repository.js';
import { LogoutButton } from '@/components/logout-button';
import { PageHeader } from '@/components/page-header';
import { BadgeCheck, CreditCard, ExternalLink, Headphones, LayoutGrid, MapPinned, Sparkles, UserRound } from 'lucide-react';

export default async function WorkspaceMenuPage(){
  const user=await requireUser(undefined,{allowLimited:true});
  const access=await getWorkspaceAccess(user);
  const provider=['TRANSPORTER','DRIVER'].includes(user.role);
  const ownsProfile=provider&&user.driver_kind!=='COMPANY';
  const links=[
    ...(ownsProfile?[{href:'/app/company-page',label:'Public profile',detail:'Manage the transporter page customers see.',Icon:UserRound}]:[]),
    ...(provider?[{href:'/app/verification',label:'Verification',detail:'Review document status and submit updates.',Icon:BadgeCheck}]:[]),
    ...(provider||user.role==='ADMIN'?[{href:user.role==='ADMIN'?'/admin/support':'/app/support',label:'Support',detail:'Open help and current conversations.',Icon:Headphones}]:[]),
    {href:'/app/more',label:'Account & plan',detail:'Private account, access, and payment details.',Icon:CreditCard},
    {href:'/',label:'Truck Market',detail:'Open the public capacity map.',Icon:MapPinned,public:true},
    {href:'/featured',label:'Featured transporters',detail:'Open today’s public programme.',Icon:Sparkles,public:true}
  ];
  return <div className="page workspace-menu-page"><PageHeader icon={LayoutGrid} title="More" subtitle="Account, public profile, support, and public discovery."/><section className="workspace-menu-grid">{links.filter(link=>access.granted||['/app/more','/','/featured'].includes(link.href)).map(({href,label,detail,Icon,public:publicLink})=><Link href={href} className="workspace-menu-card" key={href}><span><Icon aria-hidden="true"/></span><div><strong>{label}</strong><p>{detail}</p></div>{publicLink?<ExternalLink aria-hidden="true"/>:null}</Link>)}</section><div className="workspace-menu-signout"><LogoutButton/></div></div>;
}
