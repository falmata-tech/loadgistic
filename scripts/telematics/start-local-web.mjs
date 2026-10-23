import {lstat,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadGatewayConfigurations} from '../../src/lib/telematics-gateway-auth.js';
import {localDemoMotionConfiguration,DEMO_MOTION_PATH} from '../../src/lib/demo-motion-auth.js';

const root=path.resolve(import.meta.dirname,'../..');
const gatewayFile=path.join(root,'.local/telematics/application-env.json');
const demoManifestFile=path.join(root,'.local/telematics/application-demo-manifest.json');
const webUrl='http://127.0.0.1:3100';

/** Keep the protected gateway credential in the child environment, never argv. */
export function localWebEnvironment(environment,gatewayJson,demoManifest){
 const configurations=loadGatewayConfigurations(gatewayJson);
 if(configurations.length!==1)throw Error('LOCAL_WEB_CONFIG_REFUSED');
 if(!demoManifest||demoManifest.purpose!=='local-fictional-gps'||demoManifest.gatewayId!==configurations[0].id)
  throw Error('LOCAL_WEB_CONFIG_REFUSED');
 const gateway=new URL(configurations[0].apiUrl);
 if(gateway.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(gateway.hostname)
  ||gateway.port!=='18082'||gateway.pathname!=='/api/'||gateway.username||gateway.password||gateway.search||gateway.hash)
  throw Error('LOCAL_WEB_CONFIG_REFUSED');
 const childEnvironment={...environment,TELEMATICS_GATEWAYS_JSON:gatewayJson,
  TELEMATICS_DEMO_GATEWAY_ID:configurations[0].id,TELEMATICS_DEFAULT_GATEWAY_ID:'',
  TELEMATICS_LOCAL_SYNTHETIC_ONLY:'true',NEXT_DIST_DIR:environment.NEXT_DIST_DIR||'.next-dev'};
 localDemoMotionConfiguration(childEnvironment,webUrl+DEMO_MOTION_PATH);
 return childEnvironment;
}

export async function protectedLocalWebEnvironment(environment=process.env){
 const [metadata,manifestMetadata]=await Promise.all([lstat(gatewayFile),lstat(demoManifestFile)]);
 if(!metadata.isFile()||(metadata.mode&0o077)!==0||!manifestMetadata.isFile()||(manifestMetadata.mode&0o077)!==0)
  throw Error('LOCAL_WEB_CONFIG_REFUSED');
 const gatewayJson=await readFile(gatewayFile,'utf8');
 const demoManifest=JSON.parse(await readFile(demoManifestFile,'utf8'));
 return localWebEnvironment(environment,gatewayJson,demoManifest);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length>3||process.argv[2]&&process.argv[2]!=='--check')throw Error('LOCAL_WEB_COMMAND_REFUSED');
  const environment=await protectedLocalWebEnvironment();
  if(process.argv[2]==='--check')console.log(JSON.stringify({event:'local_web_gateway_ready',gatewayCount:1,web: webUrl}));
  else{
   const next=path.join(root,'node_modules/next/dist/bin/next');
   const child=spawn(process.execPath,[next,'dev','--turbopack','--hostname','127.0.0.1','--port','3100'],
    {cwd:root,env:environment,stdio:'inherit'});
   child.on('error',()=>{console.error('LOCAL_WEB_START_FAILED');process.exitCode=1;});
   child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
  }
 }catch{console.error('LOCAL_WEB_CONFIG_REFUSED');process.exitCode=1;}
}
