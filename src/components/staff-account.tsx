'use client';
import {UserRound} from 'lucide-react';
import {Text,useTranslation} from './localization';
import {LogoutButton} from './logout-button';
import Link from 'next/link';
import styles from './staff-account.module.css';

export function StaffAccount({name,href,ariaLabel='Staff account',documentNavigation=false}:{name:string;href?:string;ariaLabel?:string;documentNavigation?:boolean}){
  const {t}=useTranslation();
  const AccountLink=documentNavigation?'a':Link;
  return <details className={styles.account}>
    <summary aria-label={t(ariaLabel)}><UserRound aria-hidden="true"/><span className={styles.label}><Text message="Account"/></span></summary>
    <div className={styles.panel}><strong>{name}</strong>{href?<AccountLink href={href}><Text message="Account"/></AccountLink>:null}<LogoutButton compact/></div>
  </details>;
}
