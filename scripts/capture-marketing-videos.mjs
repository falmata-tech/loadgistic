import { spawn } from 'node:child_process';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3000';
const outputDir=path.resolve('artifacts/marketing');
const workDir=path.join(outputDir,'.recording');
const password='Loadgistic123!';
const viewport={width:1280,height:720};

const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

async function run(command,args){
  await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:'inherit'});
    child.once('error',reject);
    child.once('exit',code=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)));
  });
}

async function loginState(browser,email){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  await page.goto(`${baseURL}/login`,{waitUntil:'domcontentloaded'});
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Log in'}).click();
  await page.waitForURL('**/app/home');
  const state=await context.storageState();
  await context.close();
  return state;
}

async function caption(page,text){
  await page.evaluate(value=>{
    document.querySelector('[data-demo-caption]')?.remove();
    const element=document.createElement('div');
    element.dataset.demoCaption='true';
    element.textContent=value;
    Object.assign(element.style,{
      position:'fixed',left:'32px',bottom:'28px',zIndex:'999999',maxWidth:'680px',
      padding:'14px 18px',background:'rgba(10,31,61,.94)',color:'#fff',
      border:'1px solid rgba(255,255,255,.24)',borderRadius:'6px',
      font:'700 22px/1.25 Arial, sans-serif',boxShadow:'0 12px 28px rgba(0,0,0,.25)'
    });
    document.body.append(element);
  },text);
}

async function open(page,route,label,wait=3500){
  await page.goto(`${baseURL}${route}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(600);
  await caption(page,label);
  await page.waitForTimeout(wait);
}

async function scroll(page,top,label,wait=3200){
  await page.evaluate(value=>window.scrollTo({top:value,behavior:'smooth'}),top);
  await page.waitForTimeout(700);
  await caption(page,label);
  await page.waitForTimeout(wait);
}

async function record(browser,name,state,journey){
  const context=await browser.newContext({
    viewport,
    storageState:state,
    recordVideo:{dir:workDir,size:viewport}
  });
  const page=await context.newPage();
  await journey(page);
  const video=page.video();
  await context.close();
  const videoPath=await video.path();
  const target=path.join(workDir,`${name}.webm`);
  await rename(videoPath,target);
  return target;
}

await rm(workDir,{recursive:true,force:true});
await mkdir(workDir,{recursive:true});

const health=await fetch(`${baseURL}/api/health`).catch(()=>null);
if(!health?.ok)throw new Error(`Start Loadgistic first at ${baseURL}`);

const browser=await chromium.launch({headless:true});
try{
  const businessState=await loginState(browser,'shipper@loadgistic.local');
  const transporterState=await loginState(browser,'transporter@loadgistic.local');
  const driverState=await loginState(browser,'driver@loadgistic.local');

  const short=await record(browser,'short',undefined,async page=>{
    await open(page,'/','Ethiopia\'s shipment demand and truck capacity, in one live marketplace.',4200);
    await scroll(page,330,'See routes, deadlines, truck needs, and shared-shipment opportunities.',4200);
    await page.getByRole('tab',{name:'Truck Board'}).click();
    await caption(page,'Truck availability is visible. Identity and contact stay protected until login.');
    await page.waitForTimeout(5200);
  });

  const business=await record(browser,'long-business',businessState,async page=>{
    await open(page,'/app/shipments/new','1. A Business posts the shipment, route, deadline, and truck need.',4200);
    await scroll(page,620,'The visual truck catalog replaces confusing tonnage labels.',3500);
    await scroll(page,1600,'Choose Public, Partners, or one direct transporter, then publish.',3500);
    await open(page,'/app/shipments/shp-tracking-setup','2. After agreement, the Business chooses the tracking rule.',4500);
    await scroll(page,420,'Status updates stay simple. Approximate location is available when needed.',4000);
    await open(page,'/app/shipments?view=TRACKING','Tracking stays inside My Shipments with the work already agreed.',4000);
  });

  const transporter=await record(browser,'long-transporter',transporterState,async page=>{
    await open(page,'/app/loads','3. Transporters discover real shipment demand and express interest.',4000);
    await open(page,'/app/loads?board=POOLED','Partial shipments can pool or connect as work along the route.',4200);
    await scroll(page,360,'Matching is a discovery aid. Each original shipment remains independent.',3500);
    await open(page,'/app/fleet','4. Fleet owners manage trucks and Drivers from My Fleet.',4000);
    await open(page,'/app/fleet/veh-trans-1','Each truck gets its own clear capacity workflow.',4000);
    await scroll(page,520,'Empty, Partial, and Off Duty are direct operational choices.',3500);
  });

  const driver=await record(browser,'long-driver',driverState,async page=>{
    await open(page,'/app/home','5. A self-managed Driver keeps capacity and general location fresh.',4200);
    await scroll(page,430,'Partial space is tied to its live route. Phone location is obscured for safety.',4200);
    await scroll(page,1320,'Shipment size, stops, future work, and visibility follow in order.',4200);
    await open(page,'/app/shipments','One workspace keeps interests, direct work, tracking, and history together.',4200);
  });

  await run('ffmpeg',['-y','-i',short,'-an','-r','30','-c:v','libx264','-preset','medium','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(outputDir,'loadgistic-short-demo.mp4')]);
  await run('ffmpeg',[
    '-y','-i',business,'-i',transporter,'-i',driver,
    '-filter_complex','[0:v]setpts=PTS-STARTPTS[v0];[1:v]setpts=PTS-STARTPTS[v1];[2:v]setpts=PTS-STARTPTS[v2];[v0][v1][v2]concat=n=3:v=1:a=0[v]',
    '-map','[v]','-an','-r','30','-c:v','libx264','-preset','medium','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(outputDir,'loadgistic-long-demo.mp4')
  ]);
}finally{
  await browser.close();
}

await rm(workDir,{recursive:true,force:true});
await sleep(50);
console.log(`Created ${path.join(outputDir,'loadgistic-short-demo.mp4')}`);
console.log(`Created ${path.join(outputDir,'loadgistic-long-demo.mp4')}`);
