/** A rendered-feature read belongs to one settled camera/data revision. */
export function createVisibleQuery<T>(read:()=>Promise<T>,commit:(value:T)=>void,interval=200) {
 let active=true,moving=false,busy=false,wanted=false,revision=0,lastRead=-Infinity;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const clear=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}};
 async function refresh():Promise<void>{
  if(!active)return;
  wanted=true;
  if(moving||busy)return;
  const delay=interval-(Date.now()-lastRead);
  if(delay>0){if(timer===undefined)timer=setTimeout(()=>{timer=undefined;void refresh();},delay);return;}
  clear();wanted=false;busy=true;lastRead=Date.now();const requestedRevision=revision;
  try{
   const value=await read();
   if(active&&!moving&&requestedRevision===revision)commit(value);
  }catch{
   // Sources/layers can disappear during style updates. A later render retries.
   // Keep the previous view; never turn a transient query into empty markers.
  }finally{
   busy=false;
   if(active&&(wanted||requestedRevision!==revision))void refresh();
  }
 }
 return {
  refresh,
  invalidate(){revision++;wanted=true;},
  moving(){revision++;moving=true;wanted=true;clear();},
  settled(){revision++;moving=false;void refresh();},
  close(){active=false;revision++;clear();},
 };
}
