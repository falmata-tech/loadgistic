import {View} from 'react-native';
import {Copy,Field} from './ui';

type Props={
  filtering?:boolean;
  departure:string;
  arrival:string;
  onDeparture:(value:string)=>void;
  onArrival:(value:string)=>void;
  disabled?:boolean;
};

export function JourneyTimeFields({filtering=false,departure,arrival,onDeparture,onArrival,disabled}:Props){
  return <View style={{gap:8}}>
    <Copy message="Journey times (optional)"/>
    <Field message={filtering?'Depart after':'Journey departure'} value={departure.replace('T',' ')} onChangeText={onDeparture}
      placeholder="YYYY-MM-DD HH:MM" autoCapitalize="none" autoCorrect={false} editable={!disabled} maxLength={16}/>
    <Field message={filtering?'Arrive by':'Journey arrival'} value={arrival.replace('T',' ')} onChangeText={onArrival}
      placeholder="YYYY-MM-DD HH:MM" autoCapitalize="none" autoCorrect={false} editable={!disabled} maxLength={16}/>
    <Copy message="Times are in Ethiopia (EAT)."/>
  </View>;
}
