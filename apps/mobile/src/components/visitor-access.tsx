import { useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { apiRequest } from '../api/http';
import { useVisitor } from '../session/visitor-provider';
import type { VisitorScope } from '../session/visitor-controller';
import { Button, Card, Copy, ErrorText, Field, Title } from './ui';
export function VisitorAccess({ scope, children }: PropsWithChildren<{ scope: VisitorScope }>) {
 const visitor = useVisitor(), [error, setError] = useState('');
 if (!visitor.ready) return <ActivityIndicator accessibilityLabel="Checking saved email access" />;
 if (!visitor.snapshot.foreground) return <Copy message={"Private access is paused while the app is in the background."}/>;
 if (!visitor.snapshot[scope]) return <VisitorLogin key={scope} scope={scope} />;
 return <View style={{ flex: 1, gap: 12 }} onTouchStart={() => { void visitor.controller.touch(scope).catch(error => setError(error instanceof Error ? error.message : 'Could not renew email access.')); }}>
  <ErrorText message={error || visitor.errors[scope] || visitor.error} /><Button secondary message="Close private access" onPress={() => { void visitor.controller.clear(scope).catch(() => setError('Could not clear saved access on this phone. Please try again.')); }} />{children}
 </View>;
}
function VisitorLogin({ scope }: { scope: VisitorScope }) {
 const visitor = useVisitor(), [email, setEmail] = useState(''), [code, setCode] = useState(''), [handoff, setHandoff] = useState('');
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
 const lock = useRef(false);
 async function submit() {
  if (lock.current) return; lock.current = true; setBusy(true); setError('');
  try {
   if (handoff) await visitor.controller.verify(scope, handoff, code);
   else { const response = await apiRequest(`/api/mobile/visitor/${scope}/request`, { body: { email: email.trim() } }) as { handoff: string; message: string; verificationRequired: boolean }; setMessage(response.message); if (response.verificationRequired) setHandoff(response.handoff); }
  } catch (error) { setError(error instanceof Error ? error.message : 'Could not verify this email.'); }
  finally { lock.current = false; setBusy(false); }
 }
 return <Card><Title>{scope === 'tracking' ? 'Follow your shipment' : 'Privately shared with you'}</Title><Copy>{scope === 'tracking' ? 'Use the email your transporter added. One code opens your shared shipments.' : 'Enter the email your transporters share capacity with.'}</Copy>
  {handoff ? <Field message="Email verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} /> : <Field message="Your email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} />}
  {!!message && <Copy>{message}</Copy>}<ErrorText message={error || visitor.errors[scope] || visitor.error} /><Button label={handoff ? 'Open private access' : 'Send email code'} busy={busy} onPress={() => { void submit(); }} />
  {!!handoff && <Button secondary message="Use another email or resend" busy={busy} onPress={() => { setHandoff(''); setCode(''); setMessage(''); setError(''); }} />}
  {visitor.errors[scope] && <Button secondary message="Retry clearing saved access" busy={busy} onPress={() => { void visitor.controller.clear(scope).catch(() => undefined); }} />}
  <Copy message={"No transporter account needed. Access stays open while you use it and closes after 30 minutes of inactivity."}/>
 </Card>;
}
