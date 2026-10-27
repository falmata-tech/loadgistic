import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as navigation from '../src/components/site-navigation.ts';
import {
 activeSiteDestination,accountHref,memberDestinations,phonePrimaryDestinations,publicDestinations,visitorDestinations
} from '../src/components/site-navigation.ts';

const provider={id:'owner',role:'TRANSPORTER',name:'Provider',canManageFleet:true,drivesTruck:true};
const driver={id:'driver',role:'DRIVER',name:'Driver',canManageFleet:false,drivesTruck:true};

test('one public shell gains account destinations after sign-in',()=>{
 assert.deepEqual(visitorDestinations.map(item=>[item.label,item.href]),[
  ['Capacity','/'],['Track','/track'],['Featured','/featured'],['About','/about']
 ]);
 assert.deepEqual(publicDestinations.map(item=>item.href),['/','/featured']);
 assert.deepEqual(memberDestinations(null),[]);
 assert.deepEqual(memberDestinations(provider).map(item=>item.href),[
  '/app/home','/app/network','/app/provider-shipments','/app/support','/app/more'
 ]);
 assert.deepEqual(memberDestinations(provider).map(item=>item.label),['Home','Network','Tracking','Support','Account']);
 assert.deepEqual(phonePrimaryDestinations(provider).map(item=>item.label),['Home','Network','Tracking']);
 assert.deepEqual(phonePrimaryDestinations(null).map(item=>item.label),['Capacity','Track','Featured','About']);
 assert.equal(memberDestinations(driver).some(item=>item.href==='/app/fleet'),false);
 assert.equal(memberDestinations(driver).some(item=>item.href==='/app/home'),true);
 assert.equal(accountHref(null),'/login');
 assert.equal(accountHref(provider),'/app/more');
});

test('shipper and broker teams reach their network and permitted tracking',()=>{
 const user={id:'shipper',role:'CUSTOMER',name:'Shipper',trackingAllowed:true};
 assert.deepEqual(phonePrimaryDestinations(user).map(item=>item.href),['/','/app/network','/app/business/tracking']);
 assert.deepEqual(memberDestinations(user).map(item=>item.href),[
  '/app/network','/app/business/tracking','/app/business/account'
 ]);
 assert.deepEqual(publicDestinations.map(item=>item.href),['/','/featured']);
 assert.equal(activeSiteDestination('/app/shared-capacity',user),'capacity');
 assert.equal(activeSiteDestination('/app/business/tracking',user),'my-tracking');
 assert.equal(accountHref(user),'/app/business/account');
});

test('platform navigation follows actual grants without retired brokerage routes',()=>{
 const admin={id:'admin',role:'ADMIN',name:'Administrator'};
 const support={id:'support',role:'SUPPORT',name:'Support',canManageSupport:true,canManageOperations:true};
 const denied={id:'support-denied',role:'SUPPORT',name:'Support'};
 assert.equal(activeSiteDestination('/admin/support',admin),'support');
 assert.equal(activeSiteDestination('/support',support),'support');
 assert.equal(memberDestinations(support).some(item=>item.href==='/admin/operations'),true);
 assert.equal(memberDestinations(denied).some(item=>item.href==='/admin/operations'),false);
 for(const user of [admin,support,denied]){
  const hrefs=memberDestinations(user).map(item=>item.href);
  assert.equal(hrefs.some(href=>href.startsWith('/brokerage')||href.startsWith('/admin/capacity-network')),false);
 }
});

test('capacity and provider details keep predictable return destinations',()=>{
 assert.equal(activeSiteDestination('/',provider),'capacity');
 assert.equal(activeSiteDestination('/providers/example',provider),'capacity');
 assert.equal(activeSiteDestination('/@example',null),'capacity');
 assert.equal(activeSiteDestination('/featured',null),'featured');
 assert.equal(activeSiteDestination('/app/network',provider),'directory');
 assert.equal(activeSiteDestination('/app/home/market',provider),'my-work');
 assert.equal(activeSiteDestination('/app/home/vehicles',provider),'my-work');
});

