'use client';
import React from 'react';
import Link from 'next/link';
import {ArrowRight,Building2,Check,Network,Truck} from 'lucide-react';
import {Text,useTranslation} from './localization';
import {platformAbout} from '@/lib/platform-copy.js';
import styles from './about-audiences.module.css';

const icons=[Network,Truck,Building2];
export function AboutAudiences(){
  const {t}=useTranslation(),[selected,setSelected]=React.useState(0),tabs=React.useRef([] as (HTMLButtonElement|null)[]);
  function move(event:{key:string;preventDefault:()=>void},index:number){
    let next=index;
    if(event.key==='ArrowRight')next=(index+1)%platformAbout.audiences.length;
    else if(event.key==='ArrowLeft')next=(index+platformAbout.audiences.length-1)%platformAbout.audiences.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=platformAbout.audiences.length-1;
    else return;
    event.preventDefault();setSelected(next);tabs.current[next]?.focus();
  }
  return <div className={styles.about}>
    <header className={styles.introduction}><h1><Text message={platformAbout.title}/></h1><p><Text message={platformAbout.body}/></p></header>
    <div className={styles.tabs} role="tablist" aria-label={t('About Loadgistic')}>
      {platformAbout.audiences.map((audience,index)=>{const Icon=icons[index];return <button key={audience.id} id={`about-tab-${audience.id}`} type="button" role="tab" aria-selected={selected===index} aria-controls={`about-panel-${audience.id}`} tabIndex={selected===index?0:-1} ref={(node:HTMLButtonElement|null)=>{tabs.current[index]=node;}} onKeyDown={(event:{key:string;preventDefault:()=>void})=>move(event,index)} onClick={()=>setSelected(index)}><Icon aria-hidden="true"/><span><Text message={audience.label}/></span></button>;})}
    </div>
    {platformAbout.audiences.map((audience,index)=><section key={audience.id} className={styles.panel} role="tabpanel" id={`about-panel-${audience.id}`} aria-labelledby={`about-tab-${audience.id}`} hidden={selected!==index} tabIndex={0}>
      <h2><Text message={audience.heading}/></h2>
      <ul className={styles.facts}>{audience.facts.map(([title,body])=><li key={title}><Check aria-hidden="true"/><div><h3><Text message={title}/></h3><p><Text message={body}/></p></div></li>)}</ul>
      <Link className="button" href={audience.href}><Text message={audience.action}/><ArrowRight aria-hidden="true"/></Link>
    </section>)}
    <footer className={styles.legal}><Link href="/privacy"><Text message="Privacy"/></Link><Link href="/terms"><Text message="Terms"/></Link><Link href="/delete-account"><Text message="Account and data deletion"/></Link><div className={styles.office}><Text message="Jigjiga, Somali Region, Ethiopia"/><span>© {new Date().getFullYear()} <a href="https://marketvisiontech.com/" target="_blank" rel="noopener noreferrer"><Text message="MarketVision Technology"/></a></span></div></footer>
  </div>;
}
