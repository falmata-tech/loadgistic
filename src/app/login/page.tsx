import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';
import { getCurrentUser } from '@/lib/auth';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string,string | undefined>> }) {
  if (await getCurrentUser()) redirect('/app/home');
  const query = await searchParams;
  return <><PublicHeader /><main className="section"><div className="container" style={{maxWidth:620}}>
    <section className="form-card"><h1 className="page-title">Log in to Loadgistic</h1><p className="page-subtitle">Use a direct business or provider account.</p><div style={{height:18}}/><Flash error={query.error} success={query.success}/><form action="/api/auth/login" method="post" className="stack" data-testid="login-form">
      <div className="form-group"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="form-group"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <button className="button" type="submit">Log in</button>
    </form></section>
  <p style={{marginTop:20}}><Link href="/">← Back to homepage</Link></p></div></main></>;
}
