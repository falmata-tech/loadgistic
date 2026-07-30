import { chromium } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3000';
const outputDir=path.resolve('artifacts/stress-ui');
const password='Loadgistic123!';

const personas=[
  {
    name:'business',
    email:'business-001@stress.loadgistic.local',
    routes:['/app/shipments?view=MY_LOADS','/app/providers','/app/providers?page=2','/app/providers/blueline-transport?compare=coverage','/app/network','/app/network?view=REQUESTS','/app/network?view=FAVORITES','/app/capacity','/app/capacity?page=2','/app/capacity?visibility=SAVED_PARTNERS']
  },
  {
    name:'fleet',
    email:'transporter@loadgistic.local',
    routes:['/app/home','/app/fleet','/app/loads','/app/shipments']
  },
  {
    name:'generated-fleet',
    email:'fleet-001@stress.loadgistic.local',
    routes:['/app/home','/app/fleet','/app/network','/app/network?view=REQUESTS','/app/loads','/app/loads?page=2','/app/loads?mode=PARTNERS','/app/loads?mode=DIRECT']
  },
  {
    name:'generated-driver',
    email:'driver-001@stress.loadgistic.local',
    routes:['/app/home','/app/network','/app/loads','/app/loads?mode=PARTNERS','/app/loads?mode=DIRECT','/app/capacity']
  },
  {
    name:'expired-workspace',
    email:'expired@loadgistic.local',
    routes:['/app/home','/app/more']
  },
  {
    name:'admin',
    email:'admin@loadgistic.local',
    routes:['/admin/operations','/admin/operations?userPage=2&truckPage=2&loadPage=2&capacityPage=2&workspacePage=2','/admin/applications','/admin/verifications','/admin/ratings','/admin/billing','/app/providers']
  }
];

const viewports=[
  {name:'desktop',width:1440,height:1000},
  {name:'mobile',width:412,height:915,isMobile:true}
];

const cohortExpectations=new Map([
  ['business:/app/network',['Horizon Freight 001 PLC','Owner Operator 001']],
  ['business:/app/network?view=REQUESTS',['Horizon Freight 002 PLC']],
  ['business:/app/network?view=FAVORITES',['Owner Operator 002']],
  ['business:/app/capacity?visibility=SAVED_PARTNERS',['LG-TRK-S00101']],
  ['generated-fleet:/app/network',['Rift Valley Foods 001 PLC','Sheba Textiles 002 PLC']],
  ['generated-fleet:/app/network?view=REQUESTS',['Highland Honey 003 PLC','Unity Leather 006 PLC']],
  ['generated-fleet:/app/loads?mode=PARTNERS',['Partners-only coffee cartons to Hawassa']],
  ['generated-fleet:/app/loads?mode=DIRECT',['Direct flour request for Horizon Freight 001']],
  ['generated-driver:/app/network',['Rift Valley Foods 001 PLC']],
  ['generated-driver:/app/loads?mode=PARTNERS',['Partners-only coffee cartons to Hawassa']],
  ['generated-driver:/app/loads?mode=DIRECT',['Direct furniture request for Owner Operator 001']]
]);

function slug(value){
  return value.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-').replace(/-+$/,'')||'home';
}

function actionableBrowserErrors(errors){
  return errors.filter(message=>!(
    message.includes('hydrated but some attributes')&&
    (message.includes('caret-color')||message.includes('style={{'))
  ));
}

async function gotoReady(page,route){
  for(let attempt=0;attempt<3;attempt+=1){
    const started=Date.now();
    try{
      const response=await page.goto(`${baseURL}${route}`,{waitUntil:'domcontentloaded',timeout:30_000});
      return {response,elapsedMs:Date.now()-started,navigationRetries:attempt};
    }catch(error){
      const transient=[
        'ERR_ABORTED',
        'ERR_CONNECTION_RESET',
        'ERR_EMPTY_RESPONSE',
        'ERR_INCOMPLETE_CHUNKED_ENCODING',
        'ERR_NETWORK_IO_SUSPENDED',
        'Timeout'
      ].some(message=>String(error).includes(message));
      if(!transient||attempt===2)throw error;
      await page.waitForTimeout(1_000*(attempt+1));
    }
  }
}

async function login(page,email){
  await gotoReady(page,'/login');
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
        const navigation=await gotoReady(page,route);
        await page.waitForTimeout(500);
        if(await page.locator('.loading-map').count()){
          await page.locator('.leaflet-container').first().waitFor({state:'visible',timeout:10_000});
        }
        const metrics=await page.evaluate(()=>({
          clientWidth:document.documentElement.clientWidth,
          scrollWidth:document.documentElement.scrollWidth,
          scrollHeight:document.documentElement.scrollHeight,
          domNodes:document.getElementsByTagName('*').length,
          cards:document.querySelectorAll('.card').length,
          links:document.querySelectorAll('a').length,
          buttons:document.querySelectorAll('button').length
        }));
        const expectsSecondPage=/[?&](?:page|userPage|truckPage|loadPage|capacityPage|workspacePage)=2(?:&|$)/.test(route);
        const secondPageVisible=!expectsSecondPage||await page.getByText(/Page 2 of/).count()>0;
        const expectedContent=cohortExpectations.get(`${persona.name}:${route}`)||[];
        const bodyText=expectedContent.length?await page.locator('body').innerText():'';
        const cohortContentVisible=expectedContent.every(value=>bodyText.includes(value));
        const file=`${viewport.name}-${persona.name}-${slug(route)}.png`;
        await page.screenshot({path:path.join(outputDir,file),fullPage:false});
        if(route.includes('compare=coverage')){
          await page.locator('.profile-route-coverage').screenshot({
            path:path.join(outputDir,`${viewport.name}-${persona.name}-route-comparison-detail.png`)
          });
        }
        const actionableErrors=actionableBrowserErrors(browserErrors);
        results.push({
          viewport:viewport.name,
          persona:persona.name,
          route,
          status:navigation.response?.status()||null,
          elapsedMs:navigation.elapsedMs,
          navigationRetries:navigation.navigationRetries,
          ...metrics,
          horizontalOverflow:metrics.scrollWidth>metrics.clientWidth,
          secondPageVisible,
          cohortContentVisible,
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
  !result.secondPageVisible||
  !result.cohortContentVisible||
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
