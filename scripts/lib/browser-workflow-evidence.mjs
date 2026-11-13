// Public diagnostic contract: construct fresh allowlisted fields, never error
// messages, arbitrary routes, assertion values, cookies or record identifiers.
const file='admin-connected-queues.spec.ts';
const scenarios=new Map([
 ['retired staff capacity feed cannot expose records and the public map remains available','RETIRED_CAPACITY'],
 ['Driver Open owner reaches its exact fleet and retains delegated workspace denial','DRIVER_OWNER'],
 ['Content and deletion overflow pages recover saved synthetic cases with unchanged controls','QUEUE_PAGING']
]);
const stages={RETIRED_CAPACITY:['SETUP','RETIRED_PAGE','RETIRED_API','RELOAD_DENIAL','PUBLIC_MAP'],
 DRIVER_OWNER:['SETUP','ADMIN_DRIVER','EXACT_OWNER','DELEGATED_DRIVER','WORKSPACE_DENIED'],
 QUEUE_PAGING:['SETUP','CONTENT_OVERFLOW','PRIVACY_OVERFLOW','INVALID_PAGE','TRUST_SCOPE','CONTENT_DENIED']};
const projects=new Set(['desktop-chromium','mobile-chromium']);
const errors=new Set(['Error','TimeoutError','AssertionError','TypeError','ReferenceError','AbortError','OTHER']);
const matchers=new Set(['toBe','toEqual','toBeVisible','toHaveCount','toHaveURL','toHaveAttribute','toContainText','OTHER']);
const routes=new Set(['/','/admin/capacity-network','/admin/operations','/admin/operations/drivers/:id',
 '/admin/operations/workspaces/:id','/admin/operations/users/:id','/admin/reviews/content','/admin/privacy','/admin/reviews','/support','/app/home','/workspaces','/login']);
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000?value:null;
const line=value=>Number.isSafeInteger(value)&&value>0&&value<=1_000_000?value:null;
const errorKind=value=>errors.has(value)?value:'OTHER';

export function parseWorkflowEvidence(input){
 let value=input;
 if(typeof input==='string'){
  if(input.length>8192)return null;
  try{value=JSON.parse(input);}catch{return null;}
 }
 if(!value||typeof value!=='object'||Array.isArray(value)||value.file!==file||!projects.has(value.project)
  ||!Object.hasOwn(stages,value.scenario)||!stages[value.scenario].includes(value.stage))return null;
 return {file,project:value.project,scenario:value.scenario,stage:value.stage,
  errorClass:errorKind(value.errorClass),line:line(value.line),matcher:matchers.has(value.matcher)?value.matcher:'OTHER',
  route:routes.has(value.route)?value.route:'UNKNOWN',kind:['ORGANIZATION','PROVIDER_PROFILE'].includes(value.kind)?value.kind:null,
  recordCards:count(value.recordCards),notFound:count(value.notFound),pageErrorCount:count(value.pageErrorCount),
  pageErrorKinds:Array.isArray(value.pageErrorKinds)?[...new Set(value.pageErrorKinds.slice(0,16).map(errorKind))].sort():[]};
}

export function adminQueueEvidence({title,project,stage,pageUrl,error,recordCards,notFound,pageErrors=/** @type {string[]} */([])}){
 let route='UNKNOWN',kind=null,sourceLine=null;
 try{
  const url=new URL(pageUrl);
  if(url.origin==='http://127.0.0.1:3100'){
   route=url.pathname.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi,':id');kind=url.searchParams.get('kind');
  }
 }catch{/* An unavailable page is diagnostic data, not another failure. */}
 if(typeof error?.stack==='string')for(const frame of error.stack.split(/\r?\n/).slice(0,64)){
  const match=/^\s+at (?:.* \()?[^()\r\n]*\/tests\/e2e\/admin-connected-queues\.spec\.ts:([1-9][0-9]{0,6}):[0-9]+\)?$/.exec(frame);
  if(match){sourceLine=Number(match[1]);break;}
 }
 return parseWorkflowEvidence({file,project,scenario:scenarios.get(title),stage,errorClass:error?.name,line:sourceLine,
  matcher:error?.matcherResult?.name,route,kind,recordCards,notFound,pageErrorCount:pageErrors.length,pageErrorKinds:pageErrors});
}
