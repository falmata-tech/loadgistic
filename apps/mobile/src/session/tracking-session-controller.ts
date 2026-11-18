import {trackingData,trackingSessionAccessSchema,guestTrackingView,type TrackingSessionView} from '../api/tracking-sessions.ts';
import {trackingAccessCode,trackingLinkToken,trackingAccessLifetimeMs} from '../../../../src/lib/tracking-sessions/client.ts';
type Options={body?:unknown;trackingGrant?:string;method?:'DELETE';signal?:AbortSignal};
type Port={development?:boolean;now:()=>number;request:(path:string,options?:Options)=>Promise<unknown>;changed:()=>void};
export function createTrackingSessionController(port:Port){
 let epoch=0,token:string|null=null,openedLink:string|null=null,id:string|null=null,expiresAt=0,session:TrackingSessionView|null=null,foreground=true,needsRead=false,notice='';
 let reading:Promise<TrackingSessionView>|null=null;
 const valid=()=>Boolean(token&&id&&port.now()<expiresAt);
 const snapshot=()=>({session:valid()&&foreground&&!needsRead?session:null,sessionId:valid()?id:null,expiresAt:valid()?expiresAt:0,foreground,needsRead,notice});
 async function clear(message='Tracking access ended. Open the link and enter its code again.'){const prior=token;notice=message;epoch++;reading=null;token=null;openedLink=null;id=null;session=null;expiresAt=0;needsRead=false;port.changed();if(prior)try{await port.request('/api/tracking/access',{method:'DELETE',trackingGrant:prior});}catch{}}
 async function read(sessionId:string,signal?:AbortSignal){
  if(!valid()||!foreground||sessionId!==id)throw Error('Open the Tracking link and enter its code again.');
  if(reading)return reading;const version=epoch,grant=token!;
  const task=(async()=>{try{
   const result=await port.request(`/api/tracking/sessions/${sessionId}`,{trackingGrant:grant,signal});
   let view:TrackingSessionView;try{view=guestTrackingView(trackingData(result,{parse:value=>value}),sessionId);}catch{if(version===epoch){session=null;needsRead=true;notice='Could not refresh Tracking. Please try again.';port.changed();}throw Error('Could not refresh Tracking. Please try again.');}
   if(version!==epoch||!foreground||!valid()||signal?.aborted)throw Error('Tracking access is no longer active.');
   session=view;needsRead=false;notice='';port.changed();return view;
  }catch(error){if(version===epoch&&[401,403,404,410].includes((error as {status?:number}).status||0))await clear();throw error;}})();
  reading=task;try{return await task;}finally{if(reading===task)reading=null;}
 }
 return{snapshot,clear,read,matchesLink:(link:unknown)=>valid()&&openedLink===trackingLinkToken(link,port.development===true),
  async open(link:unknown,code:unknown){
   const linkToken=trackingLinkToken(link,port.development===true),secret=trackingAccessCode(code);if(!linkToken||!secret)throw Error('Enter the Tracking link and its separate 8-character code.');
   await clear('');const version=++epoch,started=port.now();
   const access=trackingData(await port.request('/api/tracking/access',{body:{linkToken,code:secret}}),trackingSessionAccessSchema);
   const view=guestTrackingView(access.session),end=Math.min(Date.parse(access.expiresAt),started+trackingAccessLifetimeMs);
   if(!/^[A-Za-z0-9._-]{1,4096}$/.test(access.grant)||!Number.isFinite(end)||end<=port.now())throw Error('Tracking access expired. Check your device time and try again.');
   if(version!==epoch||!foreground)return;
   notice='';token=access.grant;openedLink=linkToken;id=view.id;session=view;expiresAt=end;needsRead=false;port.changed();
  },
  expire(){if(token&&!valid())void clear();},
  setForeground(value:boolean){if(foreground===value)return;foreground=value;epoch++;reading=null;needsRead=Boolean(token);port.changed();if(value&&valid()&&id)void read(id).catch(()=>undefined);},
 };
}
