import {managedOperationsSummary,runManagedOperations} from '../../src/lib/managed-operations.js';
import {
  MANAGED_OPERATIONS_SIGNATURE_HEADER,
  MANAGED_OPERATIONS_TIMESTAMP_HEADER,
  verifyManagedOperationsSignature
} from '../../src/lib/managed-operations-auth.js';

export async function executeManagedOperations(request,{
  environment=process.env,runOperations=runManagedOperations,now=Date.now()
}={}){
  const authorized=request?.method==='POST'&&verifyManagedOperationsSignature({
    timestamp:request.headers.get(MANAGED_OPERATIONS_TIMESTAMP_HEADER),
    signature:request.headers.get(MANAGED_OPERATIONS_SIGNATURE_HEADER),
    audience:request.url
  },environment,now);
  if(!authorized){
    console.warn(JSON.stringify({event:'managed-operations-background',ok:false,error:'UNAUTHORIZED'}));
    return new Response(null,{status:401});
  }
  try{
    const result=managedOperationsSummary(await runOperations());
    console.info(JSON.stringify({event:'managed-operations-background',...result}));
  }catch{
    console.error(JSON.stringify({event:'managed-operations-background',ok:false,error:'OPERATION_FAILED'}));
  }
  return new Response(null,{status:204});
}

export default async function(request){
  return executeManagedOperations(request);
}

export const config={background:true};
