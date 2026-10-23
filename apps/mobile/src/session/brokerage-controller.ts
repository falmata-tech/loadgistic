export type Intake={name:string;phone:string;origin:string;destination:string};
export type ChatMessage={id:string;sequence:number;kind:'VISITOR'|'BROKER';body:string;createdAt:string;name:string};
export type ChatSnapshot={request:{id:string;origin:string;destination:string;status:string;assignedName:string|null;endedAt:string|null;expiresAt:string};messages:ChatMessage[];hasOlder:boolean};
type Draft={kind:'DRAFT';requestId:string;secret:string;intake:Intake;validUntil:number};
type Active={kind:'ACTIVE';requestId:string;token:string;validUntil:number;pending?:{messageId:string;body:string}};
type Saved=Draft|Active;
type Port={now:()=>number;uuid:()=>string;secret:()=>Promise<string>;read:()=>Promise<string|null>;write:(value:string)=>Promise<void>;remove:()=>Promise<void>;request:(path:string,options:{token?:string;body?:unknown})=>Promise<unknown>;changed:()=>void};
const WEEK=7*24*60*60*1000,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateIntake(value:Intake):Intake{
 const text=(s:string,max:number)=>{if(typeof s!=='string'||!s.trim()||s.length>max||/[\u0000-\u001f\u007f]/.test(s))throw Error('Enter your route, name and phone number.');return s.trim();};
 const phone=text(value.phone,30);if(!/^\+?[0-9 ()-]+$/.test(phone)||!/^\+?[0-9]{7,15}$/.test(phone.replace(/[ ()-]/g,'')))throw Error('Enter a valid phone number.');
 return {name:text(value.name,100),phone,origin:text(value.origin,160),destination:text(value.destination,160)};
}
export function parseSavedChat(raw:string,now:number):Saved{
 const value=JSON.parse(raw) as Saved;
 if(!value||!UUID.test(value.requestId)||!Number.isFinite(value.validUntil)||value.validUntil<=now||value.validUntil>now+WEEK+1000)throw Error('This conversation has expired on this phone.');
 if(value.kind==='DRAFT'){if(!/^[a-f0-9]{64}$/.test(value.secret))throw Error('Invalid saved chat.');return {kind:'DRAFT',requestId:value.requestId,secret:value.secret,validUntil:value.validUntil,intake:validateIntake(value.intake)};}
 if(value.kind!=='ACTIVE'||typeof value.token!=='string'||value.token.length>2048||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.token))throw Error('Invalid saved chat.');
 if(value.pending&&(!UUID.test(value.pending.messageId)||typeof value.pending.body!=='string'||!value.pending.body.trim()||value.pending.body.length>2000))throw Error('Invalid saved message.');
 return {kind:'ACTIVE',requestId:value.requestId,token:value.token,validUntil:value.validUntil,...(value.pending?{pending:{messageId:value.pending.messageId,body:value.pending.body}}:{})};
}
function chatSnapshot(value:unknown,id:string):ChatSnapshot{
 if(!value||typeof value!=='object')throw Error('Could not read the conversation.');const data=value as ChatSnapshot;
 if(data.request?.id!==id||!Array.isArray(data.messages)||data.messages.length>50||typeof data.hasOlder!=='boolean')throw Error('Could not read the conversation.');
 if(data.messages.some(item=>!UUID.test(item.id)||!Number.isSafeInteger(item.sequence)||item.sequence<1||!['VISITOR','BROKER'].includes(item.kind)||typeof item.body!=='string'))throw Error('Could not read the conversation.');return data;
}
export function createBrokerageController(port:Port){
 let saved:Saved|null=null,data:ChatSnapshot|null=null,error='',ready=false,busy=false,visible=false,epoch=0,readSequence=0;
 let writes=Promise.resolve(),cleanupRequired=false;
 const emit=()=>port.changed();
 const write=(fn:()=>Promise<void>)=>{const next=writes.then(fn,fn);writes=next.catch(()=>undefined);return next;};
 const persist=async(value:Saved,generation:number)=>{await write(async()=>{if(generation===epoch)await port.write(JSON.stringify(value));});if(generation!==epoch)throw Error('This conversation changed.');saved=value;emit();};
 const clear=async()=>{epoch++;readSequence++;saved=null;data=null;emit();try{await write(async()=>{try{await port.remove();}catch{await port.write('');}});cleanupRequired=false;error='';}catch{cleanupRequired=true;error='Saved chat access could not be removed. Retry before starting another chat.';}emit();};
 const fail=(caught:unknown)=>{error=caught instanceof Error?caught.message:'Could not confirm the update. Please try again.';emit();};
 const refresh=async(before?:number)=>{
  if(!visible||busy||saved?.kind!=='ACTIVE')return;
  if(saved.validUntil<=port.now()){await clear();error='This conversation has expired on this phone.';emit();return;}
  const generation=epoch,sequence=++readSequence,current=saved;
  try{const result=chatSnapshot(await port.request('/api/mobile/brokerage'+(before?`?before=${before}`:''),{token:current.token}),current.requestId);if(generation===epoch&&sequence===readSequence&&visible){data=result;error='';emit();}}
  catch(caught){if(generation===epoch&&sequence===readSequence&&visible){if((caught as {status?:number}).status===403)await clear();fail(caught);}}
 };
 const mutate=async(fn:()=>Promise<void>)=>{if(busy)return;busy=true;readSequence++;error='';emit();try{await fn();}catch(caught){fail(caught);}finally{busy=false;emit();}};
 return {
  snapshot:()=>({ready,busy,error,cleanupRequired,saved,chat:visible?data:null}),
  setVisible(value:boolean){visible=value;if(!value){readSequence++;data=null;}emit();},
  async restore(){const generation=epoch;try{const raw=await port.read();if(generation!==epoch)return;if(raw)saved=parseSavedChat(raw,port.now());}catch(caught){await clear();fail(caught);}finally{ready=true;emit();}await refresh();},
  refresh,
  start:(input:Intake)=>mutate(async()=>{
   if(cleanupRequired)throw Error('Retry clearing saved chat access first.');
   if(saved?.kind==='ACTIVE')throw Error('End your current chat before starting again.');
   if(saved&&saved.validUntil<=port.now()){await clear();throw Error('The saved request has expired. Start a new chat.');}
   const generation=epoch;
   if(!saved){const intake=validateIntake(input),secret=await port.secret();await persist({kind:'DRAFT',requestId:port.uuid(),secret,intake,validUntil:port.now()+WEEK},generation);}
   const draft=saved as Draft,requestedAt=port.now();
   let result:{token:string;expiresAt:string;issuedAt:number;snapshot:unknown};
   try{result=await port.request('/api/mobile/brokerage/start',{body:{requestId:draft.requestId,secret:draft.secret,...draft.intake}}) as typeof result;}
   catch(caught){if(generation===epoch&&(caught as {status?:number;code?:string}).status===403&&(caught as {code?:string}).code==='CHAT_UNAVAILABLE'){await clear();throw Error('This saved conversation is no longer available. Start a new request.');}throw caught;}
   const remaining=Date.parse(result.expiresAt)-result.issuedAt;if(!Number.isFinite(remaining)||remaining<=0||remaining>WEEK+1000)throw Error('Could not confirm chat access. Retry the same request.');
   const next=parseSavedChat(JSON.stringify({kind:'ACTIVE',requestId:draft.requestId,token:result.token,validUntil:requestedAt+remaining}),port.now());
   const snapshot=chatSnapshot(result.snapshot,draft.requestId);await persist(next,generation);if(visible)data=snapshot;
  }),
  send:(body:string)=>mutate(async()=>{
   if(saved?.kind!=='ACTIVE'||!visible)throw Error('Open your chat to continue.');
   const generation=epoch;
   if(!saved.pending){const text=body.trim();if(!text||text.length>2000)throw Error('Enter a message of up to 2,000 characters.');await persist({...saved,pending:{messageId:port.uuid(),body:text}},generation);}
   const active=saved as Active;
   const snapshot=chatSnapshot(await port.request('/api/mobile/brokerage',{token:active.token,body:{action:'SEND',...active.pending}}),active.requestId);
   await persist({...active,pending:undefined},generation);if(visible)data=snapshot;
  }),
  end:()=>mutate(async()=>{
   if(saved?.kind!=='ACTIVE')throw Error('Open your chat to continue.');const generation=epoch,active=saved;
   const snapshot=chatSnapshot(await port.request('/api/mobile/brokerage',{token:active.token,body:{action:'END',confirm:true}}),active.requestId);
   await persist({...active,pending:undefined},generation);if(visible)data=snapshot;
  }),
  async newChat(){if(busy)return;if(saved?.kind==='DRAFT'){error='Retry the saved request first so we can check whether it was received.';emit();return;}if(saved?.kind==='ACTIVE'&&(!data||!data.request.endedAt&&data.request.status!=='CLOSED')){error='End your current chat first. Our team can still call you.';emit();return;}await clear();},
  clear,
 };
}
