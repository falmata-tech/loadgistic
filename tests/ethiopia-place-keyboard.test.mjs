import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const places=[
 {id:'builtin:addis ababa',name:'Addis Ababa',display_name:'Addis Ababa, Ethiopia',country_name:'Ethiopia',country_code:'ET',place_type:'city',lat:9.03,lng:38.74},
 {id:'builtin:addis alem',name:'Addis Alem',display_name:'Addis Alem, Ethiopia',country_name:'Ethiopia',country_code:'ET',place_type:'town',lat:9.02,lng:38.39}
];
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

function harness({fetchImpl=async()=>({ok:true,json:async()=>({results:places})}),...overrides}={}){
 let cursor=0,dirty=false,clock=0,nextTimer=0,tree;const slots=[],effects=[],timers=new Map(),changes=[],chosen=[],scrolls=[];
 const changed=(before,after)=>!before||before.length!==after.length||before.some((value,index)=>value!==after[index]);
 const React={
  createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}}),
  useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;
   return [slots[index],next=>{const value=typeof next==='function'?next(slots[index]):next;if(!Object.is(value,slots[index])){slots[index]=value;dirty=true;}}];},
  useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});},
  useEffect:(run,deps)=>{const index=cursor++;if(!slots[index]||changed(slots[index].deps,deps)){const previous=slots[index];slots[index]={deps};effects.push(()=>{previous?.cleanup?.();slots[index].cleanup=run();});}}
 };
 const file=readFileSync('src/components/ethiopia-place-input.tsx','utf8');
 const parsed=ts.createSourceFile('ethiopia-place-input.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 const exports={},ports={React,exports,useTranslation:()=>({t:value=>value}),LoadingIndicator:'LoadingIndicator',MapPin:'MapPin',fetch:fetchImpl,
  window:{setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,due:clock+delay});return id;},clearTimeout:id=>timers.delete(id)}};
 new Function(...Object.keys(ports),code)(...Object.values(ports));
 const props={id:'shipment-origin',name:'origin',placeRefName:'originPlaceRef',onChange:event=>changes.push(event.target.value),onPlaceSelect:place=>chosen.push(place),...overrides};
 const render=()=>{let runs=0;do{dirty=false;cursor=0;tree=exports.EthiopiaPlaceInput(props);
   for(const node of nodes(tree))if(typeof node.props?.ref==='function')node.props.ref({scrollIntoView:options=>scrolls.push({id:node.props.id,...options})});
   while(effects.length)effects.shift()();if(++runs>20)throw Error('PLACE_RENDER_DID_NOT_SETTLE');
  }while(dirty);return tree;};
 const input=()=>nodes(tree).find(node=>node.type==='input'&&node.props.role==='combobox');
 const options=()=>nodes(tree).filter(node=>node.props?.role==='option');
 const hidden=()=>nodes(tree).find(node=>node.type==='input'&&node.props.type==='hidden');
 const api={changes,chosen,scrolls,render,input,options,hidden,submits:0,root:()=>tree,
  type:text=>{input().props.onChange({target:{value:text}});render();},
  key:(key,{composing=false,keyCode=0}={})=>{const event={key,nativeEvent:{isComposing:composing,keyCode},defaultPrevented:false,propagationStopped:false,
   preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;}};
   input().props.onKeyDown(event);if(key==='Enter'&&!event.defaultPrevented&&!composing&&keyCode!==229)api.submits++;render();return event;},
  async advance(ms=220){clock+=ms;for(const [id,timer]of [...timers])if(timer.due<=clock){timers.delete(id);timer.fn();}await settle();render();},
  async settle(){await settle();render();},
  close(){for(const slot of slots)slot?.cleanup?.();}
 };
 render();return api;
}

