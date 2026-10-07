import {test,expect} from '@playwright/test';

// Leaflet's animation proxy encodes the projected center and zoom. Unlike
// raster tiles it survives zoom transitions and does not depend on tile loading.
async function cameraView(page:any){
 await expect(page.locator('.leaflet-container')).not.toHaveClass(/leaflet-zoom-anim/);
 return page.locator('.leaflet-proxy').evaluate((element:HTMLElement)=>{
  const matrix=new DOMMatrix(element.style.transform);
  return {zoom:Math.log2(matrix.a)+1,x:Math.round(matrix.e*100)/100,y:Math.round(matrix.f*100)/100};
 });
}

test('selected truck has centered readable modals and a separate attached exit restoring filtered camera',async({page}:{page:any},info:any)=>{
 test.setTimeout(120000);
 const response=await page.request.get('/api/public/capacity?q=Merkato&status=PARTIAL');expect(response.ok()).toBe(true);
 const truck=(await response.json()).items.find((item:{vehicle_model:string;current_route_points:unknown[]})=>item.vehicle_model==='X200'&&item.current_route_points?.length===2);expect(truck).toBeTruthy();
 await page.goto(`/?q=Merkato&status=PARTIAL&truck=${encodeURIComponent(truck.id)}`);
 const drawer=page.locator('#capacity-filter-drawer'),card=page.locator('.capacity-info-card'),marker=page.locator('.capacity-truck-map-marker.selected'),exit=page.locator('.capacity-truck-exit');
 await expect(marker).toBeVisible({timeout:30000});await expect(drawer).toBeHidden();await expect(card).toHaveCount(0);
 const truckControl=page.locator('.map-info-bubble.truck'),location=page.locator('.map-info-bubble.location'),regular=page.locator('.map-info-bubble.regular'),capacity=page.locator('.map-info-bubble.partial');
 const before=await cameraView(page);
 await truckControl.click();await expect(card).toHaveClass(/truck/);await expect(card.getByRole('link',{name:'Profile',exact:true})).toHaveCount(1);
 await expect(card).toHaveAttribute('open','');await expect(card).toHaveRole('dialog');
 await page.keyboard.press('Escape');await expect(card).toHaveCount(0);await expect(truckControl).toBeFocused();await expect(marker).toBeVisible();
 await capacity.click();await expect(card.locator('.signal-route-stops li')).toHaveCount(2);await expect(card).toContainText('Follow the route in the order shown.');
 const bounds=await card.boundingBox(),mapBox=await page.locator('.public-capacity-map').boundingBox();
 expect(Math.abs(bounds.x+bounds.width/2-mapBox.x-mapBox.width/2)).toBeLessThan(2);
 expect(Math.abs(bounds.y+bounds.height/2-mapBox.y-mapBox.height/2)).toBeLessThan(2);
 const overflow=await card.locator('.capacity-info-content').evaluate((el:HTMLElement)=>el.scrollHeight-el.clientHeight);expect(overflow).toBeLessThanOrEqual(1);
 await expect(card).toHaveCSS('border-top-color','rgb(234, 179, 8)');
 await page.screenshot({path:info.outputPath('route-modal.png')});
 // Modal traps focus and blocks background map interactions.
 await page.keyboard.press('Tab');expect(await card.evaluate((el:HTMLElement)=>el.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Shift+Tab');expect(await card.evaluate((el:HTMLElement)=>el.contains(document.activeElement))).toBe(true);
 await page.mouse.click(mapBox.x+5,mapBox.y+mapBox.height/2);await expect(card).toHaveCount(0);
 await location.click();await expect(card).toHaveCSS('border-top-color','rgb(26, 115, 232)');
 await card.getByRole('button',{name:'Close map signal details'}).click();
 await regular.click();await expect(card).toHaveCSS('border-top-color','rgb(192, 102, 32)');await expect(card).toContainText('both directions');
 await page.screenshot({path:info.outputPath('regular-modal.png')});
 await card.getByRole('button',{name:'Close map signal details'}).click();await expect(marker).toBeVisible();
 expect(await cameraView(page)).toEqual(before);
 const markerBox=await marker.boundingBox(),exitBox=await exit.boundingBox();expect(exitBox.width).toBe(44);expect(exitBox.height).toBe(44);
 expect(exitBox.x).toBeGreaterThan(markerBox.x+markerBox.width/2);expect(exitBox.x).toBeLessThan(markerBox.x+markerBox.width);
 await page.screenshot({path:info.outputPath('attached-exit.png')});
 // Return from the direct link, pan/zoom the filtered map, then select and exit
 // twice. Selection must not overwrite the original camera or the query/draft.
 await exit.click();await expect(marker).toHaveCount(0);await expect(drawer).toBeHidden();
 const url=page.url();await page.locator('.capacity-drawer-handle button').click();
 const search=drawer.getByRole('searchbox',{name:'Search transporters'});await search.fill('Unsubmitted draft');
 await drawer.getByRole('button',{name:'Close filter drawer'}).click();
 for(let attempt=0;attempt<6&&await page.locator('.capacity-truck-map-marker').count()===0;attempt++)await page.locator('.leaflet-control-zoom-in').click();
 await expect(page.locator('.capacity-truck-map-marker').first()).toBeVisible();
 const canvas=await page.locator('.leaflet-container').boundingBox();
 await page.mouse.move(canvas.x+30,canvas.y+canvas.height/2);await page.mouse.down();await page.mouse.move(canvas.x+65,canvas.y+canvas.height/2+25,{steps:8});await page.mouse.up();
 // Let Leaflet's bounded inertia finish before recording the return camera.
 await page.waitForTimeout(400);
 for(let cycle=0;cycle<2;cycle++){
  const camera=await cameraView(page);
  await page.locator('.capacity-truck-map-marker').first().click();await expect(marker).toBeVisible();await expect(card).toHaveCount(0);
  // Changing the selected camera must not change the saved return position.
  await page.locator('.leaflet-control-zoom-in').click();
  await exit.focus();await page.keyboard.press('Enter');await expect(marker).toHaveCount(0);await expect(drawer).toBeHidden();
  await expect.poll(()=>cameraView(page)).toEqual(camera);expect(page.url()).toBe(url);
 }
 await page.locator('.capacity-drawer-handle button').click();await expect(search).toHaveValue('Unsubmitted draft');
});
