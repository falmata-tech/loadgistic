import {LOCAL_CAPACITY_PRIVACY_RADII_KM} from './location-privacy.js';
export const TRACKING_LOCATION_INTERVAL_MS=10*60*1000;
export function trackingPrivacyRadius(value){
  const radius=Number(value);return LOCAL_CAPACITY_PRIVACY_RADII_KM.includes(radius)?radius:20;
}
export function trackingLocationResult(result){
  if(result?.recorded===true)return 'saved';
  if(result?.recorded===false&&result.reason==='THROTTLED')return 'waiting';
  throw new Error('Approximate location could not be confirmed. Try again.');
}
// Cancellation invalidates a late GPS callback as well as aborting a fetch.
export function createForegroundLocationRunner(isVisible,timeoutMs=45000){
  let active=null;
  return {
    get busy(){return active!==null;},
    cancel(){active?.abort();active=null;},
    async run({read,save,onState,onResult,onError}){
      if(active||!isVisible())return false;
      const controller=new AbortController();active=controller;
      const current=()=>active===controller&&!controller.signal.aborted&&isVisible();
      let timer;
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Saving took too long. Refresh to check whether it saved before trying again.')),timeoutMs);});
      try{
        onState('requesting');const value=await Promise.race([read(controller.signal),timeout]);
        if(!current())return false;
        onState('saving');const result=await Promise.race([save(value,controller.signal),timeout]);
        if(!current())return false;
        onResult(result,value);return true;
      }catch(error){if(current())onError(error);controller.abort();return false;}
      finally{clearTimeout(timer);if(active===controller)active=null;}
    }
  };
}
