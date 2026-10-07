import {useEffect,useState,type PropsWithChildren} from 'react';
import {Image,Keyboard,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router,useNavigation,usePathname,type Href} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import {languages} from '../localization/controller';
import {activeDestination,hasWorkspace,isWorkspace,publicDestinations,workspaceDestinations,workspaceMenu,type Destination} from '../navigation/destinations';
import {AppIcon,type IconName} from './app-icon';
import {ErrorText,palette} from './ui';
import {ExternalButton} from './public-details';

export function NavigationShell({children}:PropsWithChildren){
 const account=useAccount(),language=useLanguage(),{t}=language,path=usePathname();
 const [menu,setMenu]=useState<'all'|'language'|'area'|null>(null),[keyboard,setKeyboard]=useState(false),[signingOut,setSigningOut]=useState(false),[error,setError]=useState('');
 const areas=useNavigation<{navigate:(name:'(marketplace)'|'(workspace)')=>void}>('/');
 function switchArea(next:'(marketplace)'|'(workspace)'){setMenu(null);Keyboard.dismiss();areas.navigate(next);}
 const workspace=isWorkspace(path,account.session),active=activeDestination(path,workspace,account.session);
 const destinations=workspace?workspaceDestinations(account.session):publicDestinations;
 const primary=destinations.some(item=>item.href===path),member=hasWorkspace(account.session);
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboard(true)),hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(false));return()=>{show.remove();hide.remove();};},[]);
 function open(kind:'all'|'language'|'area'){Keyboard.dismiss();setError('');setMenu(kind);}
 function navigate(href:string){if(href==='#menu'){open('all');return;}setMenu(null);Keyboard.dismiss();if(path!==href)router.navigate(href as Href);}
 async function signOut(){if(signingOut)return;setSigningOut(true);setError('');try{await account.signOut();setMenu(null);router.replace('/account');}catch{setError(t('Sign-out could not finish. Please try again.'));}finally{setSigningOut(false);}}
 return <View style={styles.root}><StatusBar style="dark"/>
  <SafeAreaView edges={['top','left','right']} style={styles.headerSafe}><View style={styles.header}>
   {!primary&&<IconButton icon="back" label={t('Back')} onPress={()=>router.canGoBack()?router.back():navigate(workspace?'/account':'/')}/>}
   <Pressable accessibilityRole="button" accessibilityLabel={t(workspace?'Dashboard':'Capacity')} onPress={()=>navigate(workspace?'/account':'/')} style={[styles.brand,member&&{flexGrow:0,flexShrink:0,flexBasis:36,width:36,minWidth:36}]}><Image source={require('../../assets/loadgistic-icon.png')} style={styles.logo}/></Pressable>
   {member&&<Pressable accessibilityRole="button" accessibilityLabel={t('Switch view')} accessibilityValue={{text:t(workspace?'My workspace':'Marketplace')}} onPress={()=>open('area')} style={styles.areaControl}><Text numberOfLines={2} style={styles.areaText}>{t(workspace?'My workspace':'Marketplace')}</Text><View style={{transform:[{rotate:'90deg'}]}}><AppIcon name="next" size={16}/></View></Pressable>}
   {workspace&&<IconButton icon="help" label={t('Support')} onPress={()=>navigate('/support')}/>}
   <IconButton icon="language" label={t('Language')} onPress={()=>open('language')}/>
   {!member&&<Pressable accessibilityRole="button" onPress={()=>navigate('/account')} style={styles.accountAction}><AppIcon name={member?'home':'truck'} size={18} color={palette.teal}/><Text style={styles.accountText}>{t(member?'Dashboard':'Transporter login')}</Text></Pressable>}
   <IconButton icon="menu" label={t('Open menu')} onPress={()=>open('all')}/>
  </View></SafeAreaView>
  <View style={styles.content}>{children}</View>
  {!keyboard&&<SafeAreaView edges={['bottom','left','right']} style={styles.bottomSafe}><View style={styles.tabs} accessibilityRole="tablist">{destinations.map(item=><Pressable key={item.href} accessibilityRole="tab" accessibilityLabel={t(item.label)} accessibilityState={{selected:active===item.href}} onPress={()=>navigate(item.href)} style={[styles.tab,active===item.href&&styles.active]}><AppIcon name={item.icon} size={22} color={active===item.href?'#0b5f62':'#5d6c77'}/><Text style={[styles.tabText,active===item.href&&styles.activeText]}>{t(item.label)}</Text></Pressable>)}</View></SafeAreaView>}
  <Modal visible={menu!==null} transparent animationType="fade" onRequestClose={()=>setMenu(null)}><View style={styles.modal}>
   <Pressable style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no" onPress={()=>setMenu(null)}/>
   <SafeAreaView style={[styles.sheet,menu==='area'&&styles.areaSheet]} edges={['top','bottom','left','right']}><View style={styles.menuHeading}><Text style={styles.heading}>{t(menu==='area'?'Switch view':menu==='language'?'Language':'Menu')}</Text><IconButton icon="close" label={t('Close menu')} onPress={()=>setMenu(null)}/></View>
    <ScrollView style={menu==='area'?{flexGrow:0,flexShrink:1}:undefined} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.menuContent}>
     {menu==='area'?<>
      <MenuItem item={{href:'/',label:'Marketplace',icon:'map'}} active={!workspace} onPress={()=>switchArea('(marketplace)')}/>
      <MenuItem item={{href:'/account',label:'My workspace',icon:'truck'}} active={workspace} onPress={()=>switchArea('(workspace)')}/>
     </>:<>
     {menu==='all'&&<>
      {member&&<><Text style={styles.workspaceName}>{account.session!.user.organizationName||account.session!.user.businessName||account.session!.user.name}</Text><Text style={styles.section}>{t('Your workspace')}</Text>{workspaceMenu(account.session).map(item=><MenuItem key={item.href} item={item} active={path===item.href} onPress={()=>navigate(item.href)}/>)}</>}
      {!member&&<MenuItem item={{href:'/account',label:account.session?'Finish account setup':'Transporter login',icon:'truck'}} active={path==='/account'} onPress={()=>navigate('/account')}/>}
      <Text style={styles.section}>{t('Explore')}</Text>{publicDestinations.map(item=><MenuItem key={item.href} item={item} active={path===item.href} onPress={()=>navigate(item.href)}/>)}
      <MenuItem item={{href:'/arrange-transport',label:'Arrange transport',icon:'truck'}} active={path==='/arrange-transport'} onPress={()=>navigate('/arrange-transport')}/>
      <Text style={styles.section}>{t('Language')}</Text>
     </>}
     <ErrorText message={language.error}/>{languages.map(item=><Pressable key={item.code} accessibilityRole="radio" accessibilityState={{checked:item.code===language.locale,disabled:language.busy}} disabled={language.busy} onPress={()=>{void language.select(item.code);}} style={[styles.row,item.code===language.locale&&styles.active]}><AppIcon name="language"/><Text style={styles.rowText}>{item.name}</Text>{item.code===language.locale&&<AppIcon name="check" color={palette.teal}/>}</Pressable>)}
     {menu==='all'&&<><View style={styles.legal}><ExternalButton label={t('Privacy')} url="https://loadgistic.com/privacy"/><ExternalButton label={t('Terms')} url="https://loadgistic.com/terms"/></View>{account.session&&<><ErrorText message={error}/><Pressable accessibilityRole="button" accessibilityState={{disabled:signingOut,busy:signingOut}} disabled={signingOut} onPress={()=>{void signOut();}} style={styles.row}><AppIcon name="logout"/><Text style={styles.rowText}>{t('Sign out')}</Text></Pressable></>}</>}
     </>}
    </ScrollView>
   </SafeAreaView>
  </View></Modal>
 </View>;
}
function IconButton({icon,label,onPress}:{icon:IconName;label:string;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}><AppIcon name={icon} color={palette.teal}/></Pressable>;}
function MenuItem({item,active,onPress}:{item:Destination;active:boolean;onPress:()=>void}){const {t}=useLanguage();return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={[styles.row,active&&styles.active]}><AppIcon name={item.icon} color={active?palette.teal:palette.muted}/><Text style={[styles.rowText,active&&styles.activeText]}>{t(item.label)}</Text><AppIcon name="next" size={18}/></Pressable>;}
const styles=StyleSheet.create({
 areaControl:{flex:1,minWidth:0,minHeight:48,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:6},areaText:{flexShrink:1,fontSize:14,fontWeight:'700',color:palette.teal},areaSheet:{flexGrow:0,flexShrink:1,flexBasis:'auto',maxHeight:'80%',marginTop:70,borderRadius:16,paddingBottom:12},
 root:{flex:1,backgroundColor:'#fff'},content:{flex:1},headerSafe:{backgroundColor:'#fff',borderBottomWidth:1,borderColor:'#d7e3e1'},header:{minHeight:60,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:2},brand:{flexGrow:1,flexShrink:1,flexBasis:0,minHeight:48,flexDirection:'row',gap:8,alignItems:'center'},logo:{width:34,height:34},brandText:{fontSize:19,fontWeight:'700',color:palette.teal,flexShrink:1},iconButton:{minWidth:46,minHeight:48,justifyContent:'center',alignItems:'center'},
 accountAction:{maxWidth:125,minHeight:46,borderWidth:1,borderColor:palette.border,borderRadius:10,paddingHorizontal:8,paddingVertical:5,flexDirection:'row',gap:6,alignItems:'center'},accountText:{fontSize:12,fontWeight:'700',color:palette.ink,flexShrink:1,textAlign:'center'},
 bottomSafe:{backgroundColor:'#fff',borderTopWidth:1,borderColor:'#d5e2df'},tabs:{flexDirection:'row',gap:3,padding:5},tab:{flex:1,minHeight:54,paddingVertical:6,paddingHorizontal:2,gap:3,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'transparent',borderRadius:11},tabText:{fontSize:11,fontWeight:'600',color:'#5d6c77',textAlign:'center'},active:{backgroundColor:'#e7f5f2',borderColor:'#b9ded9'},activeText:{color:'#0b5f62',fontWeight:'700'},
 modal:{flex:1,backgroundColor:'rgba(23,44,70,.16)',alignItems:'flex-end'},sheet:{width:'91%',maxWidth:390,flexGrow:1,flexShrink:1,flexBasis:0,backgroundColor:'#fff'},menuHeading:{flexShrink:0,minHeight:62,flexDirection:'row',paddingHorizontal:18,alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:palette.border},heading:{fontSize:22,fontWeight:'700',color:palette.ink},menuContent:{padding:14,gap:4,paddingBottom:24},workspaceName:{fontSize:19,fontWeight:'700',color:palette.ink,padding:10},section:{fontSize:13,fontWeight:'700',color:palette.muted,marginTop:14,marginBottom:6,paddingHorizontal:10},row:{minHeight:52,borderRadius:10,borderWidth:1,borderColor:'transparent',padding:12,flexDirection:'row',alignItems:'center',gap:12},rowText:{fontSize:16,color:palette.ink,flex:1},legal:{gap:8,marginVertical:14},
});
