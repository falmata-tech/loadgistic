import styles from '@/app/admin/admin-presentation.module.css';

import {Text} from '@/components/localization';
import Link from 'next/link';
import {Activity,ArrowRight,Building2,ClipboardCheck,Gauge,Headphones,Network,Route,Sparkles,Satellite,Truck,UserRoundCog,Users} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {getAdminOperations} from '@/lib/platform-admin.js';
import {PageHeader} from '@/components/page-header';

const records=[
  {view:'TRUCKS',label:'Vehicles',count:'trucks',detail:'Registered vehicles',Icon:Truck},
  {view:'DRIVERS',label:'Drivers',count:'drivers',detail:'Company Driver access and assignments',Icon:UserRoundCog},
  {view:'TRACKING',label:'Tracking',count:'tracking',detail:'Shipments and progress updates',Icon:ClipboardCheck},
  {view:'CAPACITY',label:'Capacity',count:'board_capacity',detail:'Current Empty and Partial signals',Icon:Gauge},
  {view:'ROUTES',label:'Routes',count:'routes',detail:'Regular service routes and areas',Icon:Route},
] as const;

const workAreas=[
  {href:'/admin/reviews',label:'Review Center',detail:'Documents and shipment reviews',Icon:ClipboardCheck},
  {href:'/admin/featured',label:'Featured & sponsors',detail:'Programme, schedule, and sponsor management',Icon:Sparkles},
  {href:'/admin/support?tab=team',label:'Team',detail:'Staff accounts and responsibilities',Icon:Users},
  {href:'/admin/devices',label:'GPS devices',detail:'Connect trackers to provider fleets',Icon:Satellite}
] as const;

export default async function AdminOverviewPage(){
  const user=await requireUser(['ADMIN'],{allowLimited:true});
  const data:any=await getAdminOperations(user,'',{view:'WORKSPACES',page:1,pageSize:1});
  return <div className={"page admin-overview-page "+styles.workspace}>
    <PageHeader icon={Activity} title={<Text message="Platform overview"/>}/>
    <div className="admin-daily-work"><aside className="card admin-support-entry"><Headphones aria-hidden="true"/><div><h2><Text message="Provider support"/></h2><p><Text message="Conversations and assignments"/></p></div><Link className="button secondary" href="/admin/support"><Text message="Open inbox"/><ArrowRight aria-hidden="true"/></Link></aside></div>
    <section className="admin-overview-section" aria-labelledby="admin-accounts-heading"><header><h2 id="admin-accounts-heading"><Text message="Accounts"/></h2></header><Link href="/admin/operations" className="admin-account-directory"><span><Users aria-hidden="true"/></span><div><strong><Text message="People and provider accounts"/></strong><p><Text message="Open an account to see its business, vehicles and related work."/></p></div><b>{String(data.counts.users??0)}</b><ArrowRight aria-hidden="true"/></Link></section>
    <section className="admin-overview-section" aria-labelledby="admin-records-heading">
      <header><div><h2 id="admin-records-heading"><Text message="Fleet and shipments"/></h2></div><Link className="button secondary small" href="/admin/operations?view=TRUCKS"><Text message="View vehicles"/><ArrowRight aria-hidden="true"/></Link></header>
      <div className="admin-overview-records">{records.map(({view,label,count,detail,Icon})=><Link href={`/admin/operations?view=${view}`} key={view}><span><Icon aria-hidden="true"/></span><div><strong><Text message={label}/></strong><small><Text message={detail}/></small></div>{count?<b>{String(data.counts[count]??0)}</b>:<ArrowRight aria-hidden="true"/>}</Link>)}</div>
    </section>
    <section className="admin-overview-section" aria-labelledby="admin-work-heading">
      <header><div><h2 id="admin-work-heading"><Text message="Management"/></h2></div></header>
      <div className="admin-overview-work">{workAreas.map(({href,label,detail,Icon})=><Link href={href} key={href}><span><Icon aria-hidden="true"/></span><div><strong><Text message={label}/></strong><small><Text message={detail}/></small></div><ArrowRight aria-hidden="true"/></Link>)}</div>
    </section>
  </div>;
}