const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
function renderNavigation(path,user){
 const node=(type,props)=>({type,props:props||{}}),react={useState:initial=>[initial,()=>{}],useEffect(){}},icons=new Proxy({},{get:(_value,key)=>key});
 const ports={'react/jsx-runtime':{jsx:node,jsxs:node},react:{__esModule:true,default:react},'next/link':{__esModule:true,default:'Link'},
  'next/navigation':{usePathname:()=>path,useRouter:()=>({replace(){assert.fail('no navigation during render');}})},'lucide-react':icons,
  './localization':{Localized:'Localized',Text:'Text',LanguagePicker:'LanguagePicker'},'./site-navigation':navigation,
  './public-navigation.module.css':{__esModule:true,default:icons},'./logo':{Logo:'Logo'},'./chat-alerts':{ChatAlerts:'ChatAlerts'},'./staff-account':{StaffAccount:'StaffAccount'}};
 const load=file=>{const exports={},code=ts.transpileModule(readFileSync(new URL('../src/components/'+file,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>{assert.ok(name in ports,'Unexpected navigation dependency '+name);return ports[name];},exports);return exports;};
 return{tree:load('public-mobile-nav.tsx').PublicMobileNav({user}),topbar:()=>load('site-topbar.tsx').SiteTopbar({user})};
}
function click(overrides={}){const event={button:0,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,defaultPrevented:false,currentTarget:{target:''},preventDefault(){this.defaultPrevented=true;},...overrides};return event;}
test('desktop and phone Home keep only the three current Home roots without suppressing browser modified clicks',()=>{
 for(const path of ['/app/home','/app/home/market','/app/home/vehicles']){
  assert.equal(activeSiteDestination(path,provider),'my-work');
  const links=nodes(renderNavigation(path,provider).tree).filter(node=>node.type==='Link'&&node.props.href==='/app/home');assert.equal(links.length,2,'desktop rail and phone primary navigation share the handler');
  for(const link of links){assert.equal(link.props['aria-current'],'page');const event=click();link.props.onClick(event);assert.equal(event.defaultPrevented,true,'ordinary Home activation keeps current tab and query state');
   for(const change of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{currentTarget:{target:'_blank'}}]){const modified=click(change);link.props.onClick(modified);assert.equal(modified.defaultPrevented,false);}}
 }
 for(const user of [provider,driver]){const home=nodes(renderNavigation('/app/network',user).tree).find(node=>node.type==='Link'&&node.props.href==='/app/home');assert.ok(home);const event=click();home.props.onClick(event);assert.equal(event.defaultPrevented,false,'Home from another task opens its work entry');}
});
test('Home remains active on deep records and Fleet aliases while ordinary activation returns to work Home',()=>{
 for(const user of [provider,driver])for(const path of ['/app/fleet','/app/fleet/vehicles','/app/fleet/drivers','/app/fleet/vehicles/owned-truck','/app/fleet/drivers/assigned-driver','/app/home/vehicles/owned-truck']){
  assert.equal(activeSiteDestination(path,user),'my-work');
  const links=nodes(renderNavigation(path,user).tree).filter(node=>node.type==='Link'&&node.props.href==='/app/home');assert.equal(links.length,2);
  for(const link of links){assert.equal(link.props['aria-current'],'page');const event=click();link.props.onClick(event);assert.equal(event.defaultPrevented,false,'active Home must still provide a route out of a record');
   for(const change of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{currentTarget:{target:'_blank'}}]){const modified=click(change);link.props.onClick(modified);assert.equal(modified.defaultPrevented,false);}}
 }
});
test('legacy app entry and provider brand target existing work Home while other brand roles retain root',()=>{
 const source=ts.transpileModule(readFileSync(new URL('../src/app/app/page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 new Function('require','exports',source)(()=>({redirect:path=>{throw Error('REDIRECT:'+path);}}),exports);assert.throws(()=>exports.default(),/REDIRECT:\/app\/home$/);
 for(const user of [provider,driver])assert.equal(nodes(renderNavigation('/app/network',user).topbar()).find(node=>node.type==='Logo').props.href,'/app/home');
 for(const user of [null,{id:'broker',role:'CUSTOMER',name:'Broker'},{id:'admin',role:'ADMIN',name:'Admin'}])assert.equal(nodes(renderNavigation('/',user).topbar()).find(node=>node.type==='Logo').props.href,'/');
});
