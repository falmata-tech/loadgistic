import {StyleSheet,Text,View} from 'react-native';
import {useLanguage} from '../localization/provider';
import {palette} from './ui';

export function CapacityCoverageIndicators({planned,preferred}:{planned:string|null;preferred:string|null}) {
  const {t}=useLanguage();
  const labels=[planned,preferred].filter((label):label is string=>label!==null);
  if(!labels.length)return null;
  return <View style={styles.group}>
    {labels.map(label=><View key={label} style={styles.item}>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.check}>✓</Text>
      <Text style={styles.label}>{t(label)}</Text>
    </View>)}
  </View>;
}
const styles=StyleSheet.create({
  group:{flexDirection:'row',flexWrap:'wrap',gap:6},
  item:{flexDirection:'row',alignItems:'center',gap:4,maxWidth:'100%',paddingHorizontal:7,paddingVertical:3,borderRadius:6,backgroundColor:palette.blueSoft},
  check:{color:palette.blue,fontSize:12,fontWeight:'700'},
  label:{flexShrink:1,color:palette.ink,fontSize:12,fontWeight:'600'}
});
