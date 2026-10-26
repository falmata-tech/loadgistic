import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {translateMessage} from '../../../src/lib/i18n/core.js';
import {localizedUpdateLabel} from '../../../src/lib/i18n/update-label.js';
import {publicFleetRowKey} from '../../../src/lib/public-fleet-row.js';
import {featuredTikTokPresentation} from '../../../src/lib/featured-tiktok-presentation.js';
import {featuredClock,featuredRange,featuredRangeLabel} from '../../../src/lib/featured-time-presentation.js';
import {FEATURED_PUBLIC_HEADING,curatedFeaturedHeadline} from '../../../src/lib/featured-heading-presentation.js';
const React={createElement:(type,props,...children)=>({type,props:{...props,children},children:children.flat(Infinity)}),Fragment:'Fragment'};
const hooks={useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useMemo:compute=>compute(),useCallback:value=>value};
const host={React,localizedUpdateLabel,...hooks,ProviderTruckSummary:'ProviderTruckSummary',TruckAuthorityBadges:'TruckAuthorityBadges',StyleSheet:{create:value=>value,flatten:values=>Object.assign({},...values.filter(Boolean)),absoluteFill:{}},Text:'Text',View:'View',Image:'Image',ScrollView:'ScrollView',SafeAreaView:'SafeAreaView',Modal:'Modal',Pressable:'Pressable',Link:'Link',AppIcon:'AppIcon',apiOrigin:'https://local.test',palette:{ink:'#0b1d3a',muted:'#526875',blue:'#155eef',border:'#cbd5e1',borderSoft:'#e5eaf1'},featuredTikTokPresentation,featuredClock,featuredRange,featuredRangeLabel,FEATURED_PUBLIC_HEADING,curatedFeaturedHeadline,useLanguage:()=>({locale:'en',t:(value,values={})=>String(value).replace(/\{(\w+)\}/g,(match,key)=>String(values[key]??match))})};
function compile(path,parameters){const parsed=ts.createSourceFile(path,readFileSync(new URL(path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),stripped=ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))),code=ts.transpileModule(ts.createPrinter().printFile(stripped),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};new Function(...Object.keys(parameters),'exports',code)(...Object.values(parameters),exports);return exports;}
const presentation=compile('../src/components/public-card.tsx',host);
function nodes(root){if(root===null||root===undefined||root===false)return[];if(Array.isArray(root))return root.flatMap(nodes);if(typeof root!=='object')return[{text:String(root)}];if(typeof root.type==='function')return nodes(root.type(root.props));return[root,...root.children.flatMap(nodes)];}
function renderedText(tree){return nodes(tree).filter(node=>'text'in node).map(node=>node.text).join(' ');}
function screen(path,query,extra={}){return compile(path,{...host,...presentation,publicFleetRowKey,Page:'Page',Copy:props=>React.createElement('Text',{},props.message||props.children),Button:'Button',ErrorText:'ErrorText',LoadingSpinner:'LoadingSpinner',ActivityIndicator:'ActivityIndicator',ExternalButton:'ExternalButton',PublicBadges:'PublicBadges',ContentSafety:'ContentSafety',usePublicQuery:()=>({data:query,error:'',loading:false,refresh(){},reload(){}}),useForegroundRefresh(){},useFocusEffect(){},useBlockedProviders:()=>({blocked:[]}),parseFeatured:value=>value,programmeState:()=> 'Finished',...extra});}

test('public card actions retain destinations and full touch targets, with bounded media',()=>{
 const tree=presentation.PublicCardAction({href:{pathname:'/',params:{provider:'long-company'}},message:'View available trucks',icon:'truck'}),all=nodes(tree),link=all.find(node=>node.type==='Link'),target=all.find(node=>node.type==='Pressable');
 assert.deepEqual(link.props.href,{pathname:'/',params:{provider:'long-company'}});assert.equal(link.props.asChild,true);assert.ok(target.props.style.minHeight>=44);assert.equal(renderedText(tree),'View available trucks');
 const image=nodes(presentation.PublicCardImage({path:'/vehicle-configurations/cargo-van.jpg',label:'Cargo van'})).find(node=>node.type==='Image');assert.equal(image.props.source.uri,'https://local.test/vehicle-configurations/cargo-van.jpg');assert.equal(image.props.accessibilityLabel,'Cargo van');assert.equal(image.props.resizeMode,'contain');
 const fallback=nodes(presentation.PublicCardImage({path:'',label:'Public Driver',portrait:true})).find(node=>node.type==='View');assert.equal(fallback.props.accessibilityLabel,'Public Driver','an unavailable portrait must retain its public accessible name');
});

