import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function harness(fetcher,{initialRevision='"rendered"'}={}){
 const saved=Object.fromEntries(['window','document','HTMLFormElement','fetch','MutationObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const documentListeners=new Map(),windowListeners=new Map(),timers=new Map(),requests=[];let next=0,refreshes=0,effect,cleanup,dialogOpen=false,observeDialog;
 class Form{target='';}
 globalThis.HTMLFormElement=Form;
 globalThis.MutationObserver=class{constructor(callback){observeDialog=callback;}observe(){}disconnect(){}};
 globalThis.window={setTimeout:(callback,delay)=>{timers.set(++next,{callback,delay});return next;},clearTimeout:id=>timers.delete(id),addEventListener:(name,callback)=>windowListeners.set(name,callback),removeEventListener:name=>windowListeners.delete(name)};
 globalThis.document={visibilityState:'visible',body:{},querySelector:()=>dialogOpen?{}:null,addEventListener:(name,callback)=>documentListeners.set(name,callback),removeEventListener:name=>documentListeners.delete(name)};
 globalThis.fetch=async(...args)=>{requests.push(args);return fetcher(...args);};
 const ports={
  react:{useState:()=>[false,()=>{}],useEffect:callback=>{effect=callback;},useLayoutEffect:()=>{}},
  'react/jsx-runtime':{jsx:()=>null},'next/navigation':{useRouter:()=>({refresh:()=>refreshes++})},'@/components/localization':{Text:'Text'}
 };
 const code=ts.transpileModule(readFileSync(new URL('../src/components/support-refresh.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(key=>{assert.ok(key in ports,'Unexpected refresh boundary '+key);return ports[key];},exports);
 exports.SupportRefresh({initialRevision});cleanup=effect();
 return{
  requests,refreshes:()=>refreshes,timers,Form,
  dialog(open){dialogOpen=open;observeDialog();},
  poll(){const [id,timer]=[...timers].find(([,timer])=>timer.delay===5000)||[];assert.ok(timer,'A bounded poll is scheduled');timers.delete(id);return timer.callback();},
  submit(event){documentListeners.get('submit')(event);},
  leave(){windowListeners.get('beforeunload')();},
  visibility(){documentListeners.get('visibilitychange')();},
  restore(){cleanup();for(const[key,descriptor]of Object.entries(saved))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
 };
}
test('the rendered queue revision avoids an unchanged first refresh while a real change still refreshes',async()=>{
 let revision='"rendered"';const h=harness(async()=>({status:200,ok:true,json:async()=>({revision})}));
 try{await h.poll();assert.equal(h.requests[0][1].headers['If-None-Match'],'"rendered"');assert.equal(h.refreshes(),0);
  revision='"changed"';await h.poll();assert.equal(h.refreshes(),1);await h.poll();assert.equal(h.refreshes(),1);
 }finally{h.restore();}
});
test('native form navigation aborts in-flight polling and cannot trigger a late refresh or reschedule',async()=>{
 for(const status of[200,401]){
  let resolve;const h=harness(()=>new Promise(done=>{resolve=done;}));
  try{const polling=h.poll();h.submit({target:new h.Form(),defaultPrevented:false});assert.equal(h.requests[0][1].signal.aborted,true);
   resolve({status,ok:status===200,json:async()=>({revision:'"changed"'})});await polling;h.visibility();assert.equal(h.refreshes(),0);assert.equal(h.requests.length,1);assert.equal(h.timers.size,0);
  }finally{h.restore();}
 }
});
test('managed forms and other-target submissions keep updates, while leaving stops them',async()=>{
 const h=harness(async()=>({status:304,ok:false}));
 try{h.submit({target:new h.Form(),defaultPrevented:true});await h.poll();const other=new h.Form();other.target='_blank';h.submit({target:other,defaultPrevented:false});await h.poll();assert.equal(h.requests.length,2);h.leave();h.visibility();assert.equal(h.timers.size,0);assert.equal(h.requests.length,2);
 }finally{h.restore();}
});

test('a deliberate task aborts queue refresh and resumes without replacing its draft',async()=>{
 let resolve;const h=harness(()=>new Promise(done=>{resolve=done;}));
 try{
  const polling=h.poll();h.dialog(true);assert.equal(h.requests[0][1].signal.aborted,true);
  resolve({status:200,ok:true,json:async()=>({revision:'"changed"'})});await polling;
  assert.equal(h.refreshes(),0);assert.equal(h.timers.size,0);
  h.dialog(false);assert.equal(h.requests.length,2);
  resolve({status:200,ok:true,json:async()=>({revision:'"changed"'})});await new Promise(done=>setImmediate(done));
  assert.equal(h.refreshes(),1);assert.ok(h.timers.size>0);
 }finally{h.restore();}
});
