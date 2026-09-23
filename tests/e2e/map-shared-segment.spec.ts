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
  for(let zoom=0;zoom<2;zoom++){
    if(zoom){
      const next=page.waitForResponse((r:any)=>r.url().includes('/api/public/capacity?'));
      await page.locator('.leaflet-control-zoom-in').click();await next;
    }
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
    await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
    if(info.project.name.includes('mobile')){
      // Pan normally into the space below the existing truck card. This tests
      // stroke separation without pretending an overlay is transparent visually.
      const map=await page.locator('.public-map-canvas').boundingBox(),line=await page.locator('.map-current-route').boundingBox();
      const dx=map.x+map.width*.42-line.x-line.width/2,dy=map.y+map.height*.74-line.y-line.height/2;
      const start={x:map.x+map.width*.2,y:map.y+map.height*.5};
      const next=page.waitForResponse((r:any)=>r.url().includes('/api/public/capacity?'));
      const touch=await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
      for(let i=1;i<=8;i++){
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*i/8,y:start.y+dy*i/8}]});
        await page.evaluate(()=>new Promise(requestAnimationFrame));
      }
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();await next;
      await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
    }
    const geometry=await page.evaluate(()=>{
      const current=document.querySelector<SVGPathElement>('.map-current-route')!,regular=document.querySelector<SVGPathElement>('.map-regular-corridor')!;
      const map=document.querySelector('.public-map-canvas')!.getBoundingClientRect(),card=document.querySelector('.map-capacity-sheet')!.getBoundingClientRect();
      const at=(path:SVGPathElement,t:number)=>path.getPointAtLength(path.getTotalLength()*t).matrixTransform(path.getScreenCTM()!);
      const exposed=(path:SVGPathElement,p:{x:number;y:number})=>p.x>map.left+15&&p.x<map.right-15&&p.y>map.top+15&&p.y<map.bottom-15&&!(p.x>=card.left&&p.x<=card.right&&p.y>=card.top&&p.y<=card.bottom)&&document.elementFromPoint(p.x,p.y)===path;
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
      const signal=page.locator(selector),box=await signal.boundingBox(),point=geometry.target[key];
      const position={x:point.x-box.x,y:point.y-box.y};
      if(info.project.name.includes('mobile'))await signal.tap({position});else await signal.click({position});
      const panel=page.getByRole('region',{name:'Selected map signal'});
      await expect(panel.locator('article>small')).toHaveText(label);
      await panel.getByRole('button',{name:'Close map signal details'}).click();
    }
    await page.mouse.move(0,0);
    await page.screenshot({path:info.outputPath(`actual-shared-leg-${zoom}.png`),scale:'css'});
  }
});
