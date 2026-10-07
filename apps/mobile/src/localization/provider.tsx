import { createContext,useContext,useEffect,useReducer,useState,type PropsWithChildren } from 'react';
import * as SecureStore from '../session/storage';
import am from '../../../../src/lib/i18n/messages/am.json';
import om from '../../../../src/lib/i18n/messages/om.json';
import so from '../../../../src/lib/i18n/messages/so.json';
import ti from '../../../../src/lib/i18n/messages/ti.json';
import { translateMessage } from '../../../../src/lib/i18n/core';
import { createLanguageController,type Locale } from './controller';
import { nativeMessages } from './messages';
const key='loadgistic.language.v1';
// Native bundles catalogs for offline use. Web's dynamic imports create Metro
// split-bundle requests for files outside the mobile app root.
const catalogs={en:{},am,om,so,ti};
type LanguageContext={locale:Locale;error:string;busy:boolean;select:(locale:Locale)=>Promise<void>;t:(message:string,values?:Record<string,string|number>)=>string};
const Context=createContext<LanguageContext|null>(null);
export function LanguageProvider({children}:PropsWithChildren) {
 const [,render]=useReducer(n=>n+1,0);
 const [controller]=useState(()=>createLanguageController({changed:render,load:async locale=>({...catalogs[locale],...nativeMessages[locale]}),read:()=>SecureStore.getItemAsync(key),write:locale=>SecureStore.setItemAsync(key,locale)}));
 useEffect(()=>{void controller.restore();},[controller]);
 const state=controller.snapshot();
 return <Context.Provider value={{locale:state.locale,busy:state.busy,error:state.error,select:controller.select,t:(message,values={})=>translateMessage(state.messages,message,values)}}>{children}</Context.Provider>;
}
// Call only at explicit app-owned copy boundaries; never wrap record data.
export function useLanguage(){const value=useContext(Context);if(!value)throw Error('LanguageProvider required');return value;}
