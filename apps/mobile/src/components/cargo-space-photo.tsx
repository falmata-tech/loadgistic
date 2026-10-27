import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Image,Modal,Platform,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {cargoPhotoCollectionPath,cargoPhotoReadPath,cargoPhotoUploadCommand} from '../api/cargo-space-photo-path';
import {uploadLimit} from '../api/upload';
import {useAccountQuery} from '../hooks/account-query';
import {useLanguage} from '../localization/provider';
import {blockChatReading} from '../session/chat-visibility';
import {useAccount} from '../session/provider';
import {uploadBody} from './private-file';
import {Button,Copy,ErrorText,LoadingSpinner,Page,Title,palette} from './ui';
import {WorkspaceSection} from './workspace-section';

type Photo={id:string;vehicleId:string;receivedAt:string;cameraCapturedAt?:string|null;source:'CAMERA'|'UPLOAD';contentPath:string};
type PhotoSummary={photo:Photo|null;requests:{id:string;workspaceId:string;requestedAt:string}[]};
type Picked={asset:ImagePicker.ImagePickerAsset;source:'CAMERA'|'UPLOAD';capturedAt?:string;actorId:string};
const imageTypes=['image/jpeg','image/png','image/webp'];
const photoSizeLimit=Math.ceil(uploadLimit/3)*4;
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Could not save the photo. Please try again.';

export function CargoSpacePhoto({vehicleId,assignedDriverId,initiallyOpen=false}:{vehicleId:string;assignedDriverId:string;initiallyOpen?:boolean}){
 const actorId=useAccount().session?.user.id||'';
 // A different actor, vehicle or assignment must never inherit a picked image.
 return <WorkspaceSection message="Cargo space photo" icon="camera" initiallyOpen={initiallyOpen}><PhotoPanel key={`${actorId}:${vehicleId}:${assignedDriverId}`} vehicleId={vehicleId} assignedDriverId={assignedDriverId}/></WorkspaceSection>;
}

