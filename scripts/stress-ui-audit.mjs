import { chromium } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3100';
const outputDir=path.resolve('artifacts/stress-ui');
const password='Loadgistic123!';

const personas=[
  {name:'fleet-transporter',email:'transporter@loadgistic.local',home:'/app/home',routes:['/app/home','/app/fleet','/app/fleet/veh-trans-1','/app/provider-shipments','/app/provider-shipments/new','/app/company-page','/app/verification','/app/support','/app/more']},
  {name:'self-managed-driver',email:'driver@loadgistic.local',home:'/app/home',routes:['/app/home','/app/capacity','/app/provider-shipments','/app/provider-shipments/new','/app/company-page','/app/verification','/app/support','/app/more']},
  {name:'company-driver',email:'company-driver@loadgistic.local',home:'/app/home',routes:['/app/home','/app/capacity','/app/provider-shipments','/app/verification','/app/support','/app/more']},
  {name:'admin',email:'admin@loadgistic.local',home:'/app/home',routes:['/admin/operations','/admin/operations?view=WORKSPACES&page=2','/admin/operations?view=TRUCKS&page=2','/admin/operations?view=DRIVERS','/admin/operations?view=TRACKING','/admin/operations?view=CAPACITY&page=2','/admin/featured','/admin/reviews?tab=documents','/admin/reviews?tab=ratings','/admin/support']},
  {name:'support-agent',email:'support@loadgistic.local',home:'/support',routes:['/support','/support?view=WAITING','/support?view=CLOSED']}
];

const viewports=[
  {name:'desktop',width:1440,height:1000},
  {name:'mobile',width:412,height:915,isMobile:true}
];

