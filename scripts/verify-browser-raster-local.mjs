// FEAT-MOB-001: reproduce an unhandled recorder side-promise, then prove the
// browser raster port isolates it. Real Request/XHR streaming, local PNG only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url),env=readFileSync(new URL('.env.local',root),'utf8');
assert.ok(/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m.test(env),'Loadgistic local backend required');
const key=name=>env.match(new RegExp('^'+name+'=(.+)$','m'))?.[1];
const admin=createClient('http://127.0.0.1:55321',key('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const anon=key('NEXT_PUBLIC_SUPABASE_ANON_KEY')||key('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')||key('SUPABASE_ANON_KEY');assert.ok(anon);
const png=readFileSync(new URL('public/favicon-32.png',root));
let mode='success',slow=false;
const stats={requests:0,closedAfterHeaders:0,httpErrors:0,decodeErrors:0};
const server=createServer((request,response)=>{
 if(request.method!=='GET'||!/^\/tile\/\d+\/\d+\/\d+\.png$/.test(request.url)){response.writeHead(404).end();return;}
 if(++stats.requests>1024){response.writeHead(429).end();return;}
 const failure=mode==='http',body=mode==='decode'?Buffer.from('Synthetic invalid PNG'):png;
 if(failure)stats.httpErrors++;if(mode==='decode')stats.decodeErrors++;
 response.writeHead(failure?503:200,{'content-type':'image/png','content-length':body.length,'access-control-allow-origin':'*','cache-control':'no-store'});
 const split=Math.min(60,body.length);response.write(body.subarray(0,split));
 const timer=setTimeout(()=>response.end(body.subarray(split)),slow?900:10);
 response.on('close',()=>{clearTimeout(timer);if(!response.writableEnded)stats.closedAfterHeaders++;});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try {
 for(const scenario of ['recorder-before','repaired','http','decode']){
  mode='success';slow=false;
  const login=createClient('http://127.0.0.1:55321',anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const link=await admin.auth.admin.generateLink({type:'magiclink',email:'falmatad97+lg-driver@gmail.com'});assert.equal(link.error,null);
  const verified=await login.auth.verifyOtp({type:'magiclink',token_hash:link.data.properties.hashed_token});assert.equal(verified.error,null);
  const context=await browser.newContext({viewport:{width:1248,height:818},deviceScaleFactor:2});context.setDefaultTimeout(15000);
  let rewrites=0;
  try {
   if(scenario==='recorder-before')await context.route(url=>url.origin==='http://localhost:8084'&&url.pathname.endsWith('.bundle'),async route=>{
    const response=await route.fetch(),body=await response.text();
    const changed=body.replaceAll('loadgistic-osm://{z}/{x}/{y}.png','https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    if(changed!==body)rewrites++;
    await route.fulfill({response,body:changed});
   });
   await context.route('https://tile.openstreetmap.org/**',async route=>{
    // A pre-header cancellation preserves the native abortTile creation stack;
    // Blink's cloned-body abort may instead produce a stackless DOMException.
    // The repaired case separately requires actual after-header body aborts.
    if(scenario==='recorder-before')await new Promise(resolve=>setTimeout(resolve,600));
    const path=new URL(route.request().url()).pathname;
    try{await route.fulfill({status:302,headers:{location:`http://127.0.0.1:${server.address().port}/tile${path}`,'access-control-allow-origin':'*'}});}catch(error){if(!route.request().failure()&&context.pages().length)throw error;}
   });
   await context.addInitScript(token=>{
    if(!sessionStorage.getItem('loadgistic.fixture.seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',token);sessionStorage.setItem('loadgistic.fixture.seeded','1');}
    const fixture={tileFetchCalls:0,unhandled:[],tileAbortStack:false};window.__recorderFixture=fixture;
    window.addEventListener('unhandledrejection',event=>{fixture.unhandled.push(event.reason?.name||'Unknown');if(event.reason?.stack?.includes('abortTile'))fixture.tileAbortStack=true;});
    const nativeFetch=window.fetch.bind(window);
    window.fetch=function(input,init){
     const promise=nativeFetch(input,init),url=typeof input==='string'?input:input.url;
     if(/^https:\/\/tile\.openstreetmap\.org\//.test(url)){
      fixture.tileFetchCalls++;
      // Intentionally broken recording hook: return the original fetch promise,
      // but leave this response/body observer branch without a rejection handler.
      // Read only public synthetic tile bytes; never observe account/API payloads.
      void promise.then(response=>response.clone().arrayBuffer());
     }
     return promise;
    };
   },verified.data.session.refresh_token);
   const page=await context.newPage(),errors=[];
   page.on('console',message=>{if(message.type()==='error')errors.push(/AbortError|signal is aborted/.test(message.text())?'AbortError':message.text().includes('unsafe header')?'Unsafe response header':'Console error');});
   page.on('pageerror',error=>errors.push(error.name));
   await page.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});
   const home=page.getByTestId('driver-home-map'),canvas=home.locator('canvas');
   await canvas.waitFor({state:'attached',timeout:90000});await page.getByRole('button',{name:'Update capacity',exact:true}).waitFor({state:'attached',timeout:45000});
   await page.waitForTimeout(1300);
   const before={...stats};
   if(scenario==='recorder-before'||scenario==='repaired'){
    slow=true;
    for(let index=0;index<6;index++){
     if(scenario==='recorder-before'&&await page.evaluate(()=>window.__recorderFixture.unhandled.length>0))break;
     try{await canvas.dblclick({position:{x:80,y:400}});}catch(error){if(scenario!=='recorder-before'||!await page.evaluate(()=>window.__recorderFixture.unhandled.length>0))throw error;break;}
     await page.waitForTimeout(1100);
    }
    await page.waitForTimeout(1100);
    if(scenario==='recorder-before'){
     assert.ok(rewrites>0,'Require the original HTTPS raster path in the controlled baseline');
     await page.waitForFunction(()=>window.__recorderFixture.unhandled.length>0,null,{timeout:15000});
     assert.equal(await page.evaluate(()=>window.__recorderFixture.tileAbortStack),true,'Reproduce the owner\'s raster abortTile stack');
     await page.screenshot({path:new URL('.local/map-recorder-before.png',root).pathname});
     console.log('PASS: reproduced uncaught raster abortTile exception from a recording side-promise despite the raster catch fix');
    }else{
     assert.ok(stats.closedAfterHeaders>before.closedAfterHeaders,'Require new real after-header cancellations from this click sequence');
     assert.equal(await page.evaluate(()=>window.__recorderFixture.tileFetchCalls),0);
     const areas=page.getByRole('tablist',{name:'Switch view'});
     await areas.getByRole('tab',{name:'Marketplace',exact:true}).click();await page.getByRole('textbox',{name:'Search transporters'}).waitFor();
     await areas.getByRole('tab',{name:'My workspace',exact:true}).click();await home.waitFor();
     await page.waitForTimeout(500);
     assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.__recorderFixture.unhandled),[]);
     assert.equal(await page.getByText('Map tiles could not load. The reported area and update time are shown above.',{exact:true}).count(),0);
     await page.screenshot({path:new URL('.local/map-recorder-repaired.png',root).pathname});
     console.log(`PASS: desktop HiDPI driver Home click zoom and area return; ${stats.closedAfterHeaders-before.closedAfterHeaders} real body cancellations; recorder remains enabled with no tile side-promises or overlay`);
    }
   }else{
    mode=scenario;
    for(let index=0;index<5;index++){await canvas.press('Shift+ArrowRight');await page.waitForTimeout(200);}
    await page.getByText('Map tiles could not load. The reported area and update time are shown above.',{exact:true}).waitFor({timeout:15000});
    assert.ok(stats[scenario==='http'?'httpErrors':'decodeErrors']>before[scenario==='http'?'httpErrors':'decodeErrors']);
    assert.deepEqual(await page.evaluate(()=>window.__recorderFixture.unhandled),[]);
    console.log(`PASS: genuine ${scenario==='http'?'HTTP':'invalid-image'} failure still reaches the visible driver map feedback`);
   }
  }finally {await login.auth.signOut({scope:'local'});await context.close();}
 }
}finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
