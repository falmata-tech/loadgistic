import {useEffect,useRef,useState,type PropsWithChildren} from 'react';
import {Image,Keyboard,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router,useNavigation,usePathname,type Href} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import {languages} from '../localization/controller';
import {activeDestination,hasWorkspace,isWorkspace,publicDestinations,workspaceDestinations,workspaceRoleLabel,type Destination} from '../navigation/destinations';
import {AppIcon,type IconName} from './app-icon';
import {ErrorText,palette} from './ui';
import {ExternalButton} from './public-details';
import {ChatUpdatesButton,useChatUpdates} from '../session/chat-alert-provider';
import {blockChatReading} from '../session/chat-visibility';

export function NavigationShell({children}:PropsWithChildren){
 const account=useAccount(),language=useLanguage(),{t}=language,path=usePathname();
 const updates=useChatUpdates();
 const [menu,setMenu]=useState<'all'|'language'|null>(null),[keyboard,setKeyboard]=useState(false),[signingOut,setSigningOut]=useState(false),[error,setError]=useState('');
 const overlay=useRef({});useEffect(()=>{const source=overlay.current;blockChatReading(source,menu!==null);return()=>blockChatReading(source,false);},[menu]);
 const areas=useNavigation<{navigate:(name:'(marketplace)'|'(workspace)')=>void}>('/');
 function switchArea(next:'(marketplace)'|'(workspace)'){setMenu(null);Keyboard.dismiss();areas.navigate(next);}
 const workspace=isWorkspace(path,account.session),active=activeDestination(path,workspace,account.session);
 const destinations=workspace?workspaceDestinations(account.session):publicDestinations;
 const primary=destinations.some(item=>item.href===path),member=hasWorkspace(account.session);
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)),hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false));return()=>{show.remove();hide.remove();};},[]);
 function open(kind:'all'|'language'){Keyboard.dismiss();setError('');setMenu(kind);}
 function navigate(href:string){if(href==='#menu'){open('all');return;}setMenu(null);Keyboard.dismiss();if(path!==href)router.navigate(href as Href);}
 async function signOut(){if(signingOut)return;setSigningOut(true);setError('');try{await account.signOut();setMenu(null);router.replace('/account');}catch{setError(t('Sign-out could not finish. Please try again.'));}finally{setSigningOut(false);}}
 return <View style={styles.root}><StatusBar style="dark"/>
  <SafeAreaView edges={['top','left','right']} style={styles.headerSafe}><View style={styles.header}>
   {!primary&&<IconButton icon="back" label={t('Back')} onPress={()=>router.canGoBack()?router.back():navigate(workspace?'/account':'/')}/>}
   <Pressable accessibilityRole="button" accessibilityLabel={t(workspace?'Dashboard':'Capacity')} onPress={()=>navigate(workspace?'/account':'/')} style={[styles.brand,member&&{flexGrow:0,flexShrink:0,flexBasis:36,width:36,minWidth:36}]}><Image source={require('../../assets/loadgistic-icon.png')} style={styles.logo}/></Pressable>
   {member&&<View style={styles.workspaceIdentity}><Text numberOfLines={1} style={styles.workspaceTitle}>{workspace?(account.session!.user.organizationName||account.session!.user.businessName||account.session!.user.name):t('Loadgistic')}</Text>{workspace&&<Text numberOfLines={1} style={styles.roleLabel}>{t(workspaceRoleLabel(account.session))}</Text>}</View>}
   {member&&<ChatUpdatesButton/>}
   <IconButton icon="language" label={t('Language')} onPress={()=>open('language')}/>
   {!member&&<Pressable accessibilityRole="button" onPress={()=>navigate('/account')} style={styles.accountAction}><AppIcon name={member?'home':'truck'} size={18} color={palette.teal}/><Text style={styles.accountText}>{t(member?'Dashboard':'Transporter login')}</Text></Pressable>}
   <IconButton icon="menu" label={t('Open menu')} onPress={()=>open('all')}/>
  </View>{member&&<View accessibilityRole="tablist" accessibilityLabel={t('Switch view')} style={styles.areas}>
   {([{name:'(marketplace)',label:'Marketplace',icon:'map',selected:!workspace},{name:'(workspace)',label:'My workspace',icon:'truck',selected:workspace}] as const).map(area=><Pressable key={area.name} accessibilityRole="tab" accessibilityLabel={t(area.label)} accessibilityState={{selected:area.selected}} onPress={()=>{if(!area.selected)switchArea(area.name);}} style={[styles.area,area.selected&&styles.active]}><AppIcon name={area.icon} size={18} color={area.selected?palette.teal:palette.muted}/><Text style={[styles.areaText,area.selected&&styles.activeText]}>{t(area.label)}</Text></Pressable>)}
  </View>}</SafeAreaView>
  <View style={styles.content}>{children}</View>
  {!keyboard&&<SafeAreaView edges={['bottom','left','right']} style={styles.bottomSafe}><View style={styles.tabs} accessibilityRole="tablist">{destinations.map(item=><Pressable key={item.href} accessibilityRole="tab" accessibilityLabel={t(item.label)} accessibilityState={{selected:active===item.href}} onPress={()=>navigate(item.href)} style={[styles.tab,active===item.href&&styles.active]}><AppIcon name={item.icon} size={22} color={active===item.href?'#0b5f62':'#5d6c77'}/><Text style={[styles.tabText,active===item.href&&styles.activeText]}>{t(item.label)}</Text></Pressable>)}</View></SafeAreaView>}
  <Modal visible={menu!==null} transparent animationType="fade" onRequestClose={()=>setMenu(null)}><View style={styles.modal}>
   <Pressable style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no" onPress={()=>setMenu(null)}/>
   <SafeAreaView style={styles.sheet} edges={['top','bottom','left','right']}><View style={styles.menuHeading}><Text style={styles.heading}>{t(menu==='language'?'Language':'Menu')}</Text><IconButton icon="close" label={t('Close menu')} onPress={()=>setMenu(null)}/></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.menuContent}>
     {menu==='all'?<>
      {member&&<Text style={styles.workspaceName}>{account.session!.user.organizationName||account.session!.user.businessName||account.session!.user.name}</Text>}
      {!member&&<MenuItem item={{href:'/account',label:account.session?'Finish account setup':'Transporter login',icon:'truck'}} active={path==='/account'} onPress={()=>navigate('/account')}/>}
      <MenuItem item={{href:'/arrange-transport',label:'Arrange transport',icon:'truck'}} active={path==='/arrange-transport'} onPress={()=>navigate('/arrange-transport')}/>
      <Pressable accessibilityRole="button" onPress={()=>{setMenu(null);updates.open();}} style={styles.row}><AppIcon name="bell"/><Text style={styles.rowText}>{t('Chat updates')}{updates.unreadCount>0?` · ${updates.unreadCount}`:''}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={()=>open('language')} style={styles.row}><AppIcon name="language"/><Text style={styles.rowText}>{t('Language')}</Text><AppIcon name="next" size={18}/></Pressable>
      <View style={styles.legal}><ExternalButton label={t('Privacy')} url="https://loadgistic.com/privacy"/><ExternalButton label={t('Terms')} url="https://loadgistic.com/terms"/></View>
      {account.session&&<><ErrorText message={error}/><Pressable accessibilityRole="button" accessibilityState={{disabled:signingOut,busy:signingOut}} disabled={signingOut} onPress={()=>{void signOut();}} style={styles.row}><AppIcon name="logout"/><Text style={styles.rowText}>{t('Sign out')}</Text></Pressable></>}
     </>:<><ErrorText message={language.error}/>{languages.map(item=><Pressable key={item.code} accessibilityRole="radio" aria-checked={item.code===language.locale} accessibilityState={{checked:item.code===language.locale,disabled:language.busy}} disabled={language.busy} onPress={()=>{void language.select(item.code);}} style={[styles.row,item.code===language.locale&&styles.active]}><AppIcon name="language"/><Text style={styles.rowText}>{item.name}</Text>{item.code===language.locale&&<AppIcon name="check" color={palette.teal}/>}</Pressable>)}</>}
    </ScrollView>
   </SafeAreaView>
  </View></Modal>
 </View>;
}
function IconButton({icon,label,onPress}:{icon:IconName;label:string;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}><AppIcon name={icon} color={palette.teal}/></Pressable>;}
function MenuItem({item,active,onPress}:{item:Destination;active:boolean;onPress:()=>void}){const {t}=useLanguage();return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={[styles.row,active&&styles.active]}><AppIcon name={item.icon} color={active?palette.teal:palette.muted}/><Text style={[styles.rowText,active&&styles.activeText]}>{t(item.label)}</Text><AppIcon name="next" size={18}/></Pressable>;}
const styles=StyleSheet.create({
 workspaceIdentity:{flex:1,minWidth:0,paddingHorizontal:8,gap:2},workspaceTitle:{fontSize:15,fontWeight:'700',color:palette.ink},roleLabel:{fontSize:11,color:palette.muted},areas:{flexDirection:'row',gap:5,paddingHorizontal:10,paddingBottom:8},area:{flex:1,minHeight:44,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'transparent',borderRadius:10,padding:6},areaText:{flexShrink:1,fontSize:13,fontWeight:'600',color:palette.muted,textAlign:'center'},
 root:{flex:1,backgroundColor:'#fff'},content:{flex:1},headerSafe:{backgroundColor:'#fff',borderBottomWidth:1,borderColor:'#d7e3e1'},header:{minHeight:60,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:2},brand:{flexGrow:1,flexShrink:1,flexBasis:0,minHeight:48,flexDirection:'row',gap:8,alignItems:'center'},logo:{width:34,height:34},brandText:{fontSize:19,fontWeight:'700',color:palette.teal,flexShrink:1},iconButton:{minWidth:46,minHeight:48,justifyContent:'center',alignItems:'center'},
 accountAction:{maxWidth:125,minHeight:46,borderWidth:1,borderColor:palette.border,borderRadius:10,paddingHorizontal:8,paddingVertical:5,flexDirection:'row',gap:6,alignItems:'center'},accountText:{fontSize:12,fontWeight:'700',color:palette.ink,flexShrink:1,textAlign:'center'},
 bottomSafe:{backgroundColor:'#fff',borderTopWidth:1,borderColor:'#d5e2df'},tabs:{flexDirection:'row',gap:3,padding:5},tab:{flex:1,minHeight:54,paddingVertical:6,paddingHorizontal:2,gap:3,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'transparent',borderRadius:11},tabText:{fontSize:11,fontWeight:'600',color:'#5d6c77',textAlign:'center'},active:{backgroundColor:'#e7f5f2',borderColor:'#b9ded9'},activeText:{color:'#0b5f62',fontWeight:'700'},
 modal:{flex:1,backgroundColor:'rgba(23,44,70,.16)',alignItems:'flex-end'},sheet:{width:'91%',maxWidth:390,flexGrow:1,flexShrink:1,flexBasis:0,backgroundColor:'#fff'},menuHeading:{flexShrink:0,minHeight:62,flexDirection:'row',paddingHorizontal:18,alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:palette.border},heading:{fontSize:22,fontWeight:'700',color:palette.ink},menuContent:{padding:14,gap:4,paddingBottom:24},workspaceName:{fontSize:19,fontWeight:'700',color:palette.ink,padding:10},section:{fontSize:13,fontWeight:'700',color:palette.muted,marginTop:14,marginBottom:6,paddingHorizontal:10},row:{minHeight:52,borderRadius:10,borderWidth:1,borderColor:'transparent',padding:12,flexDirection:'row',alignItems:'center',gap:12},rowText:{fontSize:16,color:palette.ink,flex:1},legal:{gap:8,marginVertical:14},
});
