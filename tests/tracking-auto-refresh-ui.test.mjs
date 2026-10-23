import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as policy from '../src/lib/tracking-refresh-policy.js';

function component(){
 const source=readFileSync(new URL('../src/components/tracking-auto-refresh.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 let effect,refreshed=0;
 const react={useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect:callback=>{effect=callback;}};
 const node=(type,props)=>({type,props:props||{}}),exports={};
 const dependencies={react:{__esModule:true,default:react},'react/jsx-runtime':{jsx:node,jsxs:node},'next/navigation':{useRouter:()=>({refresh:()=>{refreshed++;}})},'lucide-react':{RefreshCw:'RefreshCw'},'./localization':{Text:'Text'},'@/lib/tracking-refresh-policy.js':policy};
 new Function('require','exports',compiled)(name=>{assert.ok(name in dependencies,`unexpected dependency ${name}`);return dependencies[name];},exports);
 return {render:props=>exports.TrackingAutoRefresh(props),mount:()=>effect(),refreshed:()=>refreshed};
}

test('web Tracking poll waits 60 seconds, does not overlap, and locks on denied access',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 let next=1,calls=0,resolveFetch;const timers=new Map(),events=[];
 globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
 globalThis.window={dispatchEvent:event=>events.push(event.type)};
 globalThis.setTimeout=(callback,delay)=>{const id=next++;timers.set(id,{callback,delay});return id;};
 globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.fetch=()=>{calls++;return new Promise(resolve=>{resolveFetch=resolve;});};
 try{
  const ui=component(),button=ui.render({shipmentId:'synthetic',revision:'old',active:true,expiresAt:Date.now()+300000});
  const cleanup=ui.mount();
  assert.equal([...timers.values()][0].delay,60000);
  button.props.onClick();button.props.onClick();
  assert.equal(calls,1,'manual refresh and pending poll share one request');
  resolveFetch({status:200,ok:true,json:async()=>({revision:'new',active:true})});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.refreshed(),1);
  const nextTimer=[...timers.values()].at(-1);assert.equal(nextTimer.delay,60000);
  nextTimer.callback();
  resolveFetch({status:401,ok:false});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(events,['tracking-access-lost']);
  cleanup();
 }finally{Object.assign(globalThis,originals);}
});
