import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {ApiError} from '../src/api/response.ts';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function runtime(){
 let state=[],cursor=0,focus,cleanup,account={session:{user:{id:'one'}},request:async()=>({trucks:['one']})};
 const hooks={ApiError,useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useRef:initial=>{const i=cursor++;return state[i]||(state[i]={current:initial});},useCallback:callback=>callback,useFocusEffect:callback=>{focus=callback;},useAccount:()=>account};
 const parsed=ts.createSourceFile('account-query.ts',readFileSync(new URL('../src/hooks/account-query.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,exports={};
 new Function(...Object.keys(hooks),'exports',code)(...Object.values(hooks),exports);
 return {render(path='/api/mobile/fleet'){cursor=0;return exports.useAccountQuery(path);},focus(){cleanup?.();cleanup=focus();},blur(){cleanup?.();cleanup=null;},setAccount(value){account=value;}};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test('refocusing a loaded query keeps content and reports refresh separately from initial loading',async()=>{
 const view=runtime();let query=view.render();assert.equal(query.loading,true);view.focus();await flush();query=view.render();assert.deepEqual(query.data,{trucks:['one']});assert.equal(query.loading,false);
 const pending=deferred();view.setAccount({session:{user:{id:'one'}},request:()=>pending.promise});view.render();view.focus();query=view.render();assert.deepEqual(query.data,{trucks:['one']});assert.equal(query.loading,false);assert.equal(query.refreshing,true);
 pending.resolve({trucks:['updated']});await flush();query=view.render();assert.deepEqual(query.data,{trucks:['updated']});assert.equal(query.refreshing,false);
});
test('failed quiet refresh for a different identity cannot relabel the previous private response',async()=>{
 const view=runtime();view.render();view.focus();await flush();view.setAccount({session:{user:{id:'two'}},request:async()=>{throw Error('denied');}});let query=view.render();assert.equal(query.data,null);await query.refresh();query=view.render();assert.equal(query.data,null);assert.equal(query.error,'denied');
});
test('blurred and superseded queries never commit their late response',async()=>{
 const old=deferred(),latest=deferred(),view=runtime();view.setAccount({session:{user:{id:'one'}},request:()=>old.promise});view.render();view.focus();view.blur();view.setAccount({session:{user:{id:'two'}},request:()=>latest.promise});view.render('/api/mobile/capacity');view.focus();old.resolve({private:'old'});await flush();assert.equal(view.render('/api/mobile/capacity').data,null);latest.resolve({trucks:['two']});await flush();assert.deepEqual(view.render('/api/mobile/capacity').data,{trucks:['two']});
});

test('authoritative resource denial clears cached private data while a temporary outage preserves it',async()=>{
 for(const status of[401,403,404,503]){
  const view=runtime();view.render();view.focus();await flush();view.setAccount({session:{user:{id:'one'}},request:async()=>{throw new ApiError(status,'FORBIDDEN','Not available');}});let query=view.render();const confirmed=await query.reloadConfirmed();query=view.render();assert.equal(confirmed,false);assert.equal(query.data===null,status!==503);assert.equal(query.error,'Not available');
 }
});
