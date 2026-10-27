import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {capacityRefreshResult} from '../src/map/capacity-refresh.ts';
import {createCapacityCameraIntent,expandCapacityCluster} from '../src/map/capacity-camera-intent.ts';

const rows=Array.from({length:48},(_,index)=>({id:`truck-${index}`,version:1}));
const complete=(key='actor-a:business-a:permission-1:filters-a')=>({key,items:rows,loading:false,error:''});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};

test('same-scope polling keeps a late-page selected truck through every intermediate page, then prunes obsolete rows',()=>{
 let state=complete();const key=state.key,selected='truck-47';
 for(const count of [14,28,42]){
  state=capacityRefreshResult(state,key,{phase:'page',items:rows.slice(0,count).map(row=>({...row,version:2}))});
  assert.equal(state.items.length,48);assert.ok(state.items.some(row=>row.id===selected));
  assert.equal(state.items[0].version,2);assert.equal(state.loading,true);
 }
 state=capacityRefreshResult(state,key,{phase:'complete',items:rows.slice(0,14)});
 assert.equal(state.items.length,14);assert.equal(state.items.some(row=>row.id===selected),false);assert.equal(state.loading,false);
});

test('first load remains progressive and changed actor, audience, permission or filters never borrow the old window',()=>{
 let state=capacityRefreshResult(null,'first',{phase:'page',items:rows.slice(0,14)});assert.equal(state.items.length,14);
 state=capacityRefreshResult(state,'first',{phase:'page',items:rows.slice(0,28)});assert.equal(state.items.length,28);
 for(const key of ['actor-b:business-a:permission-1:filters-a','actor-a:business-b:permission-1:filters-a','actor-a:business-a:permission-2:filters-a','actor-a:business-a:permission-1:filters-b']){
  const next=capacityRefreshResult(complete(),key,{phase:'page',items:rows.slice(0,1)});assert.deepEqual(next.items,rows.slice(0,1));
 }
});

test('private 403 denial clears retained pages while a same-scope transient failure preserves them',()=>{
 const previous=complete(),partial=capacityRefreshResult(previous,previous.key,{phase:'page',items:rows.slice(0,14)});
 const denied=capacityRefreshResult(partial,previous.key,{phase:'denied',error:'403'});assert.deepEqual(denied.items,[]);assert.equal(denied.loading,false);
 const transient=capacityRefreshResult(previous,previous.key,{phase:'failed',error:'offline'});assert.equal(transient.items.length,48);
 assert.deepEqual(capacityRefreshResult(previous,'foreign',{phase:'failed',error:'offline'}).items,[]);
});

for(const reason of ['source','selection','pan','zoom','unmount'])test(`late cluster expansion cannot move the camera after ${reason}`,async()=>{
 const intent=createCapacityCameraIntent(),pending=deferred(),moves=[],errors=[];
 const request=expandCapacityCluster(intent,()=>pending.promise,value=>moves.push(value),()=>errors.push(true));
 if(reason==='pan')intent.gesture();else if(reason==='unmount')intent.close();else intent.invalidate();
 pending.resolve(12);await request;assert.deepEqual(moves,[]);assert.deepEqual(errors,[]);
});

test('a newer cluster activation wins even when its predecessor resolves or rejects later',async()=>{
 const intent=createCapacityCameraIntent(),first=deferred(),second=deferred(),moves=[],errors=[];
 const old=expandCapacityCluster(intent,()=>first.promise,value=>moves.push(value),()=>errors.push('old'));
 const latest=expandCapacityCluster(intent,()=>second.promise,value=>moves.push(value),()=>errors.push('latest'));
 second.resolve(14);await latest;first.reject(Error('old source disappeared'));await old;
 assert.deepEqual(moves,[14]);assert.deepEqual(errors,[]);
});

test('initial automatic centering remains available until a deliberate later gesture or unmount',()=>{
 const untouched=createCapacityCameraIntent();untouched.invalidate();assert.equal(untouched.canCenterInitially(),true);
 untouched.gesture();assert.equal(untouched.canCenterInitially(),false);
 const activated=createCapacityCameraIntent();activated.begin();assert.equal(activated.canCenterInitially(),false);
 const closed=createCapacityCameraIntent();closed.close();assert.equal(closed.canCenterInitially(),false);
});

// Execute the component's real camera observer and completion effect, without
// invoking host touch events. Native map callbacks must protect camera intent too.
function cameraCallbacks(platform){
 const file=readFileSync(new URL('../src/components/CapacityMap.tsx',import.meta.url),'utf8'),source=ts.createSourceFile('CapacityMap.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let observer,initialCenter;
 function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='observeView')observer=node.initializer;
  if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('canCenterInitially()'))initialCenter=node.arguments[0];
  ts.forEachChild(node,visit);
 }
 visit(source);assert.ok(observer&&initialCenter,'exercise the actual map observer and initial completion effect');
 const code=ts.transpileModule(`const observeView=${observer.getText(source)};const centerInitially=${initialCenter.getText(source)};return{observeView,centerInitially};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const intent=createCapacityCameraIntent(),moves=[],fanClears=[],fitted={current:false},ports={Platform:{OS:platform},latestView:{current:{center:[39.5,9],zoom:5,bearing:0,pitch:0}},cameraIntent:{current:intent},camera:{current:{jumpTo:value=>moves.push(value)}},setFan:value=>fanClears.push(value),initialCamera:{longitude:40,latitude:10,zoom:6},ready:true,loading:false,selected:null,fitted};
 return{...new Function(...Object.keys(ports),code)(...Object.values(ports)),intent,moves,fanClears,fitted};
}
for(const platform of ['android','ios']){
 test(`${platform} camera pan suppresses delayed initial fit without depending on parent touch delivery`,()=>{
  const h=cameraCallbacks(platform);h.observeView({center:[39.6,9.1],zoom:6,bearing:0,pitch:0},true);h.centerInitially();
  assert.equal(h.intent.canCenterInitially(),false);assert.deepEqual(h.moves,[]);assert.deepEqual(h.fanClears,[null],'panning removes screen-only spread markers');
 });
 test(`${platform} non-user camera movement still allows exactly one initial completed-data fit`,()=>{
  const h=cameraCallbacks(platform);h.observeView({center:[39.6,9.1],zoom:6,bearing:0,pitch:0},false);h.centerInitially();h.centerInitially();
  assert.deepEqual(h.moves,[{center:[40,10],zoom:6}]);assert.equal(h.fitted.current,true);assert.deepEqual(h.fanClears,[null]);
 });
}
