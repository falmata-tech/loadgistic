import {auditDeleteVehicles,auditIdentity,auditLogin,auditProvider,checked,localAuditService} from './audit-helpers';
import {expect,test} from './browser-test';
import {randomUUID} from 'node:crypto';

async function login(page:any,role='admin'){
  await auditLogin(page,`${role}@loadgistic.local`);
}

test('admin capacity wording and platform access match their actual state',async({page}:{page:any},info:any)=>{
  await login(page);
  await page.goto('/admin/operations?view=CAPACITY');
  const rows=page.locator('.admin-record-list article');
  await expect(rows.first()).toBeVisible();
  for(const row of await rows.all()){
    const status=(await row.locator('.status').innerText()).trim().toLowerCase();
    const copy=await row.locator('small').innerText();
    if(status.includes('off duty')){expect(copy).toContain('Off Duty');expect(copy).not.toContain('Empty vehicle');}
    if(status==='empty')expect(copy).toContain('Empty vehicle');
    if(status==='partial')expect(copy).toContain('Partial space');
  }
  await page.goto('/app/more');
  await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();await expect(page.getByText('Platform access',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Contact support for a plan.',{exact:true})).toHaveCount(0);
  await expect(page.locator('form[action="/api/billing/payment-proof"]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('admin-account.png'),fullPage:true});
});

test('admin vehicle save and denied account action return to their searched inventories',async({page}:{page:any},info:any)=>{
  test.setTimeout(120_000);
  const client=localAuditService();const actor=await auditProvider(client,'admin-context');const suffix=randomUUID().slice(0,8);let id='';
  try{
    const created=await client.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{use_basis:'OWNED',make:'Audit',model:suffix,plate:`TEST-${suffix}`,cargo_configuration:'Mini Box Truck'}});expect(created.error).toBeNull();id=created.data.id;
    await login(page);
    const vehicleList=`/admin/operations?view=TRUCKS&q=${suffix}&page=1`;
    await page.goto(vehicleList);
    const row=page.locator('.admin-record-list article').filter({hasText:suffix});
    await expect(row).toHaveCount(1);
    await row.getByRole('link',{name:'Open',exact:true}).click();
    await expect(page.getByRole('link',{name:'Vehicle list',exact:true})).toHaveAttribute('href',vehicleList,{timeout:20000});
    await page.screenshot({path:info.outputPath('admin-vehicle-detail-return.png'),fullPage:true});
    await page.getByRole('button',{name:'Deactivate vehicle',exact:true}).click();
    await page.getByRole('dialog',{name:'Deactivate vehicle',exact:true}).getByRole('button',{name:'Deactivate vehicle',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`view=TRUCKS&q=${suffix}&page=1&success=`));
    await expect(page.locator('.alert.success')).toBeVisible();
    const persisted=await client.from('vehicles').select('active').eq('id',id).single();expect(persisted.error).toBeNull();expect(persisted.data?.active).toBe(false);
    await row.getByRole('link',{name:'Open',exact:true}).click();
    await expect(page).toHaveURL(/\/admin\/operations\/trucks\/[a-f0-9-]+/,{timeout:20000});
    await expect(page.getByRole('button',{name:'Reactivate vehicle',exact:true})).toBeVisible({timeout:20000});
    await page.getByRole('link',{name:'Vehicle list',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`view=TRUCKS&q=${suffix}&page=1`));
    await page.screenshot({path:info.outputPath('admin-truck-save-context.png'),fullPage:true});
    // A denied record action retains the list search even though editing lives on the detail page.
    const accountList=`/admin/operations?${new URLSearchParams({view:'USERS',q:actor.email,page:'1'})}`;
    await page.goto(accountList);
    const accountRow=page.locator('.admin-record-list article').filter({hasText:actor.email});
    await accountRow.getByRole('link',{name:'Open',exact:true}).click();
    await expect(page).toHaveURL(/\/admin\/operations\/users\/[a-f0-9-]+/);
    await expect(page.locator('.admin-operation-record-page').getByRole('link',{name:'Accounts',exact:true})).toHaveAttribute('href',accountList);
    await page.screenshot({path:info.outputPath('admin-account-detail-return.png'),fullPage:true});
    await page.getByRole('button',{name:'Suspend account',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Suspend account',exact:true});
    const form=dialog.locator('form');
    await expect(form.locator('input[name="returnTo"]')).toHaveValue(accountList);
    await form.evaluate((element:HTMLFormElement,missing:string)=>{element.setAttribute('action',`/api/admin/records/user/${missing}`);},randomUUID());
    await dialog.getByRole('button',{name:'Suspend account',exact:true}).click();
    await expect(page).toHaveURL((url:URL)=>url.pathname==='/admin/operations'&&url.searchParams.get('view')==='USERS'&&url.searchParams.get('q')===actor.email&&url.searchParams.get('page')==='1'&&url.searchParams.has('error'));
    await expect(page.locator('.alert.error')).toBeVisible();
  }finally{
    if(id){
      for(const [table,key] of [['audit_logs','entity_id'],['capacities','vehicle_id'],['vehicles','id']]){
        const removed=table==='vehicles'?await auditDeleteVehicles(client,'id',id):await client.from(table).delete().eq(key,id);expect(removed.error).toBeNull();
      }
    }
    checked(await client.from('audit_logs').delete().eq('actor_user_id',actor.id));
    checked(await client.auth.admin.deleteUser(actor.id));
  }
});

test('provider home displays authoritative counts and latest activity',async({page}:{page:any},info:any)=>{
  const client=localAuditService();
  const owner=await auditIdentity(client,'transporter@loadgistic.local');
  const projection=await client.rpc('workspace_dashboard',{actor_user_id:owner.id});expect(projection.error).toBeNull();
  await login(page,'transporter');
  for(const [label,value] of Object.entries(projection.data.counts)){
    await expect(page.locator('.stat').filter({has:page.getByText(label,{exact:true})}).locator('strong')).toHaveText(String(value));
  }
  await page.getByRole('link',{name:'Tracking',exact:true}).filter({visible:true}).first().click();
  if(projection.data.recent.length)await expect(page.locator('a.tracking-row').filter({hasText:projection.data.recent[0].code})).toHaveAttribute('href',`/app/provider-shipments/${projection.data.recent[0].id}`);
  await page.screenshot({path:info.outputPath('provider-home.png'),fullPage:true});
});

test('admin stale pagination recovers and regular service areas remain areas',async({page}:{page:any},info:any)=>{
  test.setTimeout(60_000);
  const client=localAuditService();
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
