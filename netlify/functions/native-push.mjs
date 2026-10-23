import {dispatchNativePush} from '../../src/lib/native-push-dispatch.js';
export default async function(){try{const result=await dispatchNativePush();console.log('Loadgistic native push',result);}catch{console.error('Loadgistic native push worker unavailable');}}
export const config={schedule:'* * * * *'};