function PhotoPanel({vehicleId,assignedDriverId}:{vehicleId:string;assignedDriverId:string}){
 const {t,locale}=useLanguage(),account=useAccount();
 const actorId=account.session?.user.id||'',canUpload=Boolean(actorId&&actorId===assignedDriverId);
 const query=useAccountQuery<PhotoSummary>(cargoPhotoCollectionPath(vehicleId));
 const [picked,setPicked]=useState<Picked|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[imageData,setImageData]=useState<string|null>(null),[opening,setOpening]=useState(false);
 const locked=useRef(false),generation=useRef(0),focused=useRef(false),blocker=useRef({});
 useFocusEffect(useCallback(()=>{focused.current=true;return()=>{focused.current=false;generation.current++;setImageData(null);setPicked(null);};},[]));
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state!=='active'){generation.current++;setImageData(null);}});return()=>listener.remove();},[]);
 useEffect(()=>{const source=blocker.current;blockChatReading(source,Boolean(imageData));return()=>blockChatReading(source,false);},[imageData]);
 const date=(value:string)=>new Date(value).toLocaleString(locale==='om'?'en-ET':locale);

 async function choose(source:'CAMERA'|'UPLOAD'){
  if(locked.current||!canUpload)return;
  locked.current=true;setBusy(true);setError('');
  try{
   // Web pickers must open directly from the button press to retain user activation.
   if(source==='CAMERA'&&Platform.OS!=='web'){
    const permission=await ImagePicker.requestCameraPermissionsAsync();
    if(!permission.granted)throw new Error('Allow camera access to take a photo.');
   }
   const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],allowsEditing:false,quality:0.75,exif:false,base64:false};
   const result=source==='CAMERA'?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
   if(result.canceled)return;
   const asset=result.assets[0];
   if(!asset||asset.type&&asset.type!=='image'||asset.mimeType&&!imageTypes.includes(asset.mimeType)||asset.fileSize&&asset.fileSize>uploadLimit)throw new Error('Choose a JPG, PNG or WebP photo under 4 MB.');
   if(focused.current&&account.session?.user.id===actorId)setPicked({asset,source,actorId,...source==='CAMERA'?{capturedAt:new Date().toISOString()}:{}});
  }catch(caught){if(focused.current)setError(errorMessage(caught));}
  finally{locked.current=false;setBusy(false);}
 }

 async function save(){
  if(locked.current||!picked||!canUpload||picked.actorId!==actorId)return;
  locked.current=true;setBusy(true);setError('');
  try{
   const {asset,source,capturedAt}=picked;
   const body=uploadBody(cargoPhotoUploadCommand(vehicleId,source,capturedAt),{uri:asset.uri,name:asset.fileName||`cargo-space-${Date.now()}.jpg`,type:asset.mimeType||asset.file?.type||'',size:asset.fileSize||asset.file?.size||0,webFile:asset.file});
   await account.request('/api/capacity/cargo-space-photos',body);
   if(focused.current&&account.session?.user.id===actorId){setPicked(null);await query.reload();}
  }catch(caught){if(focused.current)setError(errorMessage(caught));}
  finally{locked.current=false;setBusy(false);}
 }

 async function openPhoto(){
  const photo=query.data?.photo;
  if(locked.current||!photo)return;
  locked.current=true;setOpening(true);setError('');const version=++generation.current;
  try{
   const result=await account.request(cargoPhotoReadPath(photo.contentPath)) as {mimeType?:unknown;base64?:unknown};
   if(result.mimeType!=='image/jpeg'||typeof result.base64!=='string'||!result.base64||result.base64.length>photoSizeLimit)throw new Error('This photo cannot be opened.');
   if(focused.current&&generation.current===version&&(Platform.OS==='web'||AppState.currentState==='active'))setImageData(`data:image/jpeg;base64,${result.base64}`);
  }catch(caught){if(focused.current&&generation.current===version)setError(errorMessage(caught));}
  finally{locked.current=false;setOpening(false);}
 }

 return <View style={{gap:12}} testID="cargo-space-photo-section">
  {query.loading&&<LoadingSpinner accessibilityLabel={t('Loading photo')}/>}
  <ErrorText message={query.error?t(query.error):''}/>
  {!!query.error&&<Button secondary message="Refresh" onPress={()=>{void query.reload();}}/>}
  {query.data?.requests.length?<Copy message="New photo requested"/>:null}
  {query.data?.photo?<View style={{gap:8}}><Copy>{t('Photo received {date}',{date:date(query.data.photo.receivedAt)})}</Copy><Button secondary message="Open photo" busy={opening} onPress={()=>{void openPhoto();}}/></View>:query.data?<Copy message="No photo yet"/>:null}
  {canUpload&&!picked&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><View style={{flexGrow:1,minWidth:130}}><Button message="Take photo" busy={busy} onPress={()=>{void choose('CAMERA');}}/></View><View style={{flexGrow:1,minWidth:130}}><Button secondary message="Choose photo" disabled={busy} onPress={()=>{void choose('UPLOAD');}}/></View></View>}
  {canUpload&&picked&&<View style={{gap:10}}><Image accessibilityLabel={t('Selected cargo space photo')} source={{uri:picked.asset.uri}} resizeMode="cover" style={{width:'100%',height:170,borderRadius:10,borderWidth:1,borderColor:palette.border}}/><View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Button message="Save photo" busy={busy} onPress={()=>{void save();}}/></View><View style={{flex:1}}><Button secondary message="Cancel" disabled={busy} onPress={()=>setPicked(null)}/></View></View></View>}
  <ErrorText message={error?t(error):''}/>
  <Modal visible={Boolean(imageData)} animationType="slide" onRequestClose={()=>setImageData(null)}><SafeAreaView style={{flex:1}}><Page><Title message="Cargo space photo"/><Button secondary message="Close photo" onPress={()=>setImageData(null)}/>{imageData?<Image accessibilityLabel={t('Cargo space photo')} source={{uri:imageData}} resizeMode="contain" style={{width:'100%',height:520}}/>:null}</Page></SafeAreaView></Modal>
 </View>;
}
