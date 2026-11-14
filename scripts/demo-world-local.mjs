// Read-only catalog/history inspection. All legacy direct-write verbs are retired.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const [action='status',atArg,activationArg,epochArg]=process.argv.slice(2);
// Refuse before loading clients, environment, checkpoints, receipts or catalogs.
if(!['plan','status'].includes(action))throw Error('DEMO_WORLD_DIRECT_APPLY_RETIRED');
if(action==='status'&&process.argv.length>3||action==='plan'&&![3,4,6].includes(process.argv.length))throw Error('DEMO_WORLD_USAGE_INVALID');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const directory=path.join(root,'.local/demo-world'),statePath=path.join(directory,'catalog-state.json');
async function readJson(file){return JSON.parse(await readFile(file,'utf8'));}
async function checkpoint(){
 try{return await readJson(statePath);}catch(error){if(error?.code==='ENOENT')return null;throw Error('DEMO_WORLD_CATALOG_STATE_INVALID');}
}
if(action==='status'){
 const state=await checkpoint();
 console.log(JSON.stringify({event:'demo_world_local_status',directApply:'RETIRED',controller:'DATABASE_224',
  checkpointPresent:Boolean(state),catalogVersion:state?.catalogVersion===2?2:null,
  epoch:Number.isSafeInteger(state?.epoch)&&state.epoch>0?state.epoch:null,
  receiptCount:state?.latestReceipts&&typeof state.latestReceipts==='object'&&!Array.isArray(state.latestReceipts)?Object.keys(state.latestReceipts).length:0,
  production:false,executed:false}));
}else{
 const {validateDemoWorldManifest,planDemoWorldSlot}=await import('../src/lib/demo-world-planner.mjs');
 const fixture=await readJson(path.join(root,'resources/fixtures/managed-market.json'));
 const manifest=await readJson(path.join(root,'resources/fixtures/demo-world-scenarios.json'));
 validateDemoWorldManifest(manifest,fixture);
 let activatedAt=activationArg,epoch=epochArg===undefined?null:Number(epochArg),previousReceiptsByTarget=new Map();
 if(!activatedAt){
  const state=await checkpoint();
  if(!state||state.catalogVersion!==2||state.mode!=='RELATIVE_EPISODES')throw Error('DEMO_WORLD_PLAN_CONTEXT_REQUIRED');
  activatedAt=state.activatedAt;epoch=state.epoch;
  const keys=new Set(manifest.targets.filter(row=>row.mutable).map(row=>row.key));
  if(!state.latestReceipts||typeof state.latestReceipts!=='object'||Array.isArray(state.latestReceipts))throw Error('DEMO_WORLD_CATALOG_STATE_INVALID');
  for(const [target,key] of Object.entries(state.latestReceipts)){
   if(!keys.has(target)||!/^[a-f0-9]{64}$/.test(String(key)))throw Error('DEMO_WORLD_RECEIPT_INVALID');
   try{previousReceiptsByTarget.set(target,await readJson(path.join(directory,`${key}.json`)));}
   catch{throw Error('DEMO_WORLD_RECEIPT_INVALID');}
  }
 }
 const plans=planDemoWorldSlot({manifest,fixture,activatedAt,epoch,at:atArg||new Date().toISOString(),previousReceiptsByTarget});
 console.log(JSON.stringify({event:'demo_world_plan',directApply:'RETIRED',controller:'DATABASE_224',
  plans:plans.map(plan=>({transitionId:plan.transitionId,targetKey:plan.targetKey,catalogVersion:2,
   cycleIndex:plan.cycleIndex,stepIndex:plan.stepIndex,scheduledAt:plan.scheduledAt,dueAt:plan.dueAt,
   expectedStatus:plan.expectedStatus,nextStatus:plan.nextStatus,nextAvailablePercent:plan.nextAvailablePercent})),
  production:false,executed:false}));
}
