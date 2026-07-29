import { chromium } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3000';
const outputDir=path.resolve('artifacts/stress-ui');
const password='Loadgistic123!';

const personas=[
  {
    name:'business',
    email:'shipper@loadgistic.local',
    routes:['/app/shipments?view=MY_LOADS','/app/providers','/app/network','/app/capacity']
  },
  {
    name:'fleet',
    email:'transporter@loadgistic.local',
    routes:['/app/home','/app/fleet','/app/loads','/app/shipments']
  },
  {
    name:'generated-fleet',
    email:'fleet-001@stress.loadgistic.local',
    routes:['/app/home','/app/fleet','/app/loads']
  },
  {
    name:'generated-driver',
    email:'driver-001@stress.loadgistic.local',
    routes:['/app/home','/app/loads','/app/capacity']
  },
  {
    name:'admin',
    email:'admin@loadgistic.local',
    routes:['/admin/operations','/admin/applications','/admin/verifications','/admin/ratings','/admin/billing','/app/providers']
  }
];

const viewports=[
  {name:'desktop',width:1440,height:1000},
  {name:'mobile',width:412,height:915,isMobile:true}
];

function slug(value){
  return value.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-').replace(/-+$/,'')||'home';
}

function actionableBrowserErrors(errors){
  return errors.filter(message=>!(
    message.includes('hydrated but some attributes')&&
    (message.includes('caret-color')||message.includes('style={{'))
  ));
}

async function login(page,email){
  await page.goto(`${baseURL}/login`,{waitUntil:'domcontentloaded',timeout:30_000});
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Log in'}).click();
  await page.waitForURL('**/app/home',{timeout:30_000});
}

await rm(outputDir,{recursive:true,force:true});
await mkdir(outputDir,{recursive:true});
const browser=await chromium.launch();
const results=[];

try{
  for(const viewport of viewports){
    for(const persona of personas){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:Boolean(viewport.isMobile)});
      const page=await context.newPage();
      const browserErrors=[];
      page.on('pageerror',error=>browserErrors.push(error.message));
      page.on('console',message=>{
        if(message.type()==='error')browserErrors.push(message.text());
      });
      await login(page,persona.email);
      for(const route of persona.routes){
        const started=Date.now();
        const response=await page.goto(`${baseURL}${route}`,{waitUntil:'domcontentloaded',timeout:30_000});
        await page.waitForTimeout(500);
        const metrics=await page.evaluate(()=>({
          clientWidth:document.documentElement.clientWidth,
          scrollWidth:document.documentElement.scrollWidth,
          scrollHeight:document.documentElement.scrollHeight,
          domNodes:document.getElementsByTagName('*').length,
          cards:document.querySelectorAll('.card').length,
          links:document.querySelectorAll('a').length,
          buttons:document.querySelectorAll('button').length
        }));
        const file=`${viewport.name}-${persona.name}-${slug(route)}.png`;
        await page.screenshot({path:path.join(outputDir,file),fullPage:false});
        const actionableErrors=actionableBrowserErrors(browserErrors);
        results.push({
          viewport:viewport.name,
          persona:persona.name,
          route,
          status:response?.status()||null,
          elapsedMs:Date.now()-started,
          ...metrics,
          horizontalOverflow:metrics.scrollWidth>metrics.clientWidth,
          browserErrors:actionableErrors
        });
        browserErrors.length=0;
      }
      await context.close();
    }
  }
}finally{
  await browser.close();
}

const failures=results.filter(result=>
  (result.status!==null&&result.status!==200)||
  result.horizontalOverflow||
  result.browserErrors.length>0||
  result.elapsedMs>30_000
);
const summary={
  baseURL,
  screens:results.length,
  failures:failures.length,
  slowest:[...results].sort((a,b)=>b.elapsedMs-a.elapsedMs).slice(0,8).map(({viewport,persona,route,elapsedMs,domNodes,cards})=>({viewport,persona,route,elapsedMs,domNodes,cards})),
  results
};
await writeFile(path.join(outputDir,'report.json'),JSON.stringify(summary,null,2));
console.log(`Stress UI audit captured ${results.length} viewport screens in ${outputDir}.`);
console.log(`Failures: ${failures.length}. Slowest route: ${summary.slowest[0]?.route||'none'} in ${summary.slowest[0]?.elapsedMs||0} ms.`);
if(failures.length){
  console.error(JSON.stringify(failures,null,2));
  process.exitCode=1;
}
