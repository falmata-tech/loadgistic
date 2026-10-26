import {readFileSync} from 'node:fs';
import {test,expect} from './browser-test';

const preview='http://127.0.0.1:8084';
async function settledModal(page:import('playwright-core').Page,label:string){
 await expect.poll(()=>page.getByRole('heading',{name:label,exact:true}).evaluate(element=>{for(let node:Element|null=element;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<1)return false;return true;})).toBe(true);
}
type PreferredSignal={id:string;recurring_corridors?:{geometry:string}[]};
async function preferredSignals(page:import('playwright-core').Page){
 let cursor='',route:PreferredSignal|undefined,area:PreferredSignal|undefined;
 const seen=new Set<string>();
 for(let pageNumber=0;pageNumber<24;pageNumber++){
  const params=new URLSearchParams();if(cursor)params.set('cursor',cursor);
  const response=await page.request.get(`/api/public/capacity?${params}`);expect(response.ok()).toBe(true);
  const payload=await response.json();expect(payload.filterError||'').toBe('');
  const items=payload.items as PreferredSignal[];
  route??=items.find(item=>item.recurring_corridors?.some(row=>row.geometry==='ROUTE'));
  area??=items.find(item=>item.recurring_corridors?.some(row=>row.geometry==='RADIUS'));
  if(route&&area||!payload.hasMore)break;
  expect(payload.nextCursor).toBeTruthy();expect(seen.has(payload.nextCursor)).toBe(false);
  seen.add(payload.nextCursor);cursor=payload.nextCursor;
 }
 expect(route,'public capacity must include a saved preferred corridor').toBeTruthy();
 return {route:route!,area};
}

test('preferred corridor keeps planned capacity distinct on phone web and Expo',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','The terminology review targets phone layouts.');
 test.setTimeout(150_000);await page.setViewportSize({width:390,height:844});
 const {route:signal,area}=await preferredSignals(page);

 await page.goto(`/?truck=${encodeURIComponent(signal.id)}`);
 await expect(page.getByRole('button',{name:'Vehicle details',exact:true})).toBeVisible({timeout:45_000});
 await expect(page.getByRole('progressbar',{name:'Loading vehicle availability',exact:true})).toHaveCount(0,{timeout:45_000});
 const legend=page.locator('.public-map-legend');await expect(legend).toBeVisible();
 if(await legend.getAttribute('open')===null)await legend.locator('summary').click();
 await expect(legend.locator('.corridor')).toHaveText(['Preferred area','Preferred corridor']);
 await expect(legend.locator('.empty-route')).toHaveText('Planned route');
 await expect.poll(()=>page.locator('.leaflet-tile-loaded').count(),{timeout:30_000}).toBeGreaterThan(5);
 await page.screenshot({path:info.outputPath('web-preferred-corridor-phone.png'),scale:'css'});

 if(area){await page.goto(`/?truck=${encodeURIComponent(area.id)}`);
  await expect(page.getByRole('button',{name:'Vehicle details',exact:true})).toBeVisible({timeout:45_000});
  const areaLegend=page.locator('.public-map-legend');if(await areaLegend.getAttribute('open')===null)await areaLegend.locator('summary').click();
  await expect(areaLegend.locator('.corridor')).toHaveText(['Preferred area','Preferred corridor']);}

 await page.goto(`${preview}/?truck=${encodeURIComponent(signal.id)}`);
 const corridor=page.getByRole('button',{name:'Preferred corridor',exact:true});
 await expect(corridor).toBeVisible({timeout:45_000});await corridor.click();
 await expect(page.getByRole('heading',{name:'Preferred corridor',exact:true})).toBeVisible();await settledModal(page,'Preferred corridor');
 await expect(page.getByText('Both directions',{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('expo-preferred-corridor-phone-en.png'),scale:'css'});
 await page.getByRole('button',{name:'Close map signal details',exact:true}).last().click();

 const locales=[['am','አማርኛ'],['om','Afaan Oromo']] as const;
 let priorLabel='Language';
 for(const [locale,name] of locales){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await page.getByRole('button',{name:priorLabel,exact:true}).click();
  await page.getByRole('radio',{name,exact:true}).click();
  await page.getByRole('dialog').getByRole('button').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const localized=page.getByRole('button',{name:messages['Preferred corridor'],exact:true});
  await expect(localized).toBeVisible();await localized.click();
  await expect(page.getByRole('heading',{name:messages['Preferred corridor'],exact:true})).toBeVisible();await settledModal(page,messages['Preferred corridor']);
  await page.screenshot({path:info.outputPath(`expo-preferred-corridor-phone-${locale}.png`),scale:'css'});
  await page.getByRole('button',{name:messages['Close map signal details'],exact:true}).last().click();
  priorLabel=messages.Language;
 }
});
