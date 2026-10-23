import {expect,test} from './browser-test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import type {Page,Request,Response} from 'playwright-core';

import {auditLogin} from './audit-helpers';
async function loginAsAdministrator(page:any){await auditLogin(page,'admin@loadgistic.local');}

const inventoryViews=['WORKSPACES','USERS','TRUCKS','DRIVERS','TRACKING','CAPACITY','ROUTES'] as const;
type NavigationView='OVERVIEW'|'MENU'|typeof inventoryViews[number];
type NavigationTask='LOGIN'|'OPEN_MORE'|'OPEN_LIST'|'OPEN_DETAIL';
type NavigationTiming={task:NavigationTask;view:NavigationView;startedAt:number};

function recordAdminNavigation(page:Page,baseURL:string|undefined){
  const origin=baseURL?new URL(baseURL).origin:null;
  const receipts:{task:NavigationTask;view:NavigationView;phase:'request'|'response'|'failed'|'requestfinished';elapsedMs:number;status:number|null}[]=[];
  const pending=new Map<Request,NavigationTiming>();
  let active:NavigationTiming={task:'LOGIN',view:'OVERVIEW',startedAt:Date.now()};
  const record=(timing:NavigationTiming,phase:'request'|'response'|'failed'|'requestfinished',status:number|null=null)=>{
    if(receipts.length<200)receipts.push({task:timing.task,view:timing.view,phase,elapsedMs:Math.max(0,Date.now()-timing.startedAt),status});
  };
  const request=(request:Request)=>{
    const url=new URL(request.url());
    if(url.origin!==origin||request.method()!=='GET'||(!request.isNavigationRequest()&&!url.searchParams.has('_rsc')))return;
    if(!/^\/(?:admin(?:\/operations(?:\/(?:workspaces|users|trucks|drivers|tracking|capacity|routes)\/[^/]+)?)?|app\/(?:home|menu))\/?$/.test(url.pathname)||receipts.length>=200)return;
    const timing={...active};pending.set(request,timing);record(timing,'request');
  };
  const response=(response:Response)=>{
    const timing=pending.get(response.request());
    if(timing){const status=response.status();record(timing,'response',Number.isInteger(status)&&status>=100&&status<=599?status:null);}
  };
  const failed=(request:Request)=>{const timing=pending.get(request);if(timing)record(timing,'failed');pending.delete(request);};
  const finished=(request:Request)=>{const timing=pending.get(request);if(timing)record(timing,'requestfinished');pending.delete(request);};
  page.on('request',request);page.on('response',response);page.on('requestfailed',failed);page.on('requestfinished',finished);
  return {
    task(task:NavigationTask,view:NavigationView){active={task,view,startedAt:Date.now()};},
    save(info:{outputPath:(name:string)=>string}){
      page.off('request',request);page.off('response',response);page.off('requestfailed',failed);page.off('requestfinished',finished);pending.clear();
      const output=info.outputPath('admin-navigation-timing.json');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(receipts,null,2)+'\n');
    }
  };
}

