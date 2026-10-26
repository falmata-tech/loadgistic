'use client';
import React from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {FileText,LockKeyhole,MoreHorizontal,X} from 'lucide-react';
import {Localized,Text} from './localization';
import {aboutDestination,activeSiteDestination,memberDestinations,phonePrimaryDestinations,publicDestinations,visitorDestinations,type SiteDestination,type SiteNavigationUser} from './site-navigation';
import styles from './public-navigation.module.css';

export function PublicMobileNav({user}:{user:SiteNavigationUser|null}){
 const pathname=usePathname(),router=useRouter(),active=activeSiteDestination(pathname,user),[menuOpen,setMenuOpen]=React.useState(false),[ready,setReady]=React.useState(false);
 const privateItems=memberDestinations(user),primary=phonePrimaryDestinations(user);
 const workItems=privateItems.filter(item=>!['support','account'].includes(item.key));
 const utilityItems=privateItems.filter(item=>['support','account'].includes(item.key));
 const primaryKeys=new Set(primary.map(item=>item.key));
 const moreWork=workItems.filter(item=>!primaryKeys.has(item.key));
 const provider=['DRIVER','TRANSPORTER'].includes(user?.role||'');
 const currentHomeTab=['/app/home','/app/home/vehicles','/app/home/market'].includes(pathname);
 const customer=user?.role==='CUSTOMER';
 const morePublic=publicDestinations.filter(item=>!(provider&&item.key==='capacity')&&!primaryKeys.has(item.key));
 const moreUtility=utilityItems.filter(item=>!primaryKeys.has(item.key));
 React.useEffect(()=>{if(pathname==='/'&&window.location.hash==='#featured-providers')router.replace('/featured');},[pathname,router]);
 React.useEffect(()=>{setMenuOpen(false);},[pathname]);
 React.useEffect(()=>{setReady(true);},[]);
 const link=(item:SiteDestination,className?:string)=><Link key={item.key} href={item.href} className={[className,active===item.key?'active':''].filter(Boolean).join(' ')||undefined} aria-current={active===item.key?'page':undefined} onClick={(event:React.MouseEvent<HTMLAnchorElement>)=>{
  if(item.key==='my-work'&&active==='my-work'&&currentHomeTab&&!event.defaultPrevented&&event.button===0&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&(!event.currentTarget.target||event.currentTarget.target==='_self'))event.preventDefault();
  setMenuOpen(false);
 }}><item.icon aria-hidden="true"/><span><Text message={item.label}/></span></Link>;
 return <>
  <Localized as="nav" copy={["aria-label"]} className={`public-workspace-nav ${styles.rail}`} aria-label="Site navigation">
   {!user?visitorDestinations.map(item=>link(item)):<>
   {customer?link(publicDestinations[0]):null}
   {workItems.map(item=>link(item))}
   {workItems.length?<div className={styles.group} aria-hidden="true"/>:null}
   {publicDestinations.filter(item=>item.key!=='capacity'||!provider&&!customer).map(item=>link(item))}
   {utilityItems.length?<div className={styles.group} aria-hidden="true"/>:null}
   {utilityItems.map(item=>link(item))}
   {link(aboutDestination)}
   </>}
   <div className={styles.legal}><Link href="/privacy" aria-current={pathname==='/privacy'?'page':undefined}><LockKeyhole aria-hidden="true"/><span><Text message="Privacy"/></span></Link><Link href="/terms" aria-current={pathname==='/terms'?'page':undefined}><FileText aria-hidden="true"/><span><Text message="Terms"/></span></Link></div>
  </Localized>
  <Localized as="nav" copy={["aria-label"]} className="public-mobile-nav" aria-label="Mobile navigation">
   {primary.map(item=>link(item))}
   {user?<button type="button" className={menuOpen?'active':''} aria-expanded={menuOpen} aria-controls="site-more-menu" disabled={!ready} onClick={()=>setMenuOpen(true)}><MoreHorizontal aria-hidden="true"/><span><Text message="More"/></span></button>:null}
  </Localized>
  {menuOpen?<div className={styles.menuBackdrop} onClick={()=>setMenuOpen(false)}><div id="site-more-menu" className={styles.menu} role="dialog" aria-modal="true" aria-label="More navigation" onClick={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape')setMenuOpen(false);}}><div className={styles.menuTitle}><strong><Text message="More"/></strong><button type="button" aria-label="Close menu" onClick={()=>setMenuOpen(false)}><X aria-hidden="true"/></button></div>
    {moreWork.map(item=>link(item))}
    {moreWork.length?<div className={styles.group} aria-hidden="true"/>:null}
    {morePublic.map(item=>link(item))}
    {moreUtility.length?<div className={styles.group} aria-hidden="true"/>:null}
    {moreUtility.map(item=>link(item))}
    {link(aboutDestination)}
    <div className={styles.legal}><Link href="/privacy" aria-current={pathname==='/privacy'?'page':undefined}><Text message="Privacy"/></Link><Link href="/terms" aria-current={pathname==='/terms'?'page':undefined}><Text message="Terms"/></Link></div></div></div>:null}
 </>;
}
