/** A pending camera command belongs to its source, selection and camera intent. */
export function createCapacityCameraIntent(){
 let active=true,revision=0,gestured=false;
 return {
  begin(){gestured=true;return ++revision;},
  invalidate(){revision++;},
  gesture(){gestured=true;revision++;},
  current(token:number){return active&&revision===token;},
  canCenterInitially(){return active&&!gestured;},
  close(){active=false;revision++;},
 };
}
export type CapacityCameraIntent=ReturnType<typeof createCapacityCameraIntent>;

export async function expandCapacityCluster<T>(intent:CapacityCameraIntent,read:()=>Promise<T>,move:(value:T)=>void,fail:()=>void){
 const token=intent.begin();
 try{const value=await read();if(intent.current(token))move(value);}catch{if(intent.current(token))fail();}
}
