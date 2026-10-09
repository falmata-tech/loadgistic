import {View,Text} from 'react-native';
import {AppIcon} from './app-icon';
import {useLanguage} from '../localization/provider';
import type {ChatReadState} from '../../../../src/lib/chat-alert-contract';
export function ChatMessageReceipt({state,sequence}:{state:ChatReadState|null;sequence:number}){
 const {t}=useLanguage(),seen=state&&sequence>0&&sequence<=(state.ownSide==='CUSTOMER'?state.teamSeen:state.customerSeen);
 return <View style={{flexDirection:'row',gap:4,alignItems:'center'}}><AppIcon name={seen?'seen':'check'} size={14} color={seen?'#0c7275':'#526875'}/><Text style={{fontSize:12,color:seen?'#0c7275':'#526875'}}>{t(seen?'Seen':'Sent')}</Text></View>;
}
