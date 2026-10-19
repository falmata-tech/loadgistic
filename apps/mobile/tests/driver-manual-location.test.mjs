import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const vehicleId='11111111-1111-4111-8111-111111111111';
function harness({selection,request=async()=>({}),capture=async()=>({approximateLat:9.1,approximateLng:38.8,locationPrecisionKm:10,phoneInstallation:{installationId:'local-phone',reportId:'report',observedAt:1000}})}={}){
 let slots=[],cursor=0,saved=0;
 const calls=[],requestPort=async(path,body)=>{calls.push({path,body});return request(path,body);};
 const React={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const useState=initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];};
 const useRef=initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});};
 const input={vehicleId,source:'MOBILE',precisionKm:10,revision:'original-revision',manualPoint:null,canSetManualLocation:true,canSetPhoneLocation:true,...selection};
 const ports={React,useState,useRef,useCallback:callback=>callback,AppState:{currentState:'active'},ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',Text:'Text',View:'View',Map:'Map',Camera:'Camera',Marker:'Marker',mapStyle:{},AppIcon:'AppIcon',Button:'Button',Copy:'Copy',ErrorText:'ErrorText',palette:{teal:'#077',ink:'#123',muted:'#567',border:'#ccc'},useLanguage:()=>({t:value=>value}),useAccountQuery:()=>({data:input,error:'',loading:false,reload:async()=>{}}),useAccount:()=>({request:requestPort}),privacyRadii:[1,3,5,10,20],captureCapacityLocation:capture};
 const path=new URL('../src/components/driver-location-editor.tsx',import.meta.url),parsed=ts.createSourceFile(path.pathname,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))))+'\nexport {LocationForm};';
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};
 new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);
 const truck={id:vehicleId,label:'Local vehicle',location:{coordinate:[38.7,9],updatedAt:'2026-10-18T10:00:00Z'}};
 return {render:()=>{cursor=0;return exports.LocationForm({truck,selection:input,onSaved:()=>saved++,onBusy(){},reload:async()=>{}});},calls,saved:()=>saved};
}
function nodes(tree){if(Array.isArray(tree))return tree.flatMap(nodes);if(!tree||typeof tree!=='object')return[];return[tree,...nodes(tree.props?.children)];}
function find(tree,type,check=()=>true){const value=nodes(tree).find(node=>(node.type===type||node.type?.name===type)&&check(node));assert.ok(value,`${type} missing`);return value;}
async function settle(){for(let i=0;i<6;i++)await Promise.resolve();}

test('assigned driver chooses a manual Capacity point and radius using the existing source command',async()=>{
 const h=harness();let view=h.render();find(view,'SourceChoice',node=>node.props.label==='Manual capacity location').props.onPress();view=h.render();
 assert.equal(find(view,'Button',node=>node.props.message==='Update location').props.disabled,true,'a point is required');
 find(view,'Map').props.onPress({nativeEvent:{lngLat:[-105.27,40.015]}});view=h.render();
 find(view,'Pressable',node=>node.props.accessibilityLabel==='5 km').props.onPress();view=h.render();
 assert.deepEqual(find(view,'Marker').props.lngLat,[-105.27,40.015]);
 find(view,'Button',node=>node.props.message==='Update location').props.onPress();await settle();
 assert.equal(h.saved(),1);assert.deepEqual(h.calls,[{path:'/api/mobile/fleet/devices',body:{action:'SOURCE',input:{vehicleId,source:'MANUAL',expectedRevision:'original-revision',precisionKm:5,manualLatitude:40.015,manualLongitude:-105.27}}}]);
 assert.equal(h.calls.some(call=>call.path.includes('tracking')),false,'Capacity source choice must not modify an active shipment Tracking lease');
});

test('denied phone capture preserves the manual source before any source write',async()=>{
 const h=harness({selection:{source:'MANUAL',manualPoint:{latitude:9,longitude:38}},capture:async()=>{throw new Error('Location permission denied');}});
 let view=h.render();find(view,'SourceChoice',node=>node.props.label==='Driver’s phone').props.onPress();view=h.render();
 find(view,'Button',node=>node.props.message==='Use phone location').props.onPress();await settle();view=h.render();
 assert.deepEqual(h.calls,[]);assert.equal(h.saved(),0);assert.equal(find(view,'ErrorText',node=>Boolean(node.props.message)).props.message,'Location permission denied');
});

test('switching back to phone shares an obscured fix after selecting the phone source',async()=>{
 const fix={approximateLat:9.1,approximateLng:38.8,locationPrecisionKm:10,phoneInstallation:{installationId:'local-phone',reportId:'report',observedAt:1000}};
 const h=harness({selection:{source:'MANUAL',manualPoint:{latitude:9,longitude:38}},capture:async()=>fix});
 let view=h.render();find(view,'SourceChoice',node=>node.props.label==='Driver’s phone').props.onPress();view=h.render();
 find(view,'Button',node=>node.props.message==='Use phone location').props.onPress();await settle();
 assert.equal(h.saved(),1);assert.deepEqual(h.calls,[{path:'/api/mobile/fleet/devices',body:{action:'SOURCE',input:{vehicleId,source:'MOBILE',expectedRevision:'original-revision',precisionKm:10}}},{path:'/api/mobile/capacity',body:{action:'LOCATION',vehicleId,...fix}}]);
 assert.equal(h.calls.some(call=>call.body?.manualLatitude!=null),false,'raw coordinates never accompany the phone report');
});

test('a failed phone report can retry without replaying the completed source change',async()=>{
 let reports=0;
 const h=harness({selection:{source:'MANUAL',manualPoint:{latitude:9,longitude:38}},request:async(path)=>{if(path==='/api/mobile/capacity'&&++reports===1)throw new Error('Temporary network failure');return {ok:true};}});
 let view=h.render();find(view,'SourceChoice',node=>node.props.label==='Driver’s phone').props.onPress();view=h.render();
 find(view,'Button',node=>node.props.message==='Use phone location').props.onPress();await settle();view=h.render();
 assert.equal(h.saved(),0);
 assert.equal(find(view,'ErrorText',node=>Boolean(node.props.message)).props.message,'Phone source saved, but the location was not shared. Try again.');
 find(view,'Button',node=>node.props.message==='Use phone location').props.onPress();await settle();
 assert.equal(h.saved(),1);
 assert.deepEqual(h.calls.map(call=>call.path),['/api/mobile/fleet/devices','/api/mobile/capacity','/api/mobile/capacity']);
});

test('driver choice is not offered when current assignment permission is absent',()=>{
 const h=harness({selection:{source:'GPS',canSetManualLocation:false,canSetPhoneLocation:false}}),view=h.render();
 assert.equal(nodes(view).some(node=>node.type?.name==='SourceChoice'),false);
 assert.equal(nodes(view).some(node=>node.type==='Button'&&['Update location','Use phone location'].includes(node.props.message)),false);
});
