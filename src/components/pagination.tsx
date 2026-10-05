
import {Text,Localized} from '@/components/localization';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  path,
  query,
  page,
  pageCount,
  total,
  pageParam='page',
  fragment
}:{
  path:string;
  query:Record<string,string|undefined>;
  page:number;
  pageCount:number;
  total:number;
  pageParam?:string;
  fragment?:string;
}){
  if(total===0)return null;
  if(pageCount<=1)return <p className="pagination-summary"><Text message="{count} results" values={{count:total}}/></p>;
  const href=(target:number)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(query)){
      if(value&&key!==pageParam)params.set(key,value);
    }
    params.set(pageParam,String(target));
    return `${path}?${params.toString()}${fragment?`#${encodeURIComponent(fragment)}`:''}`;
  };
  return <Localized as="nav" copy={["aria-label"]} className="pagination" aria-label="Results pages">
    {page>1?<Localized as="link" copy={["aria-label","title"]} href={href(page-1)} className="button secondary icon-only" aria-label="Previous page" title="Previous page"><ChevronLeft aria-hidden="true"/></Localized>:<span className="button secondary icon-only disabled" aria-hidden="true"><ChevronLeft/></span>}
    <span><Text message="Page {page} of {pages} · {count} results" values={{page,pages:pageCount,count:total}}/></span>
    {page<pageCount?<Localized as="link" copy={["aria-label","title"]} href={href(page+1)} className="button secondary icon-only" aria-label="Next page" title="Next page"><ChevronRight aria-hidden="true"/></Localized>:<span className="button secondary icon-only disabled" aria-hidden="true"><ChevronRight/></span>}
  </Localized>;
}
