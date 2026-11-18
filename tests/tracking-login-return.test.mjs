import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as authFlow from '../src/lib/auth-flow.js';
import {signupAudience,signupEntry} from '../src/lib/signup-audience.js';
import {managedBusinessContext} from '../src/lib/identity/business-context.js';

function compile(path,ports){
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 new Function('require','exports',code)(name=>{assert.ok(name in ports,'unreviewed port: '+name);return ports[name];},exports);return exports;
}
const jsx=(type,props)=>({type,props:props||{}}),redirect=path=>{throw Error('REDIRECT:'+path);};
function login(user=null){
 const page=compile('src/app/login/page.tsx',{
  'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'Link'},'next/headers':{cookies:async()=>({get:()=>({value:'synthetic-handoff'})})},'next/navigation':{redirect},
  '@/components/localization':{Text:'Text',Localized:'Localized'},'lucide-react':Object.fromEntries(['KeyRound','LockKeyhole','LogIn','Mail','RotateCcw','Send'].map(name=>[name,name])),
  '@/components/public-auth-shell':{PublicAuthShell:'AuthShell'},'@/components/public-header':{PublicHeader:'Header'},'@/components/flash':{Flash:'Flash'},
  '@/lib/auth':{getCurrentUser:async()=>user},'@/lib/signup-audience.js':{signupEntry},'@/lib/auth-flow.js':{...authFlow,localAuthInboxUrl:()=>null,localFixturePasswordLoginEnabled:()=>false},
  '@/lib/provider-signup.js':{MANAGED_SIGNUP_COOKIE:'fixture-handoff',readProviderSignupHandoff:()=>({email:'synthetic@example.test'}),maskedProviderSignupEmail:()=> 'synthetic masked address'}
 });return query=>page.default({searchParams:Promise.resolve(query)});
}
function nodes(value){
 if(Array.isArray(value))return value.flatMap(nodes);if(!value||typeof value!=='object')return[];
 return[value,...nodes(typeof value.type==='function'?value.type(value.props):value.props?.children)];
}
function verifier(projection,{verified=true}={}){
 const calls=[],ports={
  'next/server.js':{NextResponse:{redirect:(location,status)=>{const response=new Response(null,{status,headers:{location:String(location)}});response.cookies={set:()=>{}};return response;}}},
  '@/lib/auth-flow.js':authFlow,'@/lib/identity/supabase':{getManagedCurrentUser:async()=>projection},'@/lib/fleet-driver-management':{hasJoinableFleetInvitation:async()=>false},
  '@/lib/provider-signup.js':{MANAGED_SIGNUP_COOKIE:'fixture-handoff',readProviderSignupHandoff:()=>({email:'synthetic@example.test'}),managedProviderSignupEligible:async()=>false},
  '@/lib/managed-oauth-flow.js':{MANAGED_OAUTH_COOKIE:'fixture-oauth'},'@/lib/rate-limit':{checkRateLimit:async()=>({allowed:true}),requestKey:()=> 'synthetic-rate-key'},
  '@/lib/redirects':{redirectUrl:(request,path)=>new URL(path,request.url),text:(form,key)=>String(form.get(key)||'')},
  '@/lib/supabase/route':{createSupabaseRouteClient:()=>({auth:{verifyOtp:async()=>{calls.push('verify');return{data:{user:{id:'synthetic',email:'synthetic@example.test'}},error:verified?null:Error('SYNTHETIC_INVALID_CODE')};},signOut:async()=>calls.push('signOut')}})},
  '@/lib/signup-audience.js':{signupAudience,signupEntry}
 };
 const api=compile('src/app/api/applications/email-otp/verify/route.ts',ports);
 return{calls,post:async from=>{const body=new FormData();body.set('code','123456');body.set('audience','EXISTING');body.set('from',from);const request=new Request('https://loadgistic.com/api/applications/email-otp/verify',{method:'POST',body});request.cookies={get:()=>({value:'synthetic-handoff'})};return api.POST(request);}};
}

test('fixed Tracking intent never chooses an arbitrary return URL or changes provider/platform role destinations',()=>{
 for(const role of['CUSTOMER','SHIPPER','RECEIVER'])assert.equal(authFlow.managedAccountLoginDestination(role,null,'tracking'),'/app/tracking');
 for(const role of['TRANSPORTER','DRIVER','ADMIN','SUPPORT','UNKNOWN'])assert.equal(authFlow.managedAccountLoginDestination(role,null,'tracking'),authFlow.managedWorkspaceDestination(role));
 for(const entry of['https://outside.example','//outside.example','/admin','tracking?next=/admin',''])assert.equal(authFlow.managedAccountLoginDestination('CUSTOMER',null,entry),'/app/business/capacity');
});

