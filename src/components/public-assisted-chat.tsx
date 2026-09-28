"use client";
import {Text,Localized} from '@/components/localization';
import {MessageCircle,X} from 'lucide-react';
import {usePathname} from 'next/navigation';
import React from 'react';
import {TransportRequestForm} from './transport-request-form';

// Brokerage conversations remain separate from provider dashboard Support.
export function PublicAssistedChat(){
 const dialog=React.useRef(null as HTMLDialogElement|null),pathname=usePathname();
 const [hydrated,setHydrated]=React.useState(false),[open,setOpen]=React.useState(false);
 const enabled=!pathname.startsWith('/help/')&&!pathname.startsWith('/login')&&!pathname.startsWith('/apply');
 React.useEffect(()=>{setOpen(sessionStorage.getItem('loadgistic-transport-request-open')==='1');setHydrated(true);},[]);
 React.useEffect(()=>{
  if(!hydrated||!enabled)return;
  if(open){if(!dialog.current?.open)dialog.current?.showModal();}else if(dialog.current?.open)dialog.current.close();
  sessionStorage.setItem('loadgistic-transport-request-open',open?'1':'0');
 },[open,enabled,hydrated]);
 if(!enabled)return null;
 return <><div className="public-assistance-dock">
  <Localized as="button" copy={["aria-label"]} aria-label="Arrange transport" aria-describedby="transport-chat-entry-kind" className="public-assistance-request" type="button" disabled={!hydrated} onClick={()=>setOpen(true)} aria-haspopup="dialog"><MessageCircle aria-hidden="true"/><span><Text message="Arrange transport"/><small id="transport-chat-entry-kind"><Text message="Live chat"/></small></span></Localized>
 </div><dialog ref={dialog} className="public-chat-dialog" aria-labelledby="public-chat-title" onClose={()=>setOpen(false)} onCancel={event=>{event.preventDefault();setOpen(false);}}>
  <header><div className="transport-chat-heading"><p><MessageCircle aria-hidden="true"/><Text message="Live chat with our transport team"/></p><h2 id="public-chat-title"><Text message="Let us arrange your transport"/></h2></div><Localized as="button" copy={["aria-label"]} type="button" onClick={()=>setOpen(false)} aria-label="Close"><X aria-hidden="true"/></Localized></header>
  <div className="public-help-panel"><TransportRequestForm active={open}/></div>
 </dialog></>;
}
