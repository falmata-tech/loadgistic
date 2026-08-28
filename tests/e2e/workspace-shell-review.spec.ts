import {expect,test} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function login(page:any,email:string){
  await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
  await page.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(/\/app\/home/);
}

async function choosePlace(page:any,label:string,query:string,option:RegExp){
  await page.getByLabel(label).fill(query);
  await expect(page.getByRole('option',{name:option}).first()).toBeVisible();
  await page.getByRole('option',{name:option}).first().click();
}

async function settleDevelopmentOverlay(page:any){
  const issueCount=page.locator('nextjs-portal [data-issues-count]');
  if(await issueCount.count()){
    await expect(issueCount).toHaveText('0',{timeout:5_000});
    await page.locator('nextjs-portal').evaluate((portal:HTMLElement)=>{portal.style.display='none';});
  }
}

async function capture(page:any,file:string){
  await page.screenshot({path:file,fullPage:false,style:'nextjs-portal{display:none!important}'});
}

async function waitForMapTiles(page:any,root:string){
  await expect.poll(async()=>page.locator(`${root} .leaflet-tile-pane img`).evaluateAll((tiles:HTMLImageElement[])=>
    tiles.length>0&&tiles.every(tile=>tile.complete&&tile.naturalWidth>0)
  ),{timeout:20_000,message:`Expected every map tile to render in ${root}`}).toBe(true);
}

test('capture focused responsive shell and Tracking review',async({page,context}:{page:any;context:any})=>{
  test.setTimeout(90_000);
  test.skip(process.env.CAPTURE_VISUAL_REVIEW!=='1','Focused visual capture only');
  const output=path.resolve(process.cwd(),'artifacts/responsive-shell-v1');
  fs.mkdirSync(output,{recursive:true});
  const project=test.info().project.name;
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});

  for(const route of [
    {path:'/about',name:'about'},
    {path:'/privacy',name:'privacy'},
    {path:'/terms',name:'terms'},
    {path:'/track',name:'track'},
    {path:'/login',name:'login'},
    {path:'/apply',name:'apply'},
    {path:'/@blueline-transport',name:'provider'}
  ]){
    await page.goto(route.path);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    await settleDevelopmentOverlay(page);
    await capture(page,path.join(output,`${project}-${route.name}.png`));
  }

  await login(page,'driver@loadgistic.local');
  await expect(page.getByTestId('capacity-summary')).toBeVisible();
  await expect(page.getByTestId('capacity-summary').locator('.leaflet-container')).toBeVisible();
  await expect(page.getByTestId('capacity-summary').locator('.capacity-setting-truck-marker')).toBeVisible();
  await waitForMapTiles(page,'[data-testid="capacity-summary"]');
  await settleDevelopmentOverlay(page);
  await capture(page,path.join(output,`${project}-driver-home.png`));
  await page.getByRole('button',{name:/^Edit regular service:/}).click();
  await expect(page.getByTestId('capacity-planning-editor')).toBeVisible();
  await capture(page,path.join(output,`${project}-driver-regular-service.png`));
  await page.getByRole('button',{name:'Back to summary'}).click();
  await page.getByRole('button',{name:/^Edit current capacity:/}).click();
  await expect(page.getByTestId('capacity-form')).toBeVisible();
  await capture(page,path.join(output,`${project}-driver-capacity-editor.png`));
  await page.getByRole('button',{name:'Back to summary'}).click();
  await page.goto('/app/menu');
  await settleDevelopmentOverlay(page);
  await capture(page,path.join(output,`${project}-more.png`));
  await page.goto('/app/more');
  await settleDevelopmentOverlay(page);
  await capture(page,path.join(output,`${project}-account.png`));

  await page.goto('/app/provider-shipments/new');
  await page.getByLabel('Truck').selectOption({index:1});
  await page.getByLabel('Cargo summary').fill('Workshop steel inputs');
  await choosePlace(page,'Origin','Addis',/Addis Ababa, Ethiopia/i);
  await choosePlace(page,'Destination','Adama',/Adama, Ethiopia/i);
  await page.getByLabel('Customer owner email').fill(`${project}@shell-review.test`);
  await page.getByLabel('Status and approximate location').check();
  await page.getByRole('button',{name:'Start Tracking'}).click();
  const code=(await page.locator('.party-code-grid article').first().locator('code').textContent())!;
  await page.getByRole('link',{name:'Open Tracking'}).click();
  await page.getByRole('button',{name:'Save Going to pickup'}).click();
  await expect(page.getByText('Tracking status updated.')).toBeVisible();
  await page.goto('/track');
  await page.getByLabel('Tracking code').fill(code);
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page.locator('.tracking-location-map .leaflet-container')).toBeVisible({timeout:15_000});
  await waitForMapTiles(page,'.tracking-location-map');
  await settleDevelopmentOverlay(page);
  await capture(page,path.join(output,`${project}-tracking-map.png`));
});
