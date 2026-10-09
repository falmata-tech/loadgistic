import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url),env=readFileSync(new URL('.env.local',root),'utf8');
assert.match(env,/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const key=name=>env.match(new RegExp('^'+name+'=(.+)$','m'))?.[1];
const admin=createClient('http://127.0.0.1:55321',key('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const anon=key('NEXT_PUBLIC_SUPABASE_ANON_KEY')||key('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')||key('SUPABASE_ANON_KEY');assert.ok(anon);
const browser=await chromium.launch({headless:true});
try{for(const [email,kind] of [['falmatad97@gmail.com','owner'],['falmatad97+lg-driver@gmail.com','driver']]){
 const login=createClient('http://127.0.0.1:55321',anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const link=await admin.auth.admin.generateLink({type:'magiclink',email});assert.equal(link.error,null);
 const verified=await login.auth.verifyOtp({type:'magiclink',token_hash:link.data.properties.hashed_token});assert.equal(verified.error,null);const session=verified.data.session;
 const context=await browser.newContext({viewport:{width:412,height:915}});const errors=[];
 await context.addInitScript(token=>{if(!sessionStorage.getItem('loadgistic.fixture.seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',token);sessionStorage.setItem('loadgistic.fixture.seeded','1');}},session.refresh_token);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.name));
 page.on('console',message=>{if(message.type()==='error')errors.push(/AbortError|signal is aborted/.test(message.text())?'Native raster AbortError':'Native console error');});
 try{
  await page.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});
  if(kind==='owner'){
   await page.getByRole('button',{name:'Add driver',exact:true}).waitFor({timeout:90000});assert.equal(await page.getByTestId('driver-home-map').count(),0);
   assert.ok(await page.getByRole('button',{name:'Edit truck',exact:true}).count()>0);assert.equal(await page.getByRole('tab',{name:'Fleet',exact:true}).count(),0);
   await page.screenshot({path:new URL('.local/workspace-owner-home-mobile.png',root).pathname});
   await page.getByText('Drivers',{exact:true}).scrollIntoViewIfNeeded();assert.equal(await page.getByText('Drivers',{exact:true}).isVisible(),true);
   await page.screenshot({path:new URL('.local/workspace-owner-drivers-mobile.png',root).pathname});
  }else{
   const map=page.getByTestId('driver-home-map');await map.waitFor({timeout:90000});await page.getByRole('button',{name:'Update capacity',exact:true}).waitFor({timeout:45000});await map.locator('canvas').waitFor({timeout:45000});
   assert.ok((await map.boundingBox()).height>915*.65);for(const label of ['Update capacity','Truck location'])assert.equal(await map.getByRole('button',{name:label,exact:true}).isVisible(),true);
   assert.equal(await page.getByRole('button',{name:'Add driver',exact:true}).count(),0);await page.screenshot({path:new URL('.local/workspace-driver-home-mobile.png',root).pathname});
   await map.locator('canvas').evaluate(node=>{window.__homeCanvas=node;});const switcher=page.getByRole('tablist',{name:'Switch view'});
   await switcher.getByRole('tab',{name:'Marketplace',exact:true}).click();await page.getByRole('textbox',{name:'Search transporters'}).waitFor({timeout:30000});
   await switcher.getByRole('tab',{name:'My workspace',exact:true}).click();await map.waitFor();assert.equal(await map.locator('canvas').evaluate(node=>node===window.__homeCanvas),true);
  }
  assert.deepEqual(errors,[]);console.log('PASS: actual local '+kind+' account Home and permitted controls');
  // Same identities on web: no email or business records are changed.
  const web=await browser.newContext({viewport:{width:412,height:915}});
  try{
   await web.addCookies(createChunks('sb-127-auth-token','base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')).map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax'})));
   const webPage=await web.newPage();webPage.on('pageerror',error=>errors.push(error.name));
   webPage.on('console',message=>{if(message.type()==='error')errors.push('Web console error');});
   await webPage.goto('http://127.0.0.1:3100/app/home',{waitUntil:'domcontentloaded',timeout:90000});
   if(kind==='owner'){await webPage.getByRole('heading',{name:'My Fleet',exact:true}).waitFor({timeout:45000});assert.equal(await webPage.locator('.fleet-truck-row').count()>0,true);assert.equal(await webPage.locator('.mobile-nav a[href="/app/fleet"]').count(),0);}
   else{await webPage.locator('.capacity-home-page .leaflet-container').waitFor({timeout:45000});assert.equal(await webPage.locator('.fleet-team').count(),0);}
   assert.deepEqual(errors,[]);await webPage.screenshot({path:new URL(`.local/workspace-${kind}-home-web-phone.png`,root).pathname});console.log('PASS: web '+kind+' Home uses its correct existing workspace');
  }finally{await web.close();}
 }catch(error){await page.screenshot({path:new URL(`.local/workspace-${kind}-home-failure.png`,root).pathname});throw error;}finally{await login.auth.signOut({scope:'local'});await context.close();}
}}finally{await browser.close();}
