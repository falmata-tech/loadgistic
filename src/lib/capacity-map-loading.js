/**
 * Load one viewport, one cursor request at a time. The caller owns cancellation.
 * @template {{id:string}} T
 * @param {{requestPage:(cursor:string|null,signal:AbortSignal)=>Promise<{items:T[],hasMore:boolean,nextCursor?:string|null,filterError?:string|null}>,onPage:(items:T[])=>void,signal:AbortSignal}} options
 */
export async function loadCapacityMapWindow({requestPage,onPage,signal}){
  const items=new Map();
  const visited=new Set();
  let cursor=null;
  while(true){
    signal.throwIfAborted();
    const page=await requestPage(cursor,signal);
    signal.throwIfAborted();
    if(page.filterError)throw new Error(page.filterError);
    if(!Array.isArray(page.items))throw new Error('Capacity could not be loaded.');
    for(const item of page.items)items.set(item.id,item);
    onPage([...items.values()]);
    if(!page.hasMore)return;
    if(!page.nextCursor||visited.has(page.nextCursor))throw new Error('Capacity could not be loaded.');
    cursor=page.nextCursor;
    visited.add(cursor);
  }
}

/** @template {{id:string}} T @param {T[]} previous @param {T[]} incoming @param {string|null} selectedId */
export function preserveSelectedMapTruck(previous,incoming,selectedId){
  const selected=previous.find(item=>item.id===selectedId);
  return selected&&!incoming.some(item=>item.id===selectedId)?[selected,...incoming]:incoming;
}
