import {useEffect,useState} from 'react';
import {contentBlocks,changeContentBlock} from '../../../../src/lib/content-blocks.js';
import * as Storage from '../session/storage';
const key='loadgistic.blocked-providers.v1',listeners=new Set<()=>void>();
let writes=Promise.resolve();
export function useBlockedProviders(){
 const [blocked,setBlocked]=useState<string[]>([]);
 useEffect(()=>{let alive=true;const read=()=>{void Storage.getItemAsync(key).then(raw=>{if(alive)setBlocked(contentBlocks(raw));}).catch(()=>undefined);};read();listeners.add(read);return()=>{alive=false;listeners.delete(read);};},[]);
 return {blocked,set:(handle:string,value:boolean)=>{const next=writes.then(async()=>{const previous=contentBlocks(await Storage.getItemAsync(key));const updated=changeContentBlock(previous,handle,value);await Storage.setItemAsync(key,JSON.stringify(updated),{keychainAccessible:Storage.WHEN_UNLOCKED_THIS_DEVICE_ONLY});for(const notify of listeners)notify();});writes=next.catch(()=>undefined);return next;}};
}
