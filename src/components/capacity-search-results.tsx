'use client';
import React from 'react';
import {useBlockedProviders} from './content-safety';
import Link from 'next/link';
import {UserRound,MapPin,ArrowRight,RefreshCw} from 'lucide-react';
import {Text,FeedbackText,Localized} from './localization';
import {LoadingIndicator} from './loading-state';
import type {CapacitySearchKind,CapacitySearchResult,CapacitySearchItem} from '@/lib/capacity-search';
import {TRANSPORTER_SEARCH_TIMEOUT_MS,transporterSearchQuery} from '@/lib/transporter-search.js';
import {CAPACITY_FILTER_PRESENTATION as filterPresentation} from '@/lib/capacity-filter-presentation';
export const SEARCH_KIND_LABELS:Record<CapacitySearchKind,string>={COMPANY:'Transport Provider',OWNER_OPERATOR:'Transport Provider',SELF_MANAGED_DRIVER:'Transport Provider'};
export function CapacitySearchResults({query,mapQuery=query,view,searchPath,apiPath='/api/capacity-search',active=true,requestVersion=0,render,onProfileSelect}:{query:Record<string,string>;mapQuery?:Record<string,string>;view:'open'|'private'|'account'|'loadgistic';searchPath:string;apiPath?:string;active?:boolean;requestVersion?:number;render?:(content:React.ReactNode)=>React.ReactNode;onProfileSelect?:()=>void}){
 const {blocked}=useBlockedProviders(),blockKey=JSON.stringify(blocked);
 const key=JSON.stringify({...query,...(blocked.length?{blocked:blockKey}:{})});
 const searchKey=JSON.stringify([key,view,searchPath,apiPath,requestVersion]);
 const [pagination,setPagination]=React.useState({key:searchKey,page:1}),[response,setResponse]=React.useState(null as {identity:string;data:CapacitySearchResult}|null),[failure,setFailure]=React.useState(null as string|null),[retry,setRetry]=React.useState(0),[completed,setCompleted]=React.useState(0);
 const page=pagination.key===searchKey?pagination.page:1;
 const identity=active&&transporterSearchQuery(query.q)?JSON.stringify([searchKey,page,retry]):null;
 const wanted=React.useRef(null as {identity:string;params:URLSearchParams}|null);
 const pending=React.useRef(null as {controller:AbortController;timeout:ReturnType<typeof setTimeout>|null}|null);
 const mounted=React.useRef(false);
 const params=new URLSearchParams(JSON.parse(key));params.set('page',String(page));if(view!=='open')params.set('view',view);
 wanted.current=identity?{identity,params}:null;
 const result=response?.identity===identity?response?.data:null,failed=identity!==null&&failure===identity,loading=!result&&!failed;
 React.useEffect(()=>{setPagination({key:searchKey,page:1});},[searchKey]);
 React.useEffect(()=>{
  mounted.current=true;
  return()=>{mounted.current=false;const request=pending.current;pending.current=null;if(request){request.controller.abort();if(request.timeout!==null)clearTimeout(request.timeout);}};
 },[view,searchPath,apiPath]);
 React.useEffect(()=>{
  const desired=wanted.current;
  if(!desired){if(response)setResponse(null);if(failure)setFailure(null);return;}
  if(pending.current||response?.identity===desired.identity||failure===desired.identity)return;
  const controller=new AbortController(),request={controller,timeout:null as ReturnType<typeof setTimeout>|null};pending.current=request;
  let finished=false;
  function finish(){if(finished)return;finished=true;if(request.timeout!==null)clearTimeout(request.timeout);if(pending.current===request){pending.current=null;if(mounted.current)setCompleted((value:number)=>value+1);}}
  request.timeout=setTimeout(()=>{controller.abort();if(mounted.current&&wanted.current?.identity===desired.identity)setFailure(desired.identity);finish();},TRANSPORTER_SEARCH_TIMEOUT_MS);
  // Aborting a browser request does not prove its database work stopped. Keep
  // one issued request until its body settles; only the latest interest runs next.
  fetch(`${apiPath}?${desired.params}`,{signal:controller.signal,cache:'no-store'}).then(async incoming=>{
   if(!incoming.ok)throw new Error();const data=await incoming.json() as CapacitySearchResult;
   if(!data||!Array.isArray(data.items))throw new Error();
   if(mounted.current&&!controller.signal.aborted&&wanted.current?.identity===desired.identity)setResponse({identity:desired.identity,data});
  }).catch(()=>{if(mounted.current&&!controller.signal.aborted&&wanted.current?.identity===desired.identity)setFailure(desired.identity);}).finally(finish);
 },[identity,completed,response?.identity,failure]);
 function target(handle:string){const params=new URLSearchParams(mapQuery);params.delete('q');params.delete('truck');params.delete('resultKind');params.set('provider',handle);return `${searchPath}?${params}`;}
 if(!identity)return render?render(null):null;
 const content=<section className="capacity-result-panel" aria-live="polite" aria-busy={loading}>
  {loading?<LoadingIndicator label="Finding transporters"/>:failed?<div role="alert" className="capacity-result-empty"><Text message="Search is temporarily unavailable. Please try again."/><button type="button" className="button secondary" onClick={()=>setRetry((v:number)=>v+1)}><RefreshCw/><Text message="Try again"/></button></div>:result?.filterError?<p role="alert"><FeedbackText message={result.filterError} fallback="Search is temporarily unavailable. Please try again."/></p>:<>
   <p className="capacity-result-count"><Text message="{count} results" values={{count:result?.total||0}}/></p>
   {!result?.items.length?<p className="capacity-result-empty"><Text message="No transporters match this search. Try an account name, manager name, handle or city."/></p>:<div className="capacity-result-list">{result.items.map((item:CapacitySearchItem)=>{return <article className="capacity-result-card" key={item.key} data-result-kind={item.kind}>
    <header><span className="capacity-result-icon"><UserRound aria-hidden="true"/></span><div><small><Text message={SEARCH_KIND_LABELS[item.kind]}/></small><h3>{item.accountName||item.title}</h3>{item.handle?<span className="capacity-result-identifier">@{item.handle}</span>:null}</div></header>
    {item.managerName?<p><Text message="Account manager"/> · {item.managerName}</p>:null}
    {item.city?<p className="capacity-result-city"><MapPin aria-hidden="true"/>{item.city}</p>:null}
    {item.description?<p className="capacity-result-description">{item.description}</p>:null}
    <small><Text message="{count} vehicles" values={{count:item.matching_trucks}}/></small>
    <footer><Link href={target(item.handle)} onClick={onProfileSelect}><Text message="Show vehicles on map"/><ArrowRight aria-hidden="true"/></Link><Link href={`/@${item.handle}`}><Text message="Profile"/></Link></footer>
   </article>;})}</div>}
   {(result?.total||0)>15?<Localized as="nav" copy={["aria-label"]} className="capacity-result-pagination" aria-label="Search result pages"><button type="button" className="button secondary" disabled={page===1} onClick={()=>setPagination({key:searchKey,page:page-1})}><Text message="Previous"/></button><span>{page} / {Math.ceil((result?.total||0)/15)}</span><button type="button" className="button secondary" disabled={!result?.hasMore} onClick={()=>setPagination({key:searchKey,page:page+1})}><Text message="Next"/></button></Localized>:null}
  </>}
 </section>;
 return render?render(content):content;
}
const documentOptions=filterPresentation.documents.groups;
export function CapacityDocumentFilters({query}:{query:Record<string,string>}){
 const [selected,setSelected]=React.useState(()=>Object.fromEntries(documentOptions.map(({key})=>[key,(query[key]||'').split(',').filter(Boolean)])) as Record<string,string[]>);
 return <fieldset className="capacity-document-filters"><legend><Text message={filterPresentation.documents.title}/></legend><p><Text message="Only current, approved documents. Every selected document must match."/></p>{documentOptions.map(({key,label,options})=><div key={key}><strong><Text message={label}/></strong><input type="hidden" name={key} value={selected[key].join(',')}/>{options.map(([value,optionLabel])=><label className="checkbox-label" key={value}><input type="checkbox" checked={selected[key].includes(value)} onChange={event=>setSelected((old:Record<string,string[]>)=>({...old,[key]:event.target.checked?[...old[key],value]:old[key].filter((v:string)=>v!==value)}))}/><Text message={optionLabel}/></label>)}</div>)}</fieldset>;
}
