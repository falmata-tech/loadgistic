import {test,expect} from './browser-test';
import {locationSourceKind} from '../../src/lib/location-source.js';

test('capacity map combines location sources with load status and clears them on desktop and phone',async({page},info)=>{
  test.setTimeout(90_000);
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const trigger=page.locator('.capacity-map-controls .capacity-filter-trigger');
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Vehicle filters'});
  await dialog.locator('[data-filter-section="location"] > summary').click();
  await expect(dialog.getByRole('group',{name:'Location source'})).toBeVisible();
  await expect(dialog.locator('[data-filter-group="loadType"]')).toHaveCount(0);
  await dialog.locator('[data-filter-group="locationSource"] input[value="GPS"]').check();
  await dialog.locator('[data-filter-group="locationSource"] input[value="MOBILE"]').check();
  await dialog.locator('[data-filter-group="status"] input[value="EMPTY"]').check();
  await expect(dialog.locator('input[name="locationSource"]')).toHaveValue('GPS,MOBILE');
  await page.screenshot({path:info.outputPath('location-source-filters.png'),scale:'css'});
  await dialog.getByRole('button',{name:'Show vehicles'}).click();
  await expect(page).toHaveURL(url=>url.searchParams.get('locationSource')==='GPS,MOBILE'&&url.searchParams.get('status')==='EMPTY',{timeout:20_000});
  const filteredQuery=new URL(page.url()).searchParams;
  await trigger.click();
  await expect(dialog.locator('input[name="locationSource"]')).toHaveValue('GPS,MOBILE');
  await dialog.getByRole('link',{name:'Clear',exact:true}).click();
  await expect(page).toHaveURL(/\/$/,{timeout:20_000});
  await trigger.click();
  await expect(dialog.locator('input[name="locationSource"]')).toHaveValue('');
  await expect(dialog.locator('input[name="status"]')).toHaveValue('');
  await page.screenshot({path:info.outputPath('location-source-clear.png'),scale:'css'});
  const api=await page.request.get(`/api/public/capacity?${filteredQuery}`);
  expect(api.status()).toBe(200);
  const result=await api.json();
  expect(result.filterError).toBeFalsy();
  for(const item of result.items||[]){
    expect(item.status).toBe('EMPTY');
    expect(['GPS','MOBILE']).toContain(locationSourceKind(item.location_source));
  }
});

test('an old Space needed link does not keep an invisible filter',async({page})=>{
  await page.goto('/?status=PARTIAL&loadType=FTL',{waitUntil:'domcontentloaded'});
  const trigger=page.locator('.capacity-map-controls .capacity-filter-trigger');
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Vehicle filters'});
  await expect(dialog.getByRole('checkbox',{name:'Partly loaded'})).toBeChecked();
  await expect(dialog.locator('[data-filter-group="loadType"]')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Show vehicles'}).click();
  await expect(page).toHaveURL(url=>url.searchParams.get('status')==='PARTIAL'&&!url.searchParams.has('loadType'),{timeout:20_000});
});
