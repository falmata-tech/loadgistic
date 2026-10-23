import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {obscureCoordinate} from '../src/lib/location-privacy.js';
const root=new URL('../',import.meta.url),localEnv=readFileSync(new URL('.env.local',root),'utf8');
assert.match(localEnv,/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},permissions:['geolocation'],geolocation:{latitude:9.03,longitude:38.74,accuracy:10}});
const page=await context.newPage(),errors=[],warnings=[],locations=[];let token='';
page.on('pageerror',error=>errors.push(error.name));page.on('console',message=>{if(message.type()==='error'&&message.text().includes('Unexpected text node'))warnings.push('Unexpected text node');});
page.on('request',request=>{
 if(request.url().includes('/api/mobile/')&&request.headers().authorization) token=request.headers().authorization.replace(/^Bearer /,'');
 if(request.url().endsWith('/api/mobile/capacity')&&request.method()==='POST'){const body=request.postDataJSON();if(body?.action==='LOCATION')locations.push(body);}
});
async function call(path,body,credential=token){const response=await fetch('http://127.0.0.1:3100/api/mobile/'+path,{method:body?'POST':'GET',headers:{...(credential?{Authorization:'Bearer '+credential}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});assert.ok([200,201].includes(response.status),'Local command '+path+': '+response.status);return response.json();}
async function code(email,start){for(let n=0;n<40;n++){const list=await(await fetch('http://127.0.0.1:55324/api/v1/messages')).json();const mail=list.messages.find(item=>new Date(item.Created).getTime()>=start-2000&&item.To?.some(to=>to.Address===email));if(mail){const detail=await(await fetch('http://127.0.0.1:55324/api/v1/message/'+mail.ID)).json();const code=String(detail.Text||detail.HTML||'').match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1];if(code)return code;}await new Promise(resolve=>setTimeout(resolve,250));}throw new Error('Local OTP delivery required');}
const shot=name=>page.screenshot({path:new URL('.local/mobile-driver-home-'+name+'.png',root).pathname});
try{
 await page.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByLabel('Email',{exact:true}).waitFor({timeout:90000});
 const email=`driver-home-${Date.now()}@loadgistic.local`,start=Date.now();
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Send code',exact:true}).click();
 await page.getByLabel('Sign-in code',{exact:true}).waitFor({timeout:30000});await page.getByLabel('Sign-in code',{exact:true}).fill(await code(email,start));await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByLabel('Your name',{exact:true}).waitFor({timeout:45000});
 await page.getByLabel('Your name',{exact:true}).fill('Local Driver Home');await page.getByLabel('Transporter name',{exact:true}).fill('Local Driver Transport');await page.getByLabel('Phone number',{exact:true}).fill('+251900000096');
 await page.getByRole('button',{name:'Self-managed driver',exact:true}).click();await page.getByRole('button',{name:'Create account',exact:true}).click();
 await page.getByTestId('driver-home-map').waitFor({timeout:45000});
 await page.getByText('Add your truck, or ask your fleet owner to assign one, before sharing capacity.',{exact:true}).waitFor({timeout:45000});await shot('unassigned');assert.ok(token);console.log('PASS: local driver OTP/onboarding and empty Home');
 const added=await call('fleet',{action:'ADD_TRUCK',make:'Isuzu',model:'Driver Home GIGA',plate:'DH-'+String(Date.now()).slice(-6),cargoConfiguration:'Medium Box Truck'});assert.ok(added.id);
 await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.getByRole('button',{name:'Update capacity',exact:true}).waitFor({timeout:45000});
 const mapBox=await page.getByTestId('driver-home-map').boundingBox(),updateBox=await page.getByRole('button',{name:'Update capacity',exact:true}).boundingBox();
 assert.ok(mapBox.height>915*.65,'Map occupies the majority of phone Home');
 assert.ok(updateBox.y>=mapBox.y&&updateBox.y+updateBox.height<=mapBox.y+mapBox.height,'Update capacity floats inside map');
 assert.equal(await page.getByText('Recent tracking',{exact:true}).count(),0);
 await page.setViewportSize({width:915,height:412});
 const landscape=await page.getByTestId('driver-home-map').boundingBox(),landscapeButton=await page.getByRole('button',{name:'Update capacity',exact:true}).boundingBox();
 assert.ok(landscape.height>100&&landscape.y+landscape.height<=412,'Landscape map stays within viewport');
 assert.ok(landscapeButton.y>=landscape.y&&landscapeButton.y+landscapeButton.height<=landscape.y+landscape.height,'Landscape floating action stays visible');
 await page.setViewportSize({width:412,height:915});
 console.log('PASS: map dominates phone Home, landscape fits, floating actions remain visible without scrolling');

 await page.getByRole('button',{name:'Update capacity',exact:true}).click();await page.getByRole('dialog').last().getByRole('button',{name:'Share truck location',exact:true}).click();await page.getByText('Approximate location saved.',{exact:true}).waitFor({timeout:45000});
 assert.deepEqual(locations[0],{action:'LOCATION',vehicleId:added.id,approximateLat:obscureCoordinate(9.03,38.74,20).lat,approximateLng:obscureCoordinate(9.03,38.74,20).lng,locationPrecisionKm:20});
 for(const city of ['Addis Ababa','Adama']){await page.getByRole('button',{name:'Choose a city',exact:true}).first().click();const dialog=page.getByRole('dialog').last();await dialog.getByLabel('Search cities',{exact:true}).fill(city);await dialog.getByRole('button',{name:new RegExp('^'+city+',')}).first().click();await page.getByRole('textbox',{name:'Search cities',exact:true}).waitFor({state:'hidden',timeout:10000});}
 const capacitySaved=page.waitForResponse(response=>response.url().endsWith('/api/mobile/capacity')&&response.request().postDataJSON()?.action==='PUBLISH',{timeout:45000});await page.getByRole('button',{name:'Save capacity',exact:true}).click();assert.equal((await capacitySaved).status(),200);await page.getByRole('button',{name:'Save capacity',exact:true}).waitFor({state:'hidden',timeout:45000});await page.getByRole('button',{name:'Update capacity',exact:true}).waitFor({timeout:45000});
 const before=(await call('capacity')).vehicles.find(item=>item.id===added.id);assert.equal(before.current.status,'EMPTY');assert.equal(before.current.visibility,'PRIVATE');assert.equal(before.current.route.length,2);assert.deepEqual(before.location.coordinate,[locations[0].approximateLng,locations[0].approximateLat]);await page.getByTestId('driver-home-map').waitFor();await shot('saved');console.log('PASS: first approximate location and capacity route save/readback');
 // Existing signals open focused groups; the underlying map survives each modal.
 const mapCanvas=page.getByTestId('driver-home-map').locator('canvas');
 await mapCanvas.waitFor({timeout:45000});await mapCanvas.evaluate(node=>{window.__loadgisticDriverCanvas=node;});
 for(const [group,expected,absent] of [['Update capacity','Where can you take a load?','Loads you accept'],['Truck location','Truck location','Available space']]){
  const control=page.getByTestId('driver-home-map').getByRole('button',{name:group,exact:true});
  const frame=await control.boundingBox();assert.ok(frame.y>=mapBox.y&&frame.y+frame.height<=mapBox.y+mapBox.height,'Each group floats inside the phone map');
  await control.click();const modal=page.getByRole('dialog').last();await modal.getByText(expected,{exact:true}).first().waitFor({timeout:15000});assert.equal(await modal.getByText(absent,{exact:true}).count(),0);
  await modal.getByRole('button',{name:'Close',exact:true}).first().click();await modal.getByRole('button',{name:'Close',exact:true}).first().waitFor({state:'hidden',timeout:10000});
  assert.equal(await mapCanvas.evaluate(node=>node===window.__loadgisticDriverCanvas),true,'Closing an unchanged editor retains the map instance');
 }
 // Manual refresh remains available even while Off Duty; only automatic sharing pauses.
 console.log('PASS: simple capacity/location editors, optional load preferences and retained map instance');

 await context.setGeolocation({latitude:8.54,longitude:39.27,accuracy:10});
 // Age only the two location timestamps on this test-created local truck.
 // Advancing the browser's wall clock would also expire its real Auth session.
 assert.match(added.id,/^[0-9a-f-]{36}$/);
 const localKey=localEnv.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1];assert.ok(localKey);
 for(const table of ['vehicle_driver_locations','capacities']){
  const fixture=await fetch('http://127.0.0.1:55321/rest/v1/'+table+'?vehicle_id=eq.'+added.id,{method:'PATCH',headers:{apikey:localKey,Authorization:'Bearer '+localKey,'Content-Type':'application/json'},body:JSON.stringify({[table==='vehicle_driver_locations'?'updated_at':'location_updated_at']:new Date(Date.now()-660000).toISOString()}),signal:AbortSignal.timeout(10000)});
  assert.ok(fixture.ok,'Local synthetic location-age fixture '+table+': '+fixture.status);
 }
 // Register before navigation so an immediate successful refresh cannot be missed.
 const automaticSaved=page.waitForResponse(response=>response.url().endsWith('/api/mobile/capacity')&&response.request().method()==='POST'&&response.request().postDataJSON()?.action==='LOCATION',{timeout:45000});
 await page.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});
 assert.equal((await automaticSaved).status(),200);
 await page.getByRole('button',{name:'Update capacity',exact:true}).waitFor({timeout:45000});
 const after=(await call('capacity')).vehicles.find(item=>item.id===added.id),expected=obscureCoordinate(8.54,39.27,20);
 assert.deepEqual(after.location.coordinate,[expected.lng,expected.lat]);assert.notEqual(after.location.area,before.location.area);assert.deepEqual(after.current,before.current);assert.equal(locations.length,2);await page.getByTestId('driver-home-map').waitFor();await shot('moved');
 await call('capacity',{action:'PUBLISH',vehicleId:added.id,status:'OFF_DUTY',acceptedLoads:'FTL',availabilityGeometry:'ROUTE',currentRoutePlaces:[],capacityAreaCenterPlaceRef:'',capacityAreaBoundaryPlaces:[],acceptsMultiPick:false,acceptsMultiDrop:false});
 await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.getByText('Off Duty · Private network',{exact:true}).waitFor({timeout:45000});
 await page.getByRole('button',{name:'Update capacity',exact:true}).waitFor();assert.equal(locations.length,2);assert.deepEqual(errors,[]);await shot('off-duty');
 console.log('PASS: self-managed driver Home, offset-only automatic movement, preserved capacity/sharing and Off Duty pause');
 const shipment=await call('shipments',{vehicleId:added.id,originPlaceRef:before.current.route[0].placeRef,destinationPlaceRef:before.current.route[1].placeRef,cargoSummary:'Local browser photo-proof check',customerEmail:`driver-proof-${Date.now()}@loadgistic.local`,trackingMode:'STATUS_ONLY'});
 await page.goto('http://localhost:8084/shipment-detail?id='+shipment.id,{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByRole('radio',{name:/^Loading ·/}).waitFor({timeout:45000});await page.getByRole('radio',{name:/^Loading ·/}).click();
 await page.getByLabel('Update note (optional)',{exact:true}).fill('Local loading photo');
 const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose file',exact:true}).click();
 const bytes=readFileSync(new URL('public/icon-192.png',root));
 await(await picker).setFiles({name:'local-driver-loading.png',mimeType:'image/png',buffer:bytes});await page.getByText('local-driver-loading.png',{exact:true}).waitFor();
 const saved=page.waitForResponse(response=>response.url().endsWith('/api/mobile/shipments/'+shipment.id)&&response.request().method()==='POST',{timeout:45000});
 await page.getByRole('button',{name:'Save: Loading',exact:true}).click();assert.equal((await saved).status(),200);
 await page.getByText('Status saved.',{exact:true}).waitFor({timeout:45000});
 const detail=await call('shipments/'+shipment.id);assert.equal(detail.status,'LOADING');const proof=detail.events.find(event=>event.hasProof&&event.status==='LOADING');assert.ok(proof);
 assert.equal((await call('shipments/'+shipment.id+'/proof/'+proof.id)).base64,bytes.toString('base64'));
 await page.getByRole('button',{name:'View photo proof',exact:true}).click();await page.getByRole('button',{name:'Close document',exact:true}).waitFor({timeout:45000});await page.waitForFunction(()=>[...document.querySelectorAll('img')].some(image=>image.src.startsWith('data:image/png')&&image.complete&&image.naturalWidth>1));await shot('photo-proof');await page.getByRole('button',{name:'Close document',exact:true}).click();
 await page.goto('http://localhost:8084/driver-photo',{waitUntil:'domcontentloaded',timeout:90000});
 const portraitPicker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose file',exact:true}).click();await(await portraitPicker).setFiles({name:'local-driver-portrait.png',mimeType:'image/png',buffer:bytes});
 await page.getByRole('switch',{name:'Allow public display of my driver photo',exact:true}).click();await page.getByRole('button',{name:'Save public photo',exact:true}).click();
 await page.getByText('Public photo updated.',{exact:true}).waitFor({timeout:45000});assert.equal((await call('account/portrait')).hasPortrait,true);await shot('portrait');
 assert.deepEqual(errors,[]);
 console.log('PASS: public driver portrait chosen, explicit consent, saved and API readback');
 console.log('PASS: visible Loading status selection/save, real file-picker upload, saved proof bytes, authorized photo reopening and zero browser exceptions. Native Android permissions and camera/device behavior remain separate.');
 // Company drivers start with owner-managed capacity, then acquire/relinquish
 // editing only through the actual owner assignment command.
 const ownerEmail=`driver-home-owner-${Date.now()}@loadgistic.local`,ownerStart=Date.now();
 const ownerHandoff=await call('auth/request',{email:ownerEmail},'');
 let owner=await call('auth/verify',{handoff:ownerHandoff.handoff,code:await code(ownerEmail,ownerStart)},'');
 await call('onboarding',{name:'Local Fleet Owner',businessName:'Local Driver Fleet',phone:'+251900000093',applicationType:'TRANSPORT_COMPANY'},owner.accessToken);
 owner=await call('auth/refresh',{refreshToken:owner.refreshToken},'');
 const companyTruck=await call('fleet',{action:'ADD_TRUCK',make:'Isuzu',model:'Company Driver GIGA',plate:'CD-'+String(Date.now()).slice(-6),cargoConfiguration:'Medium Box Truck'},owner.accessToken);
 const driverEmail=`driver-home-company-${Date.now()}@loadgistic.local`;
 const driver=await call('fleet',{action:'ADD_DRIVER',name:'Local Company Driver',email:driverEmail,phone:'+251900000092'},owner.accessToken);
 const assignment={action:'ASSIGN_DRIVER',driverId:driver.id,vehicleId:companyTruck.id,canManageCapacity:false,canManageTracking:true};
 await call('fleet',assignment,owner.accessToken);
 await page.getByRole('button',{name:'Open menu',exact:true}).click();const loggedOut=page.waitForResponse(response=>response.url().endsWith('/api/mobile/auth/logout')&&response.request().method()==='POST',{timeout:45000});await page.getByRole('button',{name:'Sign out',exact:true}).click();assert.equal((await loggedOut).status(),200);await page.getByRole('dialog').waitFor({state:'hidden',timeout:10000});await page.getByRole('textbox',{name:'Email',exact:true}).waitFor({timeout:45000});
 const driverStart=Date.now();await page.getByRole('textbox',{name:'Email',exact:true}).fill(driverEmail);await page.getByRole('button',{name:'Send code',exact:true}).click();await page.getByLabel('Sign-in code',{exact:true}).waitFor({timeout:45000});await page.getByLabel('Sign-in code',{exact:true}).fill(await code(driverEmail,driverStart));await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Location and availability',exact:true}).waitFor({timeout:45000});await page.getByRole('button',{name:'Location and availability',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Save capacity',exact:true}).count(),0);
 await page.getByRole('dialog').last().getByRole('button',{name:'Share truck location',exact:true}).click();await page.getByText('Approximate location saved.',{exact:true}).waitFor({timeout:45000});await page.getByRole('dialog').last().getByRole('button',{name:'Close',exact:true}).last().click();
 const publication={action:'PUBLISH',vehicleId:companyTruck.id,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',currentRoutePlaces:before.current.route.map(place=>({placeRef:place.placeRef})),capacityAreaCenterPlaceRef:'',capacityAreaBoundaryPlaces:[],acceptsMultiPick:false,acceptsMultiDrop:false};
 await call('capacity',publication,owner.accessToken);await call('fleet',{...assignment,canManageCapacity:true},owner.accessToken);
 await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.getByRole('button',{name:'Update capacity',exact:true}).waitFor({timeout:45000});await page.getByRole('button',{name:'Update capacity',exact:true}).click();await page.getByRole('radio',{name:'Partial',exact:true}).click();const partialSaved=page.waitForResponse(response=>response.url().endsWith('/api/mobile/capacity')&&response.request().postDataJSON()?.action==='PUBLISH',{timeout:45000});await page.getByRole('button',{name:'Save capacity',exact:true}).click();assert.equal((await partialSaved).status(),200);await page.getByRole('button',{name:'Save capacity',exact:true}).waitFor({state:'hidden',timeout:45000});await page.getByRole('button',{name:'Update capacity',exact:true}).waitFor({timeout:45000});
 assert.equal((await call('capacity',undefined,owner.accessToken)).vehicles.find(truck=>truck.id===companyTruck.id).current.status,'PARTIAL');
 await call('fleet',assignment,owner.accessToken);await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.getByRole('button',{name:'Location and availability',exact:true}).waitFor({timeout:45000});await page.getByRole('button',{name:'Location and availability',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Save capacity',exact:true}).count(),0);
 const dutySaved=page.waitForResponse(response=>response.url().endsWith('/api/mobile/capacity')&&response.request().postDataJSON()?.action==='DUTY',{timeout:45000});await page.getByRole('button',{name:'Go Off Duty',exact:true}).click();assert.equal((await dutySaved).status(),200);await page.getByRole('button',{name:'Go Off Duty',exact:true}).waitFor({state:'hidden',timeout:45000});await page.getByText('Off Duty · Private network',{exact:true}).waitFor({timeout:45000});assert.equal((await call('capacity',undefined,owner.accessToken)).vehicles.find(truck=>truck.id===companyTruck.id).current.status,'OFF_DUTY');
 await page.getByTestId('driver-home-map').waitFor();await shot('company-driver');assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
 console.log('PASS: new company driver email-code login, first Home/location bootstrap, owner publication, granted capacity editing, Partial save, live permission revocation and restricted-driver Off Duty persisted.');
 await call('auth/logout',{accessToken:owner.accessToken,refreshToken:owner.refreshToken},'');

} catch(error){await shot('failure');console.error('Driver Home alerts:',await page.getByRole('alert').allTextContents());throw error;}finally{await browser.close();}
