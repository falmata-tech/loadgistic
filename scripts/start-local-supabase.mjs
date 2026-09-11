import {readFileSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const root=process.cwd();
const cli=String(process.env.SUPABASE_CLI_PATH||'supabase').trim();
const credentialPath=path.join(root,'.local','google-oauth.env');
const allowed=new Set([
  'SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID',
  'SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET'
]);

function readCredentials(){
  let source='';
  try{
    const permissions=statSync(credentialPath).mode&0o777;
    if((permissions&0o077)!==0)throw new Error('INSECURE_LOCAL_GOOGLE_OAUTH_FILE_PERMISSIONS');
    source=readFileSync(credentialPath,'utf8');
  }catch(error){
    if(error?.code!=='ENOENT')throw error;
  }
  const values={};
  for(const line of source.split(/\r?\n/)){
    const trimmed=line.trim();
    if(!trimmed||trimmed.startsWith('#'))continue;
    const separator=trimmed.indexOf('=');
    if(separator<1)throw new Error('INVALID_LOCAL_GOOGLE_OAUTH_FILE');
    const key=trimmed.slice(0,separator).trim();
    const value=trimmed.slice(separator+1).trim();
    if(!allowed.has(key))throw new Error('UNEXPECTED_LOCAL_GOOGLE_OAUTH_KEY');
    values[key]=value;
  }
  const configured=[...allowed].every(key=>Boolean(values[key]));
  return {
    configured,
    clientId:configured?values.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID:'local-google-not-configured.apps.googleusercontent.com',
    clientSecret:configured?values.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET:'local-google-not-configured'
  };
}

const credentials=readCredentials();
const result=spawnSync(cli,['start',...process.argv.slice(2)],{
  cwd:root,
  // Supabase's default success output contains local API keys. Keep it out of
  // terminal history and logs; actionable startup failures remain on stderr.
  stdio:['ignore','ignore','inherit'],
  env:{
    ...process.env,
    SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID:credentials.clientId,
    SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET:credentials.clientSecret
  }
});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
process.stdout.write(credentials.configured
  ?'Local Supabase Google OAuth is configured from the ignored credential file.\n'
  :'Local Supabase started without live Google credentials; numeric email codes and fixture login remain available.\n');
