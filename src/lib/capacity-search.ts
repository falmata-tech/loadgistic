import {createSupabaseAdminClient} from './supabase-adapter.js';
import {capacityDatabaseFilters} from './capacity-viewport.js';
import {resolveCapacityFilterPlaces} from './capacity-filter-places.js';
export type CapacitySearchKind='COMPANY'|'OWNER_OPERATOR'|'SELF_MANAGED_DRIVER'|'COMPANY_DRIVER';
export type CapacitySearchItem={key:string;kind:CapacitySearchKind;title:string;subtitle:string|null;description:string|null;identifier:string|null;handle:string;capacity_id:string|null;city:string|null;status:string|null;owner:string;driver:string|null;documents:string[];matching_trucks:number};
export type CapacitySearchResult={items:CapacitySearchItem[];total:number;page:number;pageSize:number;hasMore:boolean;filterError?:string};
export async function searchCapacity(filters:Record<string,string>,scope:{audience:'PUBLIC'|'EMAIL'|'LOADGISTIC';digest?:string;actorId?:string}) :Promise<CapacitySearchResult>{
 const client=createSupabaseAdminClient(),resolved=await resolveCapacityFilterPlaces(client,filters);
 if(resolved.filterError)return {items:[],total:0,page:1,pageSize:15,hasMore:false,filterError:resolved.filterError};
 const query=capacityDatabaseFilters(filters,resolved.places);
 const {data,error}=await client.rpc('capacity_search_results',{query,requested_audience:scope.audience,requested_digest:scope.digest||null,actor_user_id:scope.actorId||null,requested_page:Math.max(1,Math.min(10000,Number(filters.page)||1))});
 if(error)throw new Error('CAPACITY_SEARCH_UNAVAILABLE');
 const result=data as CapacitySearchResult;
 return {...result,items:result.items.map(item=>({...item,kind:item.kind==='OWNER_OPERATOR'?'SELF_MANAGED_DRIVER':item.kind}))};
}