function slug(value){return value.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-').replace(/-+$/,'')||'home';}
function actionableBrowserErrors(errors){return errors.filter(message=>!message.includes('caret-color'));}

async function gotoReady(page,route){
  for(let attempt=0;attempt<3;attempt+=1){
    const started=Date.now();
    try{
      const response=await page.goto(`${baseURL}${route}`,{waitUntil:'domcontentloaded',timeout:30_000});
      await page.locator('.loading-map').waitFor({state:'hidden',timeout:10_000}).catch(()=>{});
      await page.waitForTimeout(300);
      return {response,elapsedMs:Date.now()-started,navigationRetries:attempt};
    }catch(error){
      const transient=['ERR_ABORTED','ERR_CONNECTION_RESET','ERR_EMPTY_RESPONSE','ERR_INCOMPLETE_CHUNKED_ENCODING','ERR_NETWORK_IO_SUSPENDED','Timeout'].some(message=>String(error).includes(message));
      if(!transient||attempt===2)throw error;
      await page.waitForTimeout(1_000*(attempt+1));
    }
  }
}

async function login(page,persona){
  await gotoReady(page,'/login');
  await page.locator('details.auth-fixture-login>summary').click();
  await page.getByLabel('Email').fill(persona.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Log in'}).click();
  await page.waitForURL(`**${persona.home}`,{timeout:30_000});
}

async function metrics(page){
  return page.evaluate(()=>({
    clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    scrollHeight:document.documentElement.scrollHeight,
    domNodes:document.getElementsByTagName('*').length,
    links:document.querySelectorAll('a').length,
    buttons:document.querySelectorAll('button').length,
    unlabeledControls:[...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(element=>!element.getAttribute('aria-label')&&!element.id&&!element.closest('label')).length,
    emptyActions:[...document.querySelectorAll('button,a.button')].filter(element=>!element.textContent?.trim()&&!element.getAttribute('aria-label')).length
  }));
}

await rm(outputDir,{recursive:true,force:true});
await mkdir(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];

try{
  for(const viewport of viewports){
    const publicContext=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:Boolean(viewport.isMobile)});
    const publicPage=await publicContext.newPage();
    const publicErrors=[];
    publicPage.on('pageerror',error=>publicErrors.push(error.message));
    publicPage.on('console',message=>{if(message.type()==='error')publicErrors.push(message.text());});
    const publicNavigation=await gotoReady(publicPage,'/');
    await publicPage.getByRole('button',{name:'List',exact:true}).click();
    const firstPage=publicPage.locator('.public-capacity-card');
    await firstPage.first().waitFor({state:'visible',timeout:15_000});
    const firstIds=await firstPage.evaluateAll(cards=>cards.map(card=>card.textContent));
    const next=publicPage.getByRole('button',{name:'Next',exact:true});
    const nextEnabled=await next.isEnabled();
    if(nextEnabled)await next.click();
    await publicPage.getByText('Page 2',{exact:true}).waitFor({state:'visible',timeout:15_000}).catch(()=>{});
    const secondIds=await firstPage.evaluateAll(cards=>cards.map(card=>card.textContent));
    const publicMetrics=await metrics(publicPage);
    await publicPage.screenshot({path:path.join(outputDir,`${viewport.name}-public-truck-market-page-2.png`),fullPage:false});
    results.push({viewport:viewport.name,persona:'public',route:'/#capacity-market-list',status:publicNavigation.response?.status()||null,elapsedMs:publicNavigation.elapsedMs,...publicMetrics,horizontalOverflow:publicMetrics.scrollWidth>publicMetrics.clientWidth,paginationAdvanced:nextEnabled&&JSON.stringify(firstIds)!==JSON.stringify(secondIds),browserErrors:actionableBrowserErrors(publicErrors.splice(0))});
    for(const route of ['/featured','/about','/track','/login','/apply','/@blueline-transport']){
      const navigation=await gotoReady(publicPage,route);const pageMetrics=await metrics(publicPage);
      results.push({viewport:viewport.name,persona:'public',route,status:navigation.response?.status()||null,elapsedMs:navigation.elapsedMs,...pageMetrics,horizontalOverflow:pageMetrics.scrollWidth>pageMetrics.clientWidth,paginationAdvanced:true,browserErrors:actionableBrowserErrors(publicErrors.splice(0))});
    }
    await publicContext.close();

    for(const persona of personas){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:Boolean(viewport.isMobile)});
      const page=await context.newPage();const browserErrors=[];
      page.on('pageerror',error=>browserErrors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text());});
      await login(page,persona);
      for(const route of persona.routes){
        const navigation=await gotoReady(page,route);const pageMetrics=await metrics(page);
        const expectsPageTwo=/[?&]page=2(?:&|$)/.test(route);
        const secondPageVisible=!expectsPageTwo||await page.getByText(/Page 2 of/).count()>0;
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-${persona.name}-${slug(route)}.png`),fullPage:false});
        results.push({viewport:viewport.name,persona:persona.name,route,status:navigation.response?.status()||null,elapsedMs:navigation.elapsedMs,...pageMetrics,horizontalOverflow:pageMetrics.scrollWidth>pageMetrics.clientWidth,paginationAdvanced:secondPageVisible,browserErrors:actionableBrowserErrors(browserErrors.splice(0))});
      }
      await context.close();
    }
  }
}finally{await browser.close();}

const failures=results.filter(result=>(result.status!==null&&result.status!==200)||result.horizontalOverflow||!result.paginationAdvanced||result.unlabeledControls||result.emptyActions||result.browserErrors.length||result.elapsedMs>30_000);
const summary={baseURL,generatedAt:new Date().toISOString(),screens:results.length,failures:failures.length,slowest:[...results].sort((a,b)=>b.elapsedMs-a.elapsedMs).slice(0,8).map(({viewport,persona,route,elapsedMs,domNodes})=>({viewport,persona,route,elapsedMs,domNodes})),results};
await writeFile(path.join(outputDir,'report.json'),`${JSON.stringify(summary,null,2)}\n`);
console.log(`Current-product stress audit captured ${results.length} viewport screens in ${outputDir}.`);
console.log(`Failures: ${failures.length}. Slowest route: ${summary.slowest[0]?.route||'none'} in ${summary.slowest[0]?.elapsedMs||0} ms.`);
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exitCode=1;}
