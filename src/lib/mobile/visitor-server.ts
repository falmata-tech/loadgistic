import { createSessionToken, verifySessionToken } from '@/lib/security.js';
import { MobileError } from './server';
import { parseVisitorSession, visitorBearer, visitorSessionSeconds, visitorSubject } from './visitor-policy.js';
export type VisitorScope = 'tracking' | 'capacity';
export function visitorScope(value: string): VisitorScope { if (value !== 'tracking' && value !== 'capacity') throw new MobileError(404, 'NOT_FOUND', 'Not found.'); return value; }
export function requireVisitor(request: Request, scope: VisitorScope) {
 const session = parseVisitorSession(verifySessionToken(visitorBearer(request.headers.get('authorization'))), scope);
 if (!session) throw new MobileError(401, 'EMAIL_REQUIRED', 'Verify your email to continue.');
 return session;
}
export function issueVisitor(scope: VisitorScope, digest: string, startedAt = Date.now()) {
 const seconds = visitorSessionSeconds(scope, startedAt);
 if (!seconds) throw new MobileError(401, 'EMAIL_REQUIRED', 'Verify your email to continue.');
 const token = createSessionToken(visitorSubject(scope, digest, startedAt), seconds), session = parseVisitorSession(verifySessionToken(token), scope);
 if (!session) throw new Error('VISITOR_SESSION_FAILED');
 return { token, scope, startedAt, expiresAt: session.expiresAt, issuedAt: Date.now() };
}
