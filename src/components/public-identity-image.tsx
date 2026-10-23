'use client';

import React from 'react';
import {Building2,UserRound} from 'lucide-react';
import {useTranslation} from './localization';
import styles from './public-identity-image.module.css';

export function PublicIdentityImage({path,kind,label,message,fallbackMessage,size='normal',className=''}:{path?:string|null;kind:'company'|'person';label:string;message?:string;fallbackMessage?:string;size?:'small'|'normal'|'large';className?:string}){
 const {t}=useTranslation();const accessibleName=message?t(message):label;
 const [failed,setFailed]=React.useState('');
 const source=path&&path!==failed?path:null;
 const fallbackName=fallbackMessage?t(fallbackMessage):accessibleName;
 return <span className={`${styles.image} ${styles[size]} ${styles[kind]} ${className}`} data-identity-kind={kind} role={!source&&fallbackName?'img':undefined} aria-label={!source&&fallbackName?fallbackName:undefined} aria-hidden={!source&&!fallbackName?true:undefined}>
  {source?<img src={source} alt={accessibleName} onError={()=>setFailed(source)}/>:kind==='company'?<Building2 aria-hidden="true"/>:<UserRound aria-hidden="true"/>}
 </span>;
}
