'use client';
import {UserRound} from 'lucide-react';
import {Text,useTranslation} from './localization';
import {LogoutButton} from './logout-button';
import styles from './staff-account.module.css';

export function StaffAccount({name}:{name:string}){
  const {t}=useTranslation();
  return <details className={styles.account}>
    <summary aria-label={t('Staff account')}><UserRound aria-hidden="true"/><span className={styles.label}><Text message="Account"/></span></summary>
    <div className={styles.panel}><strong>{name}</strong><LogoutButton compact/></div>
  </details>;
}
