import {expect,test} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {localMailpitNumericCode} from './mailpit-helper';

async function verifyNewEmail(page:any,email:string){
  await page.goto('/login');
  const requested=Date.now();
  await page.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(email);
  await page.getByRole('button',{name:'Email me a code'}).click();
  await expect(page.getByTestId('email-code-form')).toBeVisible();
  const code=await localMailpitNumericCode(email,requested,['Your Loadgistic signup code','Your Loadgistic sign-in code']);
  await page.getByLabel('Six-digit code',{exact:true}).fill(code);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
}

async function selectPlace(page:any,label:string,value:string){
  const input=page.getByRole('combobox',{name:label,exact:true});
  await input.fill(value);
  await page.getByRole('option',{name:new RegExp(value,'i')}).first().click();
}

test('new fleet invites a driver through email, assigns a truck, publishes and revokes access',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(180_000);
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  if(!['localhost','127.0.0.1'].includes(new URL(endpoint).hostname))throw new Error('REMOTE_FLEET_TEST_REFUSED');
  const service=createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
  const suffix=randomUUID().slice(0,8);
  const ownerEmail=`fleet-owner-${suffix}@loadgistic.local`,driverEmail=`fleet-driver-${suffix}@loadgistic.local`;
  const ownerName=`Fleet Owner ${suffix}`,driverName=`Invited Driver ${suffix}`;
  const driverContext=await browser.newContext({baseURL:info.project.use.baseURL,
    viewport:page.viewportSize()||undefined,isMobile:Boolean(info.project.use.isMobile),
    permissions:['geolocation'],geolocation:{latitude:9.03,longitude:38.76},
    extraHTTPHeaders:{'x-forwarded-for':'127.0.0.241'}});
  const driverPage=await driverContext.newPage();
  let orgId='';
  try{
    // No seeded owner, driver, membership or assignment: both identities use the public flow.
    await verifyNewEmail(page,ownerEmail);
    await expect(page.getByTestId('provider-details-form')).toBeVisible();
    await page.getByLabel('Your name',{exact:true}).fill(ownerName);
    await page.getByLabel('Transporter name',{exact:true}).fill(`Workflow Fleet ${suffix}`);
    await page.getByLabel('Account phone',{exact:true}).fill('+251900000011');
    await page.getByRole('button',{name:'Create transporter workspace'}).click();
    await expect(page).toHaveURL(/\/app\/home$/);
    await page.goto('/app/fleet');
    await expect(page.getByText('No trucks added yet.',{exact:true})).toBeVisible();
    const owner=await service.from('profiles').select('id').eq('email',ownerEmail).single();
    expect(owner.error).toBeNull();
    const membership=await service.from('organization_members').select('organization_id').eq('user_id',owner.data!.id).single();
    orgId=membership.data!.organization_id;
    await page.goto('/app/provider-shipments/new');
    await expect(page.getByRole('link',{name:'Add truck'})).toBeVisible();
    await expect(page.locator('form.provider-shipment-form')).toHaveCount(0);
    await page.goto('/app/network');
    await expect(page.getByRole('link',{name:'Manage drivers'})).toBeVisible();
    await page.getByRole('link',{name:'Add truck'}).click();
    await page.getByLabel('Make',{exact:true}).fill('Isuzu');
    await page.getByLabel('Model',{exact:true}).fill('Workflow mini');
    await page.getByLabel('Vehicle configuration',{exact:true}).selectOption('Mini Box Truck');
    await page.getByLabel('Plate number',{exact:true}).fill(`TEST-${suffix}`);
    await page.getByRole('button',{name:'Add truck',exact:true}).click();
    await expect(page.getByRole('region',{name:'Truck driver'})).toContainText('No driver assigned');
    const truckPath=new URL(page.url()).pathname;
    const truckId=truckPath.split('/').at(-1)!;
    await page.getByRole('link',{name:'Assign driver',exact:true}).click();
    await expect(page.locator('.fleet-assignment-context')).toContainText('Workflow mini');
    await page.getByRole('link',{name:'Invite driver',exact:true}).first().click();
    await page.getByLabel('Driver name',{exact:true}).fill(driverName);
    await page.getByLabel('Email',{exact:true}).fill(driverEmail);
    await page.getByLabel('Contact phone',{exact:true}).fill('+251900000022');
    await page.getByRole('button',{name:'Send invitation'}).click();
    await expect(page.getByText('Invitation sent. After the driver accepts, assign their truck here.')).toBeVisible();
    await expect(page.locator('.fleet-invitation-row')).toContainText(driverEmail);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('fleet-invitation.png')});
    const inbox=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
    expect(inbox.messages.some((message:{Subject:string;To:{Address:string}[]})=>message.Subject==='You’re invited to join a fleet on Loadgistic'&&message.To.some(to=>to.Address===driverEmail))).toBe(true);

    await verifyNewEmail(driverPage,driverEmail);
    await expect(driverPage).toHaveURL(/\/join-fleet$/);
    await expect(driverPage.getByRole('heading',{name:`Workflow Fleet ${suffix}`})).toBeVisible();
    await driverPage.screenshot({path:info.outputPath('driver-accept-invitation.png')});
    await driverPage.getByRole('button',{name:'Join fleet',exact:true}).click();
    await expect(driverPage).toHaveURL(/\/app\/home$/);
    await page.reload();
    await expect(page.locator('.fleet-invitation-row')).toHaveCount(0);
    const driver=page.locator('.fleet-driver-manager').filter({hasText:driverName});
    await driver.locator('summary').first().click();
    await expect(driver.getByRole('combobox',{name:'Truck',exact:true})).toHaveValue(truckId);
    await driver.getByLabel('Capacity updates',{exact:true}).check();
    await driver.getByLabel('Tracking updates',{exact:true}).check();
    await driver.getByRole('button',{name:'Save driver',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`${truckPath}\\?success=`));
    await expect(page.getByRole('region',{name:'Truck driver'})).toContainText(driverName);
    await page.locator('.fleet-truck-details-editor>summary').click();
    await page.getByLabel('Model',{exact:true}).fill('Corrected mini');
    await page.getByRole('button',{name:'Save truck details'}).click();
    await expect(page.getByRole('heading',{name:'Isuzu · Corrected mini'})).toBeVisible();

    await driverPage.goto('/app/home');
    await driverPage.getByRole('button',{name:/^Edit current capacity:/}).click();
    const capacity=driverPage.getByRole('dialog',{name:'Current capacity',exact:true});
    await capacity.getByRole('button',{name:'Capacity route',exact:true}).click();
    await selectPlace(driverPage,'City 1','Addis Ababa');
    await selectPlace(driverPage,'City 2','Sebeta');
    await capacity.getByRole('button',{name:'Use my location',exact:true}).click();
    await expect(capacity.getByText(/Location ready/)).toBeVisible();
    const saveResponse=driverPage.waitForResponse((response:any)=>response.url().endsWith('/api/capacity')&&response.request().method()==='POST');
    await capacity.getByRole('button',{name:'Save',exact:true}).click();
    expect(await (await saveResponse).json()).toMatchObject({ok:true});
    await expect(capacity).toHaveCount(0);
    await expect(driverPage.getByRole('button',{name:'Edit current capacity: Empty'})).toBeVisible();
    await driverPage.screenshot({path:info.outputPath('new-driver-published-capacity.png')});
    await driverPage.goto('/app/provider-shipments/new');
    await expect(driverPage.getByRole('combobox',{name:/Truck/})).toBeVisible();
    await driverPage.goto('/app/network');
    await expect(driverPage.getByRole('button',{name:'Add access',exact:true})).toBeVisible();

    await page.goto('/app/fleet');
    const managed=page.locator('.fleet-driver-manager').filter({hasText:driverName});
    await managed.locator('summary').first().click();
    await managed.getByText('Edit contact',{exact:true}).click();
    await managed.getByLabel('Driver name',{exact:true}).fill(`Updated Driver ${suffix}`);
    await managed.getByLabel('Contact phone',{exact:true}).fill('+251900000033');
    await managed.getByRole('button',{name:'Save contact'}).click();
    const updated=page.locator('.fleet-driver-manager').filter({hasText:`Updated Driver ${suffix}`});
    await expect(updated).toContainText('+251900000033');
    await updated.locator('summary').first().click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await updated.screenshot({path:info.outputPath('driver-management.png')});
    await updated.getByText('Remove from fleet',{exact:true}).click();
    await updated.getByLabel('I confirm removal from this fleet.').check();
    await updated.getByRole('button',{name:'Remove driver',exact:true}).click();
    await expect(page.locator('.fleet-driver-manager')).toHaveCount(0);
    await page.goto(truckPath);
    await expect(page.getByRole('region',{name:'Truck driver'})).toContainText('No driver assigned');
    await driverPage.goto('/app/home');
    await expect(driverPage).toHaveURL(/\/login\?error=/);
  }finally{
    await driverContext.close();
    // Exact local test identities only; never reset shared demo fixtures.
    const profiles=await service.from('profiles').select('id').in('email',[ownerEmail,driverEmail]);
    const ids=(profiles.data||[]).map((profile:{id:string})=>profile.id);
    if(orgId){
      for(const table of ['fleet_driver_invitations','audit_logs']){
        const deleted=await service.from(table).delete().eq('organization_id',orgId);expect(deleted.error).toBeNull();
      }
      const capacities=await service.from('capacities').delete().eq('provider_organization_id',orgId);expect(capacities.error).toBeNull();
      const vehicles=await service.from('vehicles').delete().eq('organization_id',orgId);expect(vehicles.error).toBeNull();
      const deleted=await service.from('organizations').delete().eq('id',orgId);expect(deleted.error).toBeNull();
    }
    if(ids.length){
      await service.from('audit_logs').delete().in('actor_user_id',ids);
      await service.from('driver_permissions').delete().in('user_id',ids);
      for(const id of ids){const deleted=await service.auth.admin.deleteUser(id);expect(deleted.error).toBeNull();}
    }
  }
});
