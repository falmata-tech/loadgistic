// Fixture setup is local-only. Failure here must precede every reset/import.
export async function readFixtureSchema(url,serviceRoleKey,{fetchImpl=fetch}={}){
  let endpoint;
  try{endpoint=new URL(url);}catch{throw new Error('SUPABASE_SCHEMA_TARGET_INVALID');}
  if(endpoint.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)
    ||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash){
    throw new Error('SUPABASE_SCHEMA_TARGET_INVALID');
  }
  let response,body;
  try{
    response=await fetchImpl(new URL('/rest/v1/',endpoint),{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`}
    });
  }catch{
    throw new Error('SUPABASE_SCHEMA_READ_FAILED:TRANSPORT');
  }
  try{body=await response.json();}catch{
    throw new Error(`SUPABASE_SCHEMA_READ_FAILED:${response.status}:INVALID_JSON_OR_TIMEOUT`);
  }
  if(!response.ok){
    const code=typeof body?.code==='string'&&/^(?:PGRST(?:[0-9]{3}|X00)|[0-9A-Z]{5})$/.test(body.code)?body.code:'UNKNOWN';
    throw new Error(`SUPABASE_SCHEMA_READ_FAILED:${response.status}:${code}`);
  }
  const definitions=body?.definitions||body?.components?.schemas;
  if(!definitions||typeof definitions!=='object'||Array.isArray(definitions)||!Object.keys(definitions).length){
    throw new Error('SUPABASE_SCHEMA_INVALID');
  }
  return definitions;
}
