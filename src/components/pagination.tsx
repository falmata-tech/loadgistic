import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  path,
  query,
  page,
  pageCount,
  total
}:{
  path:string;
  query:Record<string,string|undefined>;
  page:number;
  pageCount:number;
  total:number;
}){
  if(pageCount<=1)return <p className="pagination-summary">{total} results</p>;
  const href=(target:number)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(query)){
      if(value&&key!=='page')params.set(key,value);
    }
    params.set('page',String(target));
    return `${path}?${params.toString()}`;
  };
  return <nav className="pagination" aria-label="Results pages">
    {page>1?<Link href={href(page-1)} className="button secondary icon-only" aria-label="Previous page" title="Previous page"><ChevronLeft aria-hidden="true"/></Link>:<span className="button secondary icon-only disabled" aria-hidden="true"><ChevronLeft/></span>}
    <span>Page {page} of {pageCount} · {total} results</span>
    {page<pageCount?<Link href={href(page+1)} className="button secondary icon-only" aria-label="Next page" title="Next page"><ChevronRight aria-hidden="true"/></Link>:<span className="button secondary icon-only disabled" aria-hidden="true"><ChevronRight/></span>}
  </nav>;
}
