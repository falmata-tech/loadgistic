import type {TrackingSessionView} from './contracts';
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
export function trackingLinkToken(value:unknown,development=false):string|null{
 if(typeof value!=='string'||value.length>2048)return null;
 const input=value.trim();if(tokenPattern.test(input))return input;
 try{
  const relative=input.startsWith('/')&&!input.startsWith('//'),url=new URL(input,'https://loadgistic.com');
  const canonical=url.protocol==='https:'&&['loadgistic.com','www.loadgistic.com'].includes(url.hostname)&&!url.port;
  const local=development===true&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&['3100','3101','3112','3114','8084'].includes(url.port);
  if(url.username||url.password||url.search||url.hash||!relative&&!canonical&&!local)return null;
  const match=url.pathname.match(/^\/track\/([A-Za-z0-9_-]{43})\/?$/);return match?.[1]||null;
 }catch{return null;}
}
export function trackingAccessCode(value:unknown):string|null{
 if(typeof value!=='string')return null;const code=value.trim().toUpperCase();
 return /^[0-9A-HJKMNP-TV-Z]{4}-?[0-9A-HJKMNP-TV-Z]{4}$/.test(code)?code.replace('-',''):null;
}

export const trackingAccessLifetimeMs=5*60*1000;

export function guestTrackingSession(session:TrackingSessionView,sessionId?:string):TrackingSessionView{
 if(sessionId&&session.id!==sessionId||session.workspaceId!==null||session.links.length||Object.values(session.capabilities).some(Boolean)||session.state==='PENDING_PROVIDER'&&(session.tracking!==null||session.shipmentId!==null)||session.tracking?.events.some(event=>event.hasProof===true)||session.tracking?.review||session.tracking!==null&&session.tracking.shipmentId!==session.shipmentId)throw Error('This Tracking access is unavailable. Open the link and enter its code again.');
 return session;
}
