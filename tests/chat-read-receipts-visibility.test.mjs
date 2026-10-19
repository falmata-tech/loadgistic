import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {chatReadState,mergeChatReadState} from '../src/lib/chat-read-policy.js';

// Exercise the actual component with a controlled browser/HTTP boundary. The
// dialog changes occlusion only: no intersection, focus or mutation is emitted.
function receiptSurface(){
 const states=[],refs=[],callbacks=[],effectSlots=[],pending=[];let si=0,ri=0,ci=0,ei=0,dirty=false,tree;
 let now=0,nextTimer=0,covered=true,focused=true,nextStatus=304,getCount=0;const timers=new Map(),writes=[];
 const same=(a,b)=>a&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const react={createContext:()=>({Provider:'Provider'}),useState(value){const i=si++;if(!(i in states))states[i]=value;return[states[i],next=>{const value=typeof next==='function'?next(states[i]):next;if(!Object.is(states[i],value)){states[i]=value;dirty=true;}}];},useRef(value){const i=ri++;return refs[i]||(refs[i]={current:value});},useCallback(fn,deps){const i=ci++;if(!same(callbacks[i]?.deps,deps))callbacks[i]={fn,deps};return callbacks[i].fn;},useEffect(fn,deps){const i=ei++,previous=effectSlots[i];if(!same(previous?.deps,deps)){effectSlots[i]={deps,cleanup:previous?.cleanup};pending.push({i,fn});}}};
 const bounds={left:0,top:0,right:1000,bottom:800},root={dataset:{},style:{},parentElement:null,getBoundingClientRect:()=>bounds,querySelectorAll:()=>[message]};
 const message={dataset:{chatSequence:'2'},isConnected:true,parentElement:root,getBoundingClientRect:()=>({left:20,top:100,right:300,bottom:180}),contains:target=>target===message,hasAttribute:()=>false};
 const doc=new EventTarget();doc.visibilityState='visible';doc.hasFocus=()=>focused;doc.elementFromPoint=()=>covered?{}:message;
 const window=new EventTarget(),initial={customerSeen:0,teamSeen:0,ownSeen:0,latestSequence:2,ownSide:'CUSTOMER',unreadCount:1,teamJoined:false,joinedAt:null,assignmentVersion:3};
 const replacements={window,document:doc,innerWidth:1000,innerHeight:800,getComputedStyle:()=>({overflow:'visible',overflowX:'visible',overflowY:'visible'}),setTimeout(fn,delay=0){const id=++nextTimer;timers.set(id,{at:now+delay,fn});return id;},clearTimeout(id){timers.delete(id);},IntersectionObserver:class{constructor(callback){this.callback=callback;}observe(target){this.callback([{target,isIntersecting:true}]);}disconnect(){}},MutationObserver:class{observe(){}disconnect(){}},async fetch(url,options={}){assert.equal(url,'/api/support/conversations/synthetic/read');if(options.method==='POST'){const input=JSON.parse(options.body);writes.push(input);return{ok:true,status:200,json:async()=>({...initial,ownSeen:2,customerSeen:2,unreadCount:0})};}getCount++;const status=getCount===1?200:nextStatus;return{ok:status<400,status,headers:{get:()=> '"same-read-state"'},json:async()=>initial};}};
 const originals=new Map(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(replacements))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 const element=(type,props)=>({type,props:props||{}}),ports={react:{__esModule:true,default:react,...react},'react/jsx-runtime':{jsx:element,jsxs:element},'lucide-react':{Check:'Check',CheckCheck:'CheckCheck'},'./localization':{Text:'Text'},'@/lib/chat-read-policy.js':{chatReadState,mergeChatReadState}};
 const code=ts.transpileModule(readFileSync(new URL('../src/components/chat-read-receipts.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(key=>{assert.ok(key in ports,'Unexpected component dependency');return ports[key];},exports);
 function render(){si=ri=ci=ei=0;dirty=false;tree=exports.ChatReadReceipts({endpoint:'/api/support/conversations/synthetic/read',chatKey:'SUPPORT:synthetic',children:null});tree.props.children.props.ref.current=root;while(pending.length){const {i,fn}=pending.shift();effectSlots[i].cleanup?.();effectSlots[i].cleanup=fn();}}
 async function settle(){for(let i=0;i<12;i++){await Promise.resolve();if(dirty)render();}}
 async function advance(ms){const until=now+ms;for(;;){const due=[...timers].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);await due[1].fn();await settle();}now=until;await settle();}
 render();
 return{settle,advance,writes,getCount:()=>getCount,uncover:()=>{covered=false;},unfocus:()=>{focused=false;},hide:()=>{doc.visibilityState='hidden';},deny:()=>{nextStatus=403;},dispose(){for(const slot of effectSlots)slot.cleanup?.();timers.clear();for(const [key,descriptor] of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
}

test('authorized304 rechecks occlusion after a dialog closes without a new browser event',async()=>{
 const surface=receiptSurface();
 try{
  await surface.settle();await surface.advance(5250);assert.equal(surface.writes.length,0,'A covered reply must stay unread');
  surface.uncover();await surface.advance(5250);
  assert.deepEqual(surface.writes,[{throughSequence:2,assignmentVersion:3}]);assert.equal(surface.getCount(),3,'Reuse bounded polls without adding requests');
 }finally{surface.dispose();}
});

test('an authorized304 still cannot acknowledge an unfocused visible reply',async()=>{
 const surface=receiptSurface();
 try{await surface.settle();surface.uncover();surface.unfocus();await surface.advance(5250);assert.deepEqual(surface.writes,[]);}finally{surface.dispose();}
});

test('a hidden page cannot acknowledge when its covering dialog closes',async()=>{
 const surface=receiptSurface();
 try{await surface.settle();surface.uncover();surface.hide();await surface.advance(5250);assert.deepEqual(surface.writes,[]);}finally{surface.dispose();}
});

test('a403 never wakes acknowledgement after the covering dialog closes',async()=>{
 const surface=receiptSurface();
 try{await surface.settle();surface.uncover();surface.deny();await surface.advance(5250);assert.deepEqual(surface.writes,[]);}finally{surface.dispose();}
});
