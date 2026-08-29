import {runManagedOperations} from '../../src/lib/managed-operations.js';

export default async function(){
  const result=await runManagedOperations();
  console.info(JSON.stringify({event:'managed-operations',...result}));
  return Response.json(result,{status:result.ok?200:500});
}

export const config={schedule:'*/15 * * * *'};
