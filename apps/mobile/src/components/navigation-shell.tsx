import {useContext,useEffect,useRef,useState,type PropsWithChildren} from 'react';
import {Image,Keyboard,Modal,Pressable,ScrollView,StyleSheet,Text,View,type ImageStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router,usePathname,type Href} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import {languages} from '../localization/controller';
import {aboutDestination,activeDestination,hasWorkspace,isWorkspace,phoneDestinations,publicDestinations,workspaceDestinations,type Destination} from '../navigation/destinations';
import {AppIcon,type IconName} from './app-icon';
import {Button,ErrorText,palette} from './ui';
import {ExternalButton} from './public-details';
import {ChatUpdatesButton,useChatUpdates} from '../session/chat-alert-provider';
import {blockChatReading} from '../session/chat-visibility';
import {BackgroundNoticeLayout} from './background-notice-layout';
import {navigationHeaderEdges} from '../location/background-notice';

export function NavigationShell({children}:PropsWithChildren){
 const account=useAccount(),language=useLanguage(),{t}=language,path=usePathname();
 const updates=useChatUpdates();
 const noticeAbove=useContext(BackgroundNoticeLayout);
 const [menuState,setMenuState]=useState<{kind:'all'|'language';actorId:string|null}|null>(null),[keyboard,setKeyboard]=useState(false),[signingOut,setSigningOut]=useState(false),[error,setError]=useState('');
 const menu=menuState?.actorId===(account.session?.user.id||null)?menuState?.kind:null;
 const setMenu=(kind:'all'|'language'|null)=>setMenuState(kind?{kind,actorId:account.session?.user.id||null}:null);
 const overlay=useRef({});useEffect(()=>{const source=overlay.current;blockChatReading(source,menu!==null);return()=>blockChatReading(source,false);},[menu]);
 const workspace=isWorkspace(path,account.session)||['/account','/workspaces'].includes(path),active=activeDestination(path,workspace,account.session);
 const member=hasWorkspace(account.session),signedIn=Boolean(account.session),privateDestinations=member?workspaceDestinations(account.session):[];
 const providerMember=member&&['TRANSPORTER','DRIVER'].includes(account.session?.user.role||'');
 const homeHref=providerMember?'/account':'/';
 const accountHref=account.session?.user.role==='CUSTOMER'?'/business-account':'/account-settings';
 const destinations=phoneDestinations(account.session);
 const bottomPaths=new Set(destinations.map(item=>item.href));
 const workItems=privateDestinations.filter(item=>!['Support','Account'].includes(item.label)&&!bottomPaths.has(item.href));
 const publicItems=publicDestinations.filter(item=>!providerMember&&(!bottomPaths.has(item.href)));
 const utilityItems=privateDestinations.filter(item=>['Support','Account'].includes(item.label)&&!bottomPaths.has(item.href));
 const primary=destinations.some(item=>item.href===path);
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)),hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false));return()=>{show.remove();hide.remove();};},[]);
 function open(kind:'all'|'language'){Keyboard.dismiss();setError('');setMenu(kind);}
 function navigate(href:string){if(href==='#menu'){open('all');return;}setMenu(null);Keyboard.dismiss();if(path!==href)router.navigate(href as Href);}
 async function signOut(){if(signingOut)return;setSigningOut(true);setError('');try{await account.signOut();setMenu(null);router.replace('/');}catch{setError(t('Sign-out could not finish. Please try again.'));}finally{setSigningOut(false);}}
 return <View style={styles.root}><StatusBar style="dark"/>
  <SafeAreaView edges={navigationHeaderEdges(noticeAbove)} style={styles.headerSafe}><View style={styles.header}>
   {!primary&&<IconButton icon="back" label={t('Back')} onPress={()=>router.canGoBack()?router.back():navigate(homeHref)} />}
   <Pressable accessibilityRole="button" accessibilityLabel={t(providerMember?'Home':'Capacity')} onPress={()=>navigate(homeHref)} style={styles.brand}><Image source={require('../../assets/loadgistic-wordmark-on-white.png')} style={styles.wordmarkLogo as ImageStyle}/></Pressable>
   {member&&<ChatUpdatesButton/>}
   <IconButton icon="language" label={t('Language')} onPress={()=>open('language')}/>
   {signedIn?<IconButton icon="user" label={t('Account')} onPress={()=>navigate(accountHref)}/>:<Pressable accessibilityRole="button" accessibilityLabel={t('Sign in')} onPress={()=>navigate('/account')} style={styles.signIn}><Text style={styles.signInText}>{t('Sign in')}</Text></Pressable>}
  </View></SafeAreaView>
  <View style={styles.content}>{children}</View>
  {!keyboard&&<SafeAreaView edges={['bottom','left','right']} style={styles.bottomSafe}><View style={styles.tabs} accessibilityRole="tablist">{destinations.map(item=><Pressable key={item.href} accessibilityRole="tab" accessibilityLabel={t(item.label)} aria-selected={active===item.href} accessibilityState={{selected:active===item.href}} onPress={()=>navigate(item.href)} style={[styles.tab,active===item.href&&styles.active]}><AppIcon name={item.icon} size={22} color={active===item.href?'#fff':palette.muted}/><Text style={[styles.tabText,active===item.href&&styles.activeText]}>{t(item.label)}</Text></Pressable>)}</View></SafeAreaView>}
  <Modal visible={menu!==null} transparent animationType="fade" onRequestClose={()=>setMenu(null)}><View style={styles.modal}>
   <Pressable style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no" onPress={()=>setMenu(null)}/>
   <SafeAreaView style={styles.sheet} edges={['top','bottom','left','right']}><View style={styles.menuHeading}><Text style={styles.heading}>{t(menu==='language'?'Language':'Menu')}</Text><IconButton icon="close" label={t('Close menu')} onPress={()=>setMenu(null)}/></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.menuContent}>
     {menu==='all'?<>
      {!member&&<MenuItem item={{href:'/account',label:account.session?'Finish account setup':'Sign in',icon:'user'}} active={path==='/account'} onPress={()=>navigate('/account')}/>}
      {workItems.map(item=><MenuItem key={item.href} item={item} active={path===item.href} onPress={()=>navigate(item.href)}/>)}
      {workItems.length?<View style={styles.divider} accessible={false}/>:null}
      {publicItems.map(item=><MenuItem key={item.href} item={item} active={path===item.href} onPress={()=>navigate(item.href)}/>)}
      {utilityItems.length?<View style={styles.divider} accessible={false}/>:null}
      {utilityItems.map(item=><MenuItem key={item.href} item={item} active={path===item.href} onPress={()=>navigate(item.href)}/>)}
      <Pressable accessibilityRole="button" onPress={()=>{setMenu(null);updates.open();}} style={styles.row}><AppIcon name="bell"/><Text style={styles.rowText}>{t('Chat updates')}{updates.unreadCount>0?` · ${updates.unreadCount}`:''}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={()=>open('language')} style={styles.row}><AppIcon name="language"/><Text style={styles.rowText}>{t('Language')}</Text><AppIcon name="next" size={18}/></Pressable>
      <View style={styles.divider} accessible={false}/>
      <MenuItem item={aboutDestination} active={path===aboutDestination.href} onPress={()=>navigate(aboutDestination.href)}/>
      <View style={styles.legal}><Button secondary message="Privacy" onPress={()=>navigate('/privacy')}/><ExternalButton label={t('Terms')} url="https://loadgistic.com/terms" failureMessage="Could not open Terms. Please try again."/></View>
      {account.session&&<><ErrorText message={error}/><Pressable accessibilityRole="button" accessibilityState={{disabled:signingOut,busy:signingOut}} disabled={signingOut} onPress={()=>{void signOut();}} style={styles.row}><AppIcon name="logout"/><Text style={styles.rowText}>{t('Sign out')}</Text></Pressable></>}
     </>:<><ErrorText message={language.error}/>{languages.map(item=><Pressable key={item.code} accessibilityRole="radio" aria-checked={item.code===language.locale} accessibilityState={{checked:item.code===language.locale,disabled:language.busy}} disabled={language.busy} onPress={()=>{void language.select(item.code);}} style={[styles.row,item.code===language.locale&&styles.active]}><AppIcon name="language" color={item.code===language.locale?'#fff':palette.muted}/><Text style={[styles.rowText,item.code===language.locale&&styles.activeText]}>{item.name}</Text>{item.code===language.locale&&<AppIcon name="check" color="#fff"/>}</Pressable>)}</>}
    </ScrollView>
   </SafeAreaView>
  </View></Modal>
 </View>;
}
function IconButton({icon,label,onPress}:{icon:IconName;label:string;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}><AppIcon name={icon} color={palette.blue}/></Pressable>;}
function MenuItem({item,active,onPress}:{item:Destination;active:boolean;onPress:()=>void}){const {t}=useLanguage();return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={[styles.row,active&&styles.active]}><AppIcon name={item.icon} color={active?'#fff':palette.muted}/><Text style={[styles.rowText,active&&styles.activeText]}>{t(item.label)}</Text><AppIcon name="next" size={18} color={active?'#fff':palette.muted}/></Pressable>;}
const styles=StyleSheet.create({
 workspaceIdentity:{flex:1,minWidth:0,paddingHorizontal:8,minHeight:48,flexDirection:'row',alignItems:'center',gap:2},workspaceTitle:{fontSize:15,fontWeight:'700',color:palette.ink},roleLabel:{fontSize:11,color:palette.muted},areas:{flexDirection:'row',gap:5,paddingHorizontal:10,paddingBottom:8},area:{flex:1,minHeight:44,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'transparent',borderRadius:10,padding:6},areaText:{flexShrink:1,fontSize:13,fontWeight:'600',color:palette.muted,textAlign:'center'},
 root:{flex:1,backgroundColor:'#fff'},content:{flex:1},headerSafe:{backgroundColor:'#fff',borderBottomWidth:1,borderColor:'#cbd5e1'},header:{minHeight:60,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:2},brand:{flexGrow:1,flexShrink:1,flexBasis:0,minHeight:48,flexDirection:'row',gap:8,alignItems:'center'},logo:{width:34,height:34},wordmarkLogo:{width:138,height:36,resizeMode:'contain'},iconButton:{minWidth:46,minHeight:48,justifyContent:'center',alignItems:'center'},signIn:{minHeight:44,paddingHorizontal:12,justifyContent:'center',borderWidth:1,borderColor:palette.blue,borderRadius:9},signInText:{color:palette.blue,fontSize:13,fontWeight:'800'},
 accountAction:{maxWidth:125,minHeight:46,borderWidth:1,borderColor:palette.border,borderRadius:10,paddingHorizontal:8,paddingVertical:5,flexDirection:'row',gap:6,alignItems:'center'},accountText:{fontSize:12,fontWeight:'700',color:palette.ink,flexShrink:1,textAlign:'center'},
 bottomSafe:{backgroundColor:'#fff',borderTopWidth:1,borderColor:'#cbd5e1'},tabs:{flexDirection:'row',gap:3,padding:5},tab:{flex:1,minHeight:54,paddingVertical:6,paddingHorizontal:2,gap:3,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'transparent',borderRadius:10},tabText:{fontSize:11,fontWeight:'600',color:'#526375',textAlign:'center'},active:{backgroundColor:'#155eef',borderColor:'#155eef'},activeText:{color:'#fff',fontWeight:'800'},
 modal:{flex:1,backgroundColor:'rgba(23,44,70,.16)',alignItems:'flex-end'},sheet:{width:'91%',maxWidth:390,flexGrow:1,flexShrink:1,flexBasis:0,backgroundColor:'#fff'},menuHeading:{flexShrink:0,minHeight:62,flexDirection:'row',paddingHorizontal:18,alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:palette.border},heading:{fontSize:22,fontWeight:'700',color:palette.ink},menuContent:{padding:14,gap:4,paddingBottom:24},workspaceName:{fontSize:19,fontWeight:'700',color:palette.ink,padding:10},section:{fontSize:13,fontWeight:'700',color:palette.muted,marginTop:14,marginBottom:6,paddingHorizontal:10},row:{minHeight:52,borderRadius:10,borderWidth:1,borderColor:'transparent',padding:12,flexDirection:'row',alignItems:'center',gap:12},rowText:{fontSize:16,color:palette.ink,flex:1},legal:{gap:8,marginVertical:14},
 divider:{height:1,backgroundColor:palette.border,marginHorizontal:12,marginVertical:8},
});
