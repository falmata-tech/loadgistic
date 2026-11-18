import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {CAPACITY_FILTER_CHOICES,capacityFilterRecord} from '../src/lib/capacity-filter-values.js';

const node=(type,props)=>({type,props:props||{}});
const nodes=value=>!value?[]:Array.isArray(value)?value.flatMap(nodes):typeof value==='object'?[value,...nodes(value.props?.children)]:[];
function load(file,ports){
 const parsed=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(value=>!ts.isImportDeclaration(value))));
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,exports={};
 new Function('require',...Object.keys(ports),'exports',code)(name=>{assert.equal(name,'react/jsx-runtime');return{jsx:node,jsxs:node};},...Object.values(ports),exports);return exports;
}
function page(user){
 const calls=[];const feed={items:[],hasMore:false,nextCursor:null,pageSize:14};
 const module=load('src/app/page.tsx',{
  Text:'Text',Localized:'Localized',PublicHeader:'PublicHeader',PublicCapacityFeed:'PublicCapacityFeed',PrivateCapacityEntry:'PrivateCapacityEntry',
  getCurrentUser:async()=>user,getWorkspaceAccess:async()=>({granted:true}),CAPACITY_FILTER_CHOICES,capacityFilterRecord,
  capacityIntroduction:{title:'Capacity',webDescription:'Capacity overview'},redirect:path=>{calls.push(['redirect',path]);throw Error('REDIRECT:'+path);},
  listPublicCapacityCursor:async(...args)=>{calls.push(['public',...args]);return feed;},
  listBusinessCapacity:async(...args)=>{calls.push(['private',...args]);return feed;},publicPageMetadata:value=>value
 });return{module,calls};
}

test('anonymous Private view stays selected and calls no public/private Capacity data port',async()=>{
 const h=page(null),tree=await h.module.default({searchParams:Promise.resolve({view:'private'})});
 assert.deepEqual(h.calls,[]);assert.equal(nodes(tree).filter(value=>value.type==='PrivateCapacityEntry').length,1);
 assert.equal(nodes(tree).some(value=>value.type==='PublicCapacityFeed'),false);
 const selected=nodes(tree).find(value=>value.type==='a'&&value.props.href==='/?view=private');assert.equal(selected.props['aria-current'],'page');
 assert.equal(nodes(tree).find(value=>value.type==='PublicHeader').props.user,null);
 const metadata=await h.module.generateMetadata({searchParams:Promise.resolve({view:'private'})});assert.equal(metadata.privateView,true);
});

test('public map and authorized business Private map retain their existing data/identity scopes',async()=>{
 const publicPage=page(null),publicTree=await publicPage.module.default({searchParams:Promise.resolve({})});
 assert.deepEqual(publicPage.calls.map(value=>value[0]),['public']);assert.equal(nodes(publicTree).some(value=>value.type==='PrivateCapacityEntry'),false);
 const user={id:'synthetic-owner',role:'CUSTOMER',active:true,selected_business_workspace:{id:'synthetic-workspace',membershipRevision:4,permissions:{capacity:true}}};
 const privatePage=page(user),privateTree=await privatePage.module.default({searchParams:Promise.resolve({view:'private'})});
 assert.equal(privatePage.calls.length,1);assert.deepEqual(privatePage.calls[0].slice(0,3),['private',user.id,user.selected_business_workspace.id]);
 const feed=nodes(privateTree).find(value=>value.type==='PublicCapacityFeed');assert.equal(feed.props.apiPath,'/api/business-workspaces/synthetic-workspace/capacity');
 assert.equal(nodes(privateTree).some(value=>value.type==='PrivateCapacityEntry'),false);
 const denied=page({...user,selected_business_workspace:null});await assert.rejects(denied.module.default({searchParams:Promise.resolve({view:'private'})}),/REDIRECT:\/app\/business\/account/);
 assert.equal(denied.calls.some(value=>value[0]==='private'),false);
});

test('Private entry has explicit account actions and a record-free basemap instead of a feed',()=>{
 const component=load('src/components/private-capacity-entry.tsx',{Link:'Link',Text:'Text',TrackingEntryMap:'TrackingEntryMap',styles:{workspace:'workspace',card:'card',actions:'actions'}});
 const tree=component.PrivateCapacityEntry(),all=nodes(tree),map=all.find(value=>value.type==='TrackingEntryMap');assert.deepEqual(map.props,{});
 assert.deepEqual(all.filter(value=>value.type==='Link').map(value=>value.props.href),['/login?from=shared-capacity','/signup?audience=BUSINESS']);
 assert.deepEqual(all.filter(value=>value.type==='Text').map(value=>value.props.message),['Privately shared with you','Sign in to see vehicles shared with your account.','Sign in','Sign up']);
 assert.equal(all.find(value=>value.type==='section').props['aria-labelledby'],'private-capacity-entry-title');
 assert.doesNotMatch(readFileSync('src/components/private-capacity-entry.tsx','utf8'),/PublicCapacityFeed|fetch\(|apiPath|latitude|longitude/);
});
