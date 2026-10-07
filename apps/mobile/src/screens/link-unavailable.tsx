import { router } from 'expo-router';
import { Page,Title,Copy,Button } from '../components/ui';
export default function LinkUnavailable() {
  return <Page><Title message={"This link cannot be opened"}/><Copy message={"Open Loadgistic to find capacity or access your account. Your saved sessions have not changed."}/><Button message="Open Loadgistic" onPress={()=>router.replace('/')}/></Page>;
}
