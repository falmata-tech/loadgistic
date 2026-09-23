'use client';

import React from 'react';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {Languages} from 'lucide-react';
import {LANGUAGES,LOCALE_COOKIE,supportedLocale,translateMessage} from '@/lib/i18n/core.js';
import {loadMessages} from '@/lib/i18n/catalogs';
import type {Locale,Messages} from '@/lib/i18n/catalogs';

type Values=Record<string,string|number>;
type Context={locale:Locale;messages:Messages;busy:boolean;setLocale:(locale:Locale)=>Promise<void>};
const LanguageContext=React.createContext({locale:'en',messages:{},busy:false,setLocale:async()=>{}} as Context);

export function LanguageProvider({locale:initialLocale,messages:initialMessages,children}:{locale:Locale;messages:Messages;children:ReactNode}){
  const [state,setState]=React.useState({locale:initialLocale,messages:initialMessages});
  const [busy,setBusy]=React.useState(false);const request=React.useRef(0);
  React.useEffect(()=>{document.documentElement.lang=state.locale;},[state.locale]);
  async function setLocale(value:Locale){
    const locale=supportedLocale(value) as Locale,version=++request.current;setBusy(true);
    try{const messages=await loadMessages(locale);if(version!==request.current)return;
      document.cookie=`${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
      setState({locale,messages});
    }finally{if(version===request.current)setBusy(false);}
  }
  return <LanguageContext.Provider value={{...state,busy,setLocale}}>{children}</LanguageContext.Provider>;
}
export function useTranslation(){
  const {locale,messages}=React.useContext(LanguageContext) as Context;
  return {locale,t:(message:string,values:Values={})=>translateMessage(messages,message,values)};
}
/** Explicitly marks fixed interface copy. Never wrap user-generated content. */
export function Text({message,values}:{message:string;values?:Values}){
  const {t}=useTranslation();return t(message,values);
}

type Tag=keyof React.JSX.IntrinsicElements|'link';
type Props<T extends Tag>={as:T;copy:readonly string[]} & (T extends 'link'?React.ComponentPropsWithRef<typeof Link>:T extends keyof React.JSX.IntrinsicElements?React.JSX.IntrinsicElements[T]:never);
/** Translate only declared copy attributes; preserve children, refs and form values. */
export function Localized<T extends Tag>({as,copy,...props}:Props<T>){
  const {t}=useTranslation();const localized:Record<string,unknown>={...props};
  for(const key of copy){const value=localized[key];if(typeof value==='string')localized[key]=t(value);}
  return as==='link'?React.createElement(Link,localized as React.ComponentPropsWithRef<typeof Link>):React.createElement(as,localized);
}
export function LanguagePicker(){
  const {locale,busy,setLocale}=React.useContext(LanguageContext) as Context,{t}=useTranslation();
  const [error,setError]=React.useState(false);const [ready,setReady]=React.useState(false);
  React.useEffect(()=>setReady(true),[]);
  return <div className="language-picker">
    <label><Languages aria-hidden="true"/><span className="sr-only">{t('Language')}</span>
      <select aria-label={t('Language')} value={locale} disabled={!ready||busy} onChange={event=>{setError(false);void setLocale(event.target.value as Locale).catch(()=>setError(true));}}>
        {LANGUAGES.map(language=><option key={language.code} value={language.code} lang={language.code}>{language.name}</option>)}
      </select>
    </label>
    {error?<span role="alert" className="language-picker-error">{t('Could not change language. Try again.')}</span>:null}
  </div>;
}
