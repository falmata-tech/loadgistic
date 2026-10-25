import {sendManagedEmail} from '../email-provider.js';
import {businessId,BusinessWorkspaceError} from './domain.js';
import type {BusinessInvitationDelivery,BusinessWorkspacePort} from './contracts';
export interface BusinessInvitationEmailPort {send(message:{to:string;subject:string;text:string;html:string},idempotencyKey:string):Promise<unknown>}
function escape(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));}
export async function deliverBusinessInvitation(port:BusinessWorkspacePort,actorId:string,workspaceId:string,invitationId:string,
 sender:BusinessInvitationEmailPort={send:sendManagedEmail},appUrl=process.env.APP_URL):Promise<BusinessInvitationDelivery>{
 const actor=businessId(actorId),workspace=businessId(workspaceId),invitation=businessId(invitationId);
 const claimed=await port.claimInvitationEmail(actor,workspace,invitation);
 if(!claimed)return 'PENDING';
 let sent=false;
 try{
  const origin=new URL(appUrl||'');
  if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password)throw new Error('INVALID_APP_ORIGIN');
  const link=new URL('/workspaces',origin.origin).toString();
  const subject='You’re invited to a business on Loadgistic';
  const intro=`${claimed.businessName} invited you to join their team on Loadgistic.`;
  const guidance='Sign in with this email to review and accept your invitation. It expires in seven days. Ignore this email if you were not expecting it.';
  await sender.send({to:claimed.email,subject,text:[intro,guidance,link].join('\n\n'),html:`<!doctype html><html><body style="margin:0;background:#f3f5f7;font-family:Arial,sans-serif;line-height:1.5;color:#0b1d3a"><div style="max-width:560px;margin:24px auto;padding:24px;border:1px solid #d7dfeb;border-radius:14px;background:#fff"><img src="https://loadgistic.com/brand/loadgistic-wordmark-on-white.png" alt="Loadgistic" width="174" height="45" style="display:block;max-width:100%;height:auto;margin:0 0 20px"/><h1 style="margin:0 0 16px;font-size:24px">Join your team</h1><p>${escape(intro)}</p><p>${escape(guidance)}</p><p><a href="${escape(link)}" style="color:#155eef;font-weight:700">View invitation</a></p></div></body></html>`},`loadgistic/business-invitation/${claimed.id}/${claimed.lease}`);
  sent=true;
 }catch{/* A durable invitation remains available; no private provider failure is returned. */}
 if(!await port.recordInvitationEmail(actor,workspace,invitation,claimed.lease,sent))throw new BusinessWorkspaceError('BUSINESS_UNAVAILABLE');
 return sent?'SENT':'FAILED';
}
