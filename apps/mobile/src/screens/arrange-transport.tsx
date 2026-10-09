import {removeNativePushScope} from '../session/native-push';
import { useCallback,useEffect,useReducer,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator,AppState,Text,View } from 'react-native';
import * as SecureStore from '../session/storage';
import * as Crypto from 'expo-crypto';
import { createBrokerageController } from '../session/brokerage-controller';
import { apiRequest } from '../api/http';
import { useForegroundRefresh } from '../hooks/foreground-refresh';
import { Page,Title,Copy,Card,Field,Button,ErrorText,palette } from '../components/ui';
import {useLanguage} from '../localization/provider';
import {brokerageStorageKey as key,brokerageAccessChanged} from '../session/brokerage-alert-access';
import {useChatReadReceipts} from '../hooks/chat-read-receipts';
import {ChatMessageReceipt} from '../components/chat-message-receipt';
export default function ArrangeTransport(){
 const {t}=useLanguage();
 const [,render]=useReducer(n=>n+1,0),[controller]=useState(()=>createBrokerageController({now:Date.now,uuid:Crypto.randomUUID,secret:async()=>Array.from(await Crypto.getRandomBytesAsync(32),byte=>byte.toString(16).padStart(2,'0')).join(''),changed:render,request:apiRequest,read:()=>SecureStore.getItemAsync(key),write:async value=>{await SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});brokerageAccessChanged();},remove:async()=>{await removeNativePushScope('GUEST');await SecureStore.deleteItemAsync(key);brokerageAccessChanged();}}));
 const state=controller.snapshot(),chat=state.chat;
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[origin,setOrigin]=useState(''),[destination,setDestination]=useState(''),[body,setBody]=useState(''),[before,setBefore]=useState<number|undefined>(),[confirm,setConfirm]=useState(false);
 useFocusEffect(useCallback(()=>{controller.setVisible(AppState.currentState==='active');if(!controller.snapshot().ready)void controller.restore();else void controller.refresh(before);const subscription=AppState.addEventListener('change',next=>{controller.setVisible(next==='active');if(next==='active')void controller.refresh(before);});return()=>{controller.setVisible(false);subscription.remove();};},[controller,before]));
 const refresh=useCallback(()=>controller.refresh(before),[controller,before]);
 useForegroundRefresh(refresh,Boolean(chat)&&!before&&!state.busy&&!chat?.request.endedAt&&chat?.request.status!=='CLOSED');
 const active=state.saved?.kind==='ACTIVE'?state.saved:null;
 const readRequest=useBrokerageReadRequest(active?.token);
 const receipts=useChatReadReceipts('BROKERAGE:'+(active?.requestId||''),readRequest,!!chat&&!!active,chat?.messages.map(message=>message.sequence)||[]);
 useEffect(()=>{if(receipts.denied)void controller.clear();},[receipts.denied,controller]);
 const pending=state.saved?.kind==='ACTIVE'?state.saved.pending:undefined,ended=Boolean(chat?.request.endedAt||chat?.request.status==='CLOSED'),draft=state.saved?.kind==='DRAFT'?state.saved.intake:null;
 return <Page {...receipts.pageProps}><ErrorText message={state.error}/>{!state.ready&&<ActivityIndicator accessibilityLabel="Opening your conversation"/>}{state.cleanupRequired&&<Button message="Retry clearing chat access" onPress={()=>{void controller.clear();}}/>}
 {state.ready&&state.saved?.kind!=='ACTIVE'&&<><View style={{gap:5}}><Title message="Need help with transport?"/><Text style={{fontSize:13,lineHeight:20,color:palette.teal}}>{t('Let us handle it')} · {t('Live chat')}</Text></View><Copy message="Tell us what you need to move and where. Our team will help find a truck and arrange the trip."/><Card>
 <Field message="From" value={draft?.origin||origin} onChangeText={setOrigin} maxLength={160} editable={!state.busy&&!draft}/><Field message="To" value={draft?.destination||destination} onChangeText={setDestination} maxLength={160} editable={!state.busy&&!draft}/><Field message="Your name" value={draft?.name||name} onChangeText={setName} maxLength={100} editable={!state.busy&&!draft}/><Field message="Phone number" value={draft?.phone||phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} editable={!state.busy&&!draft}/>
 <Copy message="We’ll reply here, or call if you leave the chat."/><Copy message="No account needed. We’ll agree the service and fee with you first."/><Button label={draft?t('Retry starting chat'):t('Start chat')} busy={state.busy} disabled={state.cleanupRequired} onPress={()=>{void controller.start({name,phone,origin,destination});}}/>{!!draft&&<Copy message={"Your request details are saved on this phone. Retrying checks the same request without creating a duplicate."}/>}</Card></>}
 {state.saved?.kind==='ACTIVE'&&<><Button secondary message="Refresh conversation" busy={state.busy} onPress={()=>{void refresh();}}/>{!chat&&!state.error&&<ActivityIndicator accessibilityLabel="Loading conversation"/>}{chat&&<><View onLayout={receipts.presenceLayout}><Copy>{chat.request.origin} → {chat.request.destination}</Copy>{receipts.state?.teamJoined&&<Copy message="Team member joined"/>}</View><Copy>{ended?(chat.request.status==='CLOSED'?t('Request resolved · chat history'):t('Chat ended. Our team can still call you.')):chat.request.assignedName?t('Assigned to {agent}',{agent:chat.request.assignedName}):t('Your request is with our transport team. Leave a message while you wait for someone to join.')}</Copy>
 {chat.hasOlder&&<Button secondary message="Older messages" disabled={state.busy} onPress={()=>{const sequence=chat.messages[0]?.sequence;if(sequence){setBefore(sequence);}}}/>}{before&&<Button secondary message="Latest messages" onPress={()=>{setBefore(undefined);}}/>}
 {chat.messages.map(item=><View key={item.id} onLayout={receipts.messageLayout(item.sequence)} style={{padding:14,gap:6,borderRadius:14,backgroundColor:item.kind==='VISITOR'?'#eaf5f4':'#f2f5f7',marginLeft:item.kind==='VISITOR'?20:0,marginRight:item.kind==='BROKER'?20:0}}><Text style={{fontWeight:'700',color:palette.ink}}>{item.name}</Text><Text selectable style={{color:palette.ink,lineHeight:23}}>{item.body}</Text><Copy>{new Date(item.createdAt).toLocaleString()}</Copy>{item.kind==='VISITOR'&&<ChatMessageReceipt state={receipts.state} sequence={item.sequence}/>}</View>)}
 {!ended&&!before&&<Card><Field message="Message to transport team" value={pending?.body||body} onChangeText={setBody} multiline maxLength={2000} editable={!state.busy&&!pending}/><Button label={pending?t('Retry sending message'):t('Send message')} busy={state.busy} disabled={!pending&&!body.trim()} onPress={()=>{void controller.send(body).then(()=>{if(!controller.snapshot().error)setBody('');});}}/>{pending&&<Copy message={"Delivery is not confirmed yet. Retry this message safely."}/>}
 {!confirm?<Button secondary message="End chat" disabled={state.busy} onPress={()=>setConfirm(true)}/>:<><Copy message={"End messaging? Our team will keep your request and may still call you."}/><Button message="Confirm end chat" busy={state.busy} onPress={()=>{void controller.end().then(()=>setConfirm(false));}}/><Button secondary message="Keep chatting" disabled={state.busy} onPress={()=>setConfirm(false)}/></>}</Card>}
 {ended&&<Button message="Start a new request" busy={state.busy} onPress={()=>{void controller.newChat().then(()=>{setBody('');setBefore(undefined);});}}/>}</>}</>}</Page>;
}

function useBrokerageReadRequest(token:string|undefined){return useCallback((body?:unknown)=>apiRequest('/api/mobile/brokerage/read',{token,body}),[token]);}
