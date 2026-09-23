
import {Localized} from '@/components/localization';
import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Localized as="link" copy={["aria-label"]} href={href} className="logo" aria-label="Loadgistic home">
      <Localized as="img" copy={["alt"]} className="logo-lockup" src="/brand/loadgistic-wordmark.png" alt="" width="190" height="49" aria-hidden="true"/>
      <Localized as="img" copy={["alt"]} className="logo-icon-only" src="/icon.svg" alt="" width="42" height="42" aria-hidden="true"/>
    </Localized>
  );
}
