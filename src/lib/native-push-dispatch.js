import {randomUUID} from 'node:crypto';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {processNativePushBatch} from './native-push-worker.js';
import {expoPushProvider} from './native-push-expo.js';
import am from './i18n/messages/am.json' with {type:'json'};
import om from './i18n/messages/om.json' with {type:'json'};
import so from './i18n/messages/so.json' with {type:'json'};
import ti from './i18n/messages/ti.json' with {type:'json'};
export async function dispatchNativePush(){
 if(process.env.LOADGISTIC_NATIVE_PUSH_ENABLED!=='true')return {enabled:false};
 if(!['https://tpwyyzoqijjmbvsmmvcm.supabase.co','http://127.0.0.1:55321'].includes(process.env.NEXT_PUBLIC_SUPABASE_URL))throw Error('LOADGISTIC_PUSH_TARGET_REQUIRED');
 const client=createSupabaseAdminClient(),rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args).abortSignal(AbortSignal.timeout(3000));if(error)throw Error('PUSH_STORE_UNAVAILABLE');return data;};
 const store={claim:(workerId,limit)=>rpc('claim_native_push_batch',{worker_id:workerId,batch_size:limit}),context:(id,workerId)=>rpc('native_push_delivery_context',{delivery_id:id,worker_id:workerId}),finish:(id,workerId,result)=>rpc('finish_native_push_delivery',{delivery_id:id,worker_id:workerId,result})};
 const catalogs={am,om,so,ti};return {enabled:true,...await processNativePushBatch({workerId:randomUUID(),store,provider:expoPushProvider({accessToken:process.env.LOADGISTIC_EXPO_PUSH_ACCESS_TOKEN}),translate:(locale,text)=>catalogs[locale]?.[text]||text})};
}
