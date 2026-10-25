import {expect,test} from './browser-test';
import {auditProvider,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

test('signed-out visitors cannot open Network or Shared with you',async({page,request})=>{
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByRole('navigation',{name:'Capacity views'}).getByRole('link',{name:'Shared with you'})).toBeVisible();
  await page.getByRole('navigation',{name:'Capacity views'}).getByRole('link',{name:'Shared with you'}).click();
  await expect(page).toHaveURL(/\/login\?from=shared-capacity/,{timeout:30_000});
  await expect(page.getByText('Sign in to see vehicles shared with your account.')).toBeVisible();
  await page.goto('/app/network');
  await expect(page).toHaveURL(/\/login/,{timeout:30_000});
  for(const url of ['/api/account-directory','/api/account-connections','/api/account-capacity']){
    const response=await request.get(url);
    expect([401,403]).toContain(response.status());
    expect(response.headers()['cache-control']).toMatch(/no-store/i);
  }
  expect((await request.get('/api/shared-capacity')).status()).toBe(410);
  expect((await request.post('/api/shared-capacity/otp',{data:{email:'visitor@example.test'}})).status()).toBe(410);
});

test('provider finds accounts in Network without a shared Capacity entry',async({page,request})=>{
  test.setTimeout(120_000);
  const service=localAuditService(),actor=await auditProvider(service,'network-nav');
  try{
  await localSupportLogin(page,actor.id);
  await page.goto('/app/network');
  await expect(page.getByRole('heading',{name:'Network',level:1})).toBeVisible();
  const views=page.getByRole('tablist',{name:'Network views'});
  await expect(views.getByRole('tab',{name:'Find accounts'})).toHaveAttribute('aria-selected','true');
  await expect(views.getByRole('tab',{name:'Connections'})).toBeVisible();
  await expect(views.getByRole('tab',{name:'Vehicle sharing'})).toBeVisible();
  await page.getByRole('textbox',{name:'Find transport accounts'}).fill('no-such-synthetic-account-xyz');
  await expect(page.getByText('No accounts match this search.')).toBeVisible({timeout:30_000});
  await page.getByRole('button',{name:'Clear search'}).click();
  await expect(page.getByRole('textbox',{name:'Find transport accounts'})).toHaveValue('');
  await views.getByRole('tab',{name:'Connections'}).click();
  await expect(views.getByRole('tab',{name:'Connections'})).toHaveAttribute('aria-selected','true');
  await views.getByRole('tab',{name:'Vehicle sharing'}).click();
  await expect(views.getByRole('tab',{name:'Vehicle sharing'})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('link',{name:'Shared with you'})).toHaveCount(0);
  await page.goto('/?view=private');
  await expect(page).toHaveURL(url=>url.pathname==='/'&&!url.search);
  await expect(page.getByRole('region',{name:'Open transport capacity'})).toBeVisible();
  const response=await page.request.get('/api/account-capacity');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toMatch(/no-store/i);
  expect(Array.isArray((await response.json()).items)).toBe(true);
  expect((await request.get('/api/account-capacity')).status()).toBe(401);
  }finally{
    await page.goto('about:blank');
    checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
    checked(await service.auth.admin.deleteUser(actor.id));
  }
});

test('public Capacity never returns privately shared vehicles',async({request})=>{
  test.setTimeout(180_000);
  let cursor='';
  for(let pageNumber=0;pageNumber<20;pageNumber+=1){
    const response=await request.get(`/api/public/capacity${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`);
    expect(response.status()).toBe(200);
    const result=await response.json();
    expect(result.items.every((item:any)=>item.current_signal_geometry_visible!==false&&item.current_signal_visibility==='PUBLIC_MARKET')).toBe(true);
    if(!result.nextCursor)return;
    cursor=result.nextCursor;
  }
  throw Error('Public Capacity cursor did not terminate within 20 pages.');
});
