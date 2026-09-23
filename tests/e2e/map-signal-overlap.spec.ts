import {test,expect} from '@playwright/test';
import {closeCapacityFilters} from './capacity-drawer-helper';

// Renderer stress fixture only: the local server supplies the selected truck;
// its viewport response gets coincident geometry. No stored geography is changed.
test('coincident closed areas and routes remain separately tappable through zoom',async({page}:{page:any},info:any)=>{
  test.setTimeout(90000);
  const data=await (await page.request.get('/api/public/capacity')).json();
  const original=data.items.find((item:{location_lat:number|null;location_lng:number|null})=>item.location_lat!=null&&item.location_lng!=null);
  expect(original).toBeTruthy();
  const lat=Number(original.location_lat),lng=Number(original.location_lng);
  const points=Array.from({length:5},(_,i)=>({lat:lat+Math.sin(i*Math.PI*2/5)*.17,lng:lng+Math.cos(i*Math.PI*2/5)*.17,label:`Test boundary ${i+1}`,place_ref:`test-${i}`}));
  let routeMode=false;
  await page.route('**/api/public/capacity?**',(route:any)=>{
    const loop=[...points,points[0]],reverseLoop=[...loop].reverse();
    const truck={...original,status:'EMPTY',current_signal_geometry_visible:true,location_precision_km:20,
      availability_geometry:routeMode?'ROUTE':'RADIUS',capacity_area_boundary:routeMode?[]:points,current_route_points:routeMode?loop:[],
      recurring_corridors:[{id:'overlap-renderer-fixture',geometry:routeMode?'ROUTE':'RADIUS',area_boundary:[...points].reverse(),route_points:reverseLoop,area_center_label:'Synthetic overlap test'}]};
    return route.fulfill({json:{items:[truck],hasMore:false,nextCursor:null}});
  });
  for(const mode of ['area','closed-route']){
    routeMode=mode==='closed-route';
    // Start empty, load the stress record through the normal viewport request,
    // then select it. Bounds and accessibility metadata use that exact geometry.
    await page.goto('/?q=overlap-renderer-fixture');
    await closeCapacityFilters(page);
    const selectedViewport=page.waitForResponse((response:any)=>response.url().includes('/api/public/capacity?'));
    await page.locator('.capacity-truck-map-marker').click();
    await selectedViewport;
    await expect(page.locator('.map-regular-corridor')).toHaveAttribute('aria-label',/Test boundary/);
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:20000});
    const current=mode==='area'?'.map-service-area':'.map-current-route';
    await expect(page.locator(current)).toBeVisible();
    for(let zoom=0;zoom<2;zoom++){
      if(zoom){
        const nextViewport=page.waitForResponse((response:any)=>response.url().includes('/api/public/capacity?'));
        await page.locator('.leaflet-control-zoom-in').click();await nextViewport;
        await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
      }
      for(const [selector,label] of [[current,mode==='area'?'Service area':'Capacity route'],['.map-regular-corridor',mode==='area'?'Regular service area':'Regular capacity route'],['.map-location-privacy-circle','approximate location']]){
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
          const card=document.querySelector('.map-capacity-sheet')!.getBoundingClientRect();
          for(let i=0;i<300;i++){
            const p=path.getPointAtLength(length*i/300).matrixTransform(matrix);
            if(p.x<map.left+15||p.x>map.right-15||p.y<map.top+15||p.y>map.bottom-15)continue;
            if(p.x>=card.left&&p.x<=card.right&&p.y>=card.top&&p.y<=card.bottom)continue;
            if(document.elementFromPoint(p.x,p.y)===element)return{x:p.x,y:p.y};
          }
          return null;
        });
        expect(point,`${mode}: ${label} needs an exposed touch point`).toBeTruthy();
        const box=await signal.boundingBox();expect(box).toBeTruthy();
        const position={x:point!.x-box!.x,y:point!.y-box!.y};
        if(info.project.name.includes('mobile'))await signal.tap({position});
        else await signal.click({position});
        const panel=page.getByRole('region',{name:'Selected map signal'});
        await expect(panel.locator('article>small'),`${mode} zoom ${zoom}: ${label}`).toContainText(new RegExp(label,'i'));
        await panel.getByRole('button',{name:'Close map signal details'}).click();
        await signal.focus();await page.keyboard.press('Enter');await expect(panel).toBeVisible();
        await panel.getByRole('button',{name:'Close map signal details'}).click();
      }
      await page.mouse.move(0,0);
      await page.screenshot({path:info.outputPath(`${mode}-zoom-${zoom}.png`),scale:'css'});
    }
  }
});
