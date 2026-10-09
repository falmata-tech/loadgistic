import { Modal, ScrollView, View } from 'react-native';
import { Button, Copy, Title, palette } from './ui';
import { ExternalButton } from './public-details';
import { AppIcon } from './app-icon';
import {useLanguage} from '../localization/provider';

export function LocationDisclosure({ visible, decide,informational=false }: { visible: boolean; decide: (accepted: boolean) => void;informational?:boolean }) {
 const {t}=useLanguage();
 return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => decide(false)}>
  <View style={{ flex: 1, backgroundColor: 'rgba(23,44,70,0.35)', justifyContent: 'center', padding: 20 }}>
   <ScrollView accessibilityViewIsModal contentContainerStyle={{ padding: 20, gap: 14 }} style={{ width: '100%', maxWidth: 480, maxHeight: '90%', flexGrow:0, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20 }}>
    <AppIcon name="location" size={28} color={palette.teal}/>
    <Title message="Location during your shipment"/>
    <Copy message="Loadgistic collects your phone's location to update your active shipment, even when the app is closed or not in use."/>
    <Copy message="Only an approximate location, within your chosen radius of up to 20 km, is sent to Loadgistic and shared with authorized shipment parties. Your exact coordinates stay on your phone."/>
    <Copy message="Updates stop when unloading is approved or shipment tracking ends. You can deny or revoke location permission in your phone settings. Other app features remain available."/>
    <ExternalButton label={t('Privacy')} url="https://loadgistic.com/privacy"/>
    {informational?<Button message="Close" onPress={()=>decide(false)}/>:<><Button message="Agree and continue" onPress={() => decide(true)}/><Button secondary message="Not now" onPress={() => decide(false)}/></>}
   </ScrollView>
  </View>
 </Modal>;
}
