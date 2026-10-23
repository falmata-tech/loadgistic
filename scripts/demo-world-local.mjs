// Opt-in local scenario advance. No scheduler, remote URL or customer selector.
import {createClient} from '@supabase/supabase-js';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertLocalAuthorityFixtureTarget} from './fixture-provider-authority.mjs';
import {validateDemoWorldManifest,planDemoWorldSlot,planDemoWorldThrough} from '../src/lib/demo-world-planner.mjs';
import {executeDemoCapacityPlan} from '../src/lib/demo-world-executor.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const directory=path.join(root,'.local/demo-world'),lock=path.join(directory,'advance.lock');
const [action='plan',atArg]=process.argv.slice(2);
if(!['plan','advance','advance-through'].includes(action)||!atArg||process.argv.length!==4)throw Error('DEMO_WORLD_USAGE_INVALID');
const at=new Date(atArg);if(!Number.isFinite(at.getTime())||at.toISOString()!==atArg)throw Error('DEMO_WORLD_TIME_INVALID');
const fixture=JSON.parse(await readFile(path.join(root,'resources/fixtures/managed-market.json'),'utf8'));
const manifest=JSON.parse(await readFile(path.join(root,'resources/fixtures/demo-world-scenarios.json'),'utf8'));
validateDemoWorldManifest(manifest,fixture);
const plans=action==='advance-through'?planDemoWorldThrough({manifest,fixture,at}):planDemoWorldSlot({manifest,fixture,at});
if(!plans.length||action!=='advance-through'&&plans.length!==1)throw Error('DEMO_WORLD_SLOT_NOT_FOUND');
if(action==='plan'){
 const plan=plans[0];
 console.log(JSON.stringify({event:'demo_world_plan',transitionId:plan.transitionId,vehicleFixtureKey:plan.vehicleFixtureKey,
  command:plan.command,expectedStatus:plan.expectedStatus,nextStatus:plan.nextStatus,
  ...(plan.command==='capacity.set_load_preference'?{from:plan.expectedLoads,to:plan.nextLoads}:{}),
  ...(plan.command==='capacity.set_route'?{from:plan.expectedRouteRefs,to:plan.nextRouteRefs}:{}),
  production:false,executed:false}));
}else{
 const url=assertLocalAuthorityFixtureTarget(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL);
 const key=process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw Error('DEMO_WORLD_LOCAL_CONFIG_MISSING');
 const client=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 await mkdir(directory,{recursive:true,mode:0o700});
 try{await mkdir(lock,{mode:0o700});}catch{throw Error('DEMO_WORLD_RUNNER_LOCKED');}
 try{
  const outcomes=[];
  for(const plan of plans){
   const receiptPath=path.join(directory,`${plan.idempotencyKey}.json`);
   let priorReceipt=null;
   try{priorReceipt=JSON.parse(await readFile(receiptPath,'utf8'));}catch(error){if(error?.code!=='ENOENT')throw Error('DEMO_WORLD_RECEIPT_INVALID');}
   const receipt=await executeDemoCapacityPlan({plan,manifest,fixture,client,priorReceipt});
   if(!priorReceipt){
    const temp=receiptPath+`.${process.pid}.tmp`;
    await writeFile(temp,JSON.stringify(receipt),{flag:'wx',mode:0o600});await rename(temp,receiptPath);
   }
   outcomes.push(receipt);
  }
  console.log(JSON.stringify({event:'demo_world_advance',through:action==='advance-through'?at.toISOString():null,
   completed:outcomes.length,replayed:outcomes.filter(item=>item.replayed).length,
   transitions:outcomes.map(item=>({transitionId:item.transitionId,vehicleFixtureKey:item.vehicleFixtureKey,
    status:item.status,acceptedLoads:item.acceptedLoads,routeRefs:item.routeRefs})),production:false}));
 }finally{await rm(lock,{recursive:true,force:true});}
}
