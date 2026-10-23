export type LocationIdentity={installationId:string;secret:string};
export type LocationBinding={installationId:string;bindingId:string;revision:string;vehicleId:string;actorId:string;expiresAt:string};
export type PhoneLocationProof=LocationIdentity&{bindingId:string;revision:string;reportId:string;observedAt:number;accuracyMeters?:number|null;speedKph?:number|null;headingDegrees?:number|null};
export type LocationRequest=(path:string,body?:unknown)=>Promise<unknown>;
type Port={now:()=>number;uuid:()=>string;identity:()=>Promise<LocationIdentity>;read:()=>Promise<LocationBinding|null>;write:(binding:LocationBinding|null)=>Promise<void>;pending:()=>Promise<LocationBinding[]>;savePending:(bindings:LocationBinding[])=>Promise<void>;release:(body:unknown)=>Promise<unknown>};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function parseLocationBinding(value:unknown,actorId?:string):LocationBinding{
 if(!value||typeof value!=='object')throw Error('Phone location could not be confirmed.');const item=value as Record<string,unknown>;
 if(!['installationId','bindingId','revision','vehicleId','actorId'].every(key=>typeof item[key]==='string'&&uuid.test(item[key] as string))||typeof item.expiresAt!=='string'||!Number.isFinite(Date.parse(item.expiresAt))||actorId&&item.actorId!==actorId)throw Error('Phone location could not be confirmed.');
 return Object.fromEntries(['installationId','bindingId','revision','vehicleId','actorId','expiresAt'].map(key=>[key,item[key]])) as LocationBinding;
}
/** Identity never grants read/vehicle authority. Every use obtains a current
 * server binding; a scope change fences pending capture synchronously. */
export function createPhoneInstallationController(port:Port){
 let actor='',request:LocationRequest|null=null,generation=0,flight:Promise<LocationBinding>|null=null;
 let barrier:Promise<unknown>=Promise.resolve();
 const serial=<T>(work:()=>Promise<T>):Promise<T>=>{const result=barrier.then(work,work);barrier=result.catch(()=>undefined);return result;};
 async function flush(){
  const identity=await port.identity(),pending=await port.pending(),remaining:LocationBinding[]=[];
  for(const binding of pending){try{await port.release({action:'RELEASE',...identity,bindingId:binding.bindingId,revision:binding.revision});}catch{remaining.push(binding);}}
  await port.savePending(remaining);if(remaining.length)throw Error('Reconnect to finish disconnecting the previous phone session.');
 }
 async function detach(expectedActor?:string){
  const saved=await port.read();if(saved&&(!expectedActor||saved.actorId===expectedActor)){
   const pending=await port.pending();if(!pending.some(item=>item.bindingId===saved.bindingId))pending.push(saved);
   // Persist the revocation before clearing authority, including offline logout.
   await port.savePending(pending);await port.write(null);
  }
  await flush();
 }
 return {
  setAccount(nextActor:string,nextRequest:LocationRequest|null,stop?:()=>Promise<void>){
   request=nextRequest;if(actor===nextActor)return;const previous=actor;actor=nextActor;generation++;flight=null;
   if(previous)void serial(async()=>{try{await stop?.();}finally{await detach(previous);}}).catch(()=>undefined);
  },
  async release(){generation++;flight=null;return serial(()=>detach());},
  async prepare(){
   const version=generation,expectedActor=actor,currentRequest=request;
   if(!expectedActor||!currentRequest)throw Error('Sign in before sharing this phone’s location.');
   if(!flight)flight=serial(async()=>{
    await flush();const saved=await port.read();
    if(saved&&saved.actorId!==expectedActor)await detach(saved.actorId);
    if(version!==generation)throw Error('Location sharing paused. Please try again.');
    const identity=await port.identity();
    const response=await currentRequest('/api/mobile/location/installation',{action:'REGISTER',...identity});
    const binding=parseLocationBinding(response,expectedActor);
    if(binding.installationId!==identity.installationId||Date.parse(binding.expiresAt)<=port.now())throw Error('Phone location could not be confirmed.');
    if(version!==generation){const pending=await port.pending();pending.push(binding);await port.savePending(pending);await flush();throw Error('Location sharing paused. Please try again.');}
    await port.write(binding);return binding;
   }).finally(()=>{flight=null;});
   const binding=await flight,identity=await port.identity();
   return {binding,proof(observedAt:number,observation?:{accuracyMeters:number|null;speedKph:number|null;headingDegrees:number|null}):PhoneLocationProof{
    if(version!==generation||actor!==binding.actorId||!Number.isFinite(observedAt)||observedAt<port.now()-120000||observedAt>port.now()+30000)throw Error('Location sharing paused. Please try again.');
    return {...identity,bindingId:binding.bindingId,revision:binding.revision,reportId:port.uuid(),observedAt,...observation};
   }};
  },
 };
}
