import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {TRACKING_JOURNEY,trackingNextStatuses,trackingProgress} from '../../../src/lib/tracking-progress.js';

// Exercise the screen's navigation/event contract without a map SDK or backend.
function workspace(status='CREATED',presentation){
 const source=readFileSync(new URL('../src/components/tracking-workspace.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const states=[];let cursor=0,blur=()=>{},background=()=>{};
 const node=(type,props)=>({type,props:props||{}});
 const react={useState:initial=>{const index=cursor++;if(!(index in states))states[index]=initial;return[states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next;}];},useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:fn=>{fn();}};
 const native={AppState:{addEventListener:(_event,fn)=>{background=fn;return{remove(){}};}},StyleSheet:{create:value=>value,absoluteFill:{}},Image:'Image',Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',View:'View'};
 const dependencies={react,'react/jsx-runtime':{jsx:node,jsxs:node},'react-native':native,'expo-router':{Link:'Link',useFocusEffect:fn=>{blur=fn();}},'../localization/provider':{useLanguage:()=>({t:text=>text})},'./tracking-map':{TrackingMap:'TrackingMap'},'./truck-authority':{TruckAuthorityBadges:'TruckAuthorityBadges'},'./app-icon':{AppIcon:'AppIcon'},'../api/tracking':{statusLabel:value=>value},'../../../../src/lib/tracking-progress.js':{TRACKING_JOURNEY,trackingNextStatuses,trackingProgress},'../../../../src/lib/vehicle-configurations':{vehicleConfigurationImage:()=>'/truck.svg'},'../api/http':{apiOrigin:'http://127.0.0.1'},'../session/chat-visibility':{blockChatReading(){}}};
 dependencies['./ui']={palette:{blue:'#155eef',border:'#d7dfeb',borderSoft:'#e5eaf1',canvas:'#f3f5f7',ink:'#0b1d3a',muted:'#526375'}};
 dependencies['../../../../src/lib/demo-tracking-identity.js']={isDemoTrackingShipment:()=>false};
 dependencies['./tracking-demo-label']={TrackingDemoLabel:'TrackingDemoLabel'};
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in dependencies,`unexpected dependency ${name}`);return dependencies[name];},exports);
 const props={code:'Synthetic',status,route:[],location:null,truck:{platformNumber:'LG-1',make:'Truck',model:'Test',configuration:'Pickup truck',providerName:'Synthetic provider',providerHandle:'synthetic',driverName:'First',driverPhone:'',contactPhone:''},presentation,children:node('Card',{children:node('Title',{message:'Tracking update'})})};
 return{render(){cursor=0;return exports.TrackingWorkspace(props);},blur(){blur();},background(){background('background');}};
}
function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;const children=tree.props?.children;for(const child of Array.isArray(children)?children:[children]){const result=find(child,predicate);if(result)return result;}return null;}
const button=(tree,label)=>find(tree,item=>item.type==='Pressable'&&item.props.accessibilityLabel===label);
const modal=tree=>find(tree,item=>item.type==='Modal');
test('truck profile navigation dismisses its overlay before leaving Tracking',()=>{
 const view=workspace();button(view.render(),'Vehicle details').props.onPress();
 let tree=view.render();assert.equal(modal(tree).props.visible,true);
 const profile=find(tree,item=>item.type==='Link'&&item.props.href?.pathname==='/transporter');assert.ok(profile);
 profile.props.onPress();assert.equal(modal(view.render()).props.visible,false);
});
test('route blur and background close Tracking overlays before another screen is visible',()=>{
 const view=workspace();
 for(const leave of [()=>view.blur(),()=>view.background()]){
  let tree=view.render();button(tree,'Vehicle details').props.onPress();button(tree,'Open shipment progress').props.onPress();
  tree=view.render();assert.equal(modal(tree).props.visible,true);assert.ok(button(tree,'Close shipment progress'));
  leave();tree=view.render();assert.equal(modal(tree).props.visible,false);assert.ok(button(tree,'Open shipment progress'));
 }
});
test('Problem does not claim that one of several allowed resume states is mandatory next',()=>{
 const tree=workspace('ISSUE').render();
 const next=find(tree,item=>item.type==='Text'&&Array.isArray(item.props.children)&&item.props.children[0]==='Next');
 assert.ok(next);assert.equal(next.props.children.join(''),'Next · Choose an available step.');
});
test('provider detail keeps one current/next strip and its update below the map instead of a scrolling map overlay',()=>{
 const tree=workspace('LOADING','provider').render();
 assert.equal(button(tree,'Open shipment progress'),null);
 const scroll=find(tree,item=>item.type==='ScrollView'&&find(item,child=>child.type==='TrackingMap'));
 assert.ok(scroll);
 const items=scroll.props.children;
 const flattened=Array.isArray(items)?items:[items];
 const mapIndex=flattened.findIndex(item=>item?.type==='TrackingMap');
 const updateIndex=flattened.findIndex(item=>find(item,child=>child.type==='Title'&&child.props.message==='Tracking update'));
 assert.ok(mapIndex>=0&&updateIndex>mapIndex);
 assert.equal(flattened.filter(item=>find(item,child=>child.type==='Text'&&Array.isArray(child.props.children)&&child.props.children[0]==='Current')).length,1);
});
