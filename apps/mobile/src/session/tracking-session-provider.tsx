import {createContext,useContext,useEffect,useState,type PropsWithChildren} from 'react';
import {AppState} from 'react-native';
import {apiRequest} from '../api/http';
import {createTrackingSessionController} from './tracking-session-controller';
type Controller=ReturnType<typeof createTrackingSessionController>;
const Context=createContext<{controller:Controller;snapshot:ReturnType<Controller['snapshot']>}|null>(null);
export function TrackingSessionProvider({children}:PropsWithChildren){
 const [,render]=useState(0),[controller]=useState(()=>createTrackingSessionController({development:__DEV__,now:Date.now,request:apiRequest,changed:()=>render(value=>value+1)}));
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>controller.setForeground(state==='active'));const timer=setInterval(()=>controller.expire(),1000);return()=>{listener.remove();clearInterval(timer);controller.setForeground(false);};},[controller]);
 return <Context.Provider value={{controller,snapshot:controller.snapshot()}}>{children}</Context.Provider>;
}
export function useTrackingSession(){const value=useContext(Context);if(!value)throw Error('TrackingSessionProvider required');return value;}
