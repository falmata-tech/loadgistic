import { createSessionToken, verifySessionToken } from '@/lib/security.js';
import { MobileError } from './server';
import { parseVisitorSession, visitorBearer, visitorSessionSeconds, visitorSubject } from './visitor-policy.js';
import {parseReviewVisitor} from '../privacy/review-visitor.js';
import {reviewVisitorDigest} from '../privacy/review-access.js';
export type VisitorScope = 'tracking' | 'capacity';
export function visitorScope(value: string): VisitorScope { if (value !== 'tracking' && value !== 'capacity') throw new MobileError(404, 'NOT_FOUND', 'Not found.'); return value; }
export async function requireVisitor(request: Request, scope: VisitorScope) {
 const payload=verifySessionToken(visitorBearer(request.headers.get('authorization')));
 const review=parseReviewVisitor(payload,scope);
 if(review){const digest=await reviewVisitorDigest(review.reviewActorId,scope);if(!digest)throw new MobileError(401,'EMAIL_REQUIRED','This review access is unavailable.');return {...review,digest};}
 const session = parseVisitorSession(payload, scope);
 if (!session) throw new MobileError(401, 'EMAIL_REQUIRED', 'Verify your email to continue.');
 return session;
}
export function issueReviewVisitor(scope:VisitorScope,actorId:string,startedAt=Date.now()){
 const seconds=visitorSessionSeconds(scope,startedAt);
 if(!seconds||! /^[a-f0-9-]{36}$/.test(actorId))throw new MobileError(401,'EMAIL_REQUIRED','This review access is unavailable.');
 const token=createSessionToken(`mobile-review-visitor:${scope}:${actorId}:${startedAt}`,seconds),session=parseReviewVisitor(verifySessionToken(token),scope);
 if(!session)throw Error('REVIEW_SESSION_FAILED');return {token,scope,startedAt,expiresAt:session.expiresAt,issuedAt:Date.now(),reviewActorId:actorId};
}
export function issueVisitor(scope: VisitorScope, digest: string, startedAt = Date.now()) {
 const seconds = visitorSessionSeconds(scope, startedAt);
 if (!seconds) throw new MobileError(401, 'EMAIL_REQUIRED', 'Verify your email to continue.');
 const token = createSessionToken(visitorSubject(scope, digest, startedAt), seconds), session = parseVisitorSession(verifySessionToken(token), scope);
 if (!session) throw new Error('VISITOR_SESSION_FAILED');
 return { token, scope, startedAt, expiresAt: session.expiresAt, issuedAt: Date.now() };
}