test('Featured keeps blocked accounts out of the compact board and opens only eligible account actions in detail',()=>{
 const truck={slot:1,handle:'long-company',name:'Long commercial transporter name that must wrap',fleetSize:3,isCompany:true,portrait:'/portrait.jpg',place:'Adama, Ethiopia',available:true};
 const feature={headline:'Daily Featured Transport Providers',introduction:'Today’s public programme.',date:'2026-10-13',start:'22:30',end:'23:59',programme:[{kind:'PROVIDER',slot:1,timeLabel:'22:30–23:59',startsAt:'',endsAt:''}],trucks:[truck,{...truck,slot:2,handle:'blocked-company',name:'Hidden account'}],sponsors:[],tiktokUrl:'',tiktokStatus:'NOT_SCHEDULED'};
 const component=screen('../src/screens/featured.tsx',feature,{useBlockedProviders:()=>({blocked:['blocked-company']})}).default,tree=component(),all=nodes(tree),text=renderedText(tree);
 for(const value of [FEATURED_PUBLIC_HEADING,truck.name,'10:30PM–11:59PM EAT'])assert.ok(text.includes(value),value);assert.match(text,/3\s+vehicles/);assert.ok(!text.includes('Daily Featured Transport Providers'),'the saved generic headline does not duplicate the programme heading');
 assert.ok(!text.includes('How Featured works')&&!text.includes('A rotating showcase, not a ranking.'));
 assert.ok(!text.includes('No TikTok LIVE broadcast')&&!text.includes('Watch live on TikTok')&&!text.includes('Confirm current documents, capacity, cargo fit, price, and timing directly.'));
 assert.equal(all.filter(node=>node.type==='AppIcon'&&node.props.name==='broadcast').length,0,'an unconfigured broadcast leaves the daily lineup alone');
 assert.ok(!text.includes('Hidden account'));const tiles=all.filter(node=>node.props?.testID==='featured-account-tile');assert.equal(tiles.length,1);assert.equal(tiles[0].props.accessibilityRole,'button');assert.match(tiles[0].props.accessibilityLabel,/Long commercial transporter name.*3 vehicles/);
 const empty=renderedText(screen('../src/screens/featured.tsx',{...feature,trucks:[],programme:[]}).default());assert.ok(empty.includes(FEATURED_PUBLIC_HEADING));assert.ok(empty.includes('10:30PM–11:59PM EAT'));assert.ok(empty.includes('No Transport Providers are scheduled today.'));
 assert.equal(all.filter(node=>node.type==='Link').length,1,'only Capacity is linked until a tile is selected');
 assert.ok(all.filter(node=>node.type==='Text'&&node.props.accessibilityRole==='header').every(node=>node.props.style.fontSize<=22),'card headings do not reuse the oversized global title');
 let stateIndex=0;const selected=screen('../src/screens/featured.tsx',feature,{useBlockedProviders:()=>({blocked:['blocked-company']}),useState:initial=>[++stateIndex===3?truck:typeof initial==='function'?initial():initial,()=>{}]}).default();const selectedNodes=nodes(selected);
 assert.ok(renderedText(selected).includes(truck.place));assert.ok(selectedNodes.some(node=>node.type==='Modal'&&node.props.onRequestClose));
 assert.deepEqual(selectedNodes.filter(node=>node.type==='Link').map(node=>node.props.href),['/',{pathname:'/transporter',params:{handle:'long-company'}},{pathname:'/',params:{provider:'long-company'}}]);
 const scheduledFeature={...feature,tiktokUrl:'https://www.tiktok.com/@loadgistic/live',tiktokStatus:'SCHEDULED'};const scheduledText=renderedText(screen('../src/screens/featured.tsx',scheduledFeature,{useBlockedProviders:()=>({blocked:[]})}).default());assert.ok(scheduledText.includes('TikTok LIVE broadcast planned · 10:30PM EAT'));
 const liveFeature={...feature,tiktokUrl:'https://www.tiktok.com/@loadgistic/live',tiktokStatus:'LIVE'};const liveTree=screen('../src/screens/featured.tsx',liveFeature,{useBlockedProviders:()=>({blocked:[]})}).default(),liveNodes=nodes(liveTree),liveText=renderedText(liveTree);assert.ok(liveText.includes('TikTok LIVE broadcast is on now'));assert.ok(liveNodes.some(node=>node.type==='ExternalButton'&&node.props.label==='Watch live on TikTok'));
 for(const status of ['NOT_SCHEDULED','ENDED']){const hidden=screen('../src/screens/featured.tsx',{...liveFeature,tiktokStatus:status},{useBlockedProviders:()=>({blocked:[]})}).default(),hiddenText=renderedText(hidden);assert.ok(hiddenText.includes(truck.name));assert.ok(!hiddenText.includes('TikTok LIVE broadcast'));assert.equal(nodes(hidden).filter(node=>node.type==='AppIcon'&&node.props.name==='broadcast').length,0);}
});