test('administrator More navigation reaches one role-complete menu',async({page,baseURL}:{page:any;baseURL?:string},info:any)=>{
  const timing=recordAdminNavigation(page,baseURL);
  try{
  await loginAsAdministrator(page);
  const mobile=(page.viewportSize()?.width||0)<=760;
  const primaryNav=page.getByRole('navigation',{name:mobile?'Mobile navigation':'Workspace navigation'});
  const primaryMore=primaryNav.getByRole('link',{name:'More',exact:true});
  await expect(primaryMore).toBeVisible();
  await expect(primaryMore).toHaveAttribute('href','/app/menu');

  if(!mobile){
    const topbarMore=page.locator('.app-topbar').getByRole('link',{name:'More',exact:true});
    await expect(topbarMore).toBeVisible();
    await expect(topbarMore).toHaveAttribute('href','/app/menu');
  }

  timing.task('OPEN_MORE','MENU');
  await Promise.all([
    page.waitForURL(/\/app\/menu$/,{waitUntil:'domcontentloaded'}),
    primaryMore.click()
  ]);
  await expect(page).toHaveURL(/\/app\/menu$/);
  const menu=page.locator('.workspace-menu-page');
  await expect(menu).toBeVisible({timeout:20000});
  for(const name of ['Management','Account','Marketplace'])await expect(menu.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(menu.getByRole('link',{name:/^Administration overview/})).toHaveAttribute('href','/admin');
  await expect(menu.getByRole('link',{name:/^Accounts\b/})).toHaveAttribute('href','/admin/operations');
  await expect(menu.getByRole('link',{name:/^Featured & sponsors/})).toHaveAttribute('href','/admin/featured');
  await expect(menu.getByRole('link',{name:/^Support/})).toHaveAttribute('href','/admin/support');
  await expect(menu.getByRole('link',{name:/^Account\b/})).toHaveAttribute('href','/app/more');
  await expect(menu.getByRole('link',{name:/^Account\b/})).toHaveCount(1);
  await expect(menu.getByRole('link',{name:/^Public featured programme/})).toHaveAttribute('href','/featured');
  }finally{timing.save(info);}
});

test('featured management previews its canonical public programme',async({page}:{page:any})=>{
  await loginAsAdministrator(page);
  await page.goto('/admin/featured');
  await page.getByRole('link',{name:'Edit programme',exact:true}).click();
  const preview=page.getByRole('link',{name:'View public programme'});
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('href','/featured');
  await expect(page.getByRole('link',{name:'View homepage'})).toHaveCount(0);
});

test('administrator primary destinations resolve to working pages',async({page}:{page:any})=>{
  test.setTimeout(90_000); // Seven separately compiled dev-server destinations.
  await loginAsAdministrator(page);
  for(const path of ['/admin','/admin/operations','/admin/featured','/admin/devices','/admin/reviews','/admin/support','/app/menu']){
    const response=await page.goto(path);
    expect(response?.status(),`${path} returned an error status`).toBeLessThan(400);
    await expect(page.locator('.app-main')).toBeVisible();
    await expect(page.getByRole('heading',{name:'404',exact:true})).toHaveCount(0);
  }
  await page.goto('/admin/capacity-network');
  // Next can stream a 200 shell before rendering notFound; assert the final page.
  await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
  await expect(page.locator('.app-main')).toHaveCount(0);
});

test('administrator Overview exposes every core record and management area',async({page}:{page:any})=>{
  await loginAsAdministrator(page);
  const overview=page.locator('.admin-overview-page');
  await expect(overview.getByRole('heading',{name:'Platform overview'})).toBeVisible();
  await expect(overview.getByRole('link',{name:/^People and provider accounts/})).toHaveAttribute('href','/admin/operations');
  for(const [label,view] of [['Vehicles','TRUCKS'],['Drivers','DRIVERS'],['Tracking','TRACKING'],['Capacity','CAPACITY'],['Routes','ROUTES']])
    await expect(overview.getByRole('link',{name:new RegExp(`^${label}`)})).toHaveAttribute('href',`/admin/operations?view=${view}`);
  for(const [label,path] of [['Review Center','/admin/reviews'],['Featured & sponsors','/admin/featured'],['Team','/admin/support?tab=team'],['GPS devices','/admin/devices']])
    await expect(overview.getByRole('link',{name:new RegExp(`^${label}`)})).toHaveAttribute('href',path);
  await expect(overview.getByRole('link',{name:/^Open inbox/})).toHaveAttribute('href','/admin/support');
  await expect(overview.getByRole('link',{name:/^Private capacity/})).toHaveCount(0);
  const navigation=page.getByRole('navigation',{name:(page.viewportSize()?.width||0)<=760?'Mobile navigation':'Workspace navigation'});
  await expect(navigation.getByRole('link',{name:'Overview',exact:true})).toHaveClass(/active/);
  await expect(navigation.getByRole('link',{name:'Accounts',exact:true})).toHaveAttribute('href','/admin/operations');
});

test('every current Operations inventory opens a real bounded record detail',async({page,baseURL}:{page:any;baseURL?:string},info:any)=>{
  test.setTimeout(120_000); // Seven inventories and their streamed record pages.
  const timing=recordAdminNavigation(page,baseURL);
  try{
  await loginAsAdministrator(page);
  const listLabels:Record<string,string>={WORKSPACES:'Client',TRUCKS:'Vehicle',DRIVERS:'Driver access',TRACKING:'Tracking',CAPACITY:'Capacity',ROUTES:'Regular service'};
  for(const view of inventoryViews){
    timing.task('OPEN_LIST',view);
    await page.goto(`/admin/operations?view=${view}`);
    const detailLink=page.locator(`.admin-record-list a[href^="/admin/operations/${view.toLowerCase()}/"]`).first();
    await expect(detailLink,`${view} did not expose a detail destination`).toBeVisible();
    timing.task('OPEN_DETAIL',view);
    const destination=new RegExp(`/admin/operations/${view.toLowerCase()}/[0-9a-f-]+`);
    await Promise.all([
      page.waitForURL(destination,{waitUntil:'domcontentloaded',timeout:20000}),
      detailLink.click()
    ]);
    await expect(page).toHaveURL(destination,{timeout:20000});
    const detail=page.locator('.admin-operation-record-page');
    if(view==='USERS'){
      await expect(detail.getByRole('region',{name:'Account details',exact:true})).toBeVisible();
      await expect(detail.getByRole('link',{name:'Accounts',exact:true})).toHaveAttribute('href',/^\/admin\/operations\?view=USERS/);
    }else{
      await expect(detail.locator('.admin-operation-record-card')).toBeVisible({timeout:20000});
      await expect(detail.locator('.admin-operation-record-card').getByRole('heading',{name:'Record details'})).toBeVisible();
      await expect(detail.getByRole('link',{name:new RegExp(`${listLabels[view]} list`,'i')})).toBeVisible();
    }
    if(view==='TRACKING')await expect(page.getByRole('heading',{name:'Status timeline'})).toBeVisible();
  }
  }finally{timing.save(info);}
});
