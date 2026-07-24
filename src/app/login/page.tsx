import Link from 'next/link';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';
import { listDemoUsers } from '@/lib/repository.js';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string,string | undefined>> }) {
  const query = await searchParams;
  const demos = listDemoUsers();
  return <><PublicHeader /><main className="section"><div className="container" style={{maxWidth:920}}><div className="split">
    <section className="form-card"><h1 className="page-title">Log in to Loadgistic</h1><p className="page-subtitle">Use a direct business or provider account.</p><div style={{height:18}}/><Flash error={query.error} success={query.success}/><form action="/api/auth/login" method="post" className="stack" data-testid="login-form">
      <div className="form-group"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required defaultValue="shipper@loadgistic.local" /></div>
      <div className="form-group"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required defaultValue="Loadgistic123!" /></div>
      <button className="button" type="submit">Log in</button>
    </form><p className="meta" style={{marginTop:16}}>Local demo password: <strong>Loadgistic123!</strong></p></section>
    <section className="card"><h2 style={{fontSize:'1.5rem'}}>Demo workspaces</h2><div className="stack">{demos.map((demo:any)=><div key={demo.email} className="card" style={{padding:14}}><strong>{demo.name}</strong><div className="meta">{demo.role}</div><code>{demo.email}</code></div>)}</div><p className="meta">These accounts are local seed data. Replace the local auth adapter with Supabase Auth for cloud deployment.</p></section>
  </div><p style={{marginTop:20}}><Link href="/">← Back to homepage</Link></p></div></main></>;
}
