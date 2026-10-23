import {parseVisitorSession} from '../mobile/visitor-policy.js';
export function parseReviewVisitor(payload,scope,now=Date.now()){
 const match=String(payload?.sub||'').match(/^mobile-review-visitor:(tracking|capacity):([a-f0-9-]{36}):(\d+)$/);
 if(!match||match[1]!==scope)return null;
 const session=parseVisitorSession({...payload,sub:`mobile-visitor:${scope}:${'0'.repeat(64)}:${match[3]}`},scope,now);
 return session?{...session,reviewActorId:match[2]}:null;
}