test('arrow navigation and Enter choose an exact place without submitting the containing form',async()=>{
 const h=harness();h.type('Addis');await h.advance();
 assert.equal(h.options().length,2);assert.equal(h.input().props['aria-activedescendant'],undefined);
 assert.equal(h.key('ArrowDown').defaultPrevented,true);
 assert.equal(h.input().props['aria-activedescendant'],'shipment-origin-option-0');
 assert.equal(h.options()[0].props['aria-selected'],true);assert.equal(h.options()[1].props['aria-selected'],false);
 h.key('ArrowDown');assert.equal(h.input().props['aria-activedescendant'],'shipment-origin-option-1');
 h.key('ArrowUp');assert.equal(h.input().props['aria-activedescendant'],'shipment-origin-option-0');
 assert.ok(h.scrolls.some(row=>row.id==='shipment-origin-option-1'&&row.block==='nearest'));
 assert.equal(h.key('Enter').defaultPrevented,true);assert.equal(h.submits,0);
 assert.equal(h.hidden().props.value,places[0].id);assert.equal(h.input().props.value,places[0].display_name);
 assert.deepEqual(h.chosen,[places[0]]);assert.equal(h.options().length,0);assert.equal(h.input().props['aria-expanded'],false);
 assert.equal(h.key('Enter').defaultPrevented,false);assert.equal(h.submits,1,'ordinary form Enter remains available after choosing');
 assert.equal(h.hidden().props.value,places[0].id);h.close();
});

test('Enter can choose the first visible suggestion, while editing immediately clears old authority and stale options',async()=>{
 const h=harness({defaultValue:'Saved place',defaultPlaceRef:'builtin:saved'});
 h.type('Addis');assert.equal(h.hidden().props.value,'');await h.advance();h.key('Enter');
 assert.equal(h.hidden().props.value,places[0].id);assert.equal(h.submits,0);
 h.type('Other city');assert.equal(h.hidden().props.value,'');assert.equal(h.options().length,0);
 assert.equal(h.key('Enter').defaultPrevented,false);assert.equal(h.chosen.length,1,'old suggestions cannot be chosen for a new query');h.close();
});

test('Up/Down wrap, Escape preserves the draft and a second Escape can reach the enclosing dialog',async()=>{
 const h=harness();h.type('Addis');await h.advance();h.key('ArrowUp');
 assert.equal(h.input().props['aria-activedescendant'],'shipment-origin-option-1');h.key('ArrowDown');
 assert.equal(h.input().props['aria-activedescendant'],'shipment-origin-option-0');
 const escape=h.key('Escape');assert.equal(escape.defaultPrevented,true);assert.equal(escape.propagationStopped,true);
 assert.equal(h.input().props.value,'Addis');assert.equal(h.hidden().props.value,'');assert.equal(h.input().props['aria-expanded'],false);
 assert.equal(h.input().props['aria-activedescendant'],undefined);
 const second=h.key('Escape');assert.equal(second.defaultPrevented,false);assert.equal(second.propagationStopped,false);h.close();
});

test('Escape remains dismissed when an in-flight lookup resolves, and normal focus/click still chooses its exact result',async()=>{
 let resolve;const h=harness({fetchImpl:()=>new Promise(complete=>{resolve=complete;})});
 h.type('Addis');await h.advance();assert.equal(h.options().length,0);assert.equal(h.key('Escape').propagationStopped,true);
 resolve({ok:true,json:async()=>({results:places})});await h.settle();
 assert.equal(h.options().length,0);assert.equal(h.input().props['aria-expanded'],false);
 h.input().props.onFocus();h.render();assert.equal(h.options().length,2);
 let prevented=false;h.options()[1].props.onPointerDown({preventDefault(){prevented=true;}});assert.equal(prevented,true);
 h.options()[1].props.onClick();h.render();assert.equal(h.hidden().props.value,places[1].id);assert.deepEqual(h.chosen,[places[1]]);h.close();
});

