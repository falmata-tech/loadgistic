"use client";
import {Text,Localized} from '@/components/localization';
import {MessageCircle,X} from 'lucide-react';
import {usePathname} from 'next/navigation';
import React from 'react';
import {TransportRequestForm} from './transport-request-form';
import {useChatAlerts,ChatAlertToast,ChatSoundToggle} from './chat-alerts';

// Brokerage conversations remain separate from provider dashboard Support.
export function PublicAssistedChat(){
 const dialog=React.useRef(null as HTMLDialogElement|null),pathname=usePathname();
 const [hydrated,setHydrated]=React.useState(false),[open,setOpen]=React.useState(false);
 const alerts=useChatAlerts('/api/chat/alerts?scope=VISITOR','visitor');
 const enabled=!pathname.startsWith('/help/')&&!pathname.startsWith('/login')&&!pathname.startsWith('/apply');
 React.useEffect(()=>{setOpen(sessionStorage.getItem('loadgistic-transport-request-open')==='1'||location.hash==='#transport-chat');setHydrated(true);const openFromNotification=(event:MessageEvent)=>{if(event.data?.type==='loadgistic-open-transport'&&event.data.href==='/about#transport-chat')setOpen(true);};navigator.serviceWorker?.addEventListener('message',openFromNotification);return()=>navigator.serviceWorker?.removeEventListener('message',openFromNotification);},[]);
 React.useEffect(()=>{
  if(!hydrated||!enabled)return;
  if(open){if(!dialog.current?.open)dialog.current?.showModal();}else if(dialog.current?.open)dialog.current.close();
  sessionStorage.setItem('loadgistic-transport-request-open',open?'1':'0');
 },[open,enabled,hydrated]);
 if(!enabled)return null;
 return <><div className="public-assistance-dock">
  <Localized as="button" copy={["aria-label"]} aria-label="Need help with transport?" aria-describedby="transport-chat-entry-kind" className="public-assistance-request" type="button" disabled={!hydrated} onClick={()=>setOpen(true)} aria-haspopup="dialog"><MessageCircle aria-hidden="true"/><span><Text message="Need help with transport?"/><small id="transport-chat-entry-kind"><Text message="Let us handle it"/> · <Text message="Live chat"/></small></span>{!!alerts.snapshot?.unreadCount&&<span className="chat-alert-badge">{alerts.snapshot.unreadCount}</span>}</Localized>
 </div>{!open&&<ChatAlertToast alerts={alerts} onOpen={()=>setOpen(true)}/>}<dialog ref={dialog} className="public-chat-dialog" aria-labelledby="public-chat-title" onClose={()=>setOpen(false)} onCancel={event=>{event.preventDefault();setOpen(false);}}>
  <header><div className="transport-chat-heading"><h2 id="public-chat-title"><Text message="Need help with transport?"/></h2><p><MessageCircle aria-hidden="true"/><Text message="Let us handle it"/> · <Text message="Live chat"/></p></div><Localized as="button" copy={["aria-label"]} type="button" onClick={()=>setOpen(false)} aria-label="Close"><X aria-hidden="true"/></Localized></header>
  <div className="public-chat-sound"><ChatSoundToggle alerts={alerts}/>{alerts.offline&&<small><Text message="Updates paused. Reconnecting…"/></small>}</div><div className="public-help-panel"><TransportRequestForm active={open}/></div>
 </dialog></>;
}
