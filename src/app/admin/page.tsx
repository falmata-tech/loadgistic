import Link from 'next/link';
import {Activity,ArrowRight,BadgeDollarSign,Building2,ClipboardCheck,Gauge,Headphones,Network,Route,Sparkles,Truck,UserRoundCog,Users} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {getAdminOperations} from '@/lib/platform-admin.js';
import {PageHeader} from '@/components/page-header';

const records=[
  {view:'WORKSPACES',label:'Clients',count:'workspaces',detail:'Provider and business workspaces',Icon:Building2},
  {view:'USERS',label:'Users',count:'users',detail:'Accounts and platform access',Icon:Users},
  {view:'TRUCKS',label:'Trucks',count:'trucks',detail:'Registered provider vehicles',Icon:Truck},
  {view:'DRIVERS',label:'Drivers',count:'drivers',detail:'Company Driver access and assignments',Icon:UserRoundCog},
  {view:'TRACKING',label:'Tracking',count:'tracking',detail:'Provider-owned shipment tracking',Icon:ClipboardCheck},
  {view:'CAPACITY',label:'Capacity',count:'board_capacity',detail:'Current Empty and Partial signals',Icon:Gauge},
  {view:'ROUTES',label:'Routes',count:'routes',detail:'Regular service routes and areas',Icon:Route},
  {view:'SUBSCRIPTIONS',label:'Plans',count:'subscriptions',detail:'Workspace access and billing state',Icon:BadgeDollarSign}
] as const;

const workAreas=[
  {href:'/admin/reviews',label:'Review Center',detail:'Documents, ratings, and payment evidence',Icon:ClipboardCheck},
  {href:'/admin/capacity-network',label:'Private capacity',detail:'Availability shared with Loadgistic for matching',Icon:Network},
  {href:'/admin/featured',label:'Featured & sponsors',detail:'Programme, schedule, and sponsor management',Icon:Sparkles},
  {href:'/admin/support',label:'Support & team',detail:'Conversations, assignments, and staff permissions',Icon:Headphones}
] as const;

export default async function AdminOverviewPage(){
  const user=await requireUser(['ADMIN'],{allowLimited:true});
  const data:any=await getAdminOperations(user,'',{view:'WORKSPACES',page:1,pageSize:1});
  return <div className="page admin-overview-page">
    <PageHeader icon={Activity} title="Administration" subtitle="Platform overview"/>
    <section className="admin-overview-section" aria-labelledby="admin-records-heading">
      <header><div><span>Platform data</span><h2 id="admin-records-heading">Records</h2></div><Link className="button secondary small" href="/admin/operations">Open all records<ArrowRight aria-hidden="true"/></Link></header>
      <div className="admin-overview-records">{records.map(({view,label,count,detail,Icon})=><Link href={`/admin/operations?view=${view}`} key={view}><span><Icon aria-hidden="true"/></span><div><strong>{label}</strong><small>{detail}</small></div>{count?<b>{String(data.counts[count]??0)}</b>:<ArrowRight aria-hidden="true"/>}</Link>)}</div>
    </section>
    <section className="admin-overview-section" aria-labelledby="admin-work-heading">
      <header><div><span>Work queues</span><h2 id="admin-work-heading">Management</h2></div></header>
      <div className="admin-overview-work">{workAreas.map(({href,label,detail,Icon})=><Link href={href} key={href}><span><Icon aria-hidden="true"/></span><div><strong>{label}</strong><small>{detail}</small></div><ArrowRight aria-hidden="true"/></Link>)}</div>
    </section>
  </div>;
}
