import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the real screen with controlled query results, without auth or map mocks claiming backend evidence.
function shipmentScreen(initial, results=[]){
 const source=readFileSync(new URL('../src/screens/visitor-shipment.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(`${source}\nexport {ShipmentUpdates};`,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const node=(type,props)=>({type,props:props||{}});
 let reloads=0;
 const query={...initial,reload:async()=>{reloads++;assert.ok(results.length,'unexpected reload');Object.assign(query,results.shift());}};
 const dependencies={
  react:{useState:initial=>[initial,()=>{}]},
  'react/jsx-runtime':{jsx:node,jsxs:node},
  'react-native':{ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',Text:'Text',View:'View'},
  'expo-router':{useLocalSearchParams:()=>({id:'synthetic'})},
  '../components/app-link':{AppLink:'AppLink'},
  '../localization/provider':{useLanguage:()=>({t:message=>message})},
  '../components/tracking-workspace':{TrackingWorkspace:'TrackingWorkspace'},
  '../components/tracking-sharing':{TrackingSharing:'TrackingSharing'},
  '../components/private-file':{PrivateFile:'PrivateFile'},
  '../components/visitor-access':{VisitorAccess:'VisitorAccess'},
  '../components/ui':Object.fromEntries(['Title','Copy','Card','Field','Button','ErrorText','palette'].map(name=>[name,name==='palette'?{}:name])),
  '../components/choices':{Choices:'Choices'},
  '../hooks/visitor-query':{useVisitorQuery:()=>query},
  '../session/visitor-provider':{useVisitor:()=>({controller:{request:()=>{throw new Error('unexpected private request');}}})},
  '../api/tracking':{statusLabel:status=>status},
  '../api/runtime-content':{parseVisitorShipment:value=>value}
 };
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in dependencies,`unexpected dependency ${name}`);return dependencies[name];},exports);
 return{render:()=>exports.ShipmentUpdates({id:'synthetic'}),reloads:()=>reloads};
}
function find(tree,predicate){
 if(Array.isArray(tree)){for(const child of tree){const result=find(child,predicate);if(result)return result;}return null;}
 if(!tree||typeof tree!=='object')return null;
 if(predicate(tree))return tree;
 return find(tree.props?.children,predicate);
}
const retry=tree=>find(tree,item=>item.type==='Button'&&item.props.message==='Refresh updates');
const shipment={code:'Synthetic',status:'CREATED',cargo:'Private synthetic cargo',route:[],location:null,publicTruck:null,events:[{id:'event',status:'CREATED',createdAt:'2026-10-13T00:00:00Z',hasProof:true}],canApprove:false,canReview:false,review:null};
const loaded={data:shipment,error:'',loading:false};

test('an initial shipment failure exposes its error and a retry that restores the workspace',()=>{
 const message='Could not load. Please try again.';
 const screen=shipmentScreen({data:null,error:message,loading:false},[loaded]);
 const tree=screen.render();
 assert.equal(find(tree,item=>item.type==='ErrorText').props.message,message);
 assert.equal(find(tree,item=>item.type==='TrackingWorkspace'),null);
 assert.equal(find(tree,item=>item.type==='PrivateFile'),null);
 assert.ok(retry(tree),'initial failure must retain an accessible retry');
 retry(tree).props.onPress();
 assert.equal(screen.reloads(),1);
 assert.ok(find(screen.render(),item=>item.type==='TrackingWorkspace'));
 assert.equal(find(screen.render(),item=>item.type==='ErrorText').props.message,'');
});

test('a malformed refresh clears private content and retains a retry for a valid response',()=>{
 const message='Shipment updates could not be loaded. Please try again.';
 const screen=shipmentScreen(loaded,[{data:null,error:message,loading:false},loaded]);
 assert.ok(find(screen.render(),item=>item.type==='PrivateFile'));
 retry(screen.render()).props.onPress();
 const failed=screen.render();
 assert.equal(find(failed,item=>item.type==='ErrorText').props.message,message);
 assert.equal(find(failed,item=>item.type==='TrackingWorkspace'),null);
 assert.equal(find(failed,item=>item.type==='PrivateFile'),null);
 assert.ok(retry(failed),'failed refresh must retain an accessible retry');
 retry(failed).props.onPress();
 assert.equal(screen.reloads(),2);
 assert.ok(find(screen.render(),item=>item.type==='TrackingWorkspace'));
});

test('an initial in-flight request shows loading without exposing private content',()=>{
 const screen=shipmentScreen({data:null,error:'',loading:true});
 const tree=screen.render();
 assert.ok(find(tree,item=>item.type==='ActivityIndicator'));
 assert.equal(find(tree,item=>item.type==='TrackingWorkspace'),null);
 assert.equal(find(tree,item=>item.type==='PrivateFile'),null);
 assert.equal(retry(tree),null);
});
