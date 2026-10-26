import {test,expect} from './browser-test';
import {closeCapacityFilters} from './capacity-drawer-helper';
import {randomUUID} from 'node:crypto';

// Renderer stress fixture only: the local server supplies the selected truck;
// its viewport response gets coincident geometry. No stored geography is changed.
test('coincident closed areas and routes remain separately tappable through zoom',async({page}:{page:any},info:any)=>{
  test.setTimeout(90000);
  const initial=await page.request.get('/api/public/capacity');
  expect(initial.status(),'PUBLIC_CAPACITY_INITIAL_HTTP_STATUS').toBe(200);
  expect(initial.headers()['content-type']||'','PUBLIC_CAPACITY_INITIAL_CONTENT_TYPE').toContain('application/json');
  const data=await initial.json();
  expect(Array.isArray(data?.items),'PUBLIC_CAPACITY_INITIAL_ITEMS_ARRAY').toBe(true);
  const located=data.items.filter((item:{location_lat:number|null;location_lng:number|null})=>item.location_lat!=null&&item.location_lng!=null);
  expect(located.length,`PUBLIC_CAPACITY_LOCATED_ITEMS of ${data.items.length}`).toBeGreaterThan(0);
  const original=located[0];
  const lat=Number(original.location_lat),lng=Number(original.location_lng);
  const points=Array.from({length:5},(_,i)=>({lat:lat+Math.sin(i*Math.PI*2/5)*.17,lng:lng+Math.cos(i*Math.PI*2/5)*.17,label:`Test boundary ${i+1}`,place_ref:`test-${i}`}));
  const rendererId=randomUUID();let routeMode=false;
  await page.route('**/api/public/capacity?**',(route:any)=>{
    const loop=[...points,points[0]],reverseLoop=[...loop].reverse();
    const truck={...original,id:rendererId,provider_name:'Synthetic overlap renderer',status:'EMPTY',current_signal_geometry_visible:true,location_precision_km:20,work_radius_km:20,
      availability_geometry:routeMode?'ROUTE':'RADIUS',capacity_area_boundary:routeMode?[]:points,current_route_points:routeMode?loop:[],
      recurring_corridors:[{id:'overlap-renderer-fixture',geometry:routeMode?'ROUTE':'RADIUS',area_boundary:[...points].reverse(),route_points:reverseLoop,area_center_label:'Synthetic overlap test'}]};
    return route.fulfill({json:{items:[truck],hasMore:false,nextCursor:null}});
  });
  for(const mode of ['area','closed-route']){
    routeMode=mode==='closed-route';
    // A distinct renderer identity cannot reuse the initial Leaflet marker's
    // immutable title. Verify the viewport fixture before selecting its marker.
    const loaded=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/public/capacity'&&response.request().method()==='GET');
    await page.goto('/',{waitUntil:'domcontentloaded'});
    const response=await loaded;expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({items:[{id:rendererId,provider_name:'Synthetic overlap renderer',availability_geometry:routeMode?'ROUTE':'RADIUS'}],hasMore:false,nextCursor:null});
    await closeCapacityFilters(page);
    await page.locator('.capacity-truck-map-marker[title*="Synthetic overlap renderer"]').click();
    await closeCapacityFilters(page);
    await expect(page.locator('.map-regular-corridor')).toHaveAttribute('aria-label',/Test boundary/);
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:20000});
    const current=mode==='area'?'.map-service-area':'.map-current-route';
    await expect(page.locator(current)).toBeVisible();
    for(let zoom=0;zoom<2;zoom++){
      if(zoom){
        // Search keeps its complete result set; zoom must change geometry, not refetch it.
        const before=await page.locator(current).getAttribute('d');
        await page.locator('.leaflet-control-zoom-in').click();
        await expect(page.locator(current)).not.toHaveAttribute('d',before!);
        await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
      }
      if(info.project.name.includes('mobile')){
        // Collapse details and pan the boundary into the open map on a phone.
        const map=await page.locator('.public-map-canvas').boundingBox(),line=await page.locator(current).boundingBox();
        const start={x:map.x+map.width*.5,y:map.y+map.height*.5};
        const dx=map.x+map.width*.35-line.x,dy=map.y+map.height*.55-line.y-line.height/2;
        const pane=page.locator('.leaflet-map-pane'),before=await pane.getAttribute('style');
        const touch=await page.context().newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
        for(let i=1;i<=8;i++){
          await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*i/8,y:start.y+dy*i/8}]});
          await page.evaluate(()=>new Promise(requestAnimationFrame));
        }
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
        await expect(pane).not.toHaveAttribute('style',before!);await expect(page.locator('.leaflet-pan-anim')).toHaveCount(0);
      }
      for(const [selector,label] of [[current,mode==='area'?'Area':'Route'],['.map-regular-corridor',mode==='area'?'Preferred area':'Preferred corridor'],['.map-location-privacy-circle','approximate location']]){
        const signal=page.locator(selector);
        await expect.poll(()=>signal.evaluate(async(element:SVGPathElement)=>{
          const signature=()=>{const m=element.getScreenCTM();return JSON.stringify([element.getAttribute('d'),m?.a,m?.d,m?.e,m?.f]);};
          const before=signature();
          await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
          return before===signature()&&!document.querySelector('.leaflet-zoom-anim');
        })).toBe(true);
        // Choose an actual exposed stroke point, not a bounding-box center or
        // forced click; card/controls must not obscure the candidate.
        const point=await signal.evaluate((element:SVGPathElement)=>{
          const path=element as SVGPathElement,length=path.getTotalLength(),matrix=path.getScreenCTM()!;
          const map=document.querySelector('.public-map-canvas')!.getBoundingClientRect();
          for(let i=0;i<300;i++){
            const raw=path.getPointAtLength(length*i/300).matrixTransform(matrix);
            const p={x:Math.round(raw.x),y:Math.round(raw.y)};
            if(p.x<map.left+15||p.x>map.right-15||p.y<map.top+15||p.y>map.bottom-15)continue;
            if(document.elementFromPoint(p.x,p.y)===element)return{x:p.x,y:p.y};
          }
          return null;
        });
        expect(point,`${mode}: ${label} needs an exposed touch point`).toBeTruthy();
        // Use the measured viewport point directly: locator-relative SVG clicks
        // may scroll a clipped path and invalidate its screen-space coordinates.
        if(info.project.name.includes('mobile'))await page.touchscreen.tap(point!.x,point!.y);
        else await page.mouse.click(point!.x,point!.y);
        const panel=page.getByRole('dialog');
        await expect(panel.locator('header>strong'),`${mode} zoom ${zoom}: ${label}`).toContainText(new RegExp(label,'i'));
        await panel.getByRole('button',{name:'Close map signal details'}).click();
        await signal.focus();await page.keyboard.press('Enter');await expect(panel).toBeVisible();
        await panel.getByRole('button',{name:'Close map signal details'}).click();
      }
      await page.mouse.move(0,0);
      await page.screenshot({path:info.outputPath(`${mode}-zoom-${zoom}.png`),scale:'css'});
    }
  }
});
