import { Link } from 'expo-router';
import type { ComponentProps } from 'react';
import { useLanguage } from '../localization/provider';
// Fixed navigation copy only. User names and other record links still use Link.
export function AppLink({message,...props}:Omit<ComponentProps<typeof Link>,'children'>&{message:string}) {
 const {t}=useLanguage();return <Link {...props}>{t(message)}</Link>;
}