test('Featured loading keeps board geometry and a failed read keeps retry reachable',()=>{
 const loading=nodes(screen('../src/screens/featured.tsx',null,{usePublicQuery:()=>({data:null,error:'',loading:true,refresh(){},reload(){}})}).default());
 assert.ok(loading.some(node=>node.type==='LoadingSpinner'&&node.props.accessibilityLabel==='Loading Featured'));
 assert.equal(loading.filter(node=>node.props?.testID==='featured-account-tile').length,0);
 const failed=nodes(screen('../src/screens/featured.tsx',null,{usePublicQuery:()=>({data:null,error:'Featured is unavailable right now.',loading:false,refresh(){},reload(){}})}).default());
 assert.ok(failed.some(node=>node.type==='Button'&&node.props.message==='Try again'));
});

test('transporter presentation retains contacts, documents, user content and truck map actions',()=>{
 const provider={handle:'long-company',name:'A long commercial transporter name',image:'/portrait.jpg',kind:'Independent transporter',city:'Adama',headline:'Freight services',contacts:{phone:'000',whatsapp:'111',email:'public@example.test',website:'https://example.test'},about:'Public provider description',services:'Road freight',badges:[{type:'IDENTITY',reviewed:true}],regular:{places:['Adama','Addis Ababa'],kind:'ROUTE'},reviewCount:1,averageRating:5,reviews:[{id:'review-1',rating:5,createdAt:'2026-10-13',note:'Original customer note /reference',disputed:true}],fleet:{total:1,page:1,pages:1},trucks:[{number:'TRK1',name:'Toyota Hiace',configuration:'Cargo van',image:'/van.jpg',driver:'Public Driver',driverKind:'Independent driver',phone:'222',regular:{kind:'ROUTE',places:['Truck route A','Truck route B']},capacity:{status:'EMPTY',updated:'Capacity updated today',origin:'Adama',destination:'Addis Ababa',locationUpdated:'Location updated today',mapHref:'/?provider=long-company&truck=00000000-0000-4000-8000-000000000001'},driverBadges:[{type:'DRIVER_IDENTITY'}],truckBadges:[{type:'VEHICLE_OWNERSHIP'}]}]};
 const translated=[],component=screen('../src/screens/transporter.tsx',provider,{useLocalSearchParams:()=>({handle:provider.handle}),useLanguage:()=>({t:(message,values={})=>{translated.push(message);return message.replace(/\{(\w+)\}/g,(match,key)=>String(values[key]??match));}})}).default,tree=component(),all=nodes(tree),text=renderedText(tree);
 for(const value of [provider.name,provider.about,'Original customer note /reference','Under dispute','TRK1','Public Driver','Adama','Addis Ababa','Capacity updated today','Location updated today','Truck route A ↔ Truck route B'])assert.ok(text.includes(value),value);
 assert.ok(!text.includes(provider.services));assert.ok(!text.includes('Transport services')&&!text.includes('Regular service'));assert.ok(!text.includes('Regular two-way Capacity route · confirm availability'));assert.ok(text.indexOf('Truck route A')>text.indexOf('Toyota Hiace'));
 assert.deepEqual(all.filter(node=>node.type==='ExternalButton').map(node=>node.props.url),['tel:000','https://wa.me/111','mailto:public@example.test','https://example.test','tel:222']);
 assert.equal(all.filter(node=>node.type==='PublicBadges').length,3);assert.deepEqual(all.find(node=>node.type==='Link').props.href,{pathname:'/',params:{provider:provider.handle}},'the explicit map action opens this transporter’s truck signals');
  const mapAction=all.find(node=>node.type==='Link'&&renderedText(node).includes('See vehicles on the map'));assert.ok(mapAction);assert.deepEqual(mapAction.props.href,{pathname:'/',params:{provider:provider.handle}});assert.ok(text.indexOf('See vehicles on the map')<text.indexOf('Vehicles and drivers'));
 const truckMapAction=all.find(node=>node.type==='Link'&&renderedText(node).includes('View planned capacity on map'));assert.ok(truckMapAction);assert.equal(truckMapAction.props.href,provider.trucks[0].capacity.mapHref);assert.ok(text.includes('Planned capacity'));
 assert.equal(all.filter(node=>node.type==='ContentSafety').length,2,'provider and review reporting remain available');
 for(const key of ['Transport Provider','Call transporter','WhatsApp','Email transporter','Website','Under dispute','Empty','Cargo van','Independent driver'])assert.ok(translated.includes(key),key+' is app-owned copy');
 for(const value of [provider.name,provider.about,provider.services,provider.headline,'Original customer note /reference','Public Driver',provider.city])assert.ok(!translated.includes(value),value+' remains unaltered record content');
});

