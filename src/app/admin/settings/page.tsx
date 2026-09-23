
import {Text} from '@/components/localization';
import {Settings2} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {getPlatformControls} from '@/lib/platform-controls.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {AccessControlsForm} from '@/components/platform-controls-form';

export default async function PlatformSettingsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN'],{allowLimited:true});
  const [controls,query]=await Promise.all([getPlatformControls(user),searchParams]);
  return <div className="page platform-settings-page"><PageHeader icon={Settings2} title={<Text message="Settings"/>} subtitle={<Text message="Platform access controls."/>}/><Flash error={query.error} success={query.success}/><AccessControlsForm controls={controls}/></div>;
}
