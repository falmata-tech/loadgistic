import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_SITE_ORIGIN,PUBLIC_SITEMAP_PATHS,isPublicSearchEnvironment,publicPageMetadata,publicRobots,publicSitemap,searchRobots,seoResponseHeaders} from '../src/lib/seo.js';
const production={NODE_ENV:'production',VERCEL_ENV:'production',APP_URL:'https://loadgistic.com'};
test('only the exact configured Production site permits search indexing',()=>{
 assert.equal(isPublicSearchEnvironment(production),true);
 assert.equal(isPublicSearchEnvironment({...production,CONTEXT:'production'}),true);
 for(const context of ['deploy-preview','branch-deploy','dev','unknown'])assert.equal(isPublicSearchEnvironment({...production,CONTEXT:context}),false);
 for(const environment of [{},{...production,NODE_ENV:'development'},{...production,VERCEL_ENV:'preview'},{...production,APP_URL:''},{...production,APP_URL:'https://preview.test'},{...production,APP_URL:'https://loadgistic.com?token=private'},{...production,APP_URL:'https://user:secret@loadgistic.com'},{...production,APP_URL:'http://loadgistic.com'}]){
  assert.equal(isPublicSearchEnvironment(environment),false);assert.equal(searchRobots({environment}).index,false);assert.deepEqual(publicSitemap(environment),[]);assert.deepEqual(publicRobots(environment),{rules:{userAgent:'*',disallow:'/'}});
 }
});
test('public sitemap contains only fixed public canonicals without database, fixture or private entries',()=>{
 const sitemap=publicSitemap(production);assert.deepEqual(sitemap.map(row=>row.url),PUBLIC_SITEMAP_PATHS.map(path=>PUBLIC_SITE_ORIGIN+path));
 assert.deepEqual(PUBLIC_SITEMAP_PATHS,['/','/about','/featured','/privacy','/terms']);
 const text=JSON.stringify(sitemap);for(const value of ['@','providers','tracking','track/','shared-capacity','email','token','app/','admin','support','api/','example.test','lastModified'])assert.equal(text.includes(value),false,value);
 assert.deepEqual(publicRobots(production),{rules:{userAgent:'*',allow:'/',disallow:'/api/'},sitemap:PUBLIC_SITE_ORIGIN+'/sitemap.xml'});
});
test('private and filtered Capacity metadata never reflects submitted values or credentials',()=>{
 const base={path:'/',title:'Truck capacity',description:'Public capacity',environment:production};
 assert.deepEqual(publicPageMetadata(base).robots,{index:true,follow:true});
 const filtered=publicPageMetadata({...base,query:{q:'PRIVATE_SURNAME',nearLat:'12.345678',token:'PRIVATE_TOKEN'}});
 assert.equal(filtered.robots.index,false);assert.equal(filtered.robots.follow,true);assert.equal(filtered.alternates.canonical,PUBLIC_SITE_ORIGIN+'/');
 const privateView=publicPageMetadata({...base,privateView:true,query:{view:'private',email:'PRIVATE_EMAIL'}});
 assert.deepEqual(privateView.robots,{index:false,follow:false,nosnippet:true,noimageindex:true});assert.equal(privateView.alternates.canonical,null);assert.equal('openGraph'in privateView,false);assert.equal('twitter'in privateView,false);
 for(const value of [filtered,privateView])for(const marker of ['PRIVATE_SURNAME','12.345678','PRIVATE_TOKEN','PRIVATE_EMAIL'])assert.equal(JSON.stringify(value).includes(marker),false);
});
test('public handle metadata uses only the public route and never creates arbitrary canonicals',()=>{
 const data=publicPageMetadata({path:'/@public-provider',title:'Transport Provider',description:'Public profile',environment:production});assert.equal(data.alternates.canonical,PUBLIC_SITE_ORIGIN+'/@public-provider');
 for(const path of ['/track/private-id','/app/home','https://other.test','//other.test','/?email=private','/@handle?token=secret','/@<script>'])assert.throws(()=>publicPageMetadata({path,title:'Profile',description:'Public',environment:production}),/INVALID_PUBLIC_CANONICAL/);
});
test('private HTML and APIs get noindex independently of robots.txt crawling preferences',()=>{
 const rules=seoResponseHeaders(production);for(const path of ['app','admin','support','track','shared-capacity','login','apply','signup','join-fleet','workspaces','delete-account','help','brokerage','api'])assert.equal(rules.some(row=>row.source===`/${path}/:path*`&&row.headers[0].value.includes('noindex')),true,path);
 assert.equal(rules.some(row=>row.source==='/'&&row.has?.some(item=>item.type==='query'&&item.key==='view'&&item.value==='private')),true);
 assert.deepEqual(seoResponseHeaders({NODE_ENV:'development'}),[{source:'/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow, nosnippet, noimageindex'}]}]);
});
