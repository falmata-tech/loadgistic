import {PublicCapacityFeed} from '@/components/public-capacity-feed';
import {Text} from '@/components/localization';
import {MapPinned} from 'lucide-react';
import {requireBusinessWorkspace} from '@/lib/identity/require-business';
import {listBusinessCapacity} from '@/lib/business-capacity/supabase';
import {capacityFilterRecord} from '@/lib/capacity-filter-values.js';
import styles from '@/components/business-workspace.module.css';
export const dynamic='force-dynamic';
export default async function BusinessCapacityPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {user,workspace}=await requireBusinessWorkspace('capacity');
 const {loadType:_legacySpaceNeeded,...input}=await searchParams;
 const query:Record<string,string>=Object.fromEntries(Object.entries(input).map(([key,value])=>[key,typeof value==='string'?value:'']));
 let filterError='';try{const {loadType:_retiredSelection,...visibleSelections}=capacityFilterRecord(input);Object.assign(query,visibleSelections);}catch{filterError='Check your search and vehicle filters.';}
 // Profile text search remains separate from truck filters on this map.
 query.q='';
 const initial=filterError?{items:[],nextCursor:null,hasMore:false,pageSize:100,filterError}:await listBusinessCapacity(user.id,workspace.id,query);
 return <div className={styles.mapPage}><header className={styles.mapHeading}><h1><Text message="Capacity"/></h1><div className={styles.scope}><MapPinned aria-hidden="true"/><span>{workspace.name} · <Text message="Shared with your business"/></span></div></header><div className={`${styles.mapCanvas} public-market-console`} key={`${user.id}:${workspace.id}:${workspace.membershipRevision}`}><section className="home-market-shell"><PublicCapacityFeed initial={initial} query={query} searchPath="/app/business/capacity" apiPath={`/api/business-workspaces/${workspace.id}/capacity`} searchApiPath={`/api/business-workspaces/${workspace.id}/capacity/search`}/></section></div></div>;
}
