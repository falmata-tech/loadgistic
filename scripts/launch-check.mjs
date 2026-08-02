import { launchReadiness } from '../src/lib/launch-readiness.js';

const readiness=launchReadiness();
console.log(JSON.stringify(readiness,null,2));
if(!readiness.ok){
  console.error('Loadgistic is runnable, but this configuration is not approved for public production traffic.');
  process.exitCode=1;
}
