import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {obscureCoordinate} from '../src/lib/location-privacy.js';
const root=new URL('../',import.meta.url),env=readFileSync(new URL('.env.local',root),'utf8');
assert.match(env,/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const fixture=JSON.parse(readFileSync(new URL('.local/mobile-phone-fixture.json',root),'utf8'));
assert.match(fixture.email,/^phone-review-\d+@loadgistic\.local$/);
const service=env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1],anon=env.match(/^(?:NEXT_PUBLIC_)?SUPABASE_(?:PUBLISHABLE|ANON)_KEY=(.+)$/m)?.[1];assert.ok(service&&anon);
// Reuse a selected synthetic LOCAL driver fixture. Production, real inboxes and
// application rate-limit configuration are untouched. This is a UI/session-restore
// test; actual email OTP login is covered by verify-mobile-driver-home-local.mjs.
const link=await fetch('http://127.0.0.1:55321/auth/v1/admin/generate_link',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({type:'magiclink',email:fixture.email}),signal:AbortSignal.timeout(15000)});assert.equal(link.status,200);
const generated=await link.json();assert.equal(generated.email,fixture.email);
const verified=await fetch('http://127.0.0.1:55321/auth/v1/verify',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({token_hash:generated.hashed_token,type:'magiclink'}),signal:AbortSignal.timeout(15000)});assert.equal(verified.status,200);
const localSession=await verified.json();let token=localSession.access_token,refresh=localSession.refresh_token;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},permissions:['geolocation'],geolocation:{latitude:9.03,longitude:38.74,accuracy:10}});
await context.addInitScript(value=>{if(!sessionStorage.getItem('loadgistic.fixture.seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',value);sessionStorage.setItem('loadgistic.fixture.seeded','1');}},refresh);
const page=await context.newPage(),errors=[],warnings=[],locations=[];
page.on('pageerror',error=>errors.push(error.name));page.on('console',message=>{if(message.type()==='error'&&message.text().includes('Unexpected text node'))warnings.push('Unexpected text node');});
page.on('request',request=>{if(request.url().includes('/api/mobile/')&&request.headers().authorization)token=request.headers().authorization.replace(/^Bearer /,'');if(request.url().endsWith('/api/mobile/capacity')&&request.method()==='POST'&&request.postDataJSON()?.action==='LOCATION')locations.push(request.postDataJSON());});
const shot=name=>page.screenshot({path:new URL('.local/mobile-driver-map-'+name+'.png',root).pathname});
async function call(path,body){const response=await fetch('http://127.0.0.1:3100/api/mobile/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});assert.ok([200,201].includes(response.status),'Local command '+path+': '+response.status);return response.json();}
async function close(){const dialog=page.getByRole('dialog').last();await dialog.getByRole('button',{name:'Close',exact:true}).first().click();await page.getByRole('dialog').waitFor({state:'hidden',timeout:15000});}
async function save(){const response=page.waitForResponse(response=>response.url().endsWith('/api/mobile/capacity')&&response.request().postDataJSON()?.action==='PUBLISH',{timeout:45000});await page.getByRole('button',{name:'Save capacity',exact:true}).click();assert.equal((await response).status(),200);await page.getByRole('dialog').waitFor({state:'hidden',timeout:15000});}
try{
 await page.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByRole('button',{name:'Update capacity',exact:true}).waitFor({timeout:90000});
 const initial=(await call('capacity')).vehicles.find(item=>item.id===fixture.vehicleId);assert.ok(initial?.current&&initial.canLocate);
 const map=page.getByTestId('driver-home-map'),frame=await map.boundingBox();assert.ok(frame.height>915*.65);
 const groups=['Update capacity','Usual routes','Truck location'];
 for(const removed of ['Coverage','Sharing','Loads'])assert.equal(await map.getByRole('button',{name:removed,exact:true}).count(),0);let lastY=0;
 for(const label of groups){const box=await map.getByRole('button',{name:label,exact:true}).boundingBox();assert.ok(box.x>=frame.x+frame.width-95&&box.y>=frame.y&&box.y+box.height<=frame.y+frame.height,'Right-side floating control stays inside map');assert.ok(box.y>lastY,'Groups stack vertically');lastY=box.y;}
 await shot('phone');
 await page.setViewportSize({width:915,height:412});const landscape=await map.boundingBox();assert.ok(landscape.height>100&&landscape.y+landscape.height<=412);await map.getByRole('button',{name:'Update capacity',exact:true}).scrollIntoViewIfNeeded();assert.ok(await map.getByRole('button',{name:'Update capacity',exact:true}).isVisible());await shot('landscape');await page.setViewportSize({width:412,height:915});
 console.log('PASS: restored real local session, map-dominant phone Home, vertically stacked right rail and bounded landscape layout');
 const canvas=map.locator('canvas');await canvas.waitFor({timeout:45000});await canvas.evaluate(node=>{window.__loadgisticDriverCanvas=node;});
 for(const [label,expected,absent] of [['Update capacity','Where can you take a load?','Loads you accept'],['Truck location','Truck location','Available space']]){
  await map.getByRole('button',{name:label,exact:true}).click();const dialog=page.getByRole('dialog').last();await dialog.getByText(expected,{exact:true}).first().waitFor({timeout:15000});assert.equal(await dialog.getByText(absent,{exact:true}).count(),0);await shot(label==='Update capacity'?'capacity':'location');await close();assert.equal(await canvas.evaluate(node=>node===window.__loadgisticDriverCanvas),true);
 }
 console.log('PASS: each signal group has focused controls; opening/closing unchanged editors retains the map');
 await map.getByRole('button',{name:'Update capacity',exact:true}).click();await page.getByRole('radio',{name:'Private network',exact:true}).click();await save();
 const shared=(await call('capacity')).vehicles.find(item=>item.id===fixture.vehicleId);assert.equal(shared.current.visibility,'PRIVATE');for(const field of ['status','route','boundary','availabilityGeometry','acceptedLoads'])assert.deepEqual(shared.current[field],initial.current[field]);
 await map.getByRole('button',{name:'Update capacity',exact:true}).click();assert.equal(await page.getByRole('radio',{name:'Full or shared',exact:true}).count(),1);await page.getByRole('radio',{name:'Full or shared',exact:true}).click();await save();assert.equal((await call('capacity')).vehicles.find(item=>item.id===fixture.vehicleId).current.acceptedLoads,'BOTH');
 await map.getByRole('button',{name:'Update capacity',exact:true}).click();await page.getByRole('radio',{name:'Partial',exact:true}).click();await save();assert.equal((await call('capacity')).vehicles.find(item=>item.id===fixture.vehicleId).current.status,'PARTIAL');
 await map.getByRole('button',{name:'Update capacity',exact:true}).click();await page.getByRole('radio',{name:'Empty',exact:true}).click();await save();
 const after=await call('capacity');assert.equal(after.vehicles.find(item=>item.id===fixture.vehicleId).current.status,'EMPTY');
 const count=locations.length;await context.setGeolocation({latitude:8.54,longitude:39.27,accuracy:10});const savedLocation=page.waitForResponse(response=>response.url().endsWith('/api/mobile/capacity')&&response.request().postDataJSON()?.action==='LOCATION',{timeout:45000});await map.getByRole('button',{name:'Share truck location',exact:true}).click();assert.equal((await savedLocation).status(),200);assert.equal(locations.length,count+1);const expected=obscureCoordinate(8.54,39.27,20);assert.deepEqual((await call('capacity')).vehicles.find(item=>item.id===fixture.vehicleId).location.coordinate,[expected.lng,expected.lat]);
 console.log('PASS: focused sharing/load/status saves preserve other fields; floating manual location saves only obscured movement');
 const services=await call('regular-service');assert.ok(Array.isArray(services.services));
 await map.getByRole('button',{name:'Usual routes',exact:true}).click();await page.getByText('Show the route or area your transport business usually serves. Set each truck’s current availability separately.',{exact:true}).waitFor();
 if(services.services.length)await page.getByRole('button',{name:'Edit regular service',exact:true}).click();
 await page.getByRole('button',{name:'Save regular service',exact:true}).waitFor({timeout:45000});
 for(const city of ['Addis Ababa','Adama']){const choose=page.getByRole('button',{name:'Choose a city',exact:true}).first();if(await choose.count()){await choose.click();const picker=page.getByRole('dialog').last();await picker.getByRole('textbox',{name:'Search cities',exact:true}).fill(city);await picker.getByRole('button',{name:new RegExp('^'+city+',')}).first().click();await page.getByRole('textbox',{name:'Search cities',exact:true}).waitFor({state:'hidden',timeout:15000});}}
 const regularSaved=page.waitForResponse(response=>response.url().endsWith('/api/mobile/regular-service')&&response.request().method()==='POST',{timeout:45000});await page.getByRole('button',{name:'Save regular service',exact:true}).click();assert.equal((await regularSaved).status(),200);await page.getByRole('dialog').waitFor({state:'hidden',timeout:15000});assert.equal((await call('regular-service')).services.length,1);
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);await shot('final');console.log('PASS: connected provider regular-service editor, zero browser exceptions and zero native-text warnings');
}catch(error){await shot('failure');throw error;}finally{
 try{refresh=await page.evaluate(()=>sessionStorage.getItem('loadgistic.account.refresh.v1'))||refresh;}catch{}
 const revoked=await fetch('http://127.0.0.1:3100/api/mobile/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:token,refreshToken:refresh}),signal:AbortSignal.timeout(15000)});assert.equal(revoked.status,200);await browser.close();
}
