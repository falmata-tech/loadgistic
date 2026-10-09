'use client';
import React from 'react';
import Link from 'next/link';
import {Bell,Volume2,VolumeX,X} from 'lucide-react';
import {Text,useTranslation} from './localization';
import {chatAlertSnapshot,chatAlertHref} from '@/lib/chat-read-policy.js';
import {chatAlertCopy,createChatAlertTracker} from '@/lib/chat-alert-delivery.js';
import type {ChatAlertSnapshot,ChatAlertEvent,ChatAlertItem} from '@/lib/chat-alert-contract';
import {createBrowserAlertDelivery,type BrowserAlertDelivery,type BrowserAlertStatus} from '@/lib/browser-alert-delivery.js';
import {handoverAlertSnapshot,handoverAlertCopy,handoverAlertHref,createHandoverAlertTracker,type HandoverAlertSnapshot,type HandoverAlert} from '@/lib/handover-alerts.js';
export function useChatAlerts(endpoint:string,identity:string){
 const [snapshot,setSnapshot]=React.useState(null as ChatAlertSnapshot|null),[toast,setToast]=React.useState(null as ChatAlertEvent|null),[offline,setOffline]=React.useState(false);
 const [sound,setSound]=React.useState(false),audio=React.useRef(null as AudioContext|null),soundEnabled=React.useRef(false);
 const [browserStatus,setBrowserStatus]=React.useState('OFF' as BrowserAlertStatus),delivery=React.useRef(null as BrowserAlertDelivery|null),{t}=useTranslation(),translate=React.useRef(t);translate.current=t;
 React.useEffect(()=>{const adapter=createBrowserAlertDelivery(identity);delivery.current=adapter;setBrowserStatus('OFF');let live=true;void adapter.prepare().then(status=>{if(live){setBrowserStatus(status);window.dispatchEvent(new Event('loadgistic-chat-refresh'));}});return()=>{live=false;if(delivery.current===adapter)delivery.current=null;void adapter.dispose();};},[identity]);
 const ding=React.useCallback(()=>{if(soundEnabled.current&&audio.current?.state==='running'){const context=audio.current,oscillator=context.createOscillator(),gain=context.createGain();oscillator.connect(gain);gain.connect(context.destination);oscillator.frequency.value=660;gain.gain.setValueAtTime(.07,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.2);oscillator.start();oscillator.stop(context.currentTime+.2);}},[]);
 const handover=useHandoverAlerts(identity,!endpoint.includes('scope=VISITOR'),delivery,translate,ding);
 React.useEffect(()=>{
  setSnapshot(null);setToast(null);setOffline(false);let disposed=false,running=false,etag='',timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
  const tracker=createChatAlertTracker();let failures=0;
  const poll=async()=>{
   if(delivery.current&&!disposed)setBrowserStatus(delivery.current.status());
   if(disposed||running||(document.visibilityState!=='visible'&&!delivery.current?.enabled()))return;running=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
   try{const response=await fetch(endpoint,{cache:'no-store',signal:controller.signal,headers:etag?{'If-None-Match':etag}:{}});
    if(response.status===401||response.status===403){if(!disposed){setSnapshot(null);setToast(null);setOffline(true);void delivery.current?.dispose();}tracker.reset();return;}
    if(response.status!==304){if(!response.ok)throw Error('UNAVAILABLE');const next=chatAlertSnapshot(await response.json());if(!disposed){
     etag=response.headers.get('etag')||'';setSnapshot(next);
     void delivery.current?.reconcile('chat',next.items.map((item:ChatAlertItem)=>chatAlertHref(item)==='#transport-chat'?'/about#transport-chat':chatAlertHref(item)));
     const changes=tracker.next(next).filter(change=>{
      if(change.event!=='MESSAGE'||document.visibilityState!=='visible'||!document.hasFocus())return true;
      const key=change.item.kind+':'+change.item.id;
      return !Array.from(document.querySelectorAll<HTMLElement>('[data-chat-key]')).some(node=>node.dataset.chatKey===key&&Number(node.dataset.chatVisibleThrough||'-1')>=change.item.incomingSequence);
     });
     if(changes.length){setToast(changes[changes.length-1]);ding();for(const change of changes)void delivery.current?.deliver({eventKey:JSON.stringify([change.item.kind,change.item.id,change.event,change.item.assignmentVersion,change.item.incomingSequence,change.item.endedAt]),body:translate.current(chatAlertCopy(change)),href:chatAlertHref(change.item)==='#transport-chat'?'/about#transport-chat':chatAlertHref(change.item)});}
    }}failures=0;if(!disposed)setOffline(false);
   }catch{failures=Math.min(failures+1,3);if(!disposed)setOffline(true);}
   finally{clearTimeout(timeout);running=false;if(!disposed)timer=setTimeout(poll,Math.min(30000,(document.visibilityState==='visible'?5000:15000)*2**failures));}
  };
  const resume=()=>{clearTimeout(timer);void poll();};void poll();document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);window.addEventListener('loadgistic-chat-refresh',resume);
  return()=>{disposed=true;controller?.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);window.removeEventListener('loadgistic-chat-refresh',resume);};
 },[endpoint,identity,ding]);
 React.useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),10000);return()=>clearTimeout(timer);},[toast]);
 React.useEffect(()=>()=>{void audio.current?.close().catch(()=>{});},[]);
 async function toggleSound(){if(soundEnabled.current){soundEnabled.current=false;setSound(false);return;}try{
  audio.current??=new AudioContext();await audio.current.resume();soundEnabled.current=audio.current.state==='running';setSound(soundEnabled.current);
 }catch{soundEnabled.current=false;setSound(false);}}
 async function toggleBrowser(){const adapter=delivery.current;if(!adapter)return;const status=await adapter.toggle();if(delivery.current===adapter)setBrowserStatus(status);window.dispatchEvent(new Event('loadgistic-chat-refresh'));}
 return {snapshot,toast,offline,sound,toggleSound,browserStatus,toggleBrowser,handover,dismiss:()=>setToast(null)};
}
function useHandoverAlerts(identity:string,enabled:boolean,delivery:React.RefObject<BrowserAlertDelivery|null>,translate:React.RefObject<ReturnType<typeof useTranslation>['t']>,ding:()=>void){
 const [snapshot,setSnapshot]=React.useState(null as HandoverAlertSnapshot|null),[toast,setToast]=React.useState(null as HandoverAlert|null),[offline,setOffline]=React.useState(false);
 React.useEffect(()=>{setSnapshot(null);setToast(null);setOffline(false);if(!enabled)return;let disposed=false,running=false,failures=0,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;const tracker=createHandoverAlertTracker();
  const poll=async()=>{if(disposed||running||(document.visibilityState!=='visible'&&!delivery.current?.enabled()))return;running=true;controller=new AbortController();const deadline=setTimeout(()=>controller?.abort(),12000);
   try{const response=await fetch('/api/notifications/handover',{cache:'no-store',signal:controller.signal});if(response.status===403){if(!disposed){setSnapshot(null);setToast(null);}tracker.reset();return;}if(!response.ok)throw Error('UNAVAILABLE');const data=handoverAlertSnapshot(await response.json());if(!disposed){setSnapshot(data);setOffline(false);void delivery.current?.reconcile('handover',data.items.filter(item=>item.unread).map(handoverAlertHref));const changes=tracker.next(data);if(changes.length){setToast(changes[changes.length-1]);ding();for(const item of changes)void delivery.current?.deliver({eventKey:'handover:'+item.id+':'+item.approvedAt,body:translate.current(handoverAlertCopy(item)),href:handoverAlertHref(item)});}}failures=0;
   }catch{failures=Math.min(failures+1,3);if(!disposed)setOffline(true);}finally{clearTimeout(deadline);running=false;if(!disposed)timer=setTimeout(poll,Math.min(30000,(document.visibilityState==='visible'?5000:15000)*2**failures));}};
  const resume=()=>{clearTimeout(timer);void poll();};void poll();document.addEventListener('visibilitychange',resume);window.addEventListener('loadgistic-chat-refresh',resume);return()=>{disposed=true;controller?.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('loadgistic-chat-refresh',resume);};
 },[identity,enabled,delivery,translate,ding]);
 React.useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),10000);return()=>clearTimeout(timer);},[toast]);
 async function acknowledge(item:HandoverAlert){setToast(null);try{const response=await fetch('/api/notifications/handover',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,approvedAt:item.approvedAt})});if(response.ok)setSnapshot(handoverAlertSnapshot(await response.json()));else setOffline(true);}catch{setOffline(true);}}
 return {snapshot,toast,offline,acknowledge,dismiss:()=>setToast(null)};
}
export function ChatAlerts({identity}:{identity:string}){
 const alerts=useChatAlerts('/api/chat/alerts',identity),[open,setOpen]=React.useState(false),dialog=React.useRef(null as HTMLDialogElement|null),{t}=useTranslation();
 React.useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open&&dialog.current?.open)dialog.current.close();},[open]);
 const count=(alerts.snapshot?.unreadCount||0)+(alerts.snapshot?.waitingCount||0)+(alerts.handover.snapshot?.unreadCount||0);
 return <><button className="button secondary small chat-alert-button" type="button" aria-label={count?t('Updates · {count} new or waiting',{count}):t('Updates')} aria-haspopup="dialog" onClick={()=>setOpen(true)}><Bell size={20} aria-hidden="true"/>{count>0&&<span className="chat-alert-badge">{count>99?'99+':count}</span>}</button>
  <dialog ref={dialog} className="chat-alert-dialog" aria-labelledby="chat-alert-title" onClose={()=>setOpen(false)} onCancel={()=>setOpen(false)}><header><h2 id="chat-alert-title"><Text message="Updates"/></h2><button className="button secondary icon-button" type="button" aria-label={t('Close')} onClick={()=>setOpen(false)}><X aria-hidden="true"/></button></header>
   <ChatSoundToggle alerts={alerts}/>{(alerts.offline||alerts.handover.offline)&&<p role="status"><Text message="Updates paused. Reconnecting…"/></p>}
   {!!alerts.handover.snapshot?.items.length&&<div className="chat-alert-list">{alerts.handover.snapshot.items.map((item:HandoverAlert)=><Link key={item.id} href={handoverAlertHref(item)} onClick={()=>{setOpen(false);void alerts.handover.acknowledge(item);}}><span><strong><Text message={handoverAlertCopy(item)}/></strong><small>#{item.id.slice(0,8).toUpperCase()}</small><small><Text message="Open Tracking"/></small></span>{item.unread&&<span className="chat-alert-count"><Text message="New"/></span>}</Link>)}</div>}
   <div className="chat-alert-list">{alerts.snapshot?.items.length?alerts.snapshot.items.map((item:ChatAlertItem)=><Link key={item.kind+item.id} href={chatAlertHref(item)} onClick={()=>setOpen(false)}><span><strong><Text message={item.kind==='SUPPORT'?'Support':'Arrange transport'}/></strong><small className="chat-alert-reference">#{item.id.slice(0,8).toUpperCase()}</small><small><Text message={item.queued?'Waiting for assignment':item.status==='CLOSED'?'Resolved':item.endedAt?'Chat ended':item.assigned?'Assigned':'Waiting for an agent'}/></small></span>{item.unreadCount>0&&<span className="chat-alert-count"><Text message="{count} unread" values={{count:item.unreadCount}}/></span>}</Link>):!alerts.handover.snapshot?.items.length&&<p className="meta"><Text message="No updates yet."/></p>}</div>
  </dialog>{alerts.handover.toast?<div className="chat-alert-toast" role="status" data-handover-alert><Bell size={18} aria-hidden="true"/><div><strong><Text message={handoverAlertCopy(alerts.handover.toast)}/></strong><Link href={handoverAlertHref(alerts.handover.toast)} onClick={()=>void alerts.handover.acknowledge(alerts.handover.toast!)}><Text message="Open Tracking"/></Link></div><button type="button" onClick={alerts.handover.dismiss} aria-label={t('Dismiss notification')}><X size={18} aria-hidden="true"/></button></div>:<ChatAlertToast alerts={alerts}/>}</>;
}
export function ChatSoundToggle({alerts}:{alerts:ReturnType<typeof useChatAlerts>}){return <><div className="chat-delivery-controls"><button className="button secondary small" type="button" aria-pressed={alerts.sound} onClick={()=>{void alerts.toggleSound();}}>{alerts.sound?<Volume2 size={16} aria-hidden="true"/>:<VolumeX size={16} aria-hidden="true"/>}<Text message={alerts.sound?'Sound on':'Turn on chat sound'}/></button>{alerts.browserStatus!=='UNSUPPORTED'&&<button className="button secondary small" type="button" disabled={alerts.browserStatus==='DENIED'} aria-pressed={alerts.browserStatus==='ON'} onClick={()=>void alerts.toggleBrowser()}><Bell size={16} aria-hidden="true"/><Text message={alerts.browserStatus==='ON'?'Browser alerts on':alerts.browserStatus==='DENIED'?'Browser alerts blocked':'Enable browser alerts'}/></button>}</div>{alerts.browserStatus==='UNAVAILABLE'&&<p className="meta" role="status"><Text message="Browser alerts unavailable. In-app updates still work."/></p>}<p className="meta"><Text message={alerts.browserStatus==='DENIED'?'Allow notifications in your browser’s site settings.':'Keep Loadgistic open to receive browser alerts.'}/></p></>;}
export function ChatAlertToast({alerts,onOpen}:{alerts:ReturnType<typeof useChatAlerts>;onOpen?:()=>void}){
 const {t}=useTranslation();if(!alerts.toast)return null;
 const {item,event}=alerts.toast;
 return <div className="chat-alert-toast" role="status" data-chat-alert-event={event}><Bell size={18} aria-hidden="true"/><div><strong><Text message={chatAlertCopy(alerts.toast)}/></strong>{onOpen?<button type="button" onClick={()=>{onOpen();alerts.dismiss();}}><Text message="Open chat"/></button>:<Link href={chatAlertHref(item)} onClick={alerts.dismiss}><Text message="Open chat"/></Link>}</div><button type="button" onClick={alerts.dismiss} aria-label={t('Dismiss notification')}><X size={18} aria-hidden="true"/></button></div>;
}