test('native provider cards distinguish planned geometry from Preferred area and respect hidden geometry',()=>{
 for(const coverage of [{kind:'AREA',places:['Area center','Boundary A','Boundary B','Boundary C']},{kind:'ROUTE',places:['Route A','Via','Route B']},null,undefined]){
  const capacity={status:'PARTIAL',updated:'Capacity updated today',locationUpdated:'Location updated today',origin:'Legacy origin',destination:'Legacy destination',mapHref:'/?provider=local-provider',...(coverage===undefined?{}:{coverage})};
  const truck={number:'LOCAL',name:'Local vehicle',configuration:'Cargo van',image:'',driver:'Local driver',driverKind:'Company driver',phone:'',driverBadges:[],truckBadges:[],regular:{kind:'AREA',places:['Preferred center','Preferred boundary']},capacity};
  const provider={handle:'local-provider',name:'Local provider',image:'',kind:'Fleet transporter',city:'Adama',headline:'',contacts:{},about:'',services:'',badges:[],regular:null,reviewCount:0,averageRating:null,reviews:[],fleet:{total:1,page:1,pages:1},trucks:[truck]};
  const text=renderedText(screen('../src/screens/transporter.tsx',provider,{useLocalSearchParams:()=>({handle:provider.handle})}).default());assert.ok(text.includes('Planned capacity'));assert.ok(text.includes('Preferred area'));assert.ok(text.includes('Confirm availability'));assert.ok(text.includes('Location updated today'));
  if(coverage){assert.ok(text.includes(coverage.kind==='AREA'?'Planned area':'Planned route'));assert.ok(text.includes(coverage.places.join(coverage.kind==='AREA'?' · ':' → ')));}
  if(coverage===undefined)assert.ok(text.includes('Legacy origin → Legacy destination'));
  else assert.ok(!text.includes('Legacy origin')&&!text.includes('Legacy destination'),'explicit null/structured geometry cannot fall back to stale route labels');
  if(coverage===null)assert.ok(!text.includes('Planned area')&&!text.includes('Planned route'));
 }
});

