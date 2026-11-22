import React from 'react';
import {acceptedResult,incomingResult,targetResult,type RequestCommand} from './requests';
import type {z} from 'zod';
export type SendTrackingRequest=(command:RequestCommand)=>Promise<unknown>;
export type Target=z.infer<typeof targetResult>['items'][number];
export type Incoming=z.infer<typeof incomingResult>[number];

export function useTrackingRequests(send:SendTrackingRequest,sessionId?:string){
 const [query,setQueryValue]=React.useState(''),[searched,setSearched]=React.useState(false),[target,setTarget]:[z.infer<typeof targetResult>|null,(x:z.infer<typeof targetResult>|null)=>void]=React.useState(null as z.infer<typeof targetResult>|null);
 const [incoming,setIncoming]:[Incoming[],(x:Incoming[]|((rows:Incoming[])=>Incoming[]))=>void]=React.useState([] as Incoming[]),[shipment,setShipment]=React.useState('');
 const [busy,setBusy]=React.useState(true),[error,setError]=React.useState(false);
 const generation=React.useRef(0),locked=React.useRef(false);
 const run=React.useCallback(async(command:RequestCommand)=>{
  if(locked.current)return;
  const current=++generation.current;locked.current=true;setBusy(true);setError(false);
  try{
   const response=await send(command);
   if(current!==generation.current)return;
   switch(command.action){
    case 'INBOX':setIncoming(incomingResult.parse(response));break;
    case 'DECLINE':if(response!==true)throw Error();setIncoming(rows=>rows.filter(row=>row.id!==command.sessionId));break;
    case 'ACCEPT':setShipment(acceptedResult.parse(response).shipmentId);setIncoming(rows=>rows.filter(row=>row.id!==command.sessionId));break;
    default:setTarget(targetResult.parse(response));setSearched(command.action==='SEARCH'&&command.query.trim().length>=2);break;
   }
  }catch{if(current===generation.current){setError(true);setIncoming([]);setTarget(null);}}
  finally{if(current===generation.current){locked.current=false;setBusy(false);}}
 },[send]);
 const refresh=React.useCallback(()=>run(sessionId?{action:'SEARCH',sessionId,query:''}:{action:'INBOX'}),[run,sessionId]);
 React.useEffect(()=>{setShipment('');setQuery('');setIncoming([]);setTarget(null);void refresh();return()=>{generation.current++;locked.current=false;};},[refresh]);
 function setQuery(value:string){setQueryValue(value);setSearched(false);setTarget(target?{...target,items:[]}:null);}
 return {query,setQuery,searched,target,incoming,shipment,busy,error,refresh,
  search:()=>sessionId&&run({action:'SEARCH',sessionId,query}),
  select:(row:Target)=>sessionId&&target&&run({action:'SELECT',sessionId,vehicleId:row.vehicleId,driverId:row.driverId,revision:target.revision}),
  withdraw:()=>sessionId&&target?.selected&&run({action:'WITHDRAW',sessionId,revision:target.revision}),
  decline:(row:Incoming)=>run({action:'DECLINE',sessionId:row.id,revision:row.revision}),
  accept:(row:Incoming,trackingMode:'STATUS_ONLY'|'LOCATION_AND_STATUS')=>run({action:'ACCEPT',sessionId:row.id,revision:row.revision,trackingMode})
 };
}
