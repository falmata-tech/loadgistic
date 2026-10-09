import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {AppState,Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import {router,type Href} from 'expo-router';
import * as Storage from './storage';
import {apiRequest,ApiError} from '../api/http';
import {nativePushDestination} from '../../../../src/lib/native-push-destination';
import {nativePushRefresh} from './native-push-refresh';
import {nativePushPresentation} from './native-push-presentation';
import type {NativePushInput,NativePushControls,NativePushStatus} from './native-push-types';
const deviceKey='loadgistic.native.push.device.v1',enabledKey='loadgistic.native.push.enabled.v1',pendingKey='loadgistic.native.push.revocations.v1';
type Device={installationId:string;secret:string};
let writes=Promise.resolve();
function serial<T>(action:()=>Promise<T>):Promise<T>{const next=writes.then(action,action);writes=next.then(()=>undefined,()=>undefined);return next;}
async function device():Promise<Device>{return serial(async()=>{const raw=await Storage.getItemAsync(deviceKey);if(raw){const value=JSON.parse(raw) as Device;if(!/^[0-9a-f-]{36}$/.test(value.installationId)||!/^[a-f0-9]{64}$/.test(value.secret))throw Error('Could not confirm phone alerts.');return value;}
 const value={installationId:Crypto.randomUUID(),secret:Array.from(await Crypto.getRandomBytesAsync(32),byte=>byte.toString(16).padStart(2,'0')).join('')};await Storage.setItemAsync(deviceKey,JSON.stringify(value),{keychainAccessible:Storage.WHEN_UNLOCKED_THIS_DEVICE_ONLY});return value;});}
async function notifications(){if(Platform.OS!=='android'||Constants.expoConfig?.extra?.nativePushConfigured!==true||!requireOptionalNativeModule('ExpoPushTokenManager'))return null;return import('expo-notifications');}
async function remove(scope:'MEMBER'|'GUEST'|'ALL'){
 const raw=await Storage.getItemAsync(deviceKey);if(!raw)return;const value=JSON.parse(raw) as Device;
 await apiRequest('/api/mobile/notifications/devices',{body:{action:'REMOVE',...value,scope}});
}
export async function removeNativePushScope(scope:'MEMBER'|'GUEST'|'ALL'):Promise<void>{
 if(Platform.OS!=='android')return;
 await serial(async()=>{
  const pending=JSON.parse(await Storage.getItemAsync(pendingKey)||'[]') as string[];
  if(!pending.includes(scope))pending.push(scope);
  await Storage.setItemAsync(pendingKey,JSON.stringify(pending));
  try{await remove(scope);await Storage.setItemAsync(pendingKey,JSON.stringify(pending.filter(value=>value!==scope)));}catch{/* Retry before new registration. */}
 });
 const sdk=await notifications();if(!sdk)return;
 try{for(const item of await sdk.getPresentedNotificationsAsync()){
  const kind=item.request.content.data?.kind;
  if(scope==='ALL'||scope==='GUEST'&&kind==='BROKERAGE'||scope==='MEMBER'&&(kind==='SUPPORT'||kind==='HANDOVER'))await sdk.dismissNotificationAsync(item.request.identifier);
 }}catch{/* Scope revocation does not depend on OS tray availability. */}
}
async function clearPending(){await serial(async()=>{
 const pending=JSON.parse(await Storage.getItemAsync(pendingKey)||'[]') as string[];
 for(const scope of pending){if(!['MEMBER','GUEST','ALL'].includes(scope))throw Error('Could not confirm phone alerts.');await remove(scope as 'MEMBER'|'GUEST'|'ALL');}
 await Storage.deleteItemAsync(pendingKey);
});}
async function tokenWithin<T>(operation:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([operation,new Promise<T>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('PUSH_TOKEN_TIMEOUT')),15000);})]);}finally{clearTimeout(timer);}}
export function useNativePush(input:NativePushInput):NativePushControls{
 const latest=useRef(input),epoch=useRef(0),lock=useRef(false),again=useRef(false),pendingTap=useRef<unknown>(null),opening=useRef(false),handled=useRef(new Set<string>()),previousScopes=useRef({member:'',guest:''});
 const [status,setStatus]=useState<NativePushStatus>('OFF'),[optedIn,setOptedIn]=useState(false),[error,setError]=useState(''),[tapRevision,setTapRevision]=useState(0);
 useLayoutEffect(()=>{latest.current=input;},[input]);
 const scope=(input.session?.user.id||'')+':'+(input.guest?.id||'');
 const register=useCallback(async function registerNow(ask:boolean):Promise<void>{
  if(lock.current){again.current=true;return;}lock.current=true;const version=epoch.current;
  try{
   await clearPending();const sdk=await notifications();setError('');
   if(ask&&sdk)await Storage.setItemAsync(enabledKey,'true');
   const enabledPreference=await Storage.getItemAsync(enabledKey)==='true';setOptedIn(enabledPreference);
   if(!sdk){setStatus('UNAVAILABLE');return;}
   if(!enabledPreference){setStatus('OFF');return;}
   const current=latest.current;if(current.busy||!current.guestReady)return;
   const activeGuest=current.guest&&current.guest.validUntil>Date.now()?current.guest:null;
   const scopes={member:current.session?.user.id||'',guest:activeGuest?.id||''};
   if(!scopes.member||previousScopes.current.member&&previousScopes.current.member!==scopes.member)await removeNativePushScope('MEMBER');
   if(!scopes.guest||previousScopes.current.guest&&previousScopes.current.guest!==scopes.guest)await removeNativePushScope('GUEST');
   previousScopes.current=scopes;
   if(!current.session&&!activeGuest){setStatus('OFF');return;}
   setStatus('BUSY');await sdk.setNotificationChannelAsync('loadgistic-updates',{name:'Loadgistic updates',importance:sdk.AndroidImportance.HIGH,lockscreenVisibility:sdk.AndroidNotificationVisibility.PRIVATE});
   let permission=await sdk.getPermissionsAsync();if(ask&&permission.status!=='granted'&&permission.canAskAgain)permission=await sdk.requestPermissionsAsync();
   if(permission.status!=='granted'){await removeNativePushScope('ALL');if(version===epoch.current)setStatus('DENIED');return;}
   const projectId=Constants.expoConfig?.extra?.eas?.projectId;
   if(projectId!=='a2d7e0a9-2fe4-4188-804e-40d8c3486ac7')throw Error('Could not confirm phone alerts.');
   const value=await device(),token=(await tokenWithin(sdk.getExpoPushTokenAsync({projectId}))).data;
   if(version!==epoch.current)return;
   const body={action:'REGISTER',...value,token,locale:current.locale};
   const enabled=(value:unknown)=>Boolean(value&&typeof value==='object'&&(value as {ok?:unknown;deliveryEnabled?:unknown}).ok===true&&(value as {deliveryEnabled?:unknown}).deliveryEnabled===true);
   let deliveryReady=true;
   if(current.session)deliveryReady=enabled(await current.request('/api/mobile/notifications/devices',body))&&deliveryReady;
   if(version!==epoch.current)return;
   if(activeGuest)deliveryReady=enabled(await apiRequest('/api/mobile/notifications/devices',{token:activeGuest.token,body}))&&deliveryReady;
   if(version===epoch.current){setStatus(deliveryReady?'ON':'UNAVAILABLE');if(!deliveryReady)setError('Phone delivery is being set up. In-app updates still work.');}
  }catch{if(version===epoch.current){setStatus('UNAVAILABLE');setError('Phone alerts could not connect. In-app updates still work.');}}
  finally{lock.current=false;if(again.current){again.current=false;void registerNow(false);}}
 },[]);
 useEffect(()=>{
  const advance=()=>{epoch.current++;};advance();const version=epoch.current;
  // Coalesce scope/locale/session commits before updating the external SDK.
  queueMicrotask(()=>{if(epoch.current===version)void register(false);});
  const subscription=AppState.addEventListener('change',state=>{if(state==='active'){void register(false);if(pendingTap.current)setTapRevision(value=>value+1);}});
  return()=>{advance();subscription.remove();};
 },[scope,input.busy,input.guestReady,input.guest?.token,input.guest?.validUntil,input.locale,input.session?.accessToken,register]);
 useEffect(()=>{
  let disposed=false;const subscriptions:{remove:()=>void}[]=[];
  void notifications().then(sdk=>{if(!sdk||disposed)return;
   sdk.setNotificationHandler({handleNotification:async()=>nativePushPresentation(AppState.currentState)});
   const receive=(value:unknown)=>{pendingTap.current=value;setTapRevision(revision=>revision+1);};
   const previous=sdk.getLastNotificationResponse();if(previous)receive(previous.notification.request.content.data);
   subscriptions.push(sdk.addNotificationResponseReceivedListener(response=>receive(response.notification.request.content.data)),sdk.addNotificationReceivedListener(()=>nativePushRefresh()),sdk.addPushTokenListener(()=>{void register(false);}));
  }).catch(()=>setStatus('UNAVAILABLE'));
  return()=>{disposed=true;for(const subscription of subscriptions)subscription.remove();};
 },[register]);
 useEffect(()=>{
  if(opening.current||!pendingTap.current||input.busy||!input.guestReady)return;
  const value=pendingTap.current,target=nativePushDestination(value),data=value as {kind?:string;sourceId?:string;eventId?:string};
  if(!target||!data.eventId||handled.current.has(data.eventId)){pendingTap.current=null;return;}
  if(data.kind!=='BROKERAGE'&&!input.session){router.navigate('/account');return;}
  opening.current=true;const version=epoch.current;let finished=false;
  void (async()=>{try{
   if(data.kind==='BROKERAGE'){
    const guest=input.guest;if(!guest||guest.id!==data.sourceId||guest.validUntil<=Date.now())throw Error('FORBIDDEN');
    await apiRequest('/api/mobile/brokerage',{token:guest.token});
   }else await input.request(data.kind==='SUPPORT'?'/api/mobile/support/'+data.sourceId:'/api/mobile/shipments/'+data.sourceId);
   if(version!==epoch.current)return;
   router.navigate(target as Href);nativePushRefresh();finished=true;
  }catch(error){if(version!==epoch.current)return;
   const temporary=error instanceof ApiError&&(error.status===0||error.status===429||error.status>=500);
   setError(temporary?'Could not open this update. Reconnect and try again.':'This update is no longer available to you.');finished=!temporary;
  }
  finally{opening.current=false;if(finished){handled.current.add(data.eventId!);if(handled.current.size>100)handled.current.delete(handled.current.values().next().value!);
   if(pendingTap.current===value){pendingTap.current=null;const sdk=await notifications();await sdk?.clearLastNotificationResponseAsync().catch(()=>{});}
  }}})();
 },[tapRevision,input]);
 const toggle=useCallback(async()=>{
  if(lock.current)return;
  if(optedIn){await Storage.setItemAsync(enabledKey,'false');setOptedIn(false);await removeNativePushScope('ALL');const sdk=await notifications();await sdk?.dismissAllNotificationsAsync().catch(()=>{});setStatus('OFF');setError('');}
  else await register(true);
 },[optedIn,register]);
 return {status,optedIn,error,toggle};
}
