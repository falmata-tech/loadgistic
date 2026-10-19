'use client';

import React from 'react';
import {X} from 'lucide-react';
import {Text,useTranslation} from '@/components/localization';

export function TrackingDetailDialog({title,closeLabel,onClose,children,className=''}:{title:string;closeLabel:string;onClose:()=>void;children:React.ReactNode;className?:string}){
  const dialog=React.useRef(null as HTMLDialogElement|null),close=React.useRef(onClose),titleId=React.useId();
  const {t}=useTranslation();close.current=onClose;
  React.useEffect(()=>{
    const element=dialog.current;if(!element)return;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    element.showModal();
    const clear=()=>{if(element.open)element.close();close.current();};
    const hide=()=>{if(document.visibilityState!=='visible')clear();};
    window.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',hide);
    return()=>{
      window.removeEventListener('pagehide',clear);document.removeEventListener('visibilitychange',hide);
      if(element.open)element.close();
      if(previousFocus?.isConnected&&document.visibilityState==='visible')previousFocus.focus({preventScroll:true});
    };
  },[]);
  return <dialog ref={dialog} className={`tracking-detail-dialog ${className}`} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{
    if(event.target!==event.currentTarget)return;
    const box=event.currentTarget.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();
  }}>
    <header><h2 id={titleId}><Text message={title}/></h2><button className="button secondary icon-button" type="button" aria-label={t(closeLabel)} autoFocus onClick={onClose}><X aria-hidden="true"/></button></header>
    <div className="tracking-detail-dialog-content">{children}</div>
  </dialog>;
}
