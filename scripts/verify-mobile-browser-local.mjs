import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Fixed local targets only. Exercise actual Expo screens and local email delivery.
const root=new URL('../',import.meta.url);
assert.match(readFileSync(new URL('.env.local',root),'utf8'),/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:412,height:915}});
const errors=[];page.on('pageerror',error=>errors.push(error.name));
const screenshot=name=>page.screenshot({path:new URL(`.local/mobile-web-preview-${name}.png`,root).pathname});
async function localCode(email,start){
 for(let attempt=0;attempt<30;attempt++){
  const list=await(await fetch('http://127.0.0.1:55324/api/v1/messages',{signal:AbortSignal.timeout(10000)})).json();
  const message=list.messages.find(item=>new Date(item.Created).getTime()>=start-2000&&item.To?.some(to=>to.Address===email));
  if(message){const detail=await(await fetch(`http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(message.ID)}`,{signal:AbortSignal.timeout(10000)})).json();const code=String(detail.Text||detail.HTML||'').match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1];if(code)return code;}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('Local OTP delivery required');
}
try{
 await page.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByLabel('Email',{exact:true}).waitFor({timeout:90000});
 const email=`mobile-browser-${Date.now()}@loadgistic.local`,started=Date.now();
 await page.getByLabel('Email',{exact:true}).fill(email);
 await page.getByRole('button',{name:'Send code',exact:true}).click();
 await page.getByLabel('Sign-in code',{exact:true}).waitFor({timeout:30000});
 await page.getByLabel('Sign-in code',{exact:true}).fill(await localCode(email,started));
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByText('Set up your transporter account',{exact:true}).waitFor({timeout:30000});
 await screenshot('onboarding');
 await page.getByLabel('Your name',{exact:true}).fill('Local Browser Owner');
 await page.getByLabel('Transporter name',{exact:true}).fill('Local Browser Transport');
 await page.getByLabel('Phone number',{exact:true}).fill('+251900000099');
 await page.getByRole('button',{name:'Owner-operator',exact:true}).click();
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await page.getByText(/^Your (?:transport|driving) workspace$/).waitFor({timeout:45000});
 await screenshot('workspace');console.log('PASS: local OTP and provider onboarding');
 await page.reload({waitUntil:'domcontentloaded',timeout:90000});
 await page.getByText(/^Your (?:transport|driving) workspace$/).waitFor({timeout:45000});
 await page.getByRole('button',{name:'Switch view',exact:true}).click();
 await screenshot('area-switch');
 await page.getByRole('button',{name:'Marketplace',exact:true}).click();
 const truck=page.locator('[data-marker-id]').filter({has:page.locator('img')}).first();
 await truck.waitFor({timeout:60000});await truck.click();
 await page.getByRole('button',{name:'Truck details',exact:true}).click();
 await page.getByText('Truck details',{exact:true}).waitFor();await screenshot('truck-modal');
 await page.getByRole('button',{name:'Close map signal details',exact:true}).last().click();
 await page.getByRole('button',{name:'Back to map',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Truck details',exact:true}).count(),0);
 await page.getByRole('button',{name:'Switch view',exact:true}).click();
 await page.getByRole('button',{name:'My workspace',exact:true}).click();
 await page.getByText(/^Your (?:transport|driving) workspace$/).waitFor();
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 const signedOut=page.waitForResponse(response=>response.url().endsWith('/api/mobile/auth/logout')&&response.request().method()==='POST',{timeout:30000});
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 assert.equal((await signedOut).status(),200);
 await page.getByLabel('Email',{exact:true}).waitFor({timeout:30000});
 assert.deepEqual(errors,[]);
 console.log('PASS: visible local OTP, provider onboarding, workspace, session restoration, area switch, map details/return and sign-out. No browser exceptions.');
}catch(error){await screenshot('workflow-failure');console.error('Preview alerts:',await page.getByRole('alert').allTextContents());throw error;}finally{await browser.close();}
