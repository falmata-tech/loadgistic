import {test,expect} from './browser-test';
import {closeCapacityFilters} from './capacity-drawer-helper';
import {auditAssignAndPublishSelfDrivenVehicle,auditDeleteVehicles,auditProvider,checked,localAuditService} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {addProviderRegularCapacity,publishProviderCapacity} from '../../src/lib/provider-capacity.js';

test('JAC X200 shared Dire Dawa–Shinile leg keeps Capacity and corridor routes separately tappable',async({page}:{page:any},info:any)=>{
  test.setTimeout(120000);
  const service=localAuditService(),actor=await auditProvider(service,'shared-route');let vehicleId='';
  try{
  const rows=checked(await service.from('place_catalog').select('id,name,latitude,longitude').in('normalized_name',['dire dawa','shinile','melka jebdu','dengego']));
  const place=(name:string)=>{const found=rows.find((row:{name:string})=>row.name===name);expect(found,`local ${name} place fixture`).toBeTruthy();return found;};
  const city=[place('Dire Dawa'),place('Shinile'),place('Melka Jebdu'),place('Dengego')];
  checked(await service.from('company_pages').update({published:true,headline:'Regional freight from Dire Dawa',about:'Independent driver serving Dire Dawa, Shinile, Melka Jebdu and Dengego.'}).eq('provider_profile_id',actor.provider_profile_id));
  vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'JAC',model:'X200',plate:`SHARED-${actor.suffix}`,cargoConfiguration:'Mini Box Truck',trailerInterchangeable:false})).id;
  await auditAssignAndPublishSelfDrivenVehicle(service,actor,vehicleId);
  await publishProviderCapacity(actor,{vehicleId,status:'PARTIAL',acceptedLoads:'PTL',availabilityGeometry:'ROUTE',visibility:'OPEN',locationSource:'DEVICE_OBSCURED',approximateLat:city[0].latitude+.005,approximateLng:city[0].longitude+.005,locationPrecisionKm:3,currentRoutePlaces:city.slice(0,2).map(row=>({placeRef:row.id}))});
  const regularId=await addProviderRegularCapacity(actor,{vehicleId,expectedDriverId:actor.id,geometry:'ROUTE',routePlaces:city.map(row=>({placeRef:row.id})),areaCenterPlaceRef:'',areaBoundaryPlaces:[]});
  const response=await page.request.get(`/api/public/capacity?provider=${encodeURIComponent(`shared-route-${actor.suffix}`)}&status=PARTIAL`);expect(response.ok()).toBe(true);const data=await response.json();
  const truck=data.items.find((item:{vehicle_id:string})=>item.vehicle_id===vehicleId);
  expect(truck,'disposable current truck has real published geometry').toBeTruthy();expect(truck.current_route_points[1].label).toMatch(/^Shinile,/);expect(truck.recurring_corridors).toHaveLength(1);expect(truck.recurring_corridors[0].id).toBe(regularId);
  const saved=checked(await service.from('profile_routes').select('assigned_vehicle_id,assigned_driver_user_id').eq('id',regularId).single());expect(saved).toEqual({assigned_vehicle_id:vehicleId,assigned_driver_user_id:actor.id});
  const loaded=page.waitForResponse((r:any)=>r.url().includes('/api/public/capacity?'));
  await page.goto(`/?status=PARTIAL&truck=${encodeURIComponent(truck.id)}`);await loaded;
  await closeCapacityFilters(page);
  await expect(page.locator('.map-current-route')).toHaveAttribute('stroke','#667085');
  // Selection now fits the complete regular route too. Inspect the shared leg
  // at street scale, where both strokes have room beside the info bubbles.
  await page.locator('.leaflet-control-zoom-in').click();
  await page.locator('.leaflet-control-zoom-in').click();
  // A shorter phone canvas fits the complete service at a smaller initial
  // scale. Establish a real street-scale leg before choosing stroke hit points;
  // the truck marker may otherwise cover most of this short route.
  for(let step=0;step<4;step++){
    await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
    const length=await page.locator('.map-current-route').evaluate((path:SVGPathElement)=>path.getTotalLength()*Math.hypot(path.getScreenCTM()!.a,path.getScreenCTM()!.b));
    if(length>=200)break;
    await page.locator('.leaflet-control-zoom-in').click();
  }
  for(let zoom=0;zoom<2;zoom++){
    if(zoom){
      // Search keeps its complete result set; zoom must change geometry, not refetch it.
      const before=await page.locator('.map-current-route').getAttribute('d');
      await page.locator('.leaflet-control-zoom-in').click();
      await expect(page.locator('.map-current-route')).not.toHaveAttribute('d',before!);
    }
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
    await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
    {
      // Keep the shared leg in the open map after fitting the complete service.
      const map=await page.locator('.public-map-canvas').boundingBox(),line=await page.locator('.map-current-route').boundingBox();
      const dx=map.x+map.width*.5-line.x-line.width/2,dy=map.y+map.height*.65-line.y-line.height/2;
      const start={x:map.x+map.width*.2,y:map.y+map.height*.5};
      const pane=page.locator('.leaflet-map-pane');const before=await pane.getAttribute('style');
      if(info.project.name.includes('mobile')){
        const touch=await page.context().newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
        for(let i=1;i<=8;i++){
          await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*i/8,y:start.y+dy*i/8}]});
          await page.evaluate(()=>new Promise(requestAnimationFrame));
        }
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
      }else{
        await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dx,start.y+dy,{steps:8});await page.mouse.up();
      }
      await expect(pane).not.toHaveAttribute('style',before!);
      await expect(page.locator('.leaflet-pan-anim')).toHaveCount(0);
      await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
    }
    // Read hit points only after Leaflet's pan/zoom inertia and markers settle.
    let lastMatrix='',stableFrames=0;
    await expect.poll(async()=>{const value=await page.locator('.map-current-route').evaluate((el:SVGPathElement)=>JSON.stringify([el.getAttribute('d'),el.getScreenCTM()]));stableFrames=value===lastMatrix?stableFrames+1:0;lastMatrix=value;return stableFrames;},{intervals:[150,150,150,150]}).toBeGreaterThanOrEqual(3);
    const geometry=await page.evaluate(()=>{
      const current=document.querySelector<SVGPathElement>('.map-current-route')!,regular=document.querySelector<SVGPathElement>('.map-regular-corridor')!;
      const map=document.querySelector('.public-map-canvas')!.getBoundingClientRect();
      const at=(path:SVGPathElement,t:number)=>path.getPointAtLength(path.getTotalLength()*t).matrixTransform(path.getScreenCTM()!);
      const exposed=(path:SVGPathElement,p:{x:number;y:number})=>p.x>map.left+15&&p.x<map.right-15&&p.y>map.top+15&&p.y<map.bottom-15&&document.elementFromPoint(p.x,p.y)===path;
      const brown=Array.from({length:1201},(_,i)=>at(regular,i/1200));
      const samples=Array.from({length:25},(_,i)=>{
        const yellow=at(current,.2+i*.6/24);
        const nearest=brown.reduce((best,p)=>Math.hypot(p.x-yellow.x,p.y-yellow.y)<Math.hypot(best.x-yellow.x,best.y-yellow.y)?p:best);
        // Touch coordinates are rounded by the browser. Avoid a fractional
        // hit at the very end of a dash that rounds into its transparent gap.
        const yellowPixel={x:Math.round(yellow.x),y:Math.round(yellow.y)},brownPixel={x:Math.round(nearest.x),y:Math.round(nearest.y)};
        return{distance:Math.hypot(nearest.x-yellow.x,nearest.y-yellow.y),yellow:yellowPixel,brown:brownPixel,bothExposed:exposed(current,yellowPixel)&&exposed(regular,brownPixel)};
      });
      return{minimum:Math.min(...samples.map(s=>s.distance)),target:samples.find(s=>s.bothExposed)};
    });
    // SVG rounding may consume a pixel of the 12px model clearance.
    expect(geometry.minimum,'separation along the shared leg, not an unrelated exposed segment').toBeGreaterThanOrEqual(10);
    expect(geometry.target,'both shared strokes need an unobscured test point').toBeTruthy();
    for(const [selector,key,label] of [['.map-current-route','yellow','Capacity route'],['.map-regular-corridor','brown','Preferred corridor']]){
      const cameraBefore=await page.locator('.leaflet-proxy').getAttribute('style');
      const point=geometry.target[key];
      if(info.project.name.includes('mobile'))await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
      const panel=page.getByRole('dialog');
      await expect(panel.locator('header>strong')).toHaveText(label);
      await panel.getByRole('button',{name:'Close map signal details'}).click();
      await expect(page.locator('.leaflet-proxy'),'signal inspection must not become a double-tap zoom').toHaveAttribute('style',cameraBefore!);
      await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
    }
    await page.mouse.move(0,0);
    await page.screenshot({path:info.outputPath(`actual-shared-leg-${zoom}.png`),scale:'css'});
  }
  // Consume inspection gestures only; ordinary background double-tap remains usable.
  const background=await page.evaluate(()=>{
    const box=document.querySelector('.public-map-canvas')!.getBoundingClientRect();
    for(const fx of [.2,.4,.6,.8])for(const fy of [.3,.5,.7,.8]){
      const point={x:Math.round(box.left+box.width*fx),y:Math.round(box.top+box.height*fy)};
      const target=document.elementFromPoint(point.x,point.y);
      if(target?.closest('.leaflet-container')&&!target.closest('.leaflet-interactive,.leaflet-control,.leaflet-marker-icon,.map-info-bubble'))return point;
    }
    return null;
  });
  expect(background,'a real unobscured background zoom target').toBeTruthy();
  const zoomScale=()=>page.locator('.leaflet-proxy').evaluate((element:HTMLElement)=>Number(element.style.transform.match(/scale\(([\d.]+)\)/)?.[1]));
  const beforeBackground=await zoomScale();expect(beforeBackground).toBeGreaterThan(0);expect(beforeBackground).toBeLessThan(16384);
  if(info.project.name.includes('mobile')){await page.touchscreen.tap(background!.x,background!.y);await page.touchscreen.tap(background!.x,background!.y);}
  else await page.mouse.dblclick(background!.x,background!.y);
  await expect.poll(zoomScale).toBe(beforeBackground*2);
  }finally{
    const routes=checked(await service.from('profile_routes').select('id').eq('provider_profile_id',actor.provider_profile_id));
    const capacities=vehicleId?checked(await service.from('capacities').select('id').eq('vehicle_id',vehicleId)):[];
    const ids=[vehicleId,...routes.map((row:{id:string})=>row.id),...capacities.map((row:{id:string})=>row.id)].filter(Boolean);
    if(ids.length)checked(await service.from('audit_logs').delete().in('entity_id',ids));
    checked(await service.from('profile_routes').delete().eq('provider_profile_id',actor.provider_profile_id));
    if(vehicleId){checked(await service.from('capacities').delete().eq('vehicle_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
    checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));
  }
});
