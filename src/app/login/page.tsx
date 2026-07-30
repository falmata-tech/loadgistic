import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, LockKeyhole, LogIn, Mail } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';
import { getCurrentUser } from '@/lib/auth';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string,string | undefined>> }) {
  if (await getCurrentUser()) redirect('/app/home');
  const query = await searchParams;
  return <><PublicHeader/><main className="section"><div className="container auth-shell">
    <section className="form-card">
      <div className="auth-heading"><span className="task-heading-icon"><LogIn aria-hidden="true"/></span><div><h1 className="page-title">Log in</h1><p className="page-subtitle">Open your workspace.</p></div></div>
      <Flash error={query.error} success={query.success}/>
      <form action="/api/auth/login" method="post" className="stack" data-testid="login-form">
        <div className="form-group"><label htmlFor="email"><Mail aria-hidden="true"/>Email</label><input id="email" name="email" type="email" autoComplete="email" required/></div>
        <div className="form-group"><label htmlFor="password"><LockKeyhole aria-hidden="true"/>Password</label><input id="password" name="password" type="password" autoComplete="current-password" required/></div>
        <button className="button" type="submit"><LogIn aria-hidden="true"/>Log in</button>
      </form>
    </section>
    <Link className="auth-back" href="/"><ArrowLeft aria-hidden="true"/>Home</Link>
  </div></main></>;
}
