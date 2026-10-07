import {test,expect} from '@playwright/test';
import {closeCapacityFilters} from './capacity-drawer-helper';

test('JAC X200 shared Dire Dawa–Shinile leg keeps yellow and regular routes separately tappable',async({page}:{page:any},info:any)=>{
  test.setTimeout(120000);
  const data=await (await page.request.get('/api/public/capacity?q=Merkato&status=PARTIAL')).json();
  const truck=data.items.find((item:{vehicle_model:string;current_route_points:{label:string}[]})=>item.vehicle_model==='X200'&&item.current_route_points?.[1]?.label.startsWith('Shinile'));
  expect(truck,'real local fixture matching the owner screenshot').toBeTruthy();
  const loaded=page.waitForResponse((r:any)=>r.url().includes('/api/public/capacity?'));
  await page.goto(`/?q=Merkato&status=PARTIAL&truck=${encodeURIComponent(truck.id)}`);await loaded;
  await closeCapacityFilters(page);
  await expect(page.locator('.map-current-route')).toHaveAttribute('stroke','#eab308');
  // Selection now fits the complete regular route too. Inspect the shared leg
  // at street scale, where both strokes have room beside the info bubbles.
  await page.locator('.leaflet-control-zoom-in').click();
  await page.locator('.leaflet-control-zoom-in').click();
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
    for(const [selector,key,label] of [['.map-current-route','yellow','Capacity route'],['.map-regular-corridor','brown','Regular capacity route']]){
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

});
