// Fixed diagnostic fields only. Never retain API messages, identity data or URLs.
const cases=new Map([
 ['driving Transport Provider OWNED signs up, explicitly assigns a truck and publishes after location permission',{file:'fleet-onboarding.spec.ts',scenario:'DRIVING_OWNED'}],
 ['driving Transport Provider PERMISSION signs up, explicitly assigns a truck and publishes after location permission',{file:'fleet-onboarding.spec.ts',scenario:'DRIVING_PERMISSION'}],
 ['Tracking proof modal fetches authorized images and rechecks revoked access when reopened',{file:'tracking-route-map.spec.ts',scenario:'TRACKING_PROOF'}],
 ['invalid multi-option deep links stay denied until an explicit filter correction',{file:'capacity-multiple-options.spec.ts',scenario:'INVALID_CAPACITY_FILTER'}]
]);
const stages={
 'fleet-onboarding.spec.ts':new Set(['VERIFY_EMAIL','CREATE_WORKSPACE','ADD_VEHICLE','ASSIGN_AND_PUBLISH','PUBLISH_CAPACITY','COMPLETE',
  'CLEANUP_FIND_IDENTITY','CLEANUP_DELETE_SIGNUP_INTENT','CLEANUP_DELETE_AUDIT','CLEANUP_FIND_PROVIDER','CLEANUP_DELETE_CAPACITY','CLEANUP_DELETE_VEHICLES','CLEANUP_DELETE_AUTH']),
 'tracking-route-map.spec.ts':new Set(['FIXTURE','PROVIDER_SIGN_IN','PROVIDER_PROOF_OPEN','PROVIDER_PROOF_CLOSE','OWNER_SIGN_IN','OWNER_PROOF_OPEN',
  'OWNER_PROOF_CLOSE','REVOKE','REOPEN_DENIED','CLOSE_DENIED','COMPLETE','CLEANUP']),
 'capacity-multiple-options.spec.ts':new Set(['VIEWPORT_TICK','INVALID_REAPPLY'])
};
const classes=new Set(['Error','TimeoutError','AssertionError','TypeError','ReferenceError','AbortError','AuthApiError','AuthUnknownError','AuthRetryableFetchError']);
const codes=new Set(['unexpected_failure','database_error','user_not_found','request_timeout','over_request_rate_limit','not_admin',
 '23503','23505','23514','42501','55P03','57014','40001','40P01','P0001','XX000']);
const capacityBooleanFields=['alert','loading','textEqual','errorPresent','reviewVisible','initialLabelPresent','currentLabelPresent','fontZero'];
function capacityObservations(value){
 const observed={};
 if(!value||typeof value!=='object'||Array.isArray(value))return observed;
 for(const key of capacityBooleanFields)if(Object.hasOwn(value,key)&&typeof value[key]==='boolean')observed[key]=value[key];
 if(Object.hasOwn(value,'invalidRequests')&&Number.isSafeInteger(value.invalidRequests)&&value.invalidRequests>=0&&value.invalidRequests<=1000)observed.invalidRequests=value.invalidRequests;
 return observed;
}
export function focusedCase(title){return cases.get(title)||null;}
export function parseFocusedBrowserEvidence(value){
 if(typeof value==='string'){if(value.length>4096)return null;try{value=JSON.parse(value);}catch{return null;}}
 if(!value||typeof value!=='object'||Array.isArray(value)||!['desktop-chromium','mobile-chromium'].includes(value.project)
  ||!Object.hasOwn(stages,value.file)||!stages[value.file].has(value.stage)||![...cases.values()].some(c=>c.file===value.file&&c.scenario===value.scenario))return null;
 const evidence={file:value.file,scenario:value.scenario,project:value.project,stage:value.stage,
  errorClass:classes.has(value.errorClass)?value.errorClass:'OTHER',
  errorCode:codes.has(value.errorCode)?value.errorCode:null,
  errorStatus:Number.isInteger(value.errorStatus)&&value.errorStatus>=100&&value.errorStatus<=599?value.errorStatus:null,
  elapsedMs:Number.isSafeInteger(value.elapsedMs)&&value.elapsedMs>=0&&value.elapsedMs<=3_600_000?value.elapsedMs:null,
  line:Number.isSafeInteger(value.line)&&value.line>0&&value.line<=1_000_000?value.line:null};
 return value.scenario==='INVALID_CAPACITY_FILTER'?{...evidence,...capacityObservations(value)}:evidence;
}
export function focusedBrowserEvidence({title,project,stage,error,elapsedMs,observations={}}){
 const identity=focusedCase(title);if(!identity)return null;let line=null;
 if(typeof error?.stack==='string')for(const frame of error.stack.split(/\r?\n/).slice(0,64)){
  const match=/^\s+at (?:.* \()?([^()\r\n]+):([1-9][0-9]{0,6}):[0-9]+\)?$/.exec(frame);
  if(match&&match[1].replaceAll('\\','/').endsWith('/tests/e2e/'+identity.file)){line=Number(match[2]);break;}
 }
 return parseFocusedBrowserEvidence({...identity,project,stage,errorClass:error?.name,errorCode:error?.code,errorStatus:error?.status,elapsedMs,line,
  ...(identity.scenario==='INVALID_CAPACITY_FILTER'?capacityObservations(observations):{})});
}
