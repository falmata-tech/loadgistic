'use client';
import React from 'react';
import Link from 'next/link';
import {Building2,UserRound,UserRoundCheck,MapPin,ArrowRight,RefreshCw} from 'lucide-react';
import {Text,Localized} from './localization';
import {LoadingIndicator} from './loading-state';
import type {CapacitySearchKind,CapacitySearchResult,CapacitySearchItem} from '@/lib/capacity-search';
export const SEARCH_KIND_LABELS:Record<CapacitySearchKind,string>={COMPANY:'Transport company',OWNER_OPERATOR:'Owner-operator',SELF_MANAGED_DRIVER:'Self-managed driver',COMPANY_DRIVER:'Company driver'};
const icons={COMPANY:Building2,OWNER_OPERATOR:UserRoundCheck,SELF_MANAGED_DRIVER:UserRound,COMPANY_DRIVER:UserRound};
export function CapacitySearchResults({query,view,searchPath}:{query:Record<string,string>;view:'open'|'private'|'loadgistic';searchPath:string}){
 const [page,setPage]=React.useState(1),[result,setResult]=React.useState(null as CapacitySearchResult|null),[loading,setLoading]=React.useState(true),[failed,setFailed]=React.useState(false),[retry,setRetry]=React.useState(0);
 const key=JSON.stringify(query);
 React.useEffect(()=>{
  let alive=true;const controller=new AbortController();setLoading(true);setFailed(false);
  const params=new URLSearchParams(JSON.parse(key));params.set('page',String(page));if(view!=='open')params.set('view',view);
  const timeout=setTimeout(()=>{controller.abort();if(alive){setFailed(true);setLoading(false);}},15000);
  fetch(`/api/capacity-search?${params}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as CapacitySearchResult;if(!controller.signal.aborted)setResult(data);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);}).finally(()=>{clearTimeout(timeout);if(!controller.signal.aborted)setLoading(false);});
  return()=>{alive=false;clearTimeout(timeout);controller.abort();};
 },[key,page,view,retry]);
 function target(handle:string,id:string|null){const params=new URLSearchParams(query);params.delete('q');params.delete('truck');params.delete('resultKind');params.set('provider',handle);if(id)params.set('truck',id);return `${searchPath}?${params}`;}
 return <section className="capacity-result-panel" aria-live="polite" aria-busy={loading}>
  {loading?<LoadingIndicator label="Finding matches…"/>:failed?<div role="alert" className="capacity-result-empty"><Text message="Search is temporarily unavailable. Please try again."/><button type="button" className="button secondary" onClick={()=>setRetry((v:number)=>v+1)}><RefreshCw/><Text message="Try again"/></button></div>:result?.filterError?<p role="alert"><Text message={result.filterError}/></p>:<>
   <p className="capacity-result-count"><Text message="{count} results" values={{count:result?.total||0}}/></p>
   {!result?.items.length?<p className="capacity-result-empty"><Text message="No matches. Try another name or adjust your filters."/></p>:<div className="capacity-result-list">{result.items.map((item:CapacitySearchItem)=>{const Icon=icons[item.kind];return <article className={`capacity-result-card kind-${item.kind.toLowerCase()}`} key={item.key} data-result-kind={item.kind}>
    <header><span className="capacity-result-icon"><Icon aria-hidden="true"/></span><div><small><Text message={SEARCH_KIND_LABELS[item.kind]}/></small><h3>{item.title}</h3></div></header>
    {item.identifier?<span className="capacity-result-identifier">{`@${item.identifier}`} </span>:null}
    {item.subtitle?<p>{item.subtitle}</p>:null}
    {item.city?<p className="capacity-result-city"><MapPin aria-hidden="true"/>{item.city}</p>:null}
    {item.description?<p className="capacity-result-description">{item.description}</p>:null}
    <small><Text message="{count} matching trucks" values={{count:item.matching_trucks}}/></small>
    <footer><Link href={target(item.handle,item.kind==='COMPANY_DRIVER'?item.capacity_id:null)}><Text message={item.kind==='COMPANY_DRIVER'?'Show on map':'Show trucks on map'}/><ArrowRight aria-hidden="true"/></Link><Link href={`/@${item.handle}`}><Text message="Profile"/></Link></footer>
   </article>;})}</div>}
   {(result?.total||0)>15?<Localized as="nav" copy={["aria-label"]} className="capacity-result-pagination" aria-label="Search result pages"><button type="button" className="button secondary" disabled={page===1} onClick={()=>setPage((n:number)=>n-1)}><Text message="Previous"/></button><span>{page} / {Math.ceil((result?.total||0)/15)}</span><button type="button" className="button secondary" disabled={!result?.hasMore} onClick={()=>setPage((n:number)=>n+1)}><Text message="Next"/></button></Localized>:null}
  </>}
 </section>;
}
const documentOptions:Record<string,Array<[string,string]>>={ownerDocs:[['IDENTITY','National ID'],['BUSINESS_LICENSE','Business License'],['BUSINESS_ADDRESS','Business Address']],driverDocs:[['IDENTITY','National ID'],['DRIVER_IDENTITY','Driving licence']],truckDocs:[['VEHICLE_OWNERSHIP','Truck ownership'],['VEHICLE_AUTHORIZATION','Permission to use truck']]};
export function CapacityDocumentFilters({query}:{query:Record<string,string>}){
 const [selected,setSelected]=React.useState(()=>Object.fromEntries(Object.keys(documentOptions).map(key=>[key,(query[key]||'').split(',').filter(Boolean)])) as Record<string,string[]>);
 return <fieldset className="capacity-document-filters"><legend><Text message="Reviewed documents"/></legend><p><Text message="Only current, approved documents. Every selected document must match."/></p>{Object.entries(documentOptions).map(([key,options])=><div key={key}><strong><Text message={key==='ownerDocs'?'Company or owner':key==='driverDocs'?'Driver documents':'Truck documents'}/></strong><input type="hidden" name={key} value={selected[key].join(',')}/>{options.map(([value,label])=><label className="checkbox-label" key={value}><input type="checkbox" checked={selected[key].includes(value)} onChange={event=>setSelected((old:Record<string,string[]>)=>({...old,[key]:event.target.checked?[...old[key],value]:old[key].filter((v:string)=>v!==value)}))}/><Text message={label}/></label>)}</div>)}</fieldset>;
}
