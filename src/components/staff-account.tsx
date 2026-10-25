'use client';
import {UserRound} from 'lucide-react';
import {Text,useTranslation} from './localization';
import {LogoutButton} from './logout-button';
import Link from 'next/link';
import styles from './staff-account.module.css';

export function StaffAccount({name,href,ariaLabel='Staff account'}:{name:string;href?:string;ariaLabel?:string}){
  const {t}=useTranslation();
  return <details className={styles.account}>
    <summary aria-label={t(ariaLabel)}><UserRound aria-hidden="true"/><span className={styles.label}><Text message="Account"/></span></summary>
    <div className={styles.panel}><strong>{name}</strong>{href?<Link href={href}><Text message="Account"/></Link>:null}<LogoutButton compact/></div>
  </details>;
}
