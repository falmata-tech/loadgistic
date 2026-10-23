import {Text,View} from 'react-native';
import {demoTrackingLabel} from '../../../../src/lib/demo-tracking-identity.js';
import {useLanguage} from '../localization/provider';
import {palette} from './ui';

export function TrackingDemoLabel({kind='shipment'}:{kind?:'shipment'|'event'|'proof'|'approval'}) {
  const {t}=useLanguage();
  return <View testID={`tracking-demo-${kind}`} style={{alignSelf:'flex-start',backgroundColor:'#eaf0ff',borderColor:palette.blue,borderWidth:1,borderRadius:8,paddingHorizontal:9,paddingVertical:4,marginVertical:4}}>
    <Text style={{fontSize:12,fontWeight:'700',color:palette.ink}}>{t(demoTrackingLabel(kind))}</Text>
  </View>;
}
