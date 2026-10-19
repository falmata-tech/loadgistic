import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {focusedMarkers} from '../src/map/focused-markers.ts';
import {markerLocation,signalBounds,signalPaths} from '../src/map/capacity-geometry.ts';
import {capacityMapData,capacityStatuses,capacityColors,capacitySourceIds,capacityLayerIds,renderedCapacityPoints,capacityMarkerOffsets} from '../src/map/capacity-clusters.ts';
import {locationSourceKind,locationSourceLabel,locationSourceColor} from '../../../src/lib/location-source.js';

// Execute the real component/handlers with its native host and hooks substituted.
// This proves the exit never enters MapLibre's first-match marker hit registry;
// actual Android touch dispatch remains a separate installed-device acceptance.
const source=ts.createSourceFile('CapacityMap.tsx',readFileSync(new URL('../src/components/CapacityMap.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const stripped=ts.factory.updateSourceFile(source,source.statements.filter(node=>!ts.isImportDeclaration(node)));
const compiled=ts.transpileModule(ts.createPrinter().printFile(stripped),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
const flatten=values=>values.flat(Infinity).filter(value=>value&&typeof value==='object');
function nodes(root,ancestors=[]){
 return [{node:root,ancestors},...flatten(root.children||[]).flatMap(child=>nodes(child,[...ancestors,root]))];
}
function fixture(currentVisible=true,topInset,bottomInset){
 const item={id:'test-truck',driver:'Public Driver',portrait:'/api/public/driver-portraits/local-driver',provider:'Test fleet',handle:'test-fleet',truck:'Test truck',status:'EMPTY',configuration:'Mini Box Truck',
  sharingMode:'',acceptedLoads:null,latitude:9,longitude:38,capacityAge:'Updated',locationAge:'Updated',precisionKm:20,
  geometry:null,currentVisible,currentPoints:[],regular:[]};
 const items=[item],slots=[],effects=[],calls={deselect:0,select:0,fit:[],jump:[]};
 let index=0,selected=null,tree;
 const hook=initial=>{const position=index++;if(!(position in slots))slots[position]=initial;return [slots[position],position];};
 const changed=(previous,next)=>!previous||previous.length!==next.length||next.some((value,position)=>!Object.is(value,previous[position]));
 const hooks={
  memo:component=>component,
  useRef:initial=>hook({current:initial})[0],
  useState:initial=>{const [value,position]=hook(typeof initial==='function'?initial():initial);return [value,next=>{slots[position]=typeof next==='function'?next(slots[position]):next;}];},
  useMemo:(compute,deps)=>{const [value,position]=hook(null);if(changed(value?.deps,deps))slots[position]={deps,value:compute()};return slots[position].value;},
  useCallback:(callback,deps)=>hooks.useMemo(()=>callback,deps),
  useEffect:(effect,deps)=>{const [previous,position]=hook(null);if(changed(previous?.deps,deps)){effects.push(()=>{previous?.cleanup?.();slots[position]={deps,cleanup:effect()};});}},
 };
 const camera={fitBounds:(...args)=>calls.fit.push(args),jumpTo:value=>calls.jump.push(value),easeTo:()=>{}};
 const React={createElement:(type,props,...children)=>({type,props:props||{},children:flatten(children),text:children.flat(Infinity).filter(value=>typeof value==='string'||typeof value==='number')}),Fragment:'Fragment'};
 const parameters={...hooks,React,exports:{},capacitySharingLabel:value=>value,capacityLoadLabel:value=>value,locationSourceKind,locationSourceLabel,locationSourceColor,focusedMarkers,
  capacityMapData,capacityStatuses,capacityColors,capacitySourceIds,capacityLayerIds,renderedCapacityPoints,capacityMarkerOffsets,
  mapStyle:{},TruckAuthorityBadges:'TruckAuthorityBadges',AppIcon:'AppIcon',PublicCardImage:'PublicCardImage',Modal:'Modal',Link:'Link',useWindowDimensions:()=>({width:320,height:600}),Image:'Image',Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',View:'View',
  StyleSheet:{create:value=>value,absoluteFill:{}},Map:'NativeMap',Camera:'Camera',GeoJSONSource:'GeoJSONSource',Layer:'Layer',Marker:'Marker',
  markerLocation,signalBounds,signalPaths,createVisibleQuery:()=>({invalidate(){},moving(){},settled(){},refresh(){},close(){}}),
  vehicleConfigurationImage:()=>'/vehicle-configurations/mini-box-truck.png',apiOrigin:'https://loadgistic.example',useLanguage:()=>({t:value=>value})};
 new Function(...Object.keys(parameters),compiled)(...Object.values(parameters));
 const Component=parameters.exports.default;
 function render(){
  index=0;tree=Component({items,selected,topInset,bottomInset,onSelect:value=>{calls.select++;selected=value;},onDeselect:()=>{calls.deselect++;selected=null;}});
  for(const {node}of nodes(tree))if(node.props.ref){
   if(node.type==='Camera')node.props.ref.current=camera;
   if(node.type==='NativeMap')node.props.ref.current={queryRenderedFeatures:async()=>[]};
  }
  for(const effect of effects.splice(0))effect();
  return tree;
 }
 render();nodes(tree).find(({node})=>node.type==='NativeMap').node.props.onDidFinishLoadingMap();render();
 const previous={center:[40,12],zoom:8,bearing:15,pitch:20};
 nodes(tree).find(({node})=>node.type==='NativeMap').node.props.onRegionDidChange({nativeEvent:previous});render();
 selected=item;render();
 return {calls,item,items,previous,render,get tree(){return tree;},get selected(){return selected;}};
}

test('selected exit uses an independent native button and restores the saved camera without selecting truck details',()=>{
 const f=fixture(),exit=nodes(f.tree).find(({node})=>node.props.accessibilityLabel==='Back to map');
 assert.ok(exit,'selected truck must always offer an exit');
 assert.equal(exit.node.type,'Pressable','a marker child participates in Android first-match hit testing');
 assert.ok(exit.ancestors.every(node=>node.type!=='Marker'&&node.type!=='NativeMap'),'exit belongs outside the entire native marker registry');
 const style=Object.assign({},...[exit.node.props.style].flat());
 assert.ok(style.width>=44&&style.height>=44,'the independent control preserves its full touch target');
 assert.equal(style.top,68,'existing callers retain the default control inset');
 exit.node.props.onPress();f.render();
 assert.equal(f.calls.deselect,1);assert.equal(f.calls.select,0);assert.equal(f.selected,null);
 assert.equal(nodes(f.tree).filter(({node})=>node.type==='Modal').length,0,'exit cannot open truck information');
 assert.deepEqual(f.calls.jump.at(-1),{...f.previous,padding:{top:0,right:0,bottom:0,left:0}});
 assert.equal(f.items[0],f.item,'the loaded map/filter result remains available after exit');
});

test('measured floating-control height moves exit, signal controls and error feedback into disjoint bounds',()=>{
 const inset=124,f=fixture(true,inset),all=nodes(f.tree),exit=all.find(({node})=>node.props.accessibilityLabel==='Back to map').node;
 const style=node=>Object.assign({},...[node.props.style].flat());
 const controls=all.find(({node})=>node.type==='ScrollView').node;
 assert.equal(style(exit).top,inset);assert.equal(style(controls).top,inset);
 all.find(({node})=>node.type==='NativeMap').node.props.onDidFailLoadingMap();f.render();
 const error=nodes(f.tree).find(({node})=>node.props.accessibilityRole==='alert').node;
 assert.ok(style(error).top>=style(exit).top+style(exit).height,'error stays below the entire exit target');
 assert.ok(style(error).right>=style(controls).right+style(controls).width,'error stays left of the signal controls');
 exit.props.onPress();f.render();assert.equal(f.calls.deselect,1);
 assert.deepEqual(f.calls.jump.at(-1),{...f.previous,padding:{top:0,right:0,bottom:0,left:0}});
});

test('a selected truck without public geometry has the same independent exit',()=>{
 const f=fixture(false),exits=nodes(f.tree).filter(({node})=>node.props.accessibilityLabel==='Back to map');
 assert.equal(exits.length,1);assert.equal(exits[0].node.type,'Pressable');
 exits[0].node.props.onPress();f.render();
 assert.equal(f.selected,null);assert.equal(f.calls.deselect,1);assert.equal(f.calls.select,0);
 assert.deepEqual(f.calls.jump.at(-1),{...f.previous,padding:{top:0,right:0,bottom:0,left:0}});
});

test('floating chat bounds move selected controls above the dock without shortening the map',()=>{
 const f=fixture(true,124,112),all=nodes(f.tree);
 const controls=all.find(({node})=>node.type==='ScrollView').node;
 const style=node=>Object.assign({},...[node.props.style].flat());
 assert.equal(style(controls).bottom,112);
 const map=all.find(({node})=>node.type==='NativeMap').node;
 assert.equal(style(map).flex,1);assert.equal(style(map).bottom,undefined);
 assert.equal(style(nodes(fixture().tree).find(({node})=>node.type==='ScrollView').node).bottom,8,'other callers preserve the existing default');
});

test('narrow truck details give transporter and driver identities separate readable rows',()=>{
 const f=fixture(),button=nodes(f.tree).find(({node})=>node.props.accessibilityLabel==='Vehicle details').node;
 button.props.onPress();f.render();
 const all=nodes(f.tree),provider=all.find(({node})=>node.type==='Text'&&node.text.includes('Test fleet'));
 const driver=all.find(({node})=>node.type==='Text'&&node.text.includes('Public Driver'));
 assert.ok(provider&&driver,'both public identities remain present');
 const portrait=all.find(({node})=>node.type==='PublicCardImage');assert.equal(portrait.node.props.path,f.item.portrait);assert.equal(portrait.node.props.identity,'person','the Driver row uses its separate supplied portrait and person fallback');
 const group=provider.ancestors.find(ancestor=>driver.ancestors.includes(ancestor)&&ancestor.type==='View'&&Object.assign({},...[ancestor.props.style].flat()).borderTopWidth===1);
 assert.ok(group,'identity rows belong to one distinct details group');
 assert.equal(Object.assign({},...[group.props.style].flat()).flexDirection,'column','320px details must not compress identities into parallel columns');
 const profile=all.find(({node})=>node.type==='Link');
 assert.deepEqual(profile.node.props.href,{pathname:'/transporter',params:{handle:'test-fleet'}},'the existing public profile destination is retained');
 assert.equal(all.filter(({node})=>node.type==='NativeMap').length,1,'opening details keeps the same map mounted');
 assert.ok(all.some(({node})=>node.type==='Text'&&node.text.includes('Confirm availability directly.')),'reported capacity keeps its freshness confirmation guidance');
});
