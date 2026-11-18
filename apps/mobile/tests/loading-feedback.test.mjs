import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const React={createElement:(type,props,...children)=>({type,props:{...props,children}})};
function compile(file,host){
 const parsed=ts.createSourceFile(file,readFileSync(new URL(file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const stripped=ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node)));
 const code=ts.transpileModule(ts.createPrinter().printFile(stripped),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};
 new Function(...Object.keys(host),'exports',code)(...Object.values(host),exports);return exports;
}
function runtime(){
 let state=[],cursor=0,effectCursor=0,effects=[],queued=[],changed,resolve,reject,starts=0,stops=0,removed=false;
 const preference=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const hooks={
  useState(initial){const id=cursor++;if(!(id in state))state[id]=typeof initial==='function'?initial():initial;return[state[id],value=>{state[id]=value;}];},
  useEffect(callback,deps){const id=effectCursor++,old=effects[id];if(!old||deps.some((value,index)=>value!==old.deps[index]))queued.push(()=>{old?.cleanup?.();effects[id]={deps,cleanup:callback()};});}
 };
 const Animated={Value:class{value=0;constructor(value){this.value=value;}setValue(value){this.value=value;}interpolate(config){return{value:this.value,config};}},View:'AnimatedView',
  timing:(_value,config)=>config,sequence:value=>value,loop:()=>({start(){starts++;},stop(){stops++;}})};
 const {LoadingBar}=compile('../src/components/loading-bar.tsx',{React,...hooks,Animated,View:'View',palette:{blue:'#155eef',blueSoft:'#eaf1ff'},useLanguage:()=>({t:value=>`translated:${value}`}),
  AccessibilityInfo:{addEventListener(event,callback){assert.equal(event,'reduceMotionChanged');changed=callback;return{remove(){removed=true;}};},isReduceMotionEnabled:()=>preference}});
 return {render(){cursor=0;effectCursor=0;const tree=LoadingBar({label:'Loading vehicle availability'});queued.splice(0).forEach(run=>run());return tree;},
  resolve,reject,change:value=>changed(value),unmount(){effects.forEach(effect=>effect.cleanup?.());},
  facts:()=>({starts,stops,removed,value:state[0].value})};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('native loading starts static, follows reduced motion and releases animation/listener on unmount',async()=>{
 const view=runtime(),tree=view.render();
 assert.deepEqual(tree.props.accessibilityState,{busy:true});assert.equal(tree.props.accessibilityLabel,'translated:Loading vehicle availability');
 assert.equal(tree.props.accessibilityRole,'progressbar');assert.equal(tree.props.accessibilityValue,undefined);
 assert.equal(view.facts().starts,0);assert.equal(view.facts().value,.5);
 view.resolve(false);await flush();view.render();assert.equal(view.facts().starts,1);
 view.change(true);view.render();assert.equal(view.facts().stops,1);assert.equal(view.facts().value,.5);
 view.change(false);view.render();assert.equal(view.facts().starts,2);
 view.unmount();assert.equal(view.facts().stops,2);assert.equal(view.facts().removed,true);
});

test('a preference event wins over an older read and unavailable preference stays static',async()=>{
 const stale=runtime();stale.render();stale.change(true);stale.resolve(false);await flush();stale.render();assert.equal(stale.facts().starts,0);stale.unmount();
 const failed=runtime();failed.render();failed.reject(Error('unavailable'));await flush();failed.render();assert.equal(failed.facts().starts,0);failed.unmount();
});

test('shared native spinner has a translated default label while retaining explicit labels and size/color',()=>{
 const {LoadingSpinner}=compile('../src/components/ui.tsx',{React,ActivityIndicator:'ActivityIndicator',StyleSheet:{create:value=>value},useLanguage:()=>({t:value=>`translated:${value}`})});
 assert.equal(LoadingSpinner({}).props.accessibilityLabel,'translated:Loading…');
 const explicit=LoadingSpinner({accessibilityLabel:'Loading shipments',size:'large',color:'#fff'});
 assert.equal(explicit.props.accessibilityLabel,'translated:Loading shipments');assert.equal(explicit.props.size,'large');assert.equal(explicit.props.color,'#fff');
});