test('an aborted older lookup cannot replace the current selectable places',async()=>{
 const pending=[];const h=harness({fetchImpl:(url,options)=>new Promise(resolve=>pending.push({url,signal:options.signal,resolve}))});
 h.type('Old');await h.advance();h.type('Addis');assert.equal(pending[0].signal.aborted,true);await h.advance();
 pending[0].resolve({ok:true,json:async()=>({results:[{...places[0],id:'builtin:old',display_name:'Old city'}]})});await h.settle();
 assert.equal(h.options().length,0);
 pending[1].resolve({ok:true,json:async()=>({results:places})});await h.settle();h.key('ArrowDown');h.key('Enter');
 assert.equal(h.hidden().props.value,places[0].id);assert.equal(h.chosen.length,1);h.close();
});

test('no-result Enter, IME composition and caller key handling retain their existing behavior',async()=>{
 const empty=harness({fetchImpl:async()=>({ok:false,json:async()=>({})})});empty.type('No matching city');await empty.advance();
 assert.equal(empty.key('ArrowDown').defaultPrevented,false);assert.equal(empty.key('Enter').defaultPrevented,false);assert.equal(empty.submits,1);empty.close();
 const ime=harness();ime.type('Addis');await ime.advance();assert.equal(ime.key('Enter',{composing:true}).defaultPrevented,false);
 assert.equal(ime.key('Enter',{keyCode:229}).defaultPrevented,false);
 assert.equal(ime.hidden().props.value,'');assert.equal(ime.chosen.length,0);assert.equal(ime.submits,0);ime.close();
 let calls=0;const guarded=harness({onKeyDown:event=>{calls++;event.preventDefault();}});guarded.type('Addis');await guarded.advance();
 guarded.key('ArrowDown');guarded.key('Enter');assert.equal(calls,2);assert.equal(guarded.chosen.length,0);
 assert.equal(guarded.input().props['aria-activedescendant'],undefined);guarded.close();
});

test('blur closes the list, preserves the selected ref and retains the caller blur event',async()=>{
 const events=[],h=harness({onBlur:event=>events.push(event)});h.type('Addis');await h.advance();h.key('Enter');
 const event={type:'blur',relatedTarget:null,currentTarget:{contains:()=>false}};h.input().props.onBlur(event);h.root().props.onBlur(event);h.render();
 assert.deepEqual(events,[event]);assert.equal(h.hidden().props.value,places[0].id);assert.equal(h.options().length,0);h.close();
});

test('focus moving to an option does not dismiss it before assistive activation',async()=>{
 const h=harness();h.type('Addis');await h.advance();const target={};
 h.root().props.onBlur({relatedTarget:target,currentTarget:{contains:node=>node===target}});h.render();
 assert.equal(h.options().length,2);h.options()[1].props.onClick();h.render();
 assert.equal(h.hidden().props.value,places[1].id);assert.equal(h.options().length,0);h.close();
});

test('Escape reaches the enclosing dialog when an empty, saved or no-match field has no visible popup',async()=>{
 for(const props of [{},{defaultValue:places[0].display_name,defaultPlaceRef:places[0].id}]){
  const h=harness(props);h.input().props.onFocus();h.render();
  assert.equal(h.input().props['aria-expanded'],false);assert.equal(h.options().length,0);
  const event=h.key('Escape');assert.equal(event.defaultPrevented,false);assert.equal(event.propagationStopped,false);
  assert.equal(h.hidden().props.value,props.defaultPlaceRef||'');h.close();
 }
 const empty=harness({fetchImpl:async()=>({ok:true,json:async()=>({results:[]})})});
 empty.type('No matching city');await empty.advance();
 assert.equal(empty.input().props['aria-expanded'],false);assert.equal(empty.options().length,0);
 const event=empty.key('Escape');assert.equal(event.defaultPrevented,false);assert.equal(event.propagationStopped,false);
 assert.equal(empty.input().props.value,'No matching city');assert.equal(empty.hidden().props.value,'');empty.close();
});
