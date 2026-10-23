import {useEffect,useRef,useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {useLanguage} from '../localization/provider';
import {blockChatReading} from '../session/chat-visibility';
import {Button,Copy,Title,palette} from './ui';

type Props=({message:string;label?:never}|{label:string;message?:never})&{
 title:string;detail:string;cancel:string;confirm:string;busy?:boolean;disabled?:boolean;
 onConfirm:()=>void;
};

// React Native Web's Alert.alert is a no-op. Use the same explicit decision on
// every platform; dismissing the overlay never invokes the protected command.
export function ConfirmationButton({message,label,title,detail,cancel,confirm,busy=false,disabled=false,onConfirm}:Props){
 const {t}=useLanguage(),[open,setOpen]=useState(false),overlay=useRef({});
 useEffect(()=>{const source=overlay.current;blockChatReading(source,open);return()=>blockChatReading(source,false);},[open]);
 const dismiss=()=>{if(!busy)setOpen(false);};
 return <>
  <Button secondary label={message===undefined?label:t(message)} busy={busy} disabled={disabled||open} onPress={()=>setOpen(true)}/>
  <Modal visible={open} transparent animationType="fade" onRequestClose={dismiss}>
   <View style={styles.backdrop}>
    <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={dismiss}/>
    <View testID="action-confirmation" accessibilityViewIsModal style={styles.dialog}>
     <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Title>{t(title)}</Title><Copy>{t(detail)}</Copy>
      <View style={styles.actions}>
       <Button secondary label={t(cancel)} disabled={busy} onPress={dismiss}/>
       <Button label={t(confirm)} busy={busy} disabled={disabled} onPress={()=>{if(busy||disabled)return;setOpen(false);onConfirm();}}/>
      </View>
     </ScrollView>
    </View>
   </View>
  </Modal>
 </>;
}
const styles=StyleSheet.create({
 backdrop:{flex:1,backgroundColor:'rgba(23,44,70,.25)',justifyContent:'center',alignItems:'center',padding:20},
 dialog:{width:'100%',maxWidth:440,maxHeight:'85%',borderWidth:1,borderColor:palette.border,borderRadius:16,backgroundColor:'#fff',overflow:'hidden'},
 content:{padding:20,gap:16},actions:{gap:10},
});
