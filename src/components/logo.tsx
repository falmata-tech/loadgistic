import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Loadgistic home">
      <span className="logo-mark" aria-hidden="true"><img src="/icon.svg" alt="" width="40" height="40"/></span>
      <span className="logo-wordmark"><strong>Loadgistic</strong></span>
    </Link>
  );
}
