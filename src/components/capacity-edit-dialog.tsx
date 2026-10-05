"use client";


import {Localized} from '@/components/localization';
import React from 'react';
import { X } from 'lucide-react';

export function CapacityEditDialog({title,truck,busy,onClose,children}:{title:string;truck:string;busy:boolean;onClose:()=>void;children:React.ReactNode}){
  const dialogRef=React.useRef(null as HTMLDialogElement|null);
  const titleId=React.useId();
  React.useEffect(()=>{
    const dialog=dialogRef.current;
    const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow='hidden';
    return()=>{
      dialog?.close();
      document.body.style.overflow=previousOverflow;
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
    };
  },[]);
  return <dialog ref={dialogRef} className="capacity-signal-dialog" aria-labelledby={titleId} aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header className="capacity-signal-dialog-header"><div><h2 id={titleId}>{title}</h2><p>{truck}</p></div><Localized as="button" copy={["aria-label"]} type="button" className="icon-button" aria-label="Close editor" disabled={busy} onClick={onClose}><X aria-hidden="true"/></Localized></header>
    {children}
  </dialog>;
}
