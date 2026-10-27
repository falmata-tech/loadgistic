import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {publicFleetRowKey} from '../src/lib/public-fleet-row.js';
import {localizedUpdateLabel} from '../src/lib/i18n/update-label.js';

const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const all=(tree,type)=>nodes(tree).filter(node=>node.type===type);
const text=tree=>tree==null||typeof tree==='boolean'?'':typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(' '):tree.type==='Text'?tree.props.message:text(tree.props?.children);

function showcase(){
 const states=[],refs=[];let stateIndex=0,refIndex=0;const focused=[],scrolled=[];
 const react={useState(initial){const index=stateIndex++;if(!(index in states))states[index]=initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];},useRef(initial){const index=refIndex++;return refs[index]||(refs[index]={current:initial});}};
 const node=(type,props,key)=>({type,props:props||{},key});
 const imports={
  react:{__esModule:true,default:react},'react/jsx-runtime':{jsx:node,jsxs:node},'next/image':{__esModule:true,default:'Image'},
  'lucide-react':new Proxy({},{get:(_target,key)=>key}),
  '@/components/localization':{Text:'Text',useTranslation:()=>({t:(message,values={})=>message.replace(/\{(\w+)\}/g,(token,key)=>String(values[key]??token))})},'@/lib/vehicle-configurations':{vehicleConfigurationImage:()=>'/truck.svg'},
  '@/components/public-capacity-map':{PublicCapacityMap:'PublicCapacityMap'},'@/components/verification-badges':{VerificationBadges:'VerificationBadges'},
  '@/lib/public-fleet-row.js':{publicFleetRowKey},'@/lib/i18n/update-label.js':{localizedUpdateLabel},'./public-identity-image':{PublicIdentityImage:'PublicIdentityImage'},'./truck-authority':{TruckAuthorityBadges:'TruckAuthorityBadges'},'./public-identity-image.module.css':{__esModule:true,default:{fleetRow:'fleet-row'}}
 };
 const source=readFileSync(new URL('../src/components/provider-fleet-showcase.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in imports,'Unexpected import '+name);return imports[name];},exports);
 const runtime={matchMedia:()=>({matches:true}),setTimeout:callback=>{callback();return 1;},requestAnimationFrame:callback=>{callback();return 1;}};
 const render=props=>{stateIndex=refIndex=0;const tree=exports.ProviderFleetShowcase(props);all(tree,'article').forEach((article,index)=>{for(const button of all(article,'button'))button.props.ref?.({focus:()=>focused.push(index)});});return tree;};
 return {render,focused,scrolled,runtime,document:{getElementById:id=>({scrollIntoView:()=>scrolled.push(id)})}};
}
const capacity=id=>({id,status:'EMPTY',availability_geometry:'ROUTE',current_route_points:[{label:'Origin'},{label:'Destination'}]});
const trucks=[{platform_number:null,make:'Make A',model:'Model A',capacity:capacity('capacity-a')},{platform_number:null,make:null,model:null,capacity:capacity('capacity-b')},{platform_number:'LG-003',make:'Make C',model:'Model C',capacity:capacity('capacity-c')}];
const props={providerName:'Example transporter',trucks,total:15,startIndex:12};

test('legacy null-number fleet rows start closed with independent keys and map controls',()=>{
 const view=showcase(),tree=view.render(props),cards=all(tree,'article');
 assert.equal(cards.length,3);assert.equal(new Set(cards.map(card=>card.key)).size,3);
 assert.equal(all(tree,'TruckAuthorityBadges').length,0,'Vehicle review appears in one document group per card');
 for(const card of cards)assert.deepEqual(all(card,'VerificationBadges').map(badge=>badge.props.label),['Vehicle documents','Driver documents']);
 assert.equal(all(tree,'PublicCapacityMap').length,0);
 const buttons=cards.map(card=>all(card,'button').find(button=>button.props['aria-controls']));
 assert.equal(new Set(buttons.map(button=>button.props['aria-controls'])).size,3);
 for(const button of buttons)assert.equal(button.props['aria-expanded'],false);
 assert.ok(!text(tree).includes('row:'));assert.ok(!text(tree).includes('number:'));
});

test('each null-number map opens alone, keeps its capacity scope and restores its own trigger focus',()=>{
 const view=showcase();const oldWindow=globalThis.window,oldDocument=globalThis.document;
 globalThis.window=view.runtime;globalThis.document=view.document;
 try{
  let tree=view.render(props),cards=all(tree,'article');
  all(cards[0],'button').find(button=>button.props['aria-controls']).props.onClick();tree=view.render(props);
  assert.equal(all(tree,'PublicCapacityMap').length,1);assert.deepEqual(all(tree,'PublicCapacityMap')[0].props.items,[trucks[0].capacity]);
  assert.equal(all(tree,'PublicCapacityMap')[0].props.selectedId,'capacity-a');
  let panel=all(tree,'section').find(section=>section.props.className==='provider-truck-map-panel');
  assert.equal(panel.props['aria-label'],'Capacity map for Make A Model A');assert.ok(!text(panel).includes('null'));assert.ok(!text(panel).includes('row:'));
  cards=all(tree,'article');all(cards[1],'button').find(button=>button.props['aria-controls']).props.onClick();tree=view.render(props);
  assert.equal(all(tree,'PublicCapacityMap').length,1);assert.equal(all(tree,'PublicCapacityMap')[0].props.selectedId,'capacity-b');
  panel=all(tree,'section').find(section=>section.props.className==='provider-truck-map-panel');assert.equal(panel.props['aria-label'],'Capacity map for Vehicle 14');
  assert.equal(new Set(view.scrolled).size,2);
  all(panel,'button').find(button=>text(button).trim()==='Close map').props.onClick();tree=view.render(props);
  assert.equal(all(tree,'PublicCapacityMap').length,0);assert.deepEqual(view.focused,[1]);
  cards=all(tree,'article');all(cards[2],'button').find(button=>button.props['aria-controls']).props.onClick();tree=view.render(props);
  panel=all(tree,'section').find(section=>section.props.className==='provider-truck-map-panel');assert.equal(panel.props['aria-label'],'Capacity map for LG-003');
 }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});

function withLocation(view,geolocation,work){
 const previous=Object.fromEntries(['window','document','navigator'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 Object.defineProperty(globalThis,'window',{configurable:true,writable:true,value:view.runtime});
 Object.defineProperty(globalThis,'document',{configurable:true,writable:true,value:view.document});
 Object.defineProperty(globalThis,'navigator',{configurable:true,writable:true,value:{geolocation}});
 try{return work();}finally{for(const [key,descriptor]of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
}
function openFirst(view){
 let tree=view.render(props);all(all(tree,'article')[0],'button').find(button=>button.props['aria-controls']).props.onClick();return view.render(props);
}
test('provider truck maps accept finite worldwide positions without changing truck scope or close focus',()=>{
 for(const point of [{lat:41.8781,lng:-87.6298},{lat:24.4539,lng:54.3773},{lat:-33.9249,lng:18.4241},{lat:90,lng:180},{lat:-90,lng:-180}]){
  const view=showcase();let requests=0;
  withLocation(view,{getCurrentPosition(success,_failure,options){requests++;assert.deepEqual(options,{enableHighAccuracy:false,timeout:10_000,maximumAge:120_000});success({coords:{latitude:point.lat,longitude:point.lng}});}},()=>{
   let tree=openFirst(view);const map=all(tree,'PublicCapacityMap')[0];assert.deepEqual(map.props.viewer,point);assert.deepEqual(map.props.items,[trucks[0].capacity]);assert.equal(map.props.selectedId,'capacity-a');assert.equal(requests,1);assert.ok(text(tree).includes('Your location is shown'));
   const panel=all(tree,'section').find(section=>section.props.className==='provider-truck-map-panel');all(panel,'button').find(button=>text(button).trim()==='Close map').props.onClick();tree=view.render(props);assert.equal(all(tree,'PublicCapacityMap').length,0);assert.deepEqual(view.focused,[0]);
  });
 }
});
test('invalid GPS coordinates never reach the map and keep a usable retry',()=>{
 for(const point of [{lat:NaN,lng:38},{lat:9,lng:Infinity},{lat:90.001,lng:0},{lat:0,lng:-180.001},{lat:'9',lng:38}]){
  const view=showcase();let requests=0;
  withLocation(view,{getCurrentPosition(success){requests++;success({coords:{latitude:requests===1?point.lat:41.8,longitude:requests===1?point.lng:-87.6}});}},()=>{
   let tree=openFirst(view);assert.equal(all(tree,'PublicCapacityMap')[0].props.viewer,null);assert.ok(text(tree).includes('Your location could not be determined. Try again.'));
   const panel=all(tree,'section').find(section=>section.props.className==='provider-truck-map-panel');all(panel,'button').find(button=>text(button).trim()==='Use my location').props.onClick();tree=view.render(props);assert.deepEqual(all(tree,'PublicCapacityMap')[0].props.viewer,{lat:41.8,lng:-87.6});assert.equal(requests,2);
  });
 }
});
test('permission denial and unavailable geolocation clear an earlier marker while preserving the selected truck',()=>{
 for(const failure of ['denied','unavailable']){
  const view=showcase();let requests=0;
  withLocation(view,{getCurrentPosition(success,denied){requests++;if(requests===1)success({coords:{latitude:41.8,longitude:-87.6}});else denied({code:1,PERMISSION_DENIED:1});}},()=>{
   let tree=openFirst(view);assert.deepEqual(all(tree,'PublicCapacityMap')[0].props.viewer,{lat:41.8,lng:-87.6});
   if(failure==='unavailable')globalThis.navigator.geolocation=null;
   const panel=all(tree,'section').find(section=>section.props.className==='provider-truck-map-panel');all(panel,'button').find(button=>text(button).trim()==='Refresh my location').props.onClick();tree=view.render(props);
   const map=all(tree,'PublicCapacityMap')[0];assert.equal(map.props.viewer,null);assert.equal(map.props.selectedId,'capacity-a');assert.deepEqual(map.props.items,[trucks[0].capacity]);assert.ok(text(tree).includes(failure==='denied'?'Location permission declined':'Your location is not shown'));
  });
 }
});


test('profile facts distinguish planned routes and areas from preferred coverage',()=>{
 for(const geometry of ['ROUTE','RADIUS']){
  const view=showcase(),planned={...capacity('planned'),availability_geometry:geometry,capacity_area_center_label:'Planned center',capacity_area_boundary:[{label:'Planned edge'}],recurring_corridors:[{geometry,route_points:[{label:'Preferred origin'},{label:'Preferred destination'}],area_center_label:'Preferred center',area_boundary:[{label:'Preferred edge'}]}]},original=structuredClone(planned);
  const tree=view.render({providerName:'Synthetic provider',trucks:[{platform_number:'LG-PLANNED',capacity:planned}],total:1,startIndex:0}),card=all(tree,'article')[0];
  const plannedFact=all(card,'section').find(node=>node.props.className.startsWith('provider-truck-current'));
  assert.ok(text(plannedFact).includes(geometry==='ROUTE'?'Planned route':'Planned area'));assert.ok(text(card).includes(geometry==='ROUTE'?'Preferred corridor':'Preferred area'));assert.ok(text(card).includes('Planned capacity update'));
  assert.equal(all(card,'Text').some(node=>['Capacity route','Preferred service area'].includes(node.props.message)),false);
  assert.deepEqual(planned,original);
 }
 const empty=showcase().render({providerName:'Synthetic provider',trucks:[{platform_number:'LG-NO-PLAN',capacity:null}],total:1,startIndex:0});assert.ok(text(empty).includes('No planned capacity published'));assert.equal(all(empty,'PublicCapacityMap').length,0);
});
