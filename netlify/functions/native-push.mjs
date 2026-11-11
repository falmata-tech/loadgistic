import {dispatchNativePush} from '../../src/lib/native-push-dispatch.js';
import {dispatchAccessEmailRetry} from '../../src/lib/netlify-dispatch/access-email-retry.mjs';
import {dispatchManagedOperations} from '../../src/lib/netlify-dispatch/managed-operations.mjs';

// Netlify supplies the following invocation's time. Subtract one interval so a
// late start still runs the work due for the minute that was actually scheduled.
async function scheduledMinute(request,now){
  try{
    const {next_run:nextRun}=await request.clone().json();
    const next=Date.parse(nextRun);
    if(Number.isFinite(next)&&Math.abs(next-now)<10*60_000)return next-60_000;
  }catch{}
  return now;
}

export function dueNativeOperations(slot){
  const minute=new Date(slot).getUTCMinutes();
  return {
    accessEmail:minute%2===0,
    managedOperations:minute%15===0
  };
}

export async function executeNativePushSchedule(request,{
  now=Date.now(),environment=process.env,fetchImpl=fetch,
  push=dispatchNativePush,accessEmail=dispatchAccessEmailRetry,
  managedOperations=dispatchManagedOperations
}={}){
  const due=dueNativeOperations(await scheduledMinute(request,now));
  const jobs=[['native-push',()=>push()]];
  if(due.accessEmail)jobs.push(['access-email-retry',()=>accessEmail({
    invocationUrl:request?.url,environment,fetchImpl,now
  })]);
  if(due.managedOperations)jobs.push(['managed-operations',()=>managedOperations({
    invocationUrl:request?.url,environment,fetchImpl,now
  })]);
  const outcomes=await Promise.allSettled(jobs.map(([,run])=>Promise.resolve().then(run)));
  outcomes.forEach((outcome,index)=>{
    const job=jobs[index][0];
    if(outcome.status==='rejected'){
      console.error(JSON.stringify({event:'scheduled-work',job,ok:false,error:'DISPATCH_FAILED'}));
    }else if(job==='native-push'){
      const result=outcome.value||{};
      console.info(JSON.stringify({event:'scheduled-work',job,ok:true,
        enabled:result.enabled===true,claimed:Math.max(0,Number(result.claimed)||0),
        sent:Math.max(0,Number(result.sent)||0),failed:Math.max(0,Number(result.failed)||0)
      }));
    }else{
      console.info(JSON.stringify({event:'scheduled-work',job,ok:true,
        status:outcome.value?.status===202?202:null
      }));
    }
  });
  return new Response(null,{status:204});
}

export default async function(request){return executeNativePushSchedule(request);}
export const config={schedule:'* * * * *'};
