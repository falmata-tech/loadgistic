import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const setting='net.ipv4.ip_local_reserved_ports';
const services=Array.from({length:10},(_,i)=>55320+i);
export function parseReservedPorts(value){
 if(typeof value!=='string'||value.length>400000)throw Error('RESERVATION_INVALID');
 const ports=new Set();
 if(!value.trim())return ports;
 for(const part of value.trim().split(',')){
  const match=/^([1-9][0-9]{0,4})(?:-([1-9][0-9]{0,4}))?$/.exec(part);
  if(!match)throw Error('RESERVATION_INVALID');
  const first=Number(match[1]),last=Number(match[2]||match[1]);
  if(first>last||last>65535)throw Error('RESERVATION_INVALID');
  for(let port=first;port<=last;port++)ports.add(port);
 }
 return ports;
}
function formatPorts(ports){
 const sorted=[...ports].sort((a,b)=>a-b),parts=[];
 for(let i=0;i<sorted.length;i++){
  const first=sorted[i];let last=first;
  while(sorted[i+1]===last+1)last=sorted[++i];
  parts.push(first===last?String(first):`${first}-${last}`);
 }
 return parts.join(',');
}
export function reserveLocalPorts({environment,platform,project,read,write}){
 if(platform!=='linux'||environment.CI!=='true'||environment.GITHUB_ACTIONS!=='true'
  ||environment.RUNNER_OS!=='Linux'||environment.LOADGISTIC_RUNNER_ENVIRONMENT!=='github-hosted'
  ||project!=='loadgistic-local')throw Error('DISPOSABLE_LINUX_RUNNER_REQUIRED');
 const before=parseReservedPorts(read()),expected=new Set([...before,...services]);
 const changed=services.some(port=>!before.has(port));
 if(changed)write(formatPorts(expected));
 const after=parseReservedPorts(read());
 if(after.size!==expected.size||[...expected].some(port=>!after.has(port)))throw Error('RESERVATION_READBACK_MISMATCH');
 return {reservedServicePorts:services.length,existingReservationsPreserved:true,changed};
}
function main(){
 function command(executable,args){
  const result=spawnSync(executable,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:512*1024});
  if(result.error||result.signal||result.status!==0)throw Error('RESERVATION_COMMAND_FAILED');
  return result.stdout;
 }
 try{
  if(process.cwd()!==root||process.argv.length!==2)throw Error('DISPOSABLE_LINUX_RUNNER_REQUIRED');
  const config=readFileSync(path.join(root,'supabase/config.toml'),'utf8');
  const project=/^project_id = "([^"]+)"$/m.exec(config)?.[1];
  const result=reserveLocalPorts({environment:process.env,platform:process.platform,project,
   read:()=>command('sysctl',['-n',setting]),write:value=>command('sudo',['-n','sysctl','-q','-w',`${setting}=${value}`])});
  process.stdout.write(`CI_LOCAL_PORT_RESERVATION ${JSON.stringify(result)}\n`);
 }catch(error){
  const allowed=new Set(['DISPOSABLE_LINUX_RUNNER_REQUIRED','RESERVATION_INVALID','RESERVATION_READBACK_MISMATCH','RESERVATION_COMMAND_FAILED']);
  process.stderr.write(`CI_LOCAL_PORT_${allowed.has(error?.message)?error.message:'RESERVATION_FAILED'}\n`);process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
