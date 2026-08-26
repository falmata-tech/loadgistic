import {runManagedOperations} from '../../src/lib/managed-operations.js';

export default async function(){
  if(process.env.DATA_BACKEND!=='supabase'){
    return Response.json({ok:false,error:'managed-data-backend-required'},{status:503});
  }
  const result=await runManagedOperations();
  console.info(JSON.stringify({event:'managed-operations',...result}));
  return Response.json(result,{status:result.ok?200:500});
}

export const config={schedule:'*/15 * * * *'};
