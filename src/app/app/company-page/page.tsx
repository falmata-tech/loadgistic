import {requireUser} from '@/lib/auth';
import {ProviderProfileWorkspace} from '@/components/provider-profile-workspace';
export default async function ProviderPageEditor({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['TRANSPORTER','DRIVER']);
 return <ProviderProfileWorkspace user={user} query={await searchParams}/>;
}
