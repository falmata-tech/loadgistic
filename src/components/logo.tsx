
import {Localized} from '@/components/localization';
import Image from 'next/image';
export function Logo({ href = '/', appearance = 'light' }: { href?: string; appearance?: 'light' | 'on-dark' }) {
  const wordmark=appearance==='on-dark'?'/brand/loadgistic-wordmark-on-dark.png':'/brand/loadgistic-wordmark-on-white.png';
  const className=appearance==='on-dark'?'logo logo-on-dark':'logo';
  return (
    <Localized as="link" copy={["aria-label"]} href={href} className={className} aria-label="Loadgistic home">
      <Image className="logo-lockup" src={wordmark} alt="" width={190} height={49} sizes="(max-width: 620px) 150px, 190px" loading="eager" aria-hidden="true" />
      <img className="logo-icon-only" src="/icon.svg" alt="" width="42" height="42" aria-hidden="true" />
    </Localized>
  );
}
