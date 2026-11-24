import type {Page} from 'playwright-core';
import {expect} from './browser-test';
import {auditTrackingOwnerLogin} from './audit-helpers';
import {issueTrackingFixtureLink,cleanupTrackingOwnerFixtures} from './tracking-session-fixtures';
import {localMailpitNumericCode} from './mailpit-helper';
const preview='http://localhost:8084';
const cleanups:Array<()=>Promise<void>>=[];

// afterEach owns teardown so an expired test body cannot race deletion of the
// registered owner before its exact shipment, proof and vehicle are removed.
export function registerNativeTrackingCleanup(cleanup:()=>Promise<void>){cleanups.push(cleanup);}
export async function cleanupNativeTrackingFixtures(page:Page){
 const tasks=cleanups.splice(0),errors:unknown[]=[];
 try{if(!page.isClosed())await page.goto('about:blank',{timeout:5000});}catch(error){errors.push(error);}
 for(const cleanup of tasks.reverse())try{await cleanup();}catch(error){errors.push(error);}
 try{await cleanupTrackingOwnerFixtures();}catch(error){errors.push(error);}
 if(errors.length)throw new AggregateError(errors,'NATIVE_TRACKING_FIXTURE_CLEANUP_FAILED');
}

// A normal registered owner deliberately issues the guest credentials. Nothing
// is inserted into a guest table or inferred from an email match.
export async function issueNativeTrackingLink(page:Page,email:string,shipmentId:string,allowLocation=false){
 const browser=page.context().browser();if(!browser)throw Error('LOCAL_BROWSER_REQUIRED');
 const owner=await browser.newContext();
 try{const ownerPage=await owner.newPage(),session=await auditTrackingOwnerLogin(ownerPage,email,shipmentId),link=await issueTrackingFixtureLink(ownerPage,session.id,allowLocation);return {sessionId:session.id,link};}
 finally{await owner.close();}
}
export async function openNativeTrackingLink(page:Page,link:{url:string;code:string}){
 const trackingId=decodeURIComponent(new URL(link.url).pathname.split('/').pop()||'');
 expect(trackingId.length).toBeGreaterThan(0);
 await page.goto(preview+'/visitor-tracking',{waitUntil:'domcontentloaded'});
 await expect(page.getByLabel('Your email',{exact:true})).toHaveCount(0);
 await page.getByLabel('Tracking ID',{exact:true}).fill(trackingId);
 await page.getByLabel('Tracking code',{exact:true}).fill(link.code);
 const opened=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/tracking/access'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Open tracking',exact:true}).click();const response=await opened;expect(response.status()).toBe(200);
 const result=await response.json();expect(result.ok).toBe(true);expect(result.data.session.workspaceId).toBeNull();expect(result.data.session.links).toEqual([]);expect(Object.values(result.data.session.capabilities).some(Boolean)).toBe(false);
 const entryAction=result.data.session.state==='PENDING_PROVIDER'?'Close Tracking':'Open shipment progress';
 await expect(page.getByRole('button',{name:entryAction,exact:true})).toBeVisible();
 return result.data.session;
}
export async function nativeTrackingAccountLogin(page:Page,email:string){
 await page.goto(preview+'/account');await page.getByLabel('Email',{exact:true}).fill(email);
 const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();
 await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(email,since,['Your Loadgistic sign-in code','Your Loadgistic signup code']));
 await page.getByRole('button',{name:'Sign in',exact:true}).last().click();
 await expect(page.getByLabel('Sign-in code',{exact:true})).toHaveCount(0);
}
