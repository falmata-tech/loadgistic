import {test,expect} from '@playwright/test';
import {localAuditService,auditProvider,checked} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {createManagedOAuthHandoff,MANAGED_OAUTH_COOKIE} from '../../src/lib/managed-oauth-flow.js';
import {createProviderSignupHandoff,MANAGED_SIGNUP_COOKIE} from '../../src/lib/provider-signup.js';

test('email-only login completes a real inbox code and rejects paused Google entry',async({page}:{page:any},info:any)=>{
  test.setTimeout(120000);
  const db=localAuditService(),actor=await auditProvider(db,'email-only');
  try{
    // Even a valid preexisting app handoff cannot resume a paused Google flow.
    const flow='email-only-disabled-flow';
    const cookie=`${MANAGED_OAUTH_COOKIE}=${createManagedOAuthHandoff('ACCESS',flow)}; ${MANAGED_SIGNUP_COOKIE}=${createProviderSignupHandoff()}`;
    for(const route of ['/api/applications/google','/api/auth/google','/api/auth/callback?code=unused&sb_flow_id='+flow]){
      const response=route.includes('callback')
        ?await page.request.get(route,{maxRedirects:0,headers:{cookie}})
        :await page.request.post(route,{maxRedirects:0});
      expect(response.status()).toBe(303);
      const location=new URL(response.headers().location);
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('error')).toBe('Use your email to get a sign-in code.');
      expect(response.headers()['cache-control']).toBe('no-store');
      const cleared=response.headersArray().filter((h:any)=>h.name.toLowerCase()==='set-cookie').map((h:any)=>h.value);
      expect(cleared.some((value:string)=>value.startsWith(MANAGED_OAUTH_COOKIE+'=;')&&value.includes('Max-Age=0'))).toBe(true);
      expect(cleared.some((value:string)=>value.startsWith(MANAGED_SIGNUP_COOKIE+'=;')&&value.includes('Max-Age=0'))).toBe(true);
      expect(cleared.some((value:string)=>value.startsWith('sb-'))).toBe(false);
    }
    await page.goto('/login');
    await expect(page.getByRole('button',{name:'Continue with Google'})).toHaveCount(0);
    await expect(page.locator('.auth-context-panel')).toHaveCount(0);
    const shell=page.getByTestId('auth-access-shell');
    await expect(shell).toBeVisible();
    expect((await shell.boundingBox())!.width).toBeLessThanOrEqual(480);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('login-email.png'),scale:'css'});
    const form=page.getByTestId('email-code-request-form');
    await form.getByLabel('Email',{exact:true}).fill(actor.email);const requested=Date.now();
    await form.getByRole('button',{name:'Email me a code'}).click();
    await expect(page.getByTestId('email-code-form')).toBeVisible({timeout:30000});
    await page.screenshot({path:info.outputPath('login-code.png'),scale:'css'});
    const code=await localMailpitNumericCode(actor.email,requested,['Your Loadgistic signup code','Your Loadgistic sign-in code']);
    await page.getByLabel('Six-digit code',{exact:true}).fill(code==='000000'?'111111':'000000');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(page.getByTestId('email-code-form')).toBeVisible();
    await expect(page.locator('.alert.error')).toBeVisible();
    await page.screenshot({path:info.outputPath('login-invalid-code.png'),scale:'css'});
    await page.getByLabel('Six-digit code',{exact:true}).fill(code);
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(page).toHaveURL(/\/app\/home$/,{timeout:30000});
    await expect(page.locator('.app-main')).toBeVisible();
  }finally{
    checked(await db.from('audit_logs').delete().eq('actor_user_id',actor.id));
    checked(await db.auth.admin.deleteUser(actor.id));
  }
});
