import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Text,Localized} from './localization';
import {requireUser} from '@/lib/auth';
import {getWorkspaceAccess} from '@/lib/workspace.js';
import {getProviderCapacityWorkspace} from '@/lib/provider-capacity.js';
import {providerHomeTab,providerHomeTabs,providerWorkspaceCapabilities} from '@/lib/provider-workspace.js';
import {CAPACITY_FILTER_CHOICES,capacityFilterRecord,type CapacityFilterGroups} from '@/lib/capacity-filter-values.js';
import {listPublicCapacityCursor} from '@/lib/capacity-market.js';
import {DriverCapacityHome} from './driver-capacity-home';
import {FleetWorkspace} from './provider-fleet-workspace';
import {PublicCapacityFeed} from './public-capacity-feed';
import styles from './provider-home.module.css';

type SearchParams=Record<string,string|string[]|undefined>;
const tabPath:Record<string,string>={capacity:'/app/home',vehicles:'/app/home/vehicles',market:'/app/home/market'};

export async function ProviderHome({requested,searchParams}:{requested?:'vehicles'|'market';searchParams:Promise<SearchParams>}){
 const user=await requireUser(undefined,{allowLimited:true});
 if(user.role==='CUSTOMER')redirect(user.selected_business_workspace?.permissions.capacity?'/':'/app/business/tracking');
 if(!['DRIVER','TRANSPORTER'].includes(user.role))redirect('/workspaces');
 const access=await getWorkspaceAccess(user);
 if(!access.granted)redirect('/app/support');
 const capabilities=providerWorkspaceCapabilities(user),tabs=providerHomeTabs(capabilities);
 const selected=providerHomeTab(capabilities,requested);
 if(requested&&selected!==requested)redirect('/app/home');
 if(!requested&&selected==='vehicles')redirect(tabPath.vehicles);
 const query=await searchParams;
 let body:React.ReactNode;
 if(selected==='capacity'){
  const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));
  const workspace=await getProviderCapacityWorkspace(user);
  const vehicles=workspace.vehicles.filter((vehicle:any)=>(!capabilities.currentDrivenVehicleId||vehicle.id===capabilities.currentDrivenVehicleId)&&vehicle.assigned_driver?.id===(capabilities.currentDriverId||user.id));
  const ids=new Set(vehicles.map((vehicle:any)=>vehicle.id));
  body=<DriverCapacityHome vehicles={plain(vehicles)} capacities={plain(workspace.capacities.filter((capacity:any)=>ids.has(capacity.vehicle_id)))} corridors={plain(workspace.corridors.filter((corridor:any)=>ids.has(corridor.vehicle_id)))} access={plain(workspace.access)} ownsFleet={capabilities.canManageFleet} query={query as Record<string,string|undefined>} renderedAt={Date.now()}/>;
 }else if(selected==='vehicles'){
  body=<FleetWorkspace searchParams={Promise.resolve(query as Record<string,string|undefined>)} basePath={tabPath.vehicles} embedded/>;
 }else{
  const workspace=await getProviderCapacityWorkspace(user);
  body=await publicMarket(query,workspace.capacities.map((capacity:{id:string})=>capacity.id));
 }
 return <div className={styles.home} data-view={selected}>
  <Localized as="nav" copy={['aria-label']} aria-label="Home views" className={styles.tabs}>{tabs.map(tab=><Link key={tab.id} href={tabPath[tab.id]} aria-current={selected===tab.id?'page':undefined} className={selected===tab.id?styles.selected:undefined}><Text message={tab.label}/></Link>)}</Localized>
  <div className={styles.content}>{body}</div>
 </div>;
}

async function publicMarket(input:SearchParams,ownSignalIds:string[]){
 const raw=Object.fromEntries(Object.entries(input).map(([key,value])=>[key,Array.isArray(value)?value[0]:value])) as Record<string,string|undefined>;
 let selections:CapacityFilterGroups;let filterError:string|undefined;
 try{selections=capacityFilterRecord(input);}catch{
  filterError='Check your search and vehicle filters.';
  selections=Object.fromEntries(Object.keys(CAPACITY_FILTER_CHOICES).map(key=>[key,Array.isArray(input[key])?'INVALID_CAPACITY_FILTER':raw[key]||''])) as CapacityFilterGroups;
  if(Object.values(input).some(Array.isArray)&&!Object.keys(CAPACITY_FILTER_CHOICES).some(key=>Array.isArray(input[key])))selections.status='INVALID_CAPACITY_FILTER';
 }
 const {loadType:_retiredSelection,...visibleSelections}=selections;
 const mapQuery=Object.fromEntries(Object.entries({...raw,...visibleSelections,q:''})
  .filter(([key,value])=>key!=='view'&&typeof value==='string')) as Record<string,string>;
 const initial=filterError?{items:[],hasMore:false,nextCursor:null,pageSize:14,filterError}:await listPublicCapacityCursor(mapQuery,{pageSize:14});
 return <section className={`public-market-workspace ${styles.market}`} aria-label="Public capacity market"><div className="home-market-shell public-market-console"><div className="public-capacity-body"><PublicCapacityFeed initial={initial} query={{...mapQuery,q:raw.q||''}} searchPath="/app/home/market" ownSignalIds={ownSignalIds}/></div></div></section>;
}
