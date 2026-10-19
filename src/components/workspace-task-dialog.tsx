'use client';

import React from 'react';
import {Pencil, X} from 'lucide-react';
import {Text, useTranslation} from './localization';
import styles from './workspace-task-dialog.module.css';

/** A deliberate, bounded edit preserves the record underneath it. */
export function WorkspaceTaskDialog({title,triggerLabel,description,children,triggerClassName='button secondary small',disabled=false,variant='default',icon}:{
  title:string;triggerLabel:string;description?:string;children:React.ReactNode;
  triggerClassName?:string;disabled?:boolean;variant?:'default'|'danger';icon?:React.ReactNode;
}){
  const {t}=useTranslation();
  const [open,setOpen]=React.useState(false);
  const [ready,setReady]=React.useState(false);
  React.useEffect(()=>{setReady(true);},[]);
  const trigger=React.useRef(null as HTMLButtonElement|null),dialog=React.useRef(null as HTMLDialogElement|null);
  const titleId=React.useId(),descriptionId=React.useId();
  const submitting=React.useRef(false);
  const busy=()=>submitting.current||Boolean(dialog.current?.querySelector('[aria-busy="true"]'));
  const close=()=>{if(!busy())setOpen(false);};
  React.useEffect(()=>{
    if(!open)return;
    const element=dialog.current;if(!element)return;
    const previousOverflow=document.body.style.overflow;
    submitting.current=false;element.showModal();document.body.style.overflow='hidden';
    return()=>{
      if(element.open)element.close();document.body.style.overflow=previousOverflow;
      if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});
    };
  },[open]);
  return <>
    <button ref={trigger} type="button" className={triggerClassName} disabled={disabled||!ready} aria-haspopup="dialog" onClick={()=>setOpen(true)}>{icon||<Pencil aria-hidden="true"/>}<Text message={triggerLabel}/></button>
    {open?<dialog ref={dialog} className={`${styles.dialog} ${variant==='danger'?styles.danger:''}`} aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined} onCancel={event=>{event.preventDefault();close();}} onSubmit={event=>{
      // Only native navigation becomes pending here. Enhanced forms own their busy state.
      if(!event.defaultPrevented)submitting.current=true;
    }}>
      <header className={styles.header}><div><h2 id={titleId}><Text message={title}/></h2>{description?<p id={descriptionId}><Text message={description}/></p>:null}</div><button type="button" className="icon-button" aria-label={t('Close editor')} onClick={close}><X aria-hidden="true"/></button></header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}><button type="button" className="button secondary" onClick={close}><Text message="Cancel"/></button></footer>
    </dialog>:null}
  </>;
}