test('already signed-in LoginPage honors only fixed Tracking intent and preserves prior shared-capacity/default routing',async()=>{
 for(const role of['CUSTOMER','SHIPPER','RECEIVER','TRANSPORTER','ADMIN','SUPPORT']){
  const render=login({id:'synthetic',role,active:true});
  await assert.rejects(render({from:'tracking'}),error=>error.message==='REDIRECT:'+authFlow.managedAccountLoginDestination(role,null,'tracking'));
  for(const from of['shared-capacity','https://outside.example','/admin'])await assert.rejects(render({from}),error=>error.message==='REDIRECT:'+authFlow.managedWorkspaceDestination(role));
 }
});

test('Tracking login request/code/retry renders bounded intent with existing account copy and no new permission',async()=>{
 const render=login();
 for(const step of['','code']){
  const tree=await render({from:'tracking',step}),all=nodes(tree),shell=all.find(item=>item.type==='AuthShell');
  assert.equal(shell.props.taskKicker.props.message,'Tracking');
  if(!step)assert.equal(shell.props.description.props.message,'Enter your email to sign in securely.');
  assert.equal(all.filter(item=>item.type==='input'&&item.props.name==='from'&&item.props.value==='tracking').length,1);
  if(step)assert.ok(all.some(item=>item.type==='Link'&&item.props.href==='/login?from=tracking'));
 }
 const shared=nodes(await render({from:'shared-capacity'})).find(item=>item.type==='AuthShell');assert.equal(shared.props.taskKicker.props.message,'Shared with you');assert.equal(shared.props.description.props.message,'Sign in to see vehicles shared with your account.');
 const invalid=nodes(await render({from:'https://outside.example'}));assert.equal(invalid.some(item=>item.type==='input'&&item.props.name==='from'),false);
});

test('successful OTP honors Tracking for actual customer roles and keeps shared-capacity/provider/platform destinations',async()=>{
 for(const role of['CUSTOMER','SHIPPER','RECEIVER','TRANSPORTER','DRIVER','ADMIN','SUPPORT']){
  const projection={id:'synthetic',role,active:true};
  for(const from of['tracking','shared-capacity','https://outside.example']){
   const h=verifier(projection),response=await h.post(from);
   const expected=from==='shared-capacity'&&role==='CUSTOMER'?'/?view=private':authFlow.managedAccountLoginDestination(role,null,signupEntry(from));
   assert.equal(response.status,303);assert.equal(response.headers.get('location'),expected);assert.deepEqual(h.calls,['verify']);
  }
 }
});

test('invalid OTP retains only fixed Tracking retry intent without authenticating or choosing an external location',async()=>{
 for(const from of['tracking','https://outside.example','/admin']){
  const h=verifier({id:'synthetic',role:'CUSTOMER',active:true},{verified:false}),response=await h.post(from),target=new URL(response.headers.get('location'));
  assert.equal(target.origin,'https://loadgistic.com');assert.equal(target.pathname,'/login');assert.equal(target.searchParams.get('step'),'code');assert.equal(target.searchParams.get('from'),from==='tracking'?'tracking':null);assert.deepEqual(h.calls,['verify','verify','signOut']);
 }
});

test('fixed entry reaches the existing selected-business Tracking redirect without conferring another workspace',async()=>{
 const selected={id:'synthetic-workspace',actorId:'synthetic',actorRole:'CUSTOMER',membershipRevision:2,permissions:{tracking:true,team:true}},user={id:'synthetic',role:'CUSTOMER',active:true,selected_business_workspace:selected,business_workspaces:[selected]};
 let requested=0;const page=compile('src/app/app/tracking/page.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{redirect},'@/lib/auth':{requireUser:async()=>{requested++;return user;}},'@/lib/identity/business-context.js':{managedBusinessContext},'@/components/page-header':{PageHeader:'PageHeader'},'@/components/tracking-session-manager':{BusinessTrackingSessions:'Sessions'},'@/components/localization':{Text:'Text'},'lucide-react':{ClipboardCheck:'ClipboardCheck'}});
 await assert.rejects(page.default({searchParams:Promise.resolve({})}),/^Error: REDIRECT:\/app\/business\/tracking$/);assert.equal(requested,1);
});
