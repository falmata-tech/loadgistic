import {isIP} from 'node:net';
import {pathToFileURL} from 'node:url';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hexSecret=/^[a-f0-9]{64}$/;
const password=/^[A-Za-z0-9_-]{32,128}$/;

/** Offline shape check. It never authorizes a deployment or touches a provider. */
export function assertHostedGatewayEnvironment(env,scope='all'){
 const reject=()=>{throw Error('HOSTED_GATEWAY_CONFIG_INVALID');};
 if(!['all','real','synthetic'].includes(scope))reject();
 const real=scope!=='synthetic',synthetic=scope!=='real';
 const address=env.GPS_INGRESS_BIND_ADDRESS;
 if(real&&(typeof address!=='string'||isIP(address)!==4||address==='0.0.0.0'||address==='255.255.255.255'))reject();
 const ids=[...(real?[env.GATEWAY_ID]:[]),...(synthetic?[env.SYNTHETIC_GATEWAY_ID]:[])];
 if(ids.some(value=>!uuid.test(value||''))||new Set(ids).size!==ids.length)reject();
 const secrets=[...(real?[env.GATEWAY_SECRET]:[]),...(synthetic?[env.SYNTHETIC_GATEWAY_SECRET]:[])];
 if(secrets.some(value=>!hexSecret.test(value||''))||new Set(secrets).size!==secrets.length)reject();
 const passwords=[...(real?[env.GATEWAY_DATABASE_PASSWORD,env.GATEWAY_BRIDGE_PASSWORD]:[]),
  ...(synthetic?[env.SYNTHETIC_DATABASE_PASSWORD,env.SYNTHETIC_BRIDGE_PASSWORD]:[])];
 if(passwords.some(value=>!password.test(value||''))||new Set([...passwords,...secrets]).size!==passwords.length+secrets.length)reject();
 let endpoint;try{endpoint=new URL(env.LOADGISTIC_GATEWAY_URL);}catch{reject();}
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.port||endpoint.search||endpoint.hash
  ||endpoint.pathname!=='/api/telematics/gateway')reject();
 return {realGateway:real,syntheticGateway:synthetic,commandsEnabled:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);
 const scope=args.length===0?'all':args.length===1&&['--scope=real','--scope=synthetic'].includes(args[0])?args[0].slice(8):null;
 assertHostedGatewayEnvironment(process.env,scope);
 console.log(JSON.stringify({event:'hosted_gateway_config_valid',deploymentAuthorized:false}));
}
