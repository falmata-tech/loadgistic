import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Loadgistic home">
      <span className="logo-mark">L</span>
      <span>Loadgistic</span>
    </Link>
  );
}
