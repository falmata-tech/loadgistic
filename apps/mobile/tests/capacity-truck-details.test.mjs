import {capacityCoverageLabel} from '../../../src/lib/capacity-coverage-label.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {parseCapacityPage} from '../src/api/public-capacity.ts';
import {externalDestination} from '../src/api/public-content.ts';
import {capacityDetailFrame} from '../src/map/capacity-detail-frame.ts';
import {capacityStatusPresentation} from '../src/theme/capacity-status-presentation.ts';
import {availableSpacePercent,emptyShipmentPreferenceLabel} from '../../../src/lib/capacity-space-estimate.js';
import {capacitySharingLabel} from '../../../src/lib/capacity-sharing.js';
import {translateMessage} from '../../../src/lib/i18n/core.js';
import {localizedUpdateLabel} from '../../../src/lib/i18n/update-label.js';
import {nativeMessages} from '../src/localization/messages.ts';
import {gpsMessages} from '../../../src/lib/i18n/gps-messages.ts';
const React={createElement:(type,props,...children)=>({type,props:{...props,children},children:children.flat(Infinity)}),Fragment:'Fragment'};
const style=node=>Object.assign({},...[node.props.style].flat());
function nodes(root,ancestors=[]){
 if(root===null||root===undefined||root===false)return[];
 if(Array.isArray(root))return root.flatMap(item=>nodes(item,ancestors));
 if(typeof root!=='object')return[{text:String(root),ancestors}];
 if(typeof root.type==='function')return nodes(root.type(root.props),ancestors);
 return[{...root,ancestors},...root.children.flatMap(child=>nodes(child,[...ancestors,root]))];
}
const text=tree=>nodes(tree).filter(node=>'text'in node).map(node=>node.text).join(' ');
function fixture(extra={}){return parseCapacityPage({items:[{id:'public-signal',status:'PARTIAL',assigned_driver_first_name:'Public first name',assigned_driver_portrait_url:'/api/public/driver-portraits/00000000-0000-4000-8000-000000000001',provider_name:'Public provider',provider_handle:'public-provider',vehicle_make:'Public truck',cargo_configuration:'Pickup truck',assigned_driver_phone:'+251922809000',accepts_partial_load:true,...extra}],hasMore:false}).items[0];}
function components({expanded=null,locale='en'}={}){
 const messages=locale==='en'?{}:{...JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8')),...nativeMessages[locale],...gpsMessages[locale]},calls=[],changes=[],translated=[];
 const t=(message,values={})=>{translated.push(message);return translateMessage(messages,message,values);};
 const dependencies={React,capacityCoverageLabel,CapacityCoverageIndicators:'CoverageIndicators',useState:initial=>[initial===null?expanded:initial,value=>changes.push(value)],useLanguage:()=>({t}),Image:'Image',Pressable:'Pressable',Text:'Text',View:'View',Link:'Link',Linking:{openURL:async url=>{calls.push(url);}},AppIcon:'AppIcon',PublicCardImage:'PublicCardImage',TruckAuthorityBadges:'TruckAuthorityBadges',ErrorText:'ErrorText',StyleSheet:{create:value=>value},palette:{blue:'#155eef',ink:'#0b1d3a',muted:'#526875'},apiOrigin:'http://127.0.0.1:3100',vehicleConfigurationImage:()=>'/truck.png',capacityStatusPresentation,availableSpacePercent,emptyShipmentPreferenceLabel,capacitySharingLabel,externalDestination,localizedUpdateLabel};
 const path='../src/components/capacity-truck-details.tsx',source=ts.createSourceFile(path,readFileSync(new URL(path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),stripped=ts.factory.updateSourceFile(source,source.statements.filter(node=>!ts.isImportDeclaration(node))),compiled=ts.transpileModule(ts.createPrinter().printFile(stripped),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};
 new Function(...Object.keys(dependencies),'exports',compiled)(...Object.values(dependencies),exports);return {...exports,calls,changes,translated,t};
}
test('vehicle actions retain the profile and use only published callback phones',async()=>{
 const c=components(),tree=c.CapacityTruckContact({truck:fixture()}),call=nodes(tree).find(node=>node.type==='Pressable'&&node.props.accessibilityRole==='button');
 assert.ok(text(tree).includes('Call driver'));assert.ok(style(call).minHeight>=44);await call.props.onPress();assert.deepEqual(c.calls,['tel:+251922809000']);
 assert.deepEqual(nodes(tree).find(node=>node.type==='Link').props.href,{pathname:'/transporter',params:{handle:'public-provider'}});
 const absent=fixture({assigned_driver_phone:'',contact_phone:'',phone:'+251911111111',driver_phone:'+251933333333'});
 assert.equal(nodes(c.CapacityTruckContact({truck:absent})).filter(node=>node.props?.accessibilityRole==='button').length,0);
 assert.ok(text(c.CapacityTruckContact({truck:absent})).includes('Profile'));
 assert.equal(c.CapacityTruckContact({truck:{...absent,handle:''}}),null);
 const provider=fixture({assigned_driver_phone:null,contact_phone:'+251911111111'}),fallback=c.CapacityTruckContact({truck:provider});assert.ok(!text(fallback).includes('Call driver'));await nodes(fallback).find(node=>node.props?.accessibilityRole==='button').props.onPress();assert.equal(c.calls.at(-1),'tel:+251911111111');
});
test('phone details keep separate public identities, portrait, profile destination and freshness guidance',()=>{
 const c=components(),truck=fixture(),tree=c.CapacityTruckDetails({truck}),all=nodes(tree),provider=all.find(node=>node.type==='Text'&&text(node).includes('Public provider')),driver=all.find(node=>node.type==='Text'&&text(node)==='Public first name');
 assert.ok(provider&&driver);const group=provider.ancestors.find(ancestor=>driver.ancestors.includes(ancestor)&&style(ancestor).borderTopWidth===1);assert.equal(style(group).flexDirection,'row');
 const portrait=all.find(node=>node.type==='PublicCardImage');assert.equal(portrait.props.path,truck.portrait);assert.equal(portrait.props.identity,'person');assert.equal(portrait.props.compact,true);
 assert.ok(text(tree).includes('Confirm availability directly.'));
 assert.ok(text(c.CapacityTruckDetails({truck:fixture({assigned_driver_phone:''})})).includes('Phone not published'));
});
test('provider details identify only a trusted Example account without inferring synthetic location',()=>{
 const c=components();
 assert.ok(text(c.CapacityTruckDetails({truck:fixture({account_is_demo:true,location_is_demo:false})})).includes('Example account'));
 for(const account_is_demo of [false,undefined,'true',1]){
  assert.equal(text(c.CapacityTruckDetails({truck:fixture({account_is_demo,location_is_demo:true})})).includes('Example account'),false);
 }
 for(const locale of ['am','om']){
  const translated=components({locale}),label=translated.t('Example account');
  assert.notEqual(label,'Example account');
  assert.ok(text(translated.CapacityTruckDetails({truck:fixture({account_is_demo:true})})).includes(label));
 }
});
test('partial space estimate appears only with report provenance and translates on the phone',()=>{
 const legacy=fixture({available_percent:50,available_percent_reported_at:null});
 assert.equal(legacy.availablePercent,null);
 assert.ok(!text(components().CapacityTruckDetails({truck:legacy})).includes('50%'));
 const reported=fixture({available_percent:40,available_percent_reported_at:'2026-10-26T10:00:00Z'});
 assert.equal(reported.availablePercent,40);
 assert.ok(text(components().CapacityTruckDetails({truck:reported})).includes('Available space: 40%'));
 for(const locale of ['am','om']){
  const c=components({locale}),translated=c.t('Available space: {percent}%',{percent:40});
  assert.notEqual(translated,'Available space: 40%');
  assert.ok(text(c.CapacityTruckDetails({truck:reported})).includes(translated));
 }
});
test('an Empty vehicle shows its saved shipment preference in every supported language',()=>{
 const preferences=[
  [false,true,'Partial Shipments Only'],
  [true,false,'Full vehicle shipments only'],
  [true,true,'Partial or full vehicle shipments'],
 ];
 for(const locale of ['en','am','om']){
  const c=components({locale});
  for(const [accepts_full_load,accepts_partial_load,label] of preferences){
   const truck=fixture({status:'EMPTY',accepts_full_load,accepts_partial_load});
   const details=text(c.CapacityTruckDetails({truck}));
   assert.ok(details.includes(c.t('Available space: {percent}%',{percent:100})));
   assert.ok(details.includes(c.t(label)));
  }
 }
});
test('document groups count only current reviews, expand public dates and disclose no source files',()=>{
 const c=components({expanded:'driver'}),truck=fixture({owner_verification_badges:[{type:'BUSINESS_LICENSE',verified:true}],driver_verification_badges:[{type:'DRIVER_IDENTITY',verified:true,reviewedAt:'2026-10-22',storage_path:'private-file'},{type:'DRIVER_IDENTITY',verified:true,expired:true,expiresOn:'2020-01-01'}]}),tree=c.CapacityDocumentGroups({truck}),all=nodes(tree),buttons=all.filter(node=>node.type==='Pressable');
 assert.deepEqual(buttons.map(button=>button.props.accessibilityLabel),['Driver documents','Vehicle documents']);for(const button of buttons)assert.ok(style(button).minHeight>=44);
 assert.ok(!text(tree).includes('Business License'));
 assert.equal(buttons[0].props['aria-expanded'],true);assert.ok(text(tree).includes('1 of 2 reviewed'));assert.ok(text(tree).includes('Expired'));assert.ok(text(tree).includes('2020-01-01'));assert.ok(text(tree).includes('Reviewed 2026-10-22.'));
 assert.ok(!JSON.stringify(tree).includes('private-file'));assert.equal(all.filter(node=>node.type==='Link').length,0);buttons[0].props.onPress();assert.deepEqual(c.changes,[null]);
 const empty=components({expanded:'driver'}).CapacityDocumentGroups({truck:fixture()});assert.ok(text(empty).includes('No current reviewed evidence.'));assert.ok(!text(empty).includes('Loadgistic reviewed'));
});
test('contact and evidence labels translate in Amharic and Afaan Oromo without translating public identities',()=>{
 for(const locale of ['am','om']){
  const c=components({expanded:'driver',locale}),truck=fixture({driver_verification_badges:[{type:'DRIVER_IDENTITY',verified:true,reviewedAt:'2026-10-22'}]}),details=c.CapacityTruckDetails({truck}),contact=c.CapacityTruckContact({truck}),value=text(details)+' '+text(contact);
  for(const message of ['Call driver','Driver documents','Vehicle documents','Loadgistic reviewed','Driver license','{reviewed} of {total} reviewed']){const translated=c.t(message,{reviewed:1,total:1});assert.notEqual(translated,message,locale+': '+message);assert.ok(value.includes(translated),locale+': visible '+message);}
  assert.ok(value.includes(truck.driver)&&value.includes(truck.provider));assert.ok(!c.translated.includes(truck.driver)&&!c.translated.includes(truck.provider),'record identities remain unaltered');
 }
});
test('truck-only modal sizing keeps its map center and leaves sixteen-pixel viewport edges for content',()=>{
 for(const [width,height,top,mapHeight] of [[320,640,252,320],[390,844,240,538],[1365,900,160,680]]){
  const host={left:0,top,width,height:mapHeight},frame=capacityDetailFrame(host,{width,height});assert.equal(frame.top+frame.height/2,top+mapHeight/2);assert.ok(frame.left>=0&&frame.left+frame.width<=width);assert.ok(frame.top>=0&&frame.top+frame.height<=height);assert.ok(frame.height>=mapHeight,'authorized details may use viewport room beyond the map');
  const content={top:frame.top+16,bottom:frame.top+frame.height-16};assert.ok(content.top>=16&&content.bottom<=height-16);
 }
});
