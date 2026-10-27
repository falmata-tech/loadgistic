import {createSupabaseAdminClient} from './supabase-adapter.js';
import {capacityDatabaseFilters} from './capacity-viewport.js';
import {resolveCapacityFilterPlaces} from './capacity-filter-places.js';
export type CapacitySearchKind='COMPANY'|'OWNER_OPERATOR'|'SELF_MANAGED_DRIVER';
export type CapacitySearchItem={key:string;kind:CapacitySearchKind;title:string;accountName?:string;managerName?:string;subtitle:string|null;description:string|null;identifier:string|null;handle:string;capacity_id:string|null;city:string|null;status:string|null;owner:string;driver:string|null;documents:string[];matching_trucks:number};
export type CapacitySearchResult={items:CapacitySearchItem[];total:number;page:number;pageSize:number;hasMore:boolean;filterError?:string};
export async function searchCapacity(filters:Record<string,string>,scope:{audience:'PUBLIC'|'EMAIL'|'ACCOUNT'|'LOADGISTIC';digest?:string;actorId?:string}) :Promise<CapacitySearchResult>{
 if(scope.audience==='LOADGISTIC')throw new Error('PLATFORM_CAPACITY_RETIRED');
 const client=createSupabaseAdminClient(),resolved=await resolveCapacityFilterPlaces(client,filters);
 if(resolved.filterError)return {items:[],total:0,page:1,pageSize:15,hasMore:false,filterError:resolved.filterError};
 const query=capacityDatabaseFilters(filters,resolved.places);
 const page=Math.max(1,Math.min(10000,Number(filters.page)||1));
 const {data,error}=scope.audience==='ACCOUNT'
  ?await client.rpc('account_capacity_search_results',{actor_user_id:scope.actorId||null,recipient_digest:scope.digest||null,query,requested_page:page})
  :await client.rpc('capacity_search_results',{query,requested_audience:scope.audience,requested_digest:scope.digest||null,actor_user_id:scope.actorId||null,requested_page:page});
 if(error)throw new Error('CAPACITY_SEARCH_UNAVAILABLE');
 const result=data as CapacitySearchResult;
 return {...result,items:result.items.map(item=>({...item,accountName:String((item as CapacitySearchItem&{account_name?:string}).account_name||item.owner||item.title||''),managerName:String((item as CapacitySearchItem&{manager_name?:string}).manager_name||''),kind:item.kind==='OWNER_OPERATOR'?'SELF_MANAGED_DRIVER':item.kind}))};
}
