import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Loadgistic home">
      <img className="logo-lockup" src="/brand/loadgistic-wordmark.png" alt="" width="190" height="49" aria-hidden="true"/>
      <img className="logo-icon-only" src="/icon.svg" alt="" width="42" height="42" aria-hidden="true"/>
    </Link>
  );
}
