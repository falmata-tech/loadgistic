import {test,expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {grantPrivateCapacityAccess,listPrivateCapacityNetwork,revokePrivateCapacityAccess} from '../../src/lib/private-capacity.js';
import {localMailpitNumericCode} from './mailpit-helper';

async function verifyShell(page:any,testInfo:any,surface:string){
  await expect(page.locator('.leaflet-container')).toBeVisible({timeout:30_000});
  const phone=testInfo.project.name.includes('mobile');
  const viewports=phone?[[320,640],[390,844],[760,900]]:
    [[761,900],[1024,768],[1180,900],[1181,900],[1440,900],[1920,1080],[2560,900]];
  const captures=path.resolve('artifacts/map-shell-2026-09-14');
  mkdirSync(captures,{recursive:true});
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});
    await expect.poll(async()=>page.evaluate(()=>{
      const box=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
      const header=box('.public-header');
      const nav=box(innerWidth<=760?'.public-mobile-nav':'.public-workspace-nav');
      const workspace=box('.home-market-shell');
      const tools=box('.market-command-column');
      const map=box('.public-map-shell');
      const sessionBar=document.querySelector('.shared-capacity-session-bar')?.getBoundingClientRect();
      return {
        navigationClear:innerWidth>1180?workspace.left>=nav.right+8:
          innerWidth>760?workspace.top>=nav.bottom:workspace.bottom<=nav.top,
        headerClear:workspace.top>=header.bottom,
        withinViewport:workspace.right<=innerWidth&&workspace.bottom<=innerHeight,
        toolsContained:tools.left>=workspace.left&&tools.right<=workspace.right,
        sessionClear:!sessionBar||(sessionBar.bottom<=workspace.top&&sessionBar.left>=workspace.left&&sessionBar.right<=workspace.right),
        usableMap:map.width>=Math.min(280,innerWidth-10)&&map.height>=(innerHeight<=640?300:400),
        noDocumentOverflow:document.documentElement.scrollWidth<=innerWidth&&
          document.documentElement.scrollHeight<=innerHeight,
      };
    }),{message:`Navigation and map bounds at ${width}px`}).toEqual({
      navigationClear:true,headerClear:true,withinViewport:true,
      toolsContained:true,sessionClear:true,usableMap:true,noDocumentOverflow:true,
    });
    await page.getByRole('button',{name:'Filters',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Filters',exact:true});
    await expect(dialog).toBeVisible();
    const bounds=await dialog.boundingBox();
    expect(bounds).toBeTruthy();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(height);
    if([320,390,1024,1920].includes(width))await page.screenshot({path:path.join(captures,`${surface}-filters-${width}.png`),scale:'css'});
    await dialog.getByRole('button',{name:'Close filters'}).click();
    await expect(dialog).not.toBeVisible();
    if([320,390,1024,1920].includes(width)){
      await expect(page.locator('.public-feed-overlay.loading')).not.toBeVisible({timeout:30_000});
      await page.screenshot({path:path.join(captures,`${surface}-map-${width}.png`),scale:'css'});
    }
  }
  const nav=page.getByRole('navigation',{name:phone?'Public mobile navigation':'Public workspace navigation',exact:true});
  await nav.getByRole('link',{name:'About',exact:true}).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator('main.public-market-workspace')).toHaveCount(0);
}

test('map and search reserve navigation space at every shell breakpoint',async({page}:{page:any},testInfo:any)=>{
  test.setTimeout(120_000);
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await verifyShell(page,testInfo,'open');
});

test('email-unlocked private map reserves navigation and logout space',async({page}:{page:any},testInfo:any)=>{
  test.setTimeout(120_000);
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  const target=new URL(endpoint);
  if(!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  const service=createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:actor,error}=await service.from('profiles').select('id,role').eq('email','transporter@loadgistic.local').single();
  expect(error).toBeNull();
  const vehicles=await listPrivateCapacityNetwork(actor);
  expect(vehicles.length).toBeGreaterThan(0);
  const email=`shell-${randomUUID()}@example.test`;
  await grantPrivateCapacityAccess(actor,{vehicleId:vehicles[0].id,email});
  try{
    await page.goto('/shared-capacity');
    await page.getByLabel('Email',{exact:true}).fill(email);
    const requestedAt=Date.now();
    await page.getByRole('button',{name:'Continue with email'}).click();
    await expect(page.getByLabel('One-time code')).toBeVisible({timeout:30_000});
    await page.getByLabel('One-time code').fill(await localMailpitNumericCode(email,requestedAt,'Your Private capacity code'));
    await page.getByRole('button',{name:'Open private capacity'}).click();
    await expect(page.getByRole('region',{name:'Privately shared truck capacity'})).toBeVisible({timeout:30_000});
    await verifyShell(page,testInfo,'private');
    await page.goto('/shared-capacity');
    await page.getByRole('button',{name:'Log out',exact:true}).click();
    await expect(page.getByRole('button',{name:'Continue with email'})).toBeVisible({timeout:30_000});
  }finally{
    const network=await listPrivateCapacityNetwork(actor);
    for(const vehicle of network)for(const grant of vehicle.grants){
      if(grant.recipient_email===email&&!grant.revoked_at)await revokePrivateCapacityAccess(actor,grant.id);
    }
  }
});
