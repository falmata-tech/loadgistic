import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Loadgistic home">
      <span className="logo-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><path className="logo-route" d="M13 45c8-1 9-10 16-11 7-2 9 5 15 1 4-3 4-10 8-15"/><circle cx="13" cy="45" r="4"/><circle cx="52" cy="20" r="4"/><path className="logo-cargo" d="M25 19h20v14H25zM25 24h20M31 19v14"/></svg></span>
      <span>Loadgistic</span>
    </Link>
  );
}
