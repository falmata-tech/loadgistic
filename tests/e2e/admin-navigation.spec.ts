import {expect,test} from '@playwright/test';

async function loginAsAdministrator(page:any){
  await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();
  const form=page.getByTestId('login-form');
  await form.getByLabel('Email',{exact:true}).fill('admin@loadgistic.local');
  await form.getByLabel('Password').fill('Loadgistic123!');
  await form.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('administrator More navigation reaches one role-complete menu',async({page}:{page:any})=>{
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

  await primaryMore.click();
  await expect(page).toHaveURL(/\/app\/menu$/);
  const menu=page.locator('.workspace-menu-grid');
  await expect(menu.getByRole('link',{name:/^Administration overview/})).toHaveAttribute('href','/admin');
  await expect(menu.getByRole('link',{name:/^Platform records/})).toHaveAttribute('href','/admin/operations');
  await expect(menu.getByRole('link',{name:/^Featured & sponsors/})).toHaveAttribute('href','/admin/featured');
  await expect(menu.getByRole('link',{name:/^Support/})).toHaveAttribute('href','/admin/support');
  await expect(menu.getByRole('link',{name:/^Account & plan/})).toHaveAttribute('href','/app/more');
  await expect(menu.getByRole('link',{name:/^Account & plan/})).toHaveCount(1);
  await expect(menu.getByRole('link',{name:/^Public featured programme/})).toHaveAttribute('href','/featured');
});

test('featured management previews its canonical public programme',async({page}:{page:any})=>{
  await loginAsAdministrator(page);
  await page.goto('/admin/featured');
  const preview=page.getByRole('link',{name:'View public programme'});
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('href','/featured');
  await expect(page.getByRole('link',{name:'View homepage'})).toHaveCount(0);
});

test('administrator primary destinations resolve to working pages',async({page}:{page:any})=>{
  await loginAsAdministrator(page);
  for(const path of ['/admin','/admin/operations','/admin/featured','/admin/capacity-network','/admin/reviews','/admin/support','/app/menu']){
    const response=await page.goto(path);
    expect(response?.status(),`${path} returned an error status`).toBeLessThan(400);
    await expect(page.locator('.app-main')).toBeVisible();
    await expect(page.getByRole('heading',{name:'404',exact:true})).toHaveCount(0);
  }
});

test('administrator Overview exposes every core record and management area',async({page}:{page:any})=>{
  await loginAsAdministrator(page);
  const overview=page.locator('.admin-overview-page');
  await expect(overview.getByRole('heading',{name:'Administration'})).toBeVisible();
  for(const label of ['Clients','Users','Trucks','Drivers','Tracking','Capacity','Routes','Plans']){
    await expect(overview.getByRole('link',{name:new RegExp(`^${label}`)})).toBeVisible();
  }
  for(const label of ['Review Center','Private capacity','Featured & sponsors','Support & team']){
    await expect(overview.getByRole('link',{name:new RegExp(`^${label}`)})).toBeVisible();
  }
  const navigation=page.getByRole('navigation',{name:(page.viewportSize()?.width||0)<=760?'Mobile navigation':'Workspace navigation'});
  await expect(navigation.getByRole('link',{name:'Overview',exact:true})).toHaveClass(/active/);
  await expect(navigation.getByRole('link',{name:'Records',exact:true})).toHaveAttribute('href','/admin/operations');
});

test('every Operations inventory opens a real bounded record detail',async({page}:{page:any})=>{
  test.setTimeout(60_000);
  await loginAsAdministrator(page);
  const listLabels:Record<string,string>={WORKSPACES:'Client',USERS:'User',TRUCKS:'Truck',DRIVERS:'Driver access',TRACKING:'Tracking',CAPACITY:'Capacity',ROUTES:'Regular service',SUBSCRIPTIONS:'Plan'};
  for(const view of ['WORKSPACES','USERS','TRUCKS','DRIVERS','TRACKING','CAPACITY','ROUTES','SUBSCRIPTIONS']){
    await page.goto(`/admin/operations?view=${view}`);
    const detailLink=page.locator(`.admin-record-list a[href^="/admin/operations/${view.toLowerCase()}/"]`).first();
    await expect(detailLink,`${view} did not expose a detail destination`).toBeVisible();
    await detailLink.click();
    await expect(page).toHaveURL(new RegExp(`/admin/operations/${view.toLowerCase()}/[0-9a-f-]+`));
    await expect(page.locator('.admin-operation-record-card')).toBeVisible();
    await expect(page.locator('.admin-operation-record-card').getByRole('heading',{name:'Record details'})).toBeVisible();
    await expect(page.getByRole('link',{name:new RegExp(`${listLabels[view]} list`,'i')})).toBeVisible();
    if(view==='TRACKING')await expect(page.getByRole('heading',{name:'Status timeline'})).toBeVisible();
  }
});
