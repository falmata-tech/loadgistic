import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {coverPosterPath,exampleCover} from '../../../src/lib/provider-cover-video.js';
import {featuredTikTokPresentation} from '../../../src/lib/featured-tiktok-presentation.js';
import {featuredClock,featuredRange,featuredRangeLabel} from '../../../src/lib/featured-time-presentation.js';
import {FEATURED_PUBLIC_HEADING,curatedFeaturedHeadline} from '../../../src/lib/featured-heading-presentation.js';
const React={createElement:(type,props,...children)=>({type,props:{...props,children},children:children.flat(Infinity)}),Fragment:'Fragment'};
const hooks={useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useMemo:compute=>compute(),useCallback:value=>value};
const host={React,...hooks,ProviderTruckSummary:'ProviderTruckSummary',TruckAuthorityBadges:'TruckAuthorityBadges',StyleSheet:{create:value=>value,flatten:values=>Object.assign({},...values.filter(Boolean)),absoluteFill:{}},Text:'Text',View:'View',Image:'Image',ScrollView:'ScrollView',SafeAreaView:'SafeAreaView',Modal:'Modal',Pressable:'Pressable',Link:'Link',AppIcon:'AppIcon',apiOrigin:'https://local.test',palette:{ink:'#0b1d3a',muted:'#526875',blue:'#155eef',border:'#cbd5e1',borderSoft:'#e5eaf1'},featuredTikTokPresentation,featuredClock,featuredRange,featuredRangeLabel,FEATURED_PUBLIC_HEADING,curatedFeaturedHeadline,useLanguage:()=>({locale:'en',t:(value,values={})=>String(value).replace(/\{(\w+)\}/g,(match,key)=>String(values[key]??match))})};
function compile(path,parameters){const parsed=ts.createSourceFile(path,readFileSync(new URL(path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),stripped=ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))),code=ts.transpileModule(ts.createPrinter().printFile(stripped),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};new Function(...Object.keys(parameters),'exports',code)(...Object.values(parameters),exports);return exports;}
const presentation=compile('../src/components/public-card.tsx',host);
function nodes(root){if(root===null||root===undefined||root===false)return[];if(Array.isArray(root))return root.flatMap(nodes);if(typeof root!=='object')return[{text:String(root)}];if(typeof root.type==='function')return nodes(root.type(root.props));return[root,...root.children.flatMap(nodes)];}
function renderedText(tree){return nodes(tree).filter(node=>'text'in node).map(node=>node.text).join(' ');}
function screen(path,query,extra={}){return compile(path,{...host,...presentation,coverPosterPath,exampleCover,useWindowDimensions:()=>({width:390,height:844}),ProviderFleetMap:'ProviderFleetMap',FeaturedSponsors:'FeaturedSponsors',ImageBackground:'ImageBackground',Page:'Page',Copy:props=>React.createElement('Text',{},props.message||props.children),Button:'Button',ErrorText:'ErrorText',LoadingSpinner:'LoadingSpinner',ActivityIndicator:'ActivityIndicator',ExternalButton:'ExternalButton',PublicBadges:'PublicBadges',ContentSafety:'ContentSafety',usePublicQuery:()=>({data:query,error:'',loading:false,refresh(){},reload(){}}),useForegroundRefresh(){},useFocusEffect(){},useBlockedProviders:()=>({blocked:[]}),parseFeatured:value=>value,programmeState:()=> 'Finished',...extra});}

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

const publicProvider={
 handle:'long-company',name:'A long commercial transporter name',image:'/portrait.jpg',
 kind:'Independent transporter',city:'Adama',headline:'Freight services',
 contacts:{phone:'000',whatsapp:'111',email:'public@example.test',website:'https://example.test'},
 about:'Public provider description',services:'Road freight',badges:[{type:'IDENTITY',reviewed:true}],
 reviewCount:1,averageRating:5,reviews:[{id:'review-1',rating:5,createdAt:'2026-10-13',note:'Original customer note /reference',disputed:true}],
 fleet:{total:1,page:1,pages:1},trucks:[{number:'TRK1',name:'Toyota Hiace',driver:'Public Driver',phone:'222'}]
};

test('transporter profile retains public contacts, documents and reviews beside one scoped map',()=>{
 const translated=[],paths=[];
 const component=screen('../src/screens/transporter.tsx',publicProvider,{
  useLocalSearchParams:()=>({handle:publicProvider.handle}),
  useState:()=>[true,()=>{}],
  usePublicQuery:path=>{paths.push(path);return {data:publicProvider,error:'',loading:false};},
  useLanguage:()=>({t:(message,values={})=>{translated.push(message);return message.replace(/\{(\w+)\}/g,(match,key)=>String(values[key]??match));}})
 }).default;
 const all=nodes(component()),text=all.filter(node=>'text'in node).map(node=>node.text).join(' ');
 assert.deepEqual(paths,['/api/mobile/public/providers/long-company?view=map']);
 assert.deepEqual(all.filter(node=>node.type==='ProviderFleetMap').map(node=>node.props.handle),[publicProvider.handle]);
 assert.equal(all.filter(node=>node.props?.testID==='profile-fleet-map').length,1);
 for(const value of [publicProvider.name,publicProvider.about,'Original customer note /reference','Under dispute','Adama'])assert.ok(text.includes(value),value);
 for(const value of ['Vehicles and drivers','TRK1','Public Driver','Toyota Hiace','Transport services','Regular service',publicProvider.services])assert.ok(!text.includes(value),value);
 assert.deepEqual(all.filter(node=>node.type==='ExternalButton').map(node=>node.props.url),['tel:000','https://wa.me/111','mailto:public@example.test','https://example.test']);
 assert.equal(all.filter(node=>node.type==='PublicBadges').length,1);
 assert.equal(all.filter(node=>node.type==='ContentSafety').length,2,'provider and review reporting remain available');
 for(const key of ['Transport Provider','Call transporter','WhatsApp','Email transporter','Website','Under dispute'])assert.ok(translated.includes(key),key+' is app-owned copy');
 for(const value of [publicProvider.name,publicProvider.about,publicProvider.headline,'Original customer note /reference',publicProvider.city])assert.ok(!translated.includes(value),value+' remains unaltered record content');
});

test('transporter cover keeps its public video action and the profile map without fleet rows',()=>{
 const component=screen('../src/screens/transporter.tsx',{...publicProvider,youtubeId:exampleCover.id,trucks:[]},{
  useLocalSearchParams:()=>({handle:publicProvider.handle})
 }).default;
 const tree=component(),all=nodes(tree);
 assert.equal(all.find(node=>node.type==='Link').props.href,`https://www.youtube.com/watch?v=${exampleCover.id}`);
 assert.equal(all.find(node=>node.type==='ImageBackground').props.source.uri,'https://local.test'+exampleCover.poster);
 assert.ok(all.some(node=>node.type==='ProviderFleetMap'));
 assert.ok(!all.some(node=>node.props?.testID==='provider-fleet-disclosure'));
 assert.ok(!renderedText(tree).includes('Original customer note /reference'),'reviews open on request');
});
