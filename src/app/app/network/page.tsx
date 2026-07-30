import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Heart, Inbox, Network, UserCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getNetworkState, listNetwork, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { NetworkActions } from '@/components/network-actions';
import { Pagination } from '@/components/pagination';

const views={
  CONNECTED:{label:'Connected',icon:UserCheck,key:'connected'},
  REQUESTS:{label:'Requests',icon:Inbox,key:'requests'},
  FAVORITES:{label:'Favorites',icon:Heart,key:'favorites'}
} as const;

export default async function NetworkPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser();
  if(user.driver_kind==='COMPANY'||user.role==='ADMIN')redirect('/app/home?error=My+Network+is+managed+by+the+workspace+owner.');
  const query=await searchParams;
  const view=Object.hasOwn(views,query.view||'')?query.view as keyof typeof views:'CONNECTED';
  const data:any=listNetwork(user);
  const selected=views[view];
  const rows:any[]=data[selected.key];
  const result:any=paginateResults(rows,{page:query.page,pageSize:12});
  return <div className="page"><PageHeader icon={Network} title="My Network" subtitle="Partners, requests, and favorites." action={<Link className="button icon-button-label" href="/app/providers"><Network aria-hidden="true"/>Find people</Link>}/><Flash error={query.error} success={query.success}/>
    <nav className="network-tabs" aria-label="Network views">{Object.entries(views).map(([key,item])=>{const Icon=item.icon;return <Link className={`button ${view===key?'':'secondary'} icon-button-label`} href={`/app/network?view=${key}`} key={key}><Icon aria-hidden="true"/>{item.label}<span>{data[item.key].length}</span></Link>})}</nav>
    <div className="network-list">{result.items.map((row:any)=>{const state=getNetworkState(user,row.target_kind,row.target_id);return <article className="card network-row" key={row.id}><div className="company-logo small">{row.name.split(' ').slice(0,2).map((word:string)=>word[0]).join('')}</div><div><h3><Link href={`/app/providers/${row.handle}`}>{row.name}</Link></h3><p className="meta">{row.city||'Location not added'}</p>{row.incoming?<span className="status">Incoming request</span>:row.outgoing?<span className="status">Request sent</span>:row.status==='DECLINED'?<span className="status expired">Not connected</span>:null}</div><NetworkActions state={state} targetKind={row.target_kind} targetId={row.target_id} returnTo={`/app/network?view=${view}&page=${result.page}`}/></article>})}</div>
    {!result.items.length?<div className="empty-state"><selected.icon aria-hidden="true"/><strong>No {selected.label.toLowerCase()} yet.</strong><span>Use the authenticated Directory to find Businesses and transport providers.</span></div>:null}
    <Pagination path="/app/network" query={{view}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