for(const locale of ['am','om'])for(const entry of [
 {name:'days',capacity:'Capacity updated 2 days ago',location:'Location updated 1 day ago',capacityKey:'Capacity updated {days} days ago',locationKey:'Location updated {days} day ago'},
 {name:'absent',capacity:undefined,location:'',capacityKey:'Capacity update unavailable',locationKey:'Location update unavailable'},
])test(`native profile freshness labels localize ${locale} ${entry.name} without translating records`,()=>{
 const catalog=JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8')),translated=[],t=(message,values)=>{translated.push(message);return translateMessage(catalog,message,values);};
 const truck={number:'LOCAL',name:'Record vehicle',configuration:'Cargo van',image:'',driver:'Location updated today',driverKind:'Company driver',phone:'',driverBadges:[],truckBadges:[],regular:null,capacity:{status:'PARTIAL',updated:entry.capacity,locationUpdated:entry.location,origin:'Record city A',destination:'Record city B',mapHref:''}};
 const provider={handle:'local-provider',name:'Capacity updated today',image:'',kind:'Fleet transporter',city:'Record city',headline:'',contacts:{},about:'Record description',services:'',badges:[],regular:null,reviewCount:0,averageRating:null,reviews:[],fleet:{total:1,page:1,pages:1},trucks:[truck]};
 const text=renderedText(screen('../src/screens/transporter.tsx',provider,{localizedUpdateLabel,useLocalSearchParams:()=>({handle:provider.handle}),useLanguage:()=>({t,locale})}).default());
 assert.deepEqual([text.includes(t(entry.capacityKey,{days:2})),text.includes(t(entry.locationKey,{days:1}))],[true,true]);
 for(const record of [provider.name,provider.about,provider.city,truck.driver,truck.capacity.origin,truck.capacity.destination])if(record)assert.ok(!translated.includes(record),'user records are not formatter inputs');
 assert.ok(text.includes(provider.name)&&text.includes(truck.driver)&&text.includes(provider.about)&&text.includes('Record city A → Record city B'));
});

test('unnumbered public fleet rows have distinct page keys without displaying invented identifiers',()=>{
 const truck={number:'',name:'Toyota Hiace',configuration:'Cargo van',image:'/van.jpg',driver:'Public Driver',driverKind:'Company driver',phone:'',capacity:null,driverBadges:[],truckBadges:[]},provider={handle:'long-company',name:'Public fleet',image:'',kind:'Fleet transporter',city:'Adama',headline:'',contacts:{},about:'',services:'',badges:[],regular:null,reviewCount:0,averageRating:null,reviews:[],fleet:{total:24,page:2,pages:2},trucks:[truck,{...truck,name:'Second public van'}]};
 const component=screen('../src/screens/transporter.tsx',provider,{useLocalSearchParams:()=>({handle:provider.handle}),useState:initial=>[initial===false?true:initial,()=>{}]}).default,tree=component();
 const disclosure=nodes(tree).find(node=>node.props?.testID==='provider-fleet-disclosure');assert.ok(disclosure);assert.equal(disclosure.props.accessibilityLabel,'Vehicles and drivers (24)');assert.deepEqual(disclosure.props.accessibilityState,{expanded:true});assert.ok(disclosure.props.style.minHeight>=44);assert.ok(nodes(disclosure).some(node=>node.type==='AppIcon'&&node.props.name==='chevronUp'));
 assert.equal(renderedText(tree).split('Vehicles and drivers').length-1,1,'one fleet header replaces the duplicate heading and hide button');
 function keys(root){if(!root||typeof root!=='object')return[];if(Array.isArray(root))return root.flatMap(keys);if(typeof root.type==='function')return [...(root.type===presentation.PublicCard?[root.props.key]:[]),...keys(root.type(root.props))];return root.children.flatMap(keys);}
 const rowKeys=keys(tree).filter(Boolean);assert.deepEqual(rowKeys,['row:12','row:13']);const text=renderedText(tree);assert.ok(text.includes('Toyota Hiace')&&text.includes('Second public van'));assert.ok(!text.includes('row:12')&&!text.includes('row:13'),'fallback keys are never public truck numbers');
});
