import {expect,test} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';

async function login(page:any,role='admin'){
  await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();
  const form=page.getByTestId('login-form');
  await form.getByLabel('Email',{exact:true}).fill(`${role}@loadgistic.local`);
  await form.getByLabel('Password').fill('Loadgistic123!');
  await form.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page).toHaveURL(role==='admin'?/\/admin$/:/\/app\/home$/);
  await expect(page.locator('h1').first()).toBeAttached();
}
function localClient(){
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  if(!['localhost','127.0.0.1'].includes(new URL(endpoint).hostname))throw new Error('REMOTE_AUDIT_REFUSED');
  return createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
}

test('admin capacity wording and platform access match their actual state',async({page}:{page:any},info:any)=>{
  await login(page);
  await page.goto('/admin/operations?view=CAPACITY');
  const rows=page.locator('.admin-record-list article');
  await expect(rows.first()).toBeVisible();
  for(const row of await rows.all()){
    const status=(await row.locator('.status').innerText()).trim().toLowerCase();
    const copy=await row.locator('small').innerText();
    if(status.includes('off duty')){expect(copy).toContain('Off Duty');expect(copy).not.toContain('Empty truck');}
    if(status==='empty')expect(copy).toContain('Empty truck');
    if(status==='partial')expect(copy).toContain('Partial space');
  }
  await page.goto('/app/more');
  await expect(page.getByText('Platform access',{exact:true})).toBeVisible();
  await expect(page.getByText('Contact support for a plan.',{exact:true})).toHaveCount(0);
  await expect(page.locator('form[action="/api/billing/payment-proof"]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('admin-account.png'),fullPage:true});
});

test('admin truck save persists and returns to the same searched inventory',async({page}:{page:any},info:any)=>{
  test.setTimeout(60_000);
  const client=localClient();const suffix=randomUUID().slice(0,8);let id='';
  try{
    const owner=await client.from('profiles').select('id').eq('email','transporter@loadgistic.local').single();expect(owner.error).toBeNull();
    const created=await client.rpc('create_provider_vehicle',{actor_user_id:owner.data!.id,command:{make:'Audit',model:suffix,plate:`TEST-${suffix}`,cargo_configuration:'Mini Box Truck'}});expect(created.error).toBeNull();id=created.data.id;
    await login(page);
    await page.goto(`/admin/operations?view=TRUCKS&q=${suffix}&page=1`);
    const row=page.locator('.admin-record-list article').filter({hasText:suffix});
    await expect(row).toHaveCount(1);
    await row.getByRole('button',{name:'Deactivate',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`view=TRUCKS&q=${suffix}&page=1&success=`));
    await expect(page.locator('.alert.success')).toBeVisible();
    await expect(row.getByRole('button',{name:'Reactivate',exact:true})).toBeVisible();
    const persisted=await client.from('vehicles').select('active').eq('id',id).single();expect(persisted.error).toBeNull();expect(persisted.data?.active).toBe(false);
    await page.screenshot({path:info.outputPath('admin-truck-save-context.png'),fullPage:true});
    await page.goto(`/admin/operations?view=CAPACITY&q=${suffix}`);
    await expect(page.locator('.admin-record-list article small')).toContainText('Off Duty');
    await expect(page.locator('.admin-record-list article small')).not.toContainText('Empty truck');
    // A second-page form retains its selected inventory even when the server denies a missing record.
    await page.goto('/admin/operations?view=USERS&page=2');
    const form=page.locator('.admin-record-list form').first();
    await expect(form).toBeVisible();
    await expect(form.locator('input[name="returnTo"]')).toHaveValue('/admin/operations?view=USERS&page=2');
    await form.evaluate((element:HTMLFormElement,missing:string)=>{element.setAttribute('action',`/api/admin/records/user/${missing}`);},randomUUID());
    await form.getByRole('button').click();
    await expect(page).toHaveURL(/view=USERS&page=2&error=/);
    await expect(page.locator('.alert.error')).toBeVisible();
  }finally{
    if(id){
      for(const [table,key] of [['audit_logs','entity_id'],['capacities','vehicle_id'],['vehicles','id']]){
        const removed=await client.from(table).delete().eq(key,id);expect(removed.error).toBeNull();
      }
    }
  }
});

test('provider home displays authoritative counts and latest activity',async({page}:{page:any},info:any)=>{
  const client=localClient();
  const owner=await client.from('profiles').select('id').eq('email','transporter@loadgistic.local').single();expect(owner.error).toBeNull();
  const projection=await client.rpc('workspace_dashboard',{actor_user_id:owner.data!.id});expect(projection.error).toBeNull();
  await login(page,'transporter');
  for(const [label,value] of Object.entries(projection.data.counts)){
    await expect(page.locator('.stat').filter({has:page.getByText(label,{exact:true})}).locator('strong')).toHaveText(String(value));
  }
  if(projection.data.recent.length)await expect(page.locator('a.list-row').first()).toHaveAttribute('href',`/app/provider-shipments/${projection.data.recent[0].id}`);
  await page.screenshot({path:info.outputPath('provider-home.png'),fullPage:true});
});

test('admin stale pagination recovers and regular service areas remain areas',async({page}:{page:any},info:any)=>{
  test.setTimeout(60_000);
  const client=localClient();
  const area=await client.from('profile_routes').select('id,origin').eq('geometry','RADIUS').limit(1).single();expect(area.error).toBeNull();
  await login(page);
  await page.goto('/admin/operations?view=USERS&q=a&page=999999');
  await expect(page.locator('.admin-record-list article').first()).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Search Users'})).toHaveValue('a');
  await expect(page.getByRole('navigation',{name:'Results pages'})).toContainText('Page 1 of');
  const invalid=await page.goto('/admin/operations?view=USERS&page=1.5');expect(invalid?.status()).toBe(200);
  await expect(page.locator('.admin-record-list article').first()).toBeVisible();
  await page.goto(`/admin/operations?view=ROUTES&q=${encodeURIComponent(area.data!.origin)}`);
  const link=page.locator(`a[href="/admin/operations/routes/${area.data!.id}?kind=PROFILE_ROUTE"]`);
  const row=page.locator('.admin-record-list article').filter({has:link});
  await expect(row.locator('small')).toContainText('Service area');
  await expect(row.locator('.status')).toHaveText(/service area/i);
  await expect(row).toContainText(`Area around ${area.data!.origin}`);
  await expect(row).not.toContainText('→');
  await link.click();
  await expect(page.locator('dl div').filter({has:page.locator('dt').getByText('Type',{exact:true})}).locator('dd')).toHaveText('Service area');
  await expect(page.locator('dl')).toContainText(`Area around ${area.data!.origin}`);
  await expect(page.locator('.admin-operation-record-card .status')).toHaveText(/service area/i);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('admin-service-area.png'),fullPage:true});
});
